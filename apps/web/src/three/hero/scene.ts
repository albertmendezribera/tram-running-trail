import * as THREE from 'three/webgpu';
import { attribute, float, fract, fwidth, max, mix, positionLocal, smoothstep, uniform, vec3 } from 'three/tsl';
import type { Scene, SceneContext } from '@tram/design-system/interactive/viewer-3d-shell.ts';
import { createStage } from '../core/stage.ts';
import { loadHeights, type TerrainMeta } from '../route-viewer/heights.ts';
import { watchPalette } from '../route-viewer/palette.ts';

/** The plan of a town as lines (`hero-cli`): metres from its south-west corner, north up; each line is x, y, x, y… */
export interface TownPlan {
  widthM: number;
  heightM: number;
  blocks: ReadonlyArray<ReadonlyArray<number>>;
  coast: ReadonlyArray<ReadonlyArray<number>>;
  route: ReadonlyArray<ReadonlyArray<number>>;
}

export interface HeroOptions {
  plan: TownPlan;
  terrainUrl: string;
  terrain: TerrainMeta;
  /** The route on the mountain, in metres east and north of the south-west corner of its terrain. */
  route: ReadonlyArray<readonly [number, number]>;
  /** How far the passage has gone, 0–1. */
  progress?: number;
}

export interface HeroScene extends Scene {
  /** 0 is the plan of the town; 1, the relief of the mountain. */
  setProgress(progress: number): void;
}

const EASE_MS = 140;
/** Heights are drawn taller than they are: a plan turned into relief has to read at a glance. */
const EXAGGERATION = 1.7;
/** The route is this wide on the ground, in metres of the terrain: about three pixels of a phone. */
const ROUTE_HALF_M = 13;
const ROUTE_POINTS = 420;
/** A line of the plan is cut so it lies on the ground it is laid over, and not through a hill. */
const DRAPE_M = 28;
const CONTOUR_M = 20;
const CONTOUR_MAJOR_M = 100;

const ease = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** A line as so many points, evenly spaced along it. */
function resampled(line: ReadonlyArray<readonly [number, number]>, count: number): Array<[number, number]> {
  const lengths = [0];
  for (let i = 1; i < line.length; i++) lengths.push(lengths[i - 1]! + Math.hypot(line[i]![0] - line[i - 1]![0], line[i]![1] - line[i - 1]![1]));
  const total = lengths.at(-1)!;
  const out: Array<[number, number]> = [];
  let k = 1;
  for (let i = 0; i < count; i++) {
    const at = (i / (count - 1)) * total;
    while (k < line.length - 1 && lengths[k]! < at) k++;
    const t = (at - lengths[k - 1]!) / (lengths[k]! - lengths[k - 1]! || 1);
    out.push([line[k - 1]![0] + (line[k]![0] - line[k - 1]![0]) * t, line[k - 1]![1] + (line[k]![1] - line[k - 1]![1]) * t]);
  }
  return out;
}

/**
 * M1, "De la quadrícula a la corba de nivell": the plan of a town laid flat, which the scroll turns into
 * the relief of a mountain. The ground rises, the contour lines come in from the valley up and take the
 * place of the streets, the route of the town becomes the route of the mountain, and the view tips from
 * straight overhead to the side. Every line is data: the blocks and the shore of the town, the elevation
 * model of the mountain, the two tracks. The first frame is the poster the page already shows.
 */
