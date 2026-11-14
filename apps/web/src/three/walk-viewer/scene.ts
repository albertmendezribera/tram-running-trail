import * as THREE from 'three/webgpu';
import { attribute, cameraPosition, color, distance, float, fog, fract, instanceIndex, hash, luminance, mix, mx_fractal_noise_float, mx_noise_float, normalWorld, normalize, pass, positionLocal, positionWorld, rangeFogFactor, saturation, screenUV, smoothstep, texture, transformNormalToView, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import type { SceneContext } from '@tram/design-system/interactive/viewer-3d-shell.ts';
import { createStage } from '../core/stage.ts';
import { loadHeights, type TerrainMeta } from '../route-viewer/heights.ts';
import { tramThreeColors, type TramColorName, type TramTerrain } from '@tram/design-system/three';
import type { RouteMark, RouteViewer } from '../route-viewer/scene.ts';
import { plantGeometry, type PlantKind } from './flora.ts';
import { paintTextures } from './textures.ts';

export interface WalkWorld {
  /** Metres east and north of the south-west corner of the terrain, height of the tree in metres, and its kind. */
  trees: ReadonlyArray<readonly [number, number, number, Exclude<PlantKind, 'bush'>]>;
  /** Outline of each building (the first ring; the rest are courtyards) and its height. */
  buildings: ReadonlyArray<{ heightM: number; rings: ReadonlyArray<ReadonlyArray<readonly [number, number]>> }>;
  /** Where the image of the kinds of ground lies, and the size of its cells. */
  land?: { x0: number; y0: number; cols: number; rows: number; cellM: number } | undefined;
  /** Stretches of the route on a paved road, as shares of its length: from, to, from, to… */
  paved?: readonly number[] | undefined;
}

export interface WalkViewerOptions {
  terrainUrl: string;
  terrain: TerrainMeta;
  /** The orthophoto of the terrain, edge to edge. */
  orthoUrl: string;
  /** Kinds of ground, one grey level each (`world-cli`): scrub grows bushes, and each kind has its grain. */
  landUrl?: string | undefined;
  world: WalkWorld;
  /** Route in metres east and north of the south-west corner of the terrain. */
  route: ReadonlyArray<readonly [number, number]>;
  share?: number;
  onStep?(direction: -1 | 1): string | void;
  grades?: ReadonlyArray<{ from: number; to: number; level: number }>;
  marks?: ReadonlyArray<RouteMark>;
  onPoint?(share: number | null): void;
  onPick?(share: number): void;
}

/** The camera, in metres: a few strides behind the runner along the path, and just over head height. */
const CAMERA = { back: 19, up: 5.6, ahead: 16, fov: 52 };
const EASE_MS = 110;
const GRADES = ['data-grade-1', 'data-grade-2', 'data-grade-3', 'data-grade-4'] as const;
const KM_MARK_RANGE = 420;
const POINT_RADIUS = 28;
/** Half the width of the path as drawn, in metres. */
const PATH_HALF = 1.7;
/** A paved road is wider than a path. */
const ROAD_HALF = 2.9;
/** Half the width of the line that marks the route along the middle of the path. */
const LINE_HALF = 0.2;
/** The route is cut in stretches, and so is what grows along it: only the stretches near the camera are drawn. */
const STRETCHES = 28;
const DRAW_RANGE_M = 1500;
/** Within this distance a plant is drawn with its fine shape and casts a shadow. */
const FINE_RANGE_M = 240;
/** Grass is drawn only this close: further away it is the colour of the ground. */
const SMALL_RANGE_M = 190;
/** An afternoon sun from the south-west: long shadows, warm light. */
const SUN = new THREE.Vector3(-0.62, 0.47, 0.56).normalize();
/** Half the side of the square the shadows are worked out in, around the runner. */
const SHADOW_REACH_M = 150;
/** The haze of the horizon and the blue overhead. A photograph sets these, not the tokens. */
const HAZE = 0xdfe8ef;
const ZENITH = 0x5d93cf;
/** Greens of each kind of plant, and the wood of a trunk. */
const LEAF: Record<PlantKind, number> = { pine: 0x4a7a42, oak: 0x66803c, deciduous: 0x86ad4a, olive: 0x98a780, bush: 0x7a9450, grass: 0xb3ad68 };
/** Plaster, from white to ochre, and roofs: tile on a house, sheet on a shed. */
const WALLS = [0xf1ead9, 0xe6d3ae, 0xd9b98c] as const;
const SHEET = 0x9a9c9a;

const ease = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};
const scatter = (a: number, b: number, salt = 0): number => {
  const v = Math.sin(a * 127.1 + b * 311.7 + salt * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * The route from the ground, as a game would show it (E18): the real terrain under its orthophoto,
 * a low sun that casts shadows, the trees the LiDAR found and the buildings of the map, and a camera
 * that runs the path a few strides behind the runner. It draws only when the position changes.
 */
export async function mountWalkViewer({ container, signal, reducedMotion }: SceneContext, o: WalkViewerOptions): Promise<RouteViewer> {
  const loader = new THREE.TextureLoader();
  const [{ data, width, height }, ortho, landKinds, landMap] = await Promise.all([
    loadHeights(o.terrainUrl, o.terrain, signal),
    loader.loadAsync(o.orthoUrl),
    o.landUrl && o.world.land ? readKinds(o.landUrl) : undefined,
    o.landUrl && o.world.land ? loader.loadAsync(o.landUrl) : undefined,
  ]);
  if (landMap) {
    // Each pixel is a kind, not a colour: read as it is, with nothing averaged between two kinds.
    landMap.colorSpace = THREE.NoColorSpace;
    landMap.magFilter = landMap.minFilter = THREE.NearestFilter;
    landMap.generateMipmaps = false;
  }
  ortho.colorSpace = THREE.SRGBColorSpace;
  ortho.anisotropy = 8;
  const sizeX = o.terrain.cols * o.terrain.cell;
  const sizeZ = o.terrain.rows * o.terrain.cell;
  const lift = (elevation: number): number => elevation - o.terrain.min;

  /** Height of the ground at a point, in scene units. */
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
  /** Kind of ground at a point: 0 unknown, 1 wood, 2 scrub, 3 meadow, 4 crops, 5 built, 6 bare, 7 water. */
  const kindAt = (x: number, y: number): number => {
    const land = o.world.land;
    if (!land || !landKinds) return 0;
    const col = Math.floor((x - land.x0) / land.cellM);
    const row = Math.floor((land.y0 + land.rows * land.cellM - y) / land.cellM);
    return col < 0 || row < 0 || col >= land.cols || row >= land.rows ? 0 : Math.round(landKinds[row * land.cols + col]! / 30);
  };

  // ── The ground: the photograph, with a grain of its own from close by, where a photograph taken from the air has none.
  const groundGeometry = new THREE.PlaneGeometry(sizeX, sizeZ, width - 1, height - 1);
  groundGeometry.rotateX(-Math.PI / 2);
  const vertices = groundGeometry.attributes['position']!;
  for (let i = 0; i < vertices.count; i++) vertices.setY(i, lift(data[i]!));
  groundGeometry.computeVertexNormals();
  const groundMaterial = new THREE.MeshStandardNodeMaterial({ roughness: 1, metalness: 0 });
  const paints = paintTextures();
  const flatWorld = vec3(positionWorld.x, positionWorld.z, 0);
  const away = distance(positionWorld, cameraPosition);
  // The photograph was taken under its own sun: its lights are held back, so a path does not burn white when lit again.
  const raw = texture(ortho, uv()).rgb.mul(1.5);
  const photo = raw.div(raw.mul(0.55).add(1)).mul(1.2);
  // From close by a photograph taken from the air has no grain. There each kind of ground shows its own
  // texture (grass, the litter of a wood, bare earth), and the photograph stays as the light and the tint
  // of the place; from afar it is all there is. Each texture is read at two sizes, so its tile does not show.
  const tileUV = vec2(positionWorld.x, positionWorld.z).div(3.4);
  const read = (map: THREE.Texture) => texture(map, tileUV).rgb.mul(0.62).add(texture(map, tileUV.mul(0.19)).rgb.mul(0.38));
  const [meadow, straw, wood, bare] = [read(paints.grass), read(paints.dryGrass), read(paints.litter), read(paints.earth)];
  // Unknown ground is taken for dry grass, and scrub is straw with bare earth showing through in patches.
  const worn = smoothstep(-0.1, 0.5, mx_noise_float(flatWorld.mul(0.11)));
  const scrub = mix(straw, bare, worn.mul(0.55));
  let cover = straw;
  if (landMap && o.world.land) {
    const land = o.world.land;
    const ragged = mx_noise_float(flatWorld.mul(0.21)).mul(3.2);
    const at = vec2(positionWorld.x.add(ragged).sub(land.x0).div(land.cols * land.cellM), float(1).sub(positionWorld.z.negate().add(ragged).sub(land.y0).div(land.rows * land.cellM)));
    const kind = texture(landMap, at).r.mul(255 / 30);
    // How much of each kind a point is: all of one, away from the edge between two.
    const is = (k: number) => float(1).sub(kind.sub(k).abs().clamp(0, 1));
    cover = mix(mix(mix(mix(mix(straw, wood, is(1)), scrub, is(2)), meadow, is(3)), bare, is(5).add(is(6)).clamp(0, 1)), straw, is(4));
  }
  // The texture carries the grain and most of the colour; the photograph, how light or dark this very spot
  // is and a little of its tint: a ploughed field stays darker than a meadow, without dyeing the grass brown.
  const light = luminance(photo);
  const textured = cover.mul(mix(vec3(light, light, light), photo, 0.35).mul(2.6).add(0.62));
  groundMaterial.colorNode = mix(photo, textured, smoothstep(520, 45, away));
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.position.set(sizeX / 2, 0, -sizeZ / 2);
  ground.receiveShadow = true;

  // ── The route on the ground, and how far along it each point is.
  const stride = Math.max(1, Math.round(o.route.length / 900));
  const track = o.route.filter((_, i) => i % stride === 0 || i === o.route.length - 1);
  const curve = new THREE.CatmullRomCurve3(track.map(([x, y]) => new THREE.Vector3(x, groundAt(x, y), -y)));
  curve.arcLengthDivisions = track.length * 4;
  const run = [0];
  for (let i = 1; i < track.length; i++) run.push(run[i - 1]! + Math.hypot(track[i]![0] - track[i - 1]![0], track[i]![1] - track[i - 1]![1]));
  const total = run.at(-1)!;
  /** Curve parameter of a share of the route's map distance. Beyond its ends the route is not there: the parameter stops. */
  const along = (share: number): number => {
    const d = Math.min(1, Math.max(0, share)) * total;
    let i = Math.min(track.length - 2, Math.floor((d / total) * (track.length - 1)));
    while (i > 0 && run[i]! > d) i--;
    while (i < track.length - 2 && run[i + 1]! < d) i++;
    const span = run[i + 1]! - run[i]!;
    return (i + (span > 0 ? (d - run[i]!) / span : 0)) / (track.length - 1);
  };
  /** A point of the route on the ground, by its share. */
  const onPath = (share: number, into: THREE.Vector3): THREE.Vector3 => {
    curve.getPoint(along(share), into);
    into.y = groundAt(into.x, -into.z);
    return into;
  };
  /** Distance from a point of the map to the route, and the share of the route nearest to it. */
  const cellM = 40;
  const cells = new Map<string, number[]>();
  track.forEach(([x, y], i) => {
    const key = `${Math.floor(x / cellM)},${Math.floor(y / cellM)}`;
    (cells.get(key) ?? cells.set(key, []).get(key)!).push(i);
  });
  const nearest = (x: number, y: number): { distance: number; share: number } => {
    let best = Infinity;
    let index = 0;
    const [cx, cy] = [Math.floor(x / cellM), Math.floor(y / cellM)];
    for (let reach = 1; reach <= 4 && best === Infinity; reach++) {
      for (let dx = -reach; dx <= reach; dx++) {
        for (let dy = -reach; dy <= reach; dy++) {
          for (const i of cells.get(`${cx + dx},${cy + dy}`) ?? []) {
            const d = Math.hypot(track[i]![0] - x, track[i]![1] - y);
            if (d < best) [best, index] = [d, i];
          }
        }
      }
    }
    return { distance: best, share: run[index]! / total };
  };

  // The path: beaten earth that fades into the ground at its edges, and along its middle the line of the
  // route: what is left to run in the colour of its grade, what has been run inked in.
  const samples = Math.max(2, Math.ceil(total / 2.5));
  const point = new THREE.Vector3();
  const next = new THREE.Vector3();
  /** A band along the route, with its points across at the given offsets (metres from the middle). */
  const pavedAt = (share: number): boolean => (o.world.paved ?? []).some((from, i, all) => i % 2 === 0 && share >= from && share <= all[i + 1]!);
  const bandOf = (offsets: readonly number[], rise: number, widen = false): THREE.BufferGeometry => {
    const across = offsets.length;
    const positions = new Float32Array((samples + 1) * across * 3);
    const levels = new Float32Array((samples + 1) * across);
    const edges = new Float32Array((samples + 1) * across);
    const roads = new Float32Array((samples + 1) * across);
    const uvs = new Float32Array((samples + 1) * across * 2);
    const index: number[] = [];
    let band = 0;
    for (let i = 0; i <= samples; i++) {
      const share = i / samples;
      onPath(share, point);
      if (i < samples) onPath(share + 1 / samples, next);
      else onPath(share - 1 / samples, next).sub(point).negate().add(point);
      const [tx, tz] = [next.x - point.x, next.z - point.z];
      const length = Math.hypot(tx, tz) || 1;
      while (o.grades && band < o.grades.length - 1 && o.grades[band]!.to < share) band++;
      const paved = pavedAt(share);
      offsets.forEach((across0, k) => {
        // A road is wider than a path.
        const offset = across0 * (widen && paved ? ROAD_HALF / PATH_HALF : 1);
        roads[i * across + k] = paved ? 1 : 0;
        // Across the band from 0 to 1, and along it in metres.
        uvs.set([(across0 / Math.max(...offsets.map(Math.abs)) + 1) / 2, share * total], (i * across + k) * 2);
        const [x, z] = [point.x + (-tz / length) * offset, point.z + (tx / length) * offset];
        positions.set([x, groundAt(x, -z) + rise, z], (i * across + k) * 3);
        levels[i * across + k] = o.grades?.[band]?.level ?? 0;
        edges[i * across + k] = Math.abs(offset) / Math.max(...offsets.map(Math.abs));
        if (i < samples && k < across - 1) {
          const a = i * across + k;
          index.push(a, a + 1, a + across, a + 1, a + across + 1, a + across);
        }
      });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('level', new THREE.BufferAttribute(levels, 1));
    geometry.setAttribute('edge', new THREE.BufferAttribute(edges, 1));
    geometry.setAttribute('road', new THREE.BufferAttribute(roads, 1));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    return geometry;
  };
  const offset = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
  const dirtMaterial = new THREE.MeshStandardNodeMaterial({ roughness: 1, metalness: 0, transparent: true, depthWrite: false, side: THREE.DoubleSide, ...offset });
  const road = attribute('road', 'float');
  const lane = uv();
  // Beaten earth where the map has a track or nothing; tarmac, with its lines, where it has a paved road.
  const beaten = texture(paints.earth, vec2(positionWorld.x, positionWorld.z).div(2.6)).rgb.mul(mx_noise_float(vec3(positionWorld.x, positionWorld.z, 4).mul(0.5)).mul(0.12).add(1.02));
  const paved = texture(paints.tarmac, vec2(lane.x, lane.y.div(ROAD_HALF * 2))).rgb;
  dirtMaterial.colorNode = mix(beaten, paved, road);
  // A path is worn in the middle and grown over at the sides; a road ends where its tarmac ends.
  const grownOver = smoothstep(1, 0.5, attribute('edge', 'float').add(mx_noise_float(vec3(positionWorld.x, positionWorld.z, 9).mul(0.9)).mul(0.22))).mul(0.94);
  dirtMaterial.opacityNode = mix(grownOver, float(1), road);
  const dirt = new THREE.Mesh(bandOf([-PATH_HALF, -PATH_HALF * 0.55, 0, PATH_HALF * 0.55, PATH_HALF], 0.06, true), dirtMaterial);
  dirt.receiveShadow = true;
  const lineMaterial = (): THREE.MeshBasicNodeMaterial => new THREE.MeshBasicNodeMaterial({ transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const aheadMaterial = lineMaterial();
  const doneMaterial = lineMaterial();
  const ramp = GRADES.map(() => uniform(new THREE.Color()));
  const level = attribute('level', 'float');
  const blend = (k: number) => smoothstep(k - 0.6, k - 0.4, level);
  aheadMaterial.colorNode = mix(mix(mix(ramp[0]!, ramp[1]!, blend(1)), ramp[2]!, blend(2)), ramp[3]!, blend(3));
  const lineGeometry = bandOf([-LINE_HALF, LINE_HALF], 0.13);
  const aheadBand = new THREE.Mesh(lineGeometry, aheadMaterial);
  aheadBand.renderOrder = 2;
  const doneBand = new THREE.Mesh(lineGeometry.clone(), doneMaterial);
  doneBand.renderOrder = 3;

  // ── What grows along the route, in stretches: each stretch is drawn only when the camera is near it.
  const stretches: Array<{ far: THREE.InstancedMesh[]; near: THREE.InstancedMesh[]; centre: THREE.Vector3; radius: number; small: boolean }> = [];
  const growth = new THREE.Group();
  // No two plants the same green: each takes its own shade, by its place in the line.
  const own = hash(instanceIndex).mul(0.36).add(0.84);
  const patchy = mx_noise_float(positionWorld.mul(0.55)).mul(0.16).add(1);
  /** The body of a plant: bark on the trunk, and the heart of the crown in the shade of its own leaves. */
  const coreMaterial = (kind: PlantKind): THREE.MeshStandardNodeMaterial => {
    const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.95, metalness: 0 });
    const barked = texture(paints.bark, uv()).rgb.mul(1.25);
    material.colorNode = mix(barked, color(LEAF[kind]).mul(own).mul(0.72), attribute('part', 'float')).mul(attribute('shade', 'float'));
    return material;
  };
  /** Its leaves: cards cut out by the picture of a spray of foliage. */
  const cardMaterial = (kind: PlantKind): THREE.MeshStandardNodeMaterial => {
    const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.42 });
    const picture = texture(kind === 'grass' ? paints.blades : paints.foliage[kind], uv());
    // Grass goes from straw to green in patches, as a field does; a crown catches the sky on top.
    const tint = kind === 'grass' ? mix(vec3(1.05, 1, 0.9), vec3(0.78, 1.02, 0.7), smoothstep(-0.2, 0.5, mx_noise_float(vec3(positionWorld.x, positionWorld.z, 3).mul(0.07)))) : vec3(1.75, 1.75, 1.75).mul(normalWorld.y.mul(0.2).add(0.98));
    material.colorNode = picture.rgb.mul(tint).mul(own).mul(patchy).mul(attribute('shade', 'float'));
    // Leaves right in front of the lens are let go: a branch across the frame hides the route it stands by.
    material.opacityNode = kind === 'grass' ? picture.a : picture.a.mul(smoothstep(5, 11, distance(positionWorld, cameraPosition)));
    // A blade or a leaf is lit as the clump it belongs to, whichever of its two sides is seen.
    if (kind === 'grass') material.normalNode = transformNormalToView(vec3(0, 1, 0));
    return material;
  };
  const dummy = new THREE.Object3D();
  const grow = (kind: PlantKind, plants: ReadonlyArray<readonly [number, number, number]>, shadows: boolean): void => {
    if (!plants.length) return;
    const [coarse, fine] = [plantGeometry(kind), plantGeometry(kind, true)];
    const [body, foliage] = [coreMaterial(kind), cardMaterial(kind)];
    const byStretch = new Map<number, Array<readonly [number, number, number]>>();
    for (const plant of plants) {
      const stretch = Math.min(STRETCHES - 1, Math.floor(nearest(plant[0], plant[1]).share * STRETCHES));
      (byStretch.get(stretch) ?? byStretch.set(stretch, []).get(stretch)!).push(plant);
    }
    for (const ownPlants of byStretch.values()) {
      const matrices = new THREE.InstancedMesh(coarse.cards, foliage, ownPlants.length);
      ownPlants.forEach(([x, y, size], i) => {
        dummy.position.set(x, groundAt(x, y), -y);
        dummy.rotation.set(0, scatter(x, y) * Math.PI * 2, 0);
        // A touch wider or narrower than tall: the same shape never twice.
        const wide = 0.88 + scatter(y, x, 1) * 0.3;
        dummy.scale.set(size * wide, size, size * wide);
        dummy.updateMatrix();
        matrices.setMatrixAt(i, dummy.matrix);
      });
      matrices.instanceMatrix.needsUpdate = true;
      matrices.computeBoundingSphere();
      // The same plants in up to four meshes that share their places: body and leaves, cut coarse for
      // afar and fine for near. Only the fine body casts a shadow: the shape of the crown, not of each leaf.
      const share = (geometry: THREE.BufferGeometry | null, material: THREE.Material): THREE.InstancedMesh | null => {
        if (!geometry) return null;
        const mesh = new THREE.InstancedMesh(geometry, material, ownPlants.length);
        mesh.instanceMatrix = matrices.instanceMatrix;
        mesh.boundingSphere = matrices.boundingSphere;
        mesh.visible = false;
        growth.add(mesh);
        return mesh;
      };
      growth.add(matrices);
      const near = [share(fine.core, body), kind === 'grass' ? null : share(fine.cards, foliage)].filter((mesh): mesh is THREE.InstancedMesh => mesh !== null);
      const far = [share(coarse.core, body), matrices].filter((mesh): mesh is THREE.InstancedMesh => mesh !== null);
      if (near[0] && fine.core) near[0].castShadow = shadows;
      stretches.push({ far, near, centre: matrices.boundingSphere!.center.clone(), radius: matrices.boundingSphere!.radius, small: kind === 'grass' });
    }
  };
  // How far the leaves of a tree reach from its trunk, as a share of its height. A tree whose crown would
  // hang over the middle of the path is left out: the camera runs there, a little over head height.
  const REACH: Record<Exclude<PlantKind, 'bush' | 'grass'>, number> = { pine: 0.58, oak: 0.52, deciduous: 0.34, olive: 0.62 };
  for (const kind of ['pine', 'oak', 'deciduous', 'olive'] as const) {
    const clear = o.world.trees.filter((tree) => tree[3] === kind && nearest(tree[0], tree[1]).distance > tree[2] * REACH[kind] + 1.2);
    grow(kind, clear.map(([x, y, h]) => [x, y, h] as const), true);
  }
  /** Every cell of a grid within reach of the route, once: where something small may grow. */
  /** How far from the middle of the route its surface ends, at the point of it nearest to a place. */
  const edgeAt = (share: number): number => (pavedAt(share) ? ROAD_HALF + 0.5 : PATH_HALF * 0.8);
  const sow = (gridM: number, reachM: number, plant: (i: number, j: number, x: number, y: number, away: number, edge: number) => void): void => {
    const seen = new Set<number>();
    const reach = Math.ceil(reachM / gridM);
    for (let t = 0; t < track.length; t++) {
      const [x, y] = track[t]!;
      for (let dx = -reach; dx <= reach; dx++) {
        for (let dy = -reach; dy <= reach; dy++) {
          const [i, j] = [Math.floor(x / gridM) + dx, Math.floor(y / gridM) + dy];
          const key = i * 100003 + j;
          if (seen.has(key)) continue;
          seen.add(key);
          const [px, py] = [(i + scatter(i, j, 2)) * gridM, (j + scatter(i, j, 3)) * gridM];
          const near = nearest(px, py);
          if (near.distance <= reachM) plant(i, j, px, py, near.distance, edgeAt(near.share));
        }
      }
    }
  };
  // Bushes where the map has scrub or wood, under the trees and between them; grass along the path, thick in a
  // meadow and thin under the pines. How much of each, by kind of ground: unknown, wood, scrub, meadow, crops, built, bare, water.
  const bushes: Array<readonly [number, number, number]> = [];
  const grass: Array<readonly [number, number, number]> = [];
  if (landKinds) {
    const bushy = [0, 0.16, 0.34, 0.03, 0, 0, 0.05, 0];
    const grassy = [0.3, 0.4, 0.6, 0.95, 0.5, 0, 0.2, 0];
    sow(5.5, 42, (i, j, x, y, away, edge) => {
      if (away > edge + 1.4 && scatter(i, j, 4) < bushy[kindAt(x, y)]!) bushes.push([x, y, 0.55 + scatter(i, j, 5) * 0.9]);
    });
    sow(1.15, 12, (i, j, x, y, away, edge) => {
      // Thick at the edge of the path, thinner away from it: the camera never leaves the path.
      if (away > edge && scatter(i, j, 6) < grassy[kindAt(x, y)]! * (1 - away / 16)) grass.push([x, y, 0.7 + scatter(i, j, 7) * 0.8]);
    });
  }
  grow('bush', bushes, false);
  grow('grass', grass, false);

  // ── The buildings of the map: walls with their windows, a roof of tile on a house and of sheet on a shed.
  const built = buildingsOf(o.world.buildings, groundAt);
  const wallMaterial = new THREE.MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0 });
  const tone = attribute('tone', 'float');
  const isRoof = attribute('roof', 'float');
  const wall = uv();
  // One bay of wall and window every three metres or so across, and one to a floor; a darker foot where rain splashes.
  const facade = texture(paints.bay, vec2(wall.x.div(3.1), wall.y.div(2.9))).rgb;
  const plaster = mix(mix(color(WALLS[0]), color(WALLS[1]), smoothstep(0.2, 0.55, tone)), color(WALLS[2]), smoothstep(0.6, 0.95, tone));
  const walls = facade.mul(plaster).mul(mix(0.74, 1, smoothstep(0.1, 0.9, wall.y)));
  // Tile laid along the slope of a roof on a house; sheet, with its seams, on a shed.
  const tiled = texture(paints.tiles, vec2(wall.x.div(2.4), wall.y.div(2.4))).rgb;
  const sheet = color(SHEET).mul(fract(wall.x.div(1.1)).sub(0.5).abs().mul(0.3).add(0.88));
  wallMaterial.colorNode = mix(walls, mix(sheet, tiled, attribute('tiled', 'float')), isRoof);
  const buildings = new THREE.Mesh(built, wallMaterial);
  buildings.castShadow = true;
  buildings.receiveShadow = true;

  // ── The runner: a figure in the signal colour, on a ring that marks it from afar.
  const runnerMaterial = new THREE.MeshStandardNodeMaterial({ roughness: 0.7, metalness: 0 });
  const ringMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const outlineMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const runner = new THREE.Group();
  // Caught mid-stride: a trunk leaning into the run, one leg forward and one back, the arms the other way round.
  const limb = (radius: number, length: number, at: readonly [number, number, number], lean: number): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 8), runnerMaterial);
    mesh.position.set(...at);
    mesh.rotation.x = lean;
    mesh.castShadow = true;
    return mesh;
  };
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), runnerMaterial);
  head.position.set(0, 1.66, 0.1);
  head.castShadow = true;
  const figure = new THREE.Group();
  // Legs swing from the hip and arms from the shoulder: each hangs from a joint that turns with the stride.
  const joint = (at: readonly [number, number, number], radius: number, length: number): THREE.Group => {
    const group = new THREE.Group();
    group.position.set(...at);
    group.add(limb(radius, length, [0, -(length / 2 + radius), 0], 0));
    return group;
  };
  const legs = [joint([0.1, 0.92, 0], 0.075, 0.6), joint([-0.1, 0.92, 0], 0.075, 0.6)];
  const arms = [joint([0.21, 1.42, 0], 0.055, 0.42), joint([-0.21, 1.42, 0], 0.055, 0.42)];
  figure.add(limb(0.15, 0.42, [0, 1.22, 0.04], 0.16), head, ...legs, ...arms);
  const flat = (inner: number, outer: number, material: THREE.Material): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 40), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.2;
    return mesh;
  };
  runner.add(figure, flat(1.05, 1.5, outlineMaterial), flat(1.15, 1.4, ringMaterial));
  // Where another view points: a mast with a hollow ring, quieter than the runner.
  const pointerMaterial = new THREE.MeshBasicNodeMaterial();
  const pointer = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 7, 6), outlineMaterial);
  mast.position.y = 3.5;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 10), pointerMaterial);
  knob.position.y = 7.2;
  pointer.add(mast, knob);
  pointer.visible = false;

  // ── Sky, haze and sun.
  const scene = new THREE.Scene();
  const skyMaterial = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  const up3 = normalize(positionLocal);
  const glow = smoothstep(0.985, 1, up3.dot(vec3(SUN.x, SUN.y, SUN.z)));
  // Fair-weather clouds: a noise read where each ray of sight would meet a flat ceiling, thinning out to the horizon.
  const ceiling = vec3(up3.x, up3.z, 0).div(up3.y.max(0.06)).mul(0.55);
  const clouds = smoothstep(0.08, 0.5, mx_fractal_noise_float(ceiling, 4, 2.1, 0.5)).mul(smoothstep(0.03, 0.3, up3.y)).mul(0.85);
  skyMaterial.colorNode = mix(mix(color(HAZE), color(ZENITH), smoothstep(-0.02, 0.5, up3.y)), vec3(1, 0.99, 0.97), clouds).add(vec3(1, 0.92, 0.75).mul(glow).mul(0.6));
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), skyMaterial);
  sky.scale.setScalar(50000);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  const hazeNear = uniform(120);
  const hazeFar = uniform(2600);
  scene.fogNode = fog(color(HAZE), rangeFogFactor(hazeNear, hazeFar));
  const sun = new THREE.DirectionalLight(0xffe9c8, 2.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -SHADOW_REACH_M, right: SHADOW_REACH_M, top: SHADOW_REACH_M, bottom: -SHADOW_REACH_M, near: 20, far: 1400 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.7;
  scene.add(sky, ground, dirt, aheadBand, doneBand, growth, buildings, runner, pointer, sun, sun.target, new THREE.HemisphereLight(0xd9e8ff, 0xbfae92, 2.5));

  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.6, 90000);
  const centre = new THREE.Vector3(sizeX / 2, lift(o.terrain.max) * 0.3, -sizeZ / 2);
  const corners = [0, sizeX].flatMap((x) => [0, -sizeZ].flatMap((z) => [0, lift(o.terrain.max)].map((y) => new THREE.Vector3(x, y, z))));
  const probe = new THREE.Vector3();
  const overview = new THREE.Vector3();
  const here = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const behind = new THREE.Vector3();
  const follow = new THREE.Vector3();
  const target = new THREE.Vector3();
  const aim = new THREE.Vector3();

  // Labels are HTML over the canvas, styled by Viewer3DShell, as in the other views.
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
    const at = onPath(mark.share, new THREE.Vector3());
    at.y += 3.2;
    return { ...mark, element, at };
  });
  const size = { width: 1, height: 1 };
  const screen = new THREE.Vector3();
  const ray = new THREE.Vector3();
  const hidden = (at: THREE.Vector3): boolean => {
    for (let i = 1; i <= 24; i++) {
      ray.lerpVectors(camera.position, at, i / 25);
      if (groundAt(ray.x, -ray.z) > ray.y + 1) return true;
    }
    return false;
  };
  let flying = 0;
  const placeLabels = (): void => {
    for (const mark of marks) {
      screen.copy(mark.at).project(camera);
      const far = mark.kind === 'km' && flying > 0.5 && camera.position.distanceTo(mark.at) > KM_MARK_RANGE;
      const show = !far && screen.z < 1 && Math.abs(screen.x) < 1 && Math.abs(screen.y) < 1 && !hidden(mark.at);
      mark.element.hidden = !show;
      if (show) mark.element.style.transform = `translate(${((screen.x + 1) / 2) * size.width}px, ${((1 - screen.y) / 2) * size.height}px) translate(-50%, -100%)`;
    }
  };

  /** Places runner and camera at a share of the route. */
  const place = (share: number): void => {
    onPath(share, here);
    onPath(share + CAMERA.ahead / total, ahead);
    // The camera keeps to the path, behind the runner: a path is clear of trunks, a straight line back is not.
    onPath(share - CAMERA.back / total, behind);
    if (share * total < CAMERA.back) behind.copy(here).addScaledVector(aim.subVectors(ahead, here).setY(0).normalize(), -(CAMERA.back - share * total)).setY(groundAt(behind.x, -behind.z));
    follow.copy(behind);
    follow.y = Math.max(behind.y, groundAt(follow.x, -follow.z)) + CAMERA.up;
    // Start and finish show the whole route; in between the camera runs with the runner.
    flying = ease(0, 0.02, share) * (1 - ease(0.98, 1, share));
    camera.position.lerpVectors(overview, follow, flying);
    target.copy(here).lerp(ahead, 0.55);
    target.y += 1.5;
    target.lerpVectors(centre, target, flying);
    camera.lookAt(target);
    camera.updateMatrixWorld();

    runner.position.copy(here);
    aim.subVectors(ahead, here);
    runner.rotation.y = Math.atan2(aim.x, aim.z);
    // The stride follows the ground covered: a step every 1.2 m, whichever way the scroll goes.
    const stride = ((share * total) / 2.4) * Math.PI * 2;
    legs[0]!.rotation.x = Math.sin(stride) * 0.85;
    legs[1]!.rotation.x = -Math.sin(stride) * 0.85;
    arms[0]!.rotation.x = -Math.sin(stride) * 0.9;
    arms[1]!.rotation.x = Math.sin(stride) * 0.9;
    figure.position.y = Math.abs(Math.cos(stride)) * 0.07;
    // From the air the runner is a dot: it grows with the distance, as the route does in the other views.
    const reach = camera.position.distanceTo(here);
    runner.scale.setScalar(1 + Math.max(0, reach / 60 - 1) * 0.9);
    pointer.scale.setScalar(1 + Math.max(0, camera.position.distanceTo(pointer.position) / 90 - 1) * 0.9);
    sky.position.copy(camera.position);
    hazeNear.value = 9000 + (130 - 9000) * flying;
    hazeFar.value = 80000 + (2800 - 80000) * flying;
    // The sun and its square of shadows go with the runner.
    sun.target.position.copy(here);
    sun.position.copy(here).addScaledVector(SUN, 650);
    for (const stretch of stretches) {
      const away = camera.position.distanceTo(stretch.centre) - stretch.radius;
      const near = flying > 0.5 && away < FINE_RANGE_M;
      // Grass has one shape and is there only from close by; the rest swap the coarse shape for the fine one.
      const fineShown = near && !stretch.small;
      const coarseShown = stretch.small ? flying > 0.5 && away < SMALL_RANGE_M : !near && (flying < 0.5 || away < DRAW_RANGE_M);
      for (const mesh of stretch.near) mesh.visible = fineShown;
      for (const mesh of stretch.far) mesh.visible = coarseShown;
    }
    placeLabels();
    doneBand.geometry.setDrawRange(0, Math.round(share * samples) * 6);
  };

  let wanted = Math.min(1, Math.max(0, o.share ?? 0));
  let shown = wanted;
  let last = 0;
  let post: THREE.RenderPipeline | undefined;
  const stage = await createStage(container, {
    resize(w, h) {
      size.width = w;
      size.height = h;
      camera.aspect = w / h;
      // An upright frame sees little to the sides: it is given a wider angle.
      camera.fov = w < h ? CAMERA.fov + 10 : CAMERA.fov;
      camera.updateProjectionMatrix();
      // Overview: the closest point that holds the whole terrain, with its long side across a wide frame.
      const fromEast = sizeZ > sizeX === camera.aspect > 1;
      const holds = (reach: number): boolean => {
        camera.position.set(fromEast ? 0.78 : 0.32, 0.5, fromEast ? 0.32 : 0.78).normalize().multiplyScalar(reach).add(centre);
        camera.lookAt(centre);
        camera.updateMatrixWorld();
        return corners.every((corner) => {
          probe.copy(corner).project(camera);
          return Math.abs(probe.x) <= 0.94 && Math.abs(probe.y) <= 0.94;
        });
      };
      let near = 300;
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
      if (Math.abs(wanted - shown) < 2e-5) shown = wanted;
      const settled = shown === wanted;
      place(shown);
      if (post) post.render();
      else stage.renderer.render(scene, camera);
      stage.canvas.dataset['share'] = shown.toFixed(4);
      last = settled ? 0 : now;
      return !settled;
    },
  });
  if (signal.aborted) {
    stage.dispose();
    throw signal.reason;
  }
  stage.renderer.shadowMap.enabled = true;
  stage.renderer.shadowMap.type = THREE.PCFShadowMap;
  stage.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  stage.renderer.toneMappingExposure = 1.22;
  // The grade of the picture: a little more colour, a warm cast, and corners that fall off, as through a lens.
  post = new THREE.RenderPipeline(stage.renderer);
  const shot = pass(scene, camera);
  const graded = saturation(shot.rgb, 1.22).mul(vec3(1.045, 1.0, 0.94)).sub(0.5).mul(1.07).add(0.5);
  post.outputNode = vec4(graded.mul(mix(0.74, 1, smoothstep(0.92, 0.3, distance(screenUV, vec2(0.5, 0.5))))), 1);
  stage.canvas.dataset['engine'] = `three-walk-${stage.backend}`;
  stage.canvas.dataset['trees'] = String(o.world.trees.length);

  const local = new AbortController();
  // Over a photograph the ground is dark: the night colours of the tokens read on it in both themes, as in the realistic view.
  const terrainMode = (container.closest<HTMLElement>('[data-terrain]')?.dataset['terrain'] ?? 'mixed') as TramTerrain;
  const set = (target3: THREE.Color, name: TramColorName): void => void target3.setRGB(...tramThreeColors.night[terrainMode][name].linear);
  ramp.forEach((value, k) => set(value.value, GRADES[k]!));
  set(doneMaterial.color, 'text');
  set(runnerMaterial.color, 'data-active');
  set(ringMaterial.color, 'data-active');
  set(outlineMaterial.color, 'data-active-outline');
  set(pointerMaterial.color, 'surface');
  container.append(labels);
  place(shown);
  post.render();

  // Pointing at the route: the nearest point on screen, within reach of a finger.
  const picks = Array.from({ length: 500 }, (_, i) => ({ share: i / 499, at: onPath(i / 499, new THREE.Vector3()) }));
  const shareAt = (event: MouseEvent): number | null => {
    const box = stage.canvas.getBoundingClientRect();
    let best: number | null = null;
    let reach = POINT_RADIUS;
    for (const pick of picks) {
      screen.copy(pick.at).project(camera);
      if (screen.z >= 1) continue;
      const d = Math.hypot(((screen.x + 1) / 2) * box.width - (event.clientX - box.left), ((1 - screen.y) / 2) * box.height - (event.clientY - box.top));
      if (d < reach) [reach, best] = [d, pick.share];
    }
    return best;
  };
  let pointed: number | null = null;
  const pointAt = (share: number | null): void => {
    if (share === pointed) return;
    pointed = share;
    stage.canvas.style.cursor = share === null ? '' : 'pointer';
    o.onPoint?.(share);
  };
  stage.canvas.addEventListener('pointermove', (event) => event.pointerType === 'mouse' && pointAt(shareAt(event)), { signal: local.signal });
  stage.canvas.addEventListener('pointerleave', () => pointAt(null), { signal: local.signal });
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
      if (share !== null) onPath(share, pointer.position);
      stage.canvas.dataset['preview'] = share === null ? '' : share.toFixed(4);
      stage.invalidate();
    },
    setActive: (active) => stage.setActive(active),
    step: (direction) => o.onStep?.(direction),
    dispose() {
      local.abort();
      labels.remove();
      post?.dispose();
      stage.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        for (const material of ([] as THREE.Material[]).concat(mesh.material ?? [])) material.dispose();
      });
      ortho.dispose();
      paints.dispose();
    },
  };
}

