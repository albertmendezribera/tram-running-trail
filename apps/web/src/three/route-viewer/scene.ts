import * as THREE from 'three/webgpu';
import { float, fract, fwidth, max, mix, normalLocal, positionLocal, smoothstep, uniform } from 'three/tsl';
import type { Scene, SceneContext } from '@tram/design-system/interactive/viewer-3d-shell.ts';
import { createStage } from '../core/stage.ts';
import { loadHeights, type TerrainMeta } from './heights.ts';
import { watchPalette } from './palette.ts';

export interface RouteViewerOptions {
  /** Terrain-RGB image from `@tram/terrain-pipeline`. */
  terrainUrl: string;
  terrain: TerrainMeta;
  /** Route in metres east and north of the south-west corner of the terrain. */
  route: ReadonlyArray<readonly [number, number]>;
  /** Vertical exaggeration, ×1 to ×2.5 (CLAUDE.md 8.1). */
  exaggeration?: number;
  /** Where the runner starts, as a share of the route (0–1). */
  share?: number;
  /** Arrow keys: the page decides what one step is and returns the text to announce. */
  onStep?(direction: -1 | 1): string | void;
  /** Places to label on the terrain. `km` markers only show from close by. */
  marks?: ReadonlyArray<RouteMark>;
  /** The pointer is over a share of the route (null: it left). */
  onPoint?(share: number | null): void;
  /** A click or a tap on a share of the route. */
  onPick?(share: number): void;
}

export interface RouteMark {
  share: number;
  text: string;
  kind: 'km' | 'place';
}

export interface RouteViewer extends Scene {
  /** Moves the runner and the camera to a share of the route (0–1). */
  setShare(share: number): void;
  /** Marks a share of the route that another view points at, without moving the camera (null: none). */
  setPreview(share: number | null): void;
}

/** Follow camera, in metres: behind and above the runner, looking down the route. */
const FOLLOW = { back: 420, up: 260, ahead: 0.04, clearance: 60 };
/** Seconds-scale smoothing of the camera, in milliseconds. Off with reduced motion. */
const EASE_MS = 110;
const RADIAL = 6;
/** Kilometre markers show within this distance of the camera, in metres: the overview stays clean. */
const KM_MARK_RANGE = 1800;
/** How close to the route the pointer has to be to point at it, in CSS pixels. */
const POINT_RADIUS = 28;

const ease = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * Route viewer, cartographic style (E02): hypsometric tint, relief shading and
 * contour lines every 10 m, with the route draped on the terrain. Every colour
 * comes from the design tokens. It draws only when the position changes.
 */