export async function mountHero({ container, signal, reducedMotion }: SceneContext, o: HeroOptions): Promise<HeroScene> {
  const { data, width, height } = await loadHeights(o.terrainUrl, o.terrain, signal);
  const sizeX = o.terrain.cols * o.terrain.cell;
  const sizeZ = o.terrain.rows * o.terrain.cell;
  const span = o.terrain.max - o.terrain.min;
  /** Height over the lowest point of the terrain, in metres, at a point of it. */
  const liftAt = (x: number, y: number): number => {
    const c = Math.min(width - 1.001, Math.max(0, (x / sizeX) * (width - 1)));
    const r = Math.min(height - 1.001, Math.max(0, ((sizeZ - y) / sizeZ) * (height - 1)));
    const [c0, r0] = [Math.floor(c), Math.floor(r)];
    const at = (cc: number, rr: number): number => data[rr * width + cc]! - o.terrain.min;
    const north = at(c0, r0) + (at(c0 + 1, r0) - at(c0, r0)) * (c - c0);
    const south = at(c0, r0 + 1) + (at(c0 + 1, r0 + 1) - at(c0, r0 + 1)) * (c - c0);
    return north + (south - north) * (r - r0);
  };

  const rise = uniform(0);
  /** Up to this height the contour lines are in; above it, the streets still are. */
  const reveal = uniform(-1e4);
  const tone = { paper: uniform(new THREE.Color()), low: uniform(new THREE.Color()), high: uniform(new THREE.Color()), contour: uniform(new THREE.Color()), water: uniform(new THREE.Color()), route: uniform(new THREE.Color()) };
  const lifted = attribute('lift', 'float');
  const stand = (extra: number) => vec3(positionLocal.x, lifted.mul(rise).mul(EXAGGERATION).add(extra), positionLocal.z);

  // ── The ground: one vertex to each cell of the model, flat until the scroll raises it.
  const positions = new Float32Array(width * height * 3);
  const lifts = new Float32Array(width * height);
  const slopes = new Float32Array(width * height * 2);
  const index: number[] = [];
  const cellX = sizeX / (width - 1);
  const cellZ = sizeZ / (height - 1);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const i = r * width + c;
      positions.set([c * cellX, 0, -(sizeZ - r * cellZ)], i * 3);
      lifts[i] = data[i]! - o.terrain.min;
      // How the ground climbs to the east and to the south, for the shade a slope has.
      slopes.set([(data[r * width + Math.min(width - 1, c + 1)]! - data[r * width + Math.max(0, c - 1)]!) / (2 * cellX), (data[Math.min(height - 1, r + 1) * width + c]! - data[Math.max(0, r - 1) * width + c]!) / (2 * cellZ)], i * 2);
      if (r < height - 1 && c < width - 1) index.push(i, i + width, i + 1, i + 1, i + width, i + width + 1);
    }
  }
  const ground = new THREE.BufferGeometry();
  ground.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  ground.setAttribute('lift', new THREE.BufferAttribute(lifts, 1));
  ground.setAttribute('slope', new THREE.BufferAttribute(slopes, 2));
  ground.setIndex(index);
  const groundMaterial = new THREE.MeshBasicNodeMaterial();
  groundMaterial.positionNode = stand(0);
  const contourLine = (interval: number, widthPx: number) => {
    const level = lifted.add(o.terrain.min).div(interval);
    const f = fract(level);
    const w = fwidth(level).mul(widthPx);
    return max(smoothstep(w, float(0), f), smoothstep(float(1).sub(w), float(1), f));
  };
  // A slope facing the light is paler than one turned from it: light from the north-west, as on a printed map.
  const slope = attribute('slope', 'vec2');
  const facing = vec3(slope.x.negate().mul(rise).mul(EXAGGERATION), 1, slope.y.negate().mul(rise).mul(EXAGGERATION)).normalize().dot(vec3(-0.45, 0.78, -0.43));
  const shade = facing.sub(0.78).mul(0.55).add(1).clamp(0.82, 1.08);
  const tinted = mix(tone.low, tone.high, lifted.div(span).clamp(0, 1)).mul(shade);
  const lines = max(contourLine(CONTOUR_M, 1).mul(0.5), contourLine(CONTOUR_MAJOR_M, 1.6));
  // Under the height the passage has reached, relief and its contour lines; above it, the paper of the plan.
  const drawn = smoothstep(reveal, reveal.sub(span * 0.04 + 1), lifted);
  groundMaterial.colorNode = mix(tone.paper, mix(tinted, tone.contour, lines), drawn);
  const terrain = new THREE.Mesh(ground, groundMaterial);
  terrain.frustumCulled = false;

  // ── The plan of the town, laid over the terrain at its own scale: its lines follow the ground as it rises
  // and go out where the contour lines have come in.
  const scale = sizeX / o.plan.widthM;
  const draped = (linesOf: ReadonlyArray<ReadonlyArray<number>>, colour: typeof tone.contour, widthPx: number): THREE.LineSegments => {
    const at: number[] = [];
    const lift: number[] = [];
    const put = (x: number, y: number): void => {
      at.push(x, 0, -y);
      lift.push(liftAt(x, y));
    };
    for (const line of linesOf) {
      for (let i = 2; i + 1 < line.length; i += 2) {
        const [ax, ay, bx, by] = [line[i - 2]! * scale, line[i - 1]! * scale, line[i]! * scale, line[i + 1]! * scale];
        const pieces = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / DRAPE_M));
        for (let k = 0; k < pieces; k++) {
          put(ax + ((bx - ax) * k) / pieces, ay + ((by - ay) * k) / pieces);
          put(ax + ((bx - ax) * (k + 1)) / pieces, ay + ((by - ay) * (k + 1)) / pieces);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(at, 3));
    geometry.setAttribute('lift', new THREE.Float32BufferAttribute(lift, 1));
    const material = new THREE.LineBasicNodeMaterial({ transparent: true, depthTest: false, linewidth: widthPx });
    material.positionNode = stand(3);
    material.colorNode = colour;
    material.opacityNode = smoothstep(reveal.sub(span * 0.02), reveal.add(span * 0.04 + 1), lifted);
    const segments = new THREE.LineSegments(geometry, material);
    segments.frustumCulled = false;
    segments.renderOrder = 1;
    return segments;
  };
  const blocks = draped(o.plan.blocks, tone.contour, 1);
  const coast = draped(o.plan.coast, tone.water, 1);

  // ── The route: the one of the town turns into the one of the mountain, point by point along both.
  const town = resampled(
    Array.from({ length: (o.plan.route[0]?.length ?? 0) / 2 }, (_, i): [number, number] => [o.plan.route[0]![i * 2]! * scale, o.plan.route[0]![i * 2 + 1]! * scale]),
    ROUTE_POINTS,
  );
  const mountain = resampled(o.route, ROUTE_POINTS);
  const ribbon = new THREE.BufferGeometry();
  const ribbonAt = new THREE.BufferAttribute(new Float32Array(ROUTE_POINTS * 2 * 3), 3);
  ribbon.setAttribute('position', ribbonAt);
  ribbon.setIndex(Array.from({ length: ROUTE_POINTS - 1 }, (_, i) => [i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2]).flat());
  const routeMaterial = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, depthTest: false });
  routeMaterial.colorNode = tone.route;
  const routeMesh = new THREE.Mesh(ribbon, routeMaterial);
  routeMesh.frustumCulled = false;
  routeMesh.renderOrder = 2;
  const along = new Float32Array(ROUTE_POINTS * 2);
  const layRoute = (turned: number, raised: number): void => {
    for (let i = 0; i < ROUTE_POINTS; i++) along.set([town[i]![0] + (mountain[i]![0] - town[i]![0]) * turned, town[i]![1] + (mountain[i]![1] - town[i]![1]) * turned], i * 2);
    for (let i = 0; i < ROUTE_POINTS; i++) {
      const [from, to] = [Math.max(0, i - 1), Math.min(ROUTE_POINTS - 1, i + 1)];
      const [tx, ty] = [along[to * 2]! - along[from * 2]!, along[to * 2 + 1]! - along[from * 2 + 1]!];
      const length = Math.hypot(tx, ty) || 1;
      for (const side of [1, -1]) {
        const [x, y] = [along[i * 2]! + (-ty / length) * ROUTE_HALF_M * side, along[i * 2 + 1]! + (tx / length) * ROUTE_HALF_M * side];
        ribbonAt.setXYZ(i * 2 + (side > 0 ? 0 : 1), x, liftAt(x, y) * raised * EXAGGERATION + 6, -y);
      }
    }
    ribbonAt.needsUpdate = true;
  };

  const scene = new THREE.Scene();
  const background = new THREE.Color();
  scene.background = background;
  scene.add(terrain, blocks, coast, routeMesh);

  // Seen without perspective, as a plan is: straight down first, then from the south and from one side.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 60000);
  const centre = new THREE.Vector3(sizeX / 2, 0, -sizeZ / 2);
  const frame = { width: 1, height: 1 };
  const view = (tilt: number): void => {
    // The plan fills the frame exactly as its poster does: whole, and as large as it fits.
    const half = Math.max(sizeZ / 2, sizeX / 2 / (frame.width / frame.height)) * (1 + 0.2 * tilt);
    Object.assign(camera, { left: -half * (frame.width / frame.height), right: half * (frame.width / frame.height), top: half, bottom: -half });
    camera.updateProjectionMatrix();
    const pitch = THREE.MathUtils.degToRad(89.9 - 46 * tilt);
    const turn = THREE.MathUtils.degToRad(-26 * tilt);
    const target = centre.clone().setY(span * EXAGGERATION * 0.32 * tilt);
    camera.position.set(target.x + Math.sin(turn) * Math.cos(pitch) * 20000, target.y + Math.sin(pitch) * 20000, target.z + Math.cos(turn) * Math.cos(pitch) * 20000);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  };

  let wanted = Math.min(1, Math.max(0, o.progress ?? 0));
  let shown = wanted;
  let last = 0;
  const stage = await createStage(container, {
    resize(w, h) {
      frame.width = w;
      frame.height = h;
    },
    frame() {
      const now = performance.now();
      const k = reducedMotion ? 1 : 1 - Math.exp(-(last ? Math.min(100, now - last) : 16) / EASE_MS);
      shown += (wanted - shown) * k;
      if (Math.abs(wanted - shown) < 1e-4) shown = wanted;
      const settled = shown === wanted;
      // The ground rises first, the contour lines climb it, the route turns, and the view tips all the while.
      rise.value = ease(0.08, 0.7, shown);
      // It starts under the lowest ground, so that at first every street is whole, and ends over the highest.
      reveal.value = -(span * 0.06 + 3) + (span * 1.14 + 5) * ease(0.14, 0.86, shown);
      layRoute(ease(0.2, 0.84, shown), rise.value);
      view(ease(0.1, 0.92, shown));
      stage.renderer.render(scene, camera);
      stage.canvas.dataset['progress'] = shown.toFixed(3);
      last = settled ? 0 : now;
      return !settled;
    },
  });
  if (signal.aborted) {
    stage.dispose();
    throw signal.reason;
  }
  stage.canvas.dataset['engine'] = `three-hero-${stage.backend}`;

  const local = new AbortController();
  watchPalette(container, local.signal, (c) => {
    const set = (colour: THREE.Color, name: keyof typeof c): void => void colour.setRGB(...c[name].linear);
    set(background, 'surface');
    set(tone.paper.value, 'surface');
    set(tone.low.value, 'surface-alt');
    // The top of the hypsometric scale, as in the cartographic view: the surface, a third of the way to the contour colour.
    const [low, contour] = [c['surface-alt'].srgb, c['map-contour'].srgb];
    tone.high.value.setRGB(low[0] + (contour[0] - low[0]) * 0.3, low[1] + (contour[1] - low[1]) * 0.3, low[2] + (contour[2] - low[2]) * 0.3, THREE.SRGBColorSpace);
    set(tone.contour.value, 'map-contour');
    set(tone.water.value, 'map-water');
    set(tone.route.value, 'data-primary');
    stage.invalidate();
  });

  return {
    setProgress(progress) {
      wanted = Math.min(1, Math.max(0, progress));
      stage.invalidate();
    },
    setActive: (active) => stage.setActive(active),
    // Without motion, or by keyboard, the passage is taken a quarter at a time.
    step(direction) {
      wanted = Math.min(1, Math.max(0, Math.round((wanted + direction * 0.25) * 4) / 4));
      stage.invalidate();
    },
    dispose() {
      local.abort();
      stage.dispose();
      for (const object of [terrain, blocks, coast, routeMesh]) {
        object.geometry.dispose();
        (object.material as THREE.Material).dispose();
      }
    },
  };
}