/** The kinds of ground as numbers: the grey of each pixel of the image, untouched by colour management. */
async function readKinds(url: string): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  return Uint8Array.from({ length: pixels.length / 4 }, (_, i) => pixels[i * 4]!);
}

/** Walls and roofs of every building as one mesh. Along a wall `uv` counts metres: across it and up from the floor. */
function buildingsOf(buildings: WalkWorld['buildings'], groundAt: (x: number, y: number) => number): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const tones: number[] = [];
  const roofs: number[] = [];
  const tiled: number[] = [];
  buildings.forEach((building, b) => {
    const outer = building.rings[0];
    if (!outer || outer.length < 3) return;
    const levels = outer.map(([x, y]) => groundAt(x, y));
    const foot = Math.min(...levels) - 1.5;
    const top = Math.max(...levels) + building.heightM;
    const floor = top - building.heightM;
    const tone = scatter(outer[0]![0], outer[0]![1], 6);
    let area = 0;
    for (let i = 0; i < outer.length; i++) area += outer[i]![0] * outer[(i + 1) % outer.length]![1] - outer[(i + 1) % outer.length]![0] * outer[i]![1];
    // A big, low footprint is a shed: sheet on top. Anything else is a house: tile.
    const tile = Math.abs(area) / 2 < 450 ? 1 : 0;
    const add = (p: readonly [number, number, number], n: readonly [number, number, number], st: readonly [number, number], roof: number): void => {
      positions.push(...p);
      normals.push(...n);
      uvs.push(...st);
      tones.push(tone + b * 0);
      roofs.push(roof);
      tiled.push(tile);
    };
    for (const ring of building.rings) {
      let run = 0;
      // Walls look outwards whichever way the ring was drawn.
      const outwards = Math.sign(area) || 1;
      for (let i = 0; i < ring.length; i++) {
        const [ax, ay] = ring[i]!;
        const [bx, by] = ring[(i + 1) % ring.length]!;
        const length = Math.hypot(bx - ax, by - ay);
        if (length < 0.05) continue;
        const normal = [((by - ay) / length) * outwards, 0, ((bx - ax) / length) * outwards] as const;
        const quad = [
          [[ax, foot, -ay], [run, foot - floor]],
          [[bx, foot, -by], [run + length, foot - floor]],
          [[bx, top, -by], [run + length, top - floor]],
          [[ax, top, -ay], [run, top - floor]],
        ] as const;
        for (const k of outwards > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]) add(quad[k]![0], normal, quad[k]![1], 0);
        run += length;
      }
    }
    const holes = building.rings.slice(1).map((ring) => ring.map(([x, y]) => new THREE.Vector2(x, y)));
    const xs = outer.map((point) => point[0]);
    const ys = outer.map((point) => point[1]);
    if (tile && !holes.length) {
      // A house: four slopes of tile, from eaves that stand out from the wall up to a flat ridge.
      const centre = [xs.reduce((sum, x) => sum + x, 0) / xs.length, ys.reduce((sum, y) => sum + y, 0) / ys.length] as const;
      const rise = Math.min(2.6, Math.max(0.9, Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 0.2));
      const eaves = outer.map(([x, y]) => {
        const reach = Math.hypot(x - centre[0], y - centre[1]) || 1;
        return [x + ((x - centre[0]) / reach) * 0.45, y + ((y - centre[1]) / reach) * 0.45] as const;
      });
      const ridge = outer.map(([x, y]) => [centre[0] + (x - centre[0]) * 0.3, centre[1] + (y - centre[1]) * 0.3] as const);
      for (let i = 0; i < outer.length; i++) {
        const j = (i + 1) % outer.length;
        const a = new THREE.Vector3(eaves[i]![0], top, -eaves[i]![1]);
        const b = new THREE.Vector3(eaves[j]![0], top, -eaves[j]![1]);
        const c = new THREE.Vector3(ridge[j]![0], top + rise, -ridge[j]![1]);
        const d = new THREE.Vector3(ridge[i]![0], top + rise, -ridge[i]![1]);
        const along = new THREE.Vector3().subVectors(b, a);
        const length = along.length();
        if (length < 0.05) continue;
        along.divideScalar(length);
        const normal = new THREE.Vector3().crossVectors(along, new THREE.Vector3().subVectors(d, a)).normalize();
        const upwards = normal.y >= 0;
        if (!upwards) normal.negate();
        // Tiles run in rows along the eaves and climb the slope.
        const st = (point: THREE.Vector3): [number, number] => {
          const from = new THREE.Vector3().subVectors(point, a);
          const across = from.dot(along);
          return [across, Math.sqrt(Math.max(0, from.lengthSq() - across * across))];
        };
        const quad = [a, b, c, d];
        for (const k of upwards ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]) add([quad[k]!.x, quad[k]!.y, quad[k]!.z], [normal.x, normal.y, normal.z], st(quad[k]!), 1);
      }
      const cap = ridge.map(([x, y]) => new THREE.Vector2(x, y));
      for (const triangle of THREE.ShapeUtils.triangulateShape(cap, [])) {
        for (const k of triangle) add([cap[k]!.x, top + rise, -cap[k]!.y], [0, 1, 0], [cap[k]!.x, cap[k]!.y], 1);
      }
    } else {
      // A shed, or a block round a courtyard: a flat roof.
      const contour = outer.map(([x, y]) => new THREE.Vector2(x, y));
      const flat = [...contour, ...holes.flat()];
      for (const triangle of THREE.ShapeUtils.triangulateShape(contour, holes)) {
        for (const k of triangle) add([flat[k]!.x, top, -flat[k]!.y], [0, 1, 0], [flat[k]!.x, flat[k]!.y], 1);
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('tone', new THREE.Float32BufferAttribute(tones, 1));
  geometry.setAttribute('roof', new THREE.Float32BufferAttribute(roofs, 1));
  geometry.setAttribute('tiled', new THREE.Float32BufferAttribute(tiled, 1));
  return geometry;
}