export async function mountRouteViewer({ container, signal, reducedMotion }: SceneContext, o: RouteViewerOptions): Promise<RouteViewer> {
  const exaggeration = Math.min(2.5, Math.max(1, o.exaggeration ?? 1.5));
  const { data, width, height } = await loadHeights(o.terrainUrl, o.terrain, signal);
  const sizeX = o.terrain.cols * o.terrain.cell;
  const sizeZ = o.terrain.rows * o.terrain.cell;
  const lift = (elevation: number): number => (elevation - o.terrain.min) * exaggeration;

  // Terrain: one vertex per cell, north at −z.
  const ground = new THREE.PlaneGeometry(sizeX, sizeZ, width - 1, height - 1);
  ground.rotateX(-Math.PI / 2);
  const position = ground.attributes['position']!;
  for (let i = 0; i < position.count; i++) position.setY(i, lift(data[i]!));
  ground.computeVertexNormals();

  const tone = {
    low: uniform(new THREE.Color()),
    high: uniform(new THREE.Color()),
    contour: uniform(new THREE.Color()),
  };
  const terrainMaterial = new THREE.MeshStandardNodeMaterial({ roughness: 1, metalness: 0 });
  const elevation = positionLocal.y.div(exaggeration).add(o.terrain.min);
  const t = elevation.sub(o.terrain.min).div(o.terrain.max - o.terrain.min).clamp(0, 1);
  // Hypsometric tint: from the surface towards the contour colour as the ground rises.
  const tint = mix(tone.low, tone.high, smoothstep(0, 1, t));
  const contourLine = (interval: number, widthPx: number) => {
    const h = elevation.div(interval);
    const f = fract(h);
    const w = fwidth(h).mul(widthPx);
    return max(smoothstep(w, float(0), f), smoothstep(float(1).sub(w), float(1), f));
  };
  // On near-flat ground a 10 m contour is mostly noise from the model: fade it out there.
  const flat = smoothstep(0.985, 0.998, normalLocal.y);
  const minor = contourLine(10, 1).mul(float(1).sub(flat));
  const major = contourLine(50, 1.8).mul(float(1).sub(flat.mul(0.7)));
  terrainMaterial.colorNode = mix(mix(tint, tone.contour, minor.mul(0.55)), tone.contour, major);
  const terrain = new THREE.Mesh(ground, terrainMaterial);
  terrain.position.set(sizeX / 2, 0, -sizeZ / 2);

  /** Height of the drawn terrain at a point, in scene units. */
  const groundAt = (x: number, y: number): number => {
    const c = Math.min(width - 1, Math.max(0, (x / sizeX) * (width - 1)));
    const r = Math.min(height - 1, Math.max(0, ((sizeZ - y) / sizeZ) * (height - 1)));
    const c0 = Math.min(width - 2, Math.floor(c));
    const r0 = Math.min(height - 2, Math.floor(r));
    const at = (cc: number, rr: number): number => data[rr * width + cc]!;
    const north = at(c0, r0) + (at(c0 + 1, r0) - at(c0, r0)) * (c - c0);
    const south = at(c0, r0 + 1) + (at(c0 + 1, r0 + 1) - at(c0, r0 + 1)) * (c - c0);
    return lift(north + (south - north) * (r - r0));
  };

  // Route: the real track, a few metres above the ground so it never sinks into it.
  const stride = Math.max(1, Math.round(o.route.length / 540));
  const track = o.route.filter((_, i) => i % stride === 0 || i === o.route.length - 1);
  const curve = new THREE.CatmullRomCurve3(track.map(([x, y]) => new THREE.Vector3(x, groundAt(x, y) + 4 * exaggeration, -y)));
  curve.arcLengthDivisions = track.length * 4;
  // The page counts kilometres on the map, not along the exaggerated relief.
  const run = [0];
  for (let i = 1; i < track.length; i++) run.push(run[i - 1]! + Math.hypot(track[i]![0] - track[i - 1]![0], track[i]![1] - track[i - 1]![1]));
  const total = run.at(-1)!;
  /** Curve parameter of a share of the route's map distance. */
  const along = (share: number): number => {
    const d = Math.min(1, Math.max(0, share)) * total;
    let i = Math.min(track.length - 2, Math.floor((d / total) * (track.length - 1)));
    while (i > 0 && run[i]! > d) i--;
    while (i < track.length - 2 && run[i + 1]! < d) i++;
    const span = run[i + 1]! - run[i]!;
    return (i + (span > 0 ? (d - run[i]!) / span : 0)) / (track.length - 1);
  };
  const lengths = curve.getLengths();
  /** Share of the tube's length at a curve parameter: tubes are built by arc length. */
  const tubeShare = (u: number): number => {
    const f = u * (lengths.length - 1);
    const i = Math.min(lengths.length - 2, Math.floor(f));
    return (lengths[i]! + (lengths[i + 1]! - lengths[i]!) * (f - i)) / lengths.at(-1)!;
  };

  const tubular = track.length * 3;
  // Seen from far away the route would thin out to nothing: it swells with the distance.
  const swell = uniform(1);
  const swollen = (radius: number): THREE.MeshBasicNodeMaterial => {
    const material = new THREE.MeshBasicNodeMaterial();
    material.positionNode = positionLocal.add(normalLocal.mul(swell.sub(1).mul(radius)));
    return material;
  };
  const aheadMaterial = swollen(3);
  const doneMaterial = swollen(4.5);
  const aheadTube = new THREE.Mesh(new THREE.TubeGeometry(curve, tubular, 3, RADIAL), aheadMaterial);
  const doneTube = new THREE.Mesh(new THREE.TubeGeometry(curve, tubular, 4.5, RADIAL), doneMaterial);

  // The runner: signal colour with its mandatory outline (E09), as a back-face shell.
  const activeMaterial = new THREE.MeshBasicNodeMaterial();
  const outlineMaterial = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide });
  const runner = new THREE.Group();
  runner.add(new THREE.Mesh(new THREE.SphereGeometry(13, 24, 16), activeMaterial), new THREE.Mesh(new THREE.SphereGeometry(17, 24, 16), outlineMaterial));
  // Where another view points: a hollow dot, quieter than the runner.
  const hollowMaterial = new THREE.MeshBasicNodeMaterial();
  const pointer = new THREE.Group();
  pointer.add(new THREE.Mesh(new THREE.SphereGeometry(8, 20, 12), hollowMaterial), new THREE.Mesh(new THREE.SphereGeometry(12, 20, 12), outlineMaterial));
  pointer.visible = false;

  const scene = new THREE.Scene();
  const background = new THREE.Color();
  scene.background = background;
  scene.add(terrain, aheadTube, doneTube, runner, pointer);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-1, 1.4, -1).multiplyScalar(4000); // from the north-west, as on a map
  scene.add(sun, new THREE.HemisphereLight(0xffffff, 0xffffff, 1.1));

  const camera = new THREE.PerspectiveCamera(35, 1, 10, 60000);
  const centre = new THREE.Vector3(sizeX / 2, lift(o.terrain.max) * 0.3, -sizeZ / 2);
  const corners = [0, sizeX].flatMap((x) => [0, -sizeZ].flatMap((z) => [0, lift(o.terrain.max)].map((y) => new THREE.Vector3(x, y, z))));
  const probe = new THREE.Vector3();
  const overview = new THREE.Vector3();
  const here = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const behind = new THREE.Vector3();
  const wantedHeading = new THREE.Vector3();
  const heading = new THREE.Vector3();
  const follow = new THREE.Vector3();
  const target = new THREE.Vector3();

  // Labels are HTML over the canvas, styled by Viewer3DShell: crisp type, the same tokens.
  const labels = document.createElement('div');
  labels.dataset['sceneLabels'] = '';
  labels.setAttribute('aria-hidden', 'true');
  const marks = (o.marks ?? []).map((mark) => {
    const element = document.createElement('div');
    element.dataset['sceneLabel'] = mark.kind;
    const text = document.createElement('span');
    text.dataset['type'] = mark.kind === 'km' ? 'data-sm' : 'text-xs';
    text.textContent = mark.text;
    element.append(text);
    element.hidden = true;
    labels.append(element);
    return { ...mark, element, at: curve.getPoint(along(mark.share)) };
  });
  const size = { width: 1, height: 1 };
  const screen = new THREE.Vector3();
  const ray = new THREE.Vector3();
  /** True when the terrain stands between the camera and a point. */
  const hidden = (point: THREE.Vector3): boolean => {
    for (let i = 1; i <= 24; i++) {
      ray.lerpVectors(camera.position, point, i / 25);
      if (groundAt(ray.x, -ray.z) > ray.y + 2) return true;
    }
    return false;
  };
  const placeLabels = (): void => {
    for (const mark of marks) {
      screen.copy(mark.at).project(camera);
      const far = mark.kind === 'km' && camera.position.distanceTo(mark.at) > KM_MARK_RANGE;
      const show = !far && screen.z < 1 && Math.abs(screen.x) < 1 && Math.abs(screen.y) < 1 && !hidden(mark.at);
      mark.element.hidden = !show;
      if (show) mark.element.style.transform = `translate(${((screen.x + 1) / 2) * size.width}px, ${((1 - screen.y) / 2) * size.height}px) translate(-50%, -100%)`;
    }
  };

  /** Places runner and camera at a share of the route. Returns true once the camera has settled. */
  const place = (share: number, k: number): boolean => {
    curve.getPoint(along(share), here);
    curve.getPoint(along(share + FOLLOW.ahead), ahead);
    curve.getPoint(along(share - FOLLOW.ahead / 2), behind);
    wantedHeading.subVectors(ahead, behind).setY(0);
    if (wantedHeading.lengthSq() > 1) wantedHeading.normalize();
    else wantedHeading.copy(heading);
    // The heading eases on its own: a hairpin turns the camera, it does not flip it.
    if (heading.lengthSq() === 0 || k >= 1) heading.copy(wantedHeading);
    else heading.lerp(wantedHeading, k * 0.5).normalize();
    const settled = heading.dot(wantedHeading) > 0.99995;
    if (settled) heading.copy(wantedHeading);

    follow.copy(here).addScaledVector(heading, -FOLLOW.back);
    follow.y = Math.max(here.y + FOLLOW.up, groundAt(follow.x, -follow.z) + FOLLOW.clearance);
    // Start and finish show the whole route; in between the camera runs with the runner.
    const near = ease(0, 0.03, share) * (1 - ease(0.97, 1, share));
    camera.position.lerpVectors(overview, follow, near);
    target.copy(here).lerp(ahead, 0.35);
    target.lerpVectors(centre, target, near);
    camera.lookAt(target);

    // On top of the line, so a slope never swallows half of it.
    runner.position.copy(here).y += 9;
    swell.value = 1 + Math.max(0, camera.position.distanceTo(here) / 480 - 1) * 0.45;
    runner.scale.setScalar(swell.value);
    pointer.scale.setScalar(1 + Math.max(0, camera.position.distanceTo(pointer.position) / 480 - 1) * 0.45);
    camera.updateMatrixWorld();
    placeLabels();
    doneTube.geometry.setDrawRange(0, Math.round(tubeShare(along(share)) * tubular) * RADIAL * 6);
    return settled;
  };

  let wanted = Math.min(1, Math.max(0, o.share ?? 0));
  let shown = wanted;
  let last = 0;
  const stage = await createStage(container, {
    resize(w, h) {
      size.width = w;
      size.height = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // Overview: the closest point that holds the whole terrain, with its long side across a wide frame.
      const fromEast = sizeZ > sizeX === camera.aspect > 1;
      const holds = (distance: number): boolean => {
        camera.position.set(fromEast ? 0.78 : 0.32, 0.5, fromEast ? 0.32 : 0.78).normalize().multiplyScalar(distance).add(centre);
        camera.lookAt(centre);
        camera.updateMatrixWorld();
        return corners.every((corner) => {
          probe.copy(corner).project(camera);
          return Math.abs(probe.x) <= 0.94 && Math.abs(probe.y) <= 0.94;
        });
      };
      let near = 500;
      let far = 40000;
      for (let i = 0; i < 18; i++) {
        const middle = (near + far) / 2;
        if (holds(middle)) far = middle;
        else near = middle;
      }
      holds(far);
      overview.copy(camera.position);
    },
    frame() {
      const now = performance.now();
      const k = reducedMotion ? 1 : 1 - Math.exp(-(last ? Math.min(100, now - last) : 16) / EASE_MS);
      shown += (wanted - shown) * k;
      if (Math.abs(wanted - shown) < 2e-4) shown = wanted;
      const settled = place(shown, k) && shown === wanted;
      stage.renderer.render(scene, camera);
      stage.canvas.dataset['share'] = shown.toFixed(4);
      last = settled ? 0 : now;
      return !settled;
    },
  });
  if (signal.aborted) {
    stage.dispose();
    throw signal.reason;
  }

  const local = new AbortController();
  watchPalette(container, local.signal, (c) => {
    const set = (color: THREE.Color, name: keyof typeof c): void => void color.setRGB(...c[name].linear);
    set(background, 'surface');
    set(tone.low.value, 'surface-alt');
    // The top of the hypsometric scale: the surface, 30 % of the way to the contour colour.
    const [low, contour] = [c['surface-alt'].srgb, c['map-contour'].srgb];
    tone.high.value.setRGB(low[0] + (contour[0] - low[0]) * 0.3, low[1] + (contour[1] - low[1]) * 0.3, low[2] + (contour[2] - low[2]) * 0.3, THREE.SRGBColorSpace);
    set(tone.contour.value, 'map-contour');
    set(aheadMaterial.color, 'text-muted');
    set(doneMaterial.color, 'data-primary');
    set(activeMaterial.color, 'data-active');
    set(hollowMaterial.color, 'surface');
    set(outlineMaterial.color, 'data-active-outline');
    stage.invalidate();
  });
  // First frame before the poster goes away.
  container.append(labels);
  place(shown, 1);
  stage.renderer.render(scene, camera);

  // Pointing at the route: the nearest point on screen, within reach of a finger.
  const samples = Array.from({ length: 400 }, (_, i) => ({ share: i / 399, at: curve.getPoint(along(i / 399)) }));
  const shareAt = (event: MouseEvent): number | null => {
    const box = stage.canvas.getBoundingClientRect();
    let best: number | null = null;
    let reach = POINT_RADIUS;
    for (const sample of samples) {
      screen.copy(sample.at).project(camera);
      if (screen.z >= 1) continue;
      const d = Math.hypot(((screen.x + 1) / 2) * box.width - (event.clientX - box.left), ((1 - screen.y) / 2) * box.height - (event.clientY - box.top));
      if (d < reach) [reach, best] = [d, sample.share];
    }
    return best;
  };
  let pointed: number | null = null;
  const point = (share: number | null): void => {
    if (share === pointed) return;
    pointed = share;
    stage.canvas.style.cursor = share === null ? '' : 'pointer';
    o.onPoint?.(share);
  };
  stage.canvas.addEventListener('pointermove', (event) => event.pointerType === 'mouse' && point(shareAt(event)), { signal: local.signal });
  stage.canvas.addEventListener('pointerleave', () => point(null), { signal: local.signal });
  stage.canvas.addEventListener(
    'click',
    (event) => {
      const share = shareAt(event);
      if (share !== null) o.onPick?.(share);
    },
    { signal: local.signal },
  );

  return {
    setShare(share) {
      wanted = Math.min(1, Math.max(0, share));
      stage.invalidate();
    },
    setPreview(share) {
      pointer.visible = share !== null;
      if (share !== null) curve.getPoint(along(share), pointer.position).y += 6;
      stage.canvas.dataset['preview'] = share === null ? '' : share.toFixed(4);
      stage.invalidate();
    },
    setActive: (active) => stage.setActive(active),
    step: (direction) => o.onStep?.(direction),
    dispose() {
      local.abort();
      labels.remove();
      stage.dispose();
      for (const mesh of [terrain, aheadTube, doneTube, ...(runner.children as THREE.Mesh[]), ...(pointer.children as THREE.Mesh[])]) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    },
  };
}
