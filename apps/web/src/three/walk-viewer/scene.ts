import * as THREE from 'three/webgpu';
import { attribute, cameraPosition, color, dFdx, dFdy, distance, float, fog, fract, instanceIndex, hash, luminance, mix, mx_fractal_noise_float, mx_noise_float, normalWorld, normalize, pass, positionLocal, positionWorld, rangeFogFactor, saturation, screenUV, smoothstep, step, texture, transformNormalToView, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import type { SceneContext } from '@tram/design-system/interactive/viewer-3d-shell.ts';
import { createStage } from '../core/stage.ts';
import { loadHeights, type TerrainMeta } from '../route-viewer/heights.ts';
import { tramThreeColors, type TramColorName, type TramTerrain } from '@tram/design-system/three';
import type { RouteMark, RouteViewer } from '../route-viewer/scene.ts';
import { type Carpet, carpetFocus, createCarpet, type Put } from './carpet.ts';
import { plantGeometry, shrubGeometry, stoneGeometry, type PlantKind } from './flora.ts';
import { buildLandmark, type Landmark } from './landmarks.ts';
import { paintTextures } from './textures.ts';

export interface WalkWorld {
  /** Metres east and north of the south-west corner of the terrain, height of the tree in metres, and its kind. */
  trees: ReadonlyArray<readonly [number, number, number, Exclude<PlantKind, 'bush'>]>;
  /**
   * Outline of each building (the first ring; the rest are courtyards) and its height. Where the cadastre
   * tells a house apart from its block it comes with its floors above ground, its use and the year it was built.
   */
  buildings: ReadonlyArray<WalkBuilding>;
  /** What is named along the route: the name, its class, and where it is. `door` marks what OpenStreetMap names at the side of the route. */
  places?: ReadonlyArray<{ name: string; kind: string; x: number; y: number; size: number; door?: boolean }> | undefined;
  /** Buildings modelled by hand: each takes the place of the building the map has where it stands. */
  landmarks?: ReadonlyArray<Landmark> | undefined;
  /** Where the image of the kinds of ground lies, and the size of its cells. */
  land?: { x0: number; y0: number; cols: number; rows: number; cellM: number } | undefined;
  /** Stretches of the route on a paved road, as shares of its length: from, to, from, to… */
  paved?: readonly number[] | undefined;
  /** Of those, the stretches for people on foot: a promenade has no lines painted on it. */
  walked?: readonly number[] | undefined;
}

export interface WalkBuilding {
  heightM: number;
  rings: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
  floors?: number | undefined;
  /** The floors of the tallest part of the building this is a part of, when that is more. */
  tallest?: number | undefined;
  use?: string | undefined;
  year?: number | undefined;
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
/** An afternoon sun from the south-west: long shadows, warm light. */
const SUN = new THREE.Vector3(-0.62, 0.47, 0.56).normalize();
/** Half the side of the square the shadows are worked out in, around the runner. */
const SHADOW_REACH_M = 150;
/** The haze of the horizon and the blue overhead. A photograph sets these, not the tokens. */
const HAZE = 0xdfe8ef;
const ZENITH = 0x5d93cf;
/** Greens of each kind of plant, and the wood of a trunk. */
const LEAF: Record<PlantKind, number> = { pine: 0x4a7a42, oak: 0x5c8040, deciduous: 0x7fae4c, olive: 0x98a780, bush: 0x6f9448, grass: 0xb3ad68 };
/** Plaster: white and cream most of all, then ochre, salmon, a grey that leans to blue and a faded red. Each house takes one. */
const WALLS = [0xf3efe6, 0xead9b5, 0xdcb98a, 0xe2b49c, 0xd5dbdc, 0xcf9f86] as const;
const WALL_SHARES = [0.3, 0.52, 0.68, 0.81, 0.91] as const;
/** The sea is drawn a hand under the level the model calls zero, so a beach at zero stays dry. */
const SEA_LEVEL_M = -0.25;
/** A name of the map is shown while the runner is within this distance of it, and so many at a time. */
const NAME_RANGE_M = 260;
/** What the ICGC calls a place, in the words of the page. Said only when the name does not say it itself. */
const PLACE_WORDS: Record<string, string> = {
  esglesia: 'Església',
  monestir: 'Monestir',
  ermita: 'Ermita',
  capella: 'Capella',
  santuari: 'Santuari',
  castell: 'Castell',
  torre_defensa: 'Torre de defensa',
  masia: 'Masia',
  allotjament_rural: 'Allotjament rural',
  platja: 'Platja',
  cala: 'Cala',
  cap: 'Cap',
  port: 'Port',
  moll: 'Moll',
  vela: 'Club nàutic',
  escullera: 'Espigó',
  educacio: 'Escola',
  esports: 'Esports',
  hipica: 'Hípica',
  camping: 'Càmping',
  cementiri: 'Cementiri',
  deixalleria: 'Deixalleria',
  estacio_baixador: 'Estació',
  estacio_ferroviaria: 'Estació',
  poligons_industrials: 'Polígon',
  arbre_singular: 'Arbre singular',
  riera: 'Riera',
  veinat: 'Veïnat',
  neighbourhood: 'Barri',
  urbanitzacio: 'Urbanització',
  // The tags of OpenStreetMap, for what it names at the side of the route.
  restaurant: 'Restaurant',
  bar: 'Bar',
  pub: 'Bar',
  cafe: 'Cafè',
  ice_cream: 'Gelateria',
  fast_food: 'Menjar ràpid',
  pharmacy: 'Farmàcia',
  bank: 'Banc',
  library: 'Biblioteca',
  theatre: 'Teatre',
  cinema: 'Cinema',
  police: 'Policia',
  post_office: 'Correus',
  fuel: 'Benzinera',
  marketplace: 'Mercat',
  hospital: 'Hospital',
  clinic: 'Clínica',
  school: 'Escola',
  place_of_worship: 'Església',
  shop: 'Botiga',
  supermarket: 'Supermercat',
  bakery: 'Forn de pa',
  bicycle: 'Bicicletes',
  sports: 'Esports',
  hotel: 'Hotel',
  hostel: 'Alberg',
  guest_house: 'Hostal',
  museum: 'Museu',
  artwork: 'Escultura',
  viewpoint: 'Mirador',
  camp_site: 'Càmping',
  gallery: 'Galeria',
  monument: 'Monument',
  memorial: 'Memorial',
  castle: 'Castell',
  ruins: 'Ruïnes',
  archaeological_site: 'Jaciment',
  tower: 'Torre',
  park: 'Parc',
  sports_centre: 'Esports',
  marina: 'Port esportiu',
  lighthouse: 'Far',
  windmill: 'Molí',
};
/** The kinds of place that have a shop front on the street. */
const SHOP_KINDS = new Set(['restaurant', 'bar', 'pub', 'cafe', 'ice_cream', 'fast_food', 'pharmacy', 'bank', 'shop', 'supermarket', 'bakery', 'bicycle', 'sports']);
/** A bar or a shop is named from closer by than a church. */
const DOOR_RANGE_M = 90;
/** Names that say nothing on the ground: a trail code, a survey point, the town the whole route is in. */
const PLACE_SKIPPED = new Set(['gr', 'vertex_geodesic', 'municipality', 'town', 'city', 'parada', 'cami', 'sequia', 'torrent', 'stream']);
/** How many pictures of a bay the strip of facades holds (`textures.ts`). */
const BAYS = 9;
/** A block of flats from this year on has terraces from side to side, not windows with shutters. */
const MODERN_FROM = 1955;
/** A floor is this tall and a bay this wide, more or less: a wall is cut in whole ones. */
const FLOOR_M = 2.9;
const BAY_M = 3.1;

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

  /**
   * Height of the ground at a point, in scene units: on the very triangle of the terrain the point is over.
   * Anything else leaves a path a hand under the ground here and a hand over it there.
   */
  const groundAt = (x: number, y: number): number => {
    const c = Math.min(width - 1, Math.max(0, (x / sizeX) * (width - 1)));
    const r = Math.min(height - 1, Math.max(0, ((sizeZ - y) / sizeZ) * (height - 1)));
    const c0 = Math.min(width - 2, Math.floor(c));
    const r0 = Math.min(height - 2, Math.floor(r));
    const [u, v] = [c - c0, r - r0];
    const at = (cc: number, rr: number): number => data[rr * width + cc]!;
    // Each cell of the terrain is two triangles, split from its south-west corner to its north-east one.
    const [southWest, northEast] = [at(c0, r0 + 1), at(c0 + 1, r0)];
    if (u + v <= 1) return lift(at(c0, r0) + (northEast - at(c0, r0)) * u + (southWest - at(c0, r0)) * v);
    return lift(at(c0 + 1, r0 + 1) + (southWest - at(c0 + 1, r0 + 1)) * (1 - u) + (northEast - at(c0 + 1, r0 + 1)) * (1 - v));
  };
  /** Kind of ground at a point: 0 unknown, 1 wood, 2 scrub, 3 meadow, 4 crops, 5 built, 6 bare, 7 water, 8 beach. */
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
  /** The colour of a whole tile: what its texture averages to. */
  const flatOf = (map: THREE.Texture) => texture(map, tileUV).level(float(9)).rgb;
  /** One kind of ground at this point: its texture, or the colour the texture averages to. */
  const coverOf = (pick: (map: THREE.Texture) => ReturnType<typeof read>) => {
    const [meadow, straw, wood, bare] = [pick(paints.grass), pick(paints.dryGrass), pick(paints.litter), pick(paints.earth)];
    // Unknown ground is taken for dry grass, and scrub is straw with bare earth showing through in patches.
    const worn = smoothstep(-0.1, 0.5, mx_noise_float(flatWorld.mul(0.11)));
    const scrub = mix(straw, bare, worn.mul(0.55));
    if (!landMap || !o.world.land) return straw;
    const land = o.world.land;
    const ragged = mx_noise_float(flatWorld.mul(0.21)).mul(3.2);
    const at = vec2(positionWorld.x.add(ragged).sub(land.x0).div(land.cols * land.cellM), float(1).sub(positionWorld.z.negate().add(ragged).sub(land.y0).div(land.rows * land.cellM)));
    const kind = texture(landMap, at).r.mul(255 / 30);
    // How much of each kind a point is: all of one, away from the edge between two.
    const is = (k: number) => float(1).sub(kind.sub(k).abs().clamp(0, 1));
    return mix(mix(mix(mix(mix(straw, wood, is(1)), scrub, is(2)), meadow, is(3)), bare, is(5).add(is(6)).add(is(8)).clamp(0, 1)), straw, is(4));
  };
  const cover = coverOf(read);
  const plain = luminance(coverOf(flatOf)).max(0.03);
  // The photograph is the colour of the place: a wood stays dark and a stubble field pale. The texture
  // gives it the grain it lacks, as lighter and darker than its own average, and a little of its own colour.
  const light = luminance(photo);
  const grain = luminance(cover).div(plain).sub(1).mul(1.25).add(1).clamp(0.35, 1.9);
  const textured = mix(photo.mul(grain), cover.mul(light.div(plain)), 0.3);
  groundMaterial.colorNode = mix(photo, textured, smoothstep(420, 30, away));
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
  // The route as it is drawn: a point every two and a half metres along it.
  const samples = Math.max(2, Math.ceil(total / 2.5));
  const point = new THREE.Vector3();
  const next = new THREE.Vector3();
  const drawn = new Float32Array((samples + 1) * 2);
  for (let i = 0; i <= samples; i++) {
    onPath(i / samples, point);
    drawn.set([point.x, -point.z], i * 2);
  }
  /** Distance from a point of the map to the route, and the share of the route nearest to it. */
  const cellM = 40;
  const cells = new Map<number, number[]>();
  for (let i = 0; i < samples; i++) {
    const key = Math.floor(drawn[i * 2]! / cellM) * 100003 + Math.floor(drawn[i * 2 + 1]! / cellM);
    (cells.get(key) ?? cells.set(key, []).get(key)!).push(i);
  }
  /**
   * Where the route runs beside itself: out along a promenade and back along it, a few metres apart. Two
   * roads drawn one over the other cross their lines; there the road is drawn without them.
   */
  const doubled = new Uint8Array(samples + 1);
  const apart = Math.ceil(80 / 2.5);
  for (let i = 0; i <= samples; i++) {
    const [x, y] = [drawn[i * 2]!, drawn[i * 2 + 1]!];
    const [cx, cy] = [Math.floor(x / cellM), Math.floor(y / cellM)];
    for (let dx = -1; dx <= 1 && !doubled[i]; dx++) {
      for (let dy = -1; dy <= 1 && !doubled[i]; dy++) {
        for (const j of cells.get((cx + dx) * 100003 + cy + dy) ?? []) {
          if (Math.abs(j - i) > apart && Math.hypot(drawn[j * 2]! - x, drawn[j * 2 + 1]! - y) < ROAD_HALF * 2.4) {
            doubled[i] = 1;
            break;
          }
        }
      }
    }
  }
  const nearest = (x: number, y: number): { distance: number; share: number } => {
    let best = Infinity;
    let share = 0;
    const [cx, cy] = [Math.floor(x / cellM), Math.floor(y / cellM)];
    for (let reach = 1; reach <= 4 && best === Infinity; reach++) {
      for (let dx = -reach; dx <= reach; dx++) {
        for (let dy = -reach; dy <= reach; dy++) {
          for (const i of cells.get((cx + dx) * 100003 + cy + dy) ?? []) {
            // To the stretch that starts at this point, not to the point: between two of them the path is as near.
            const [ax, ay, bx, by] = [drawn[i * 2]!, drawn[i * 2 + 1]!, drawn[i * 2 + 2]!, drawn[i * 2 + 3]!];
            const span = (bx - ax) ** 2 + (by - ay) ** 2;
            const t = span ? Math.min(1, Math.max(0, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / span)) : 0;
            const d = Math.hypot(x - ax - (bx - ax) * t, y - ay - (by - ay) * t);
            if (d < best) [best, share] = [d, (i + t) / samples];
          }
        }
      }
    }
    return { distance: best, share };
  };

  // The path: beaten earth that fades into the ground at its edges, and along its middle the line of the
  // route: what is left to run in the colour of its grade, what has been run inked in.
  /** A band along the route, with its points across at the given offsets (metres from the middle). */
  const inStretch = (stretches: readonly number[] | undefined, share: number): boolean => (stretches ?? []).some((from, i, all) => i % 2 === 0 && share >= from && share <= all[i + 1]!);
  const pavedAt = (share: number): boolean => inStretch(o.world.paved, share);
  const walkedAt = (share: number): boolean => inStretch(o.world.walked, share);
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
        // 0 is a path of earth, 1 a road, 2 a paved way for people on foot, 3 a road the route runs twice.
        roads[i * across + k] = paved ? (walkedAt(share) ? 2 : doubled[i] ? 3 : 1) : 0;
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
  const way = attribute('road', 'float');
  const road = way.clamp(0, 1);
  const lane = uv();
  // Beaten earth where the map has a track or nothing; where it has a paved way, what the photograph shows it paved with.
  const beaten = texture(paints.earth, vec2(positionWorld.x, positionWorld.z).div(2.6)).rgb.mul(mx_noise_float(vec3(positionWorld.x, positionWorld.z, 4).mul(0.5)).mul(0.12).add(1.02));
  // The lines of a road are painted at the edges of its texture: a road with no lines reads the texture between them.
  const unlined = step(2.5, way);
  const paved = texture(paints.tarmac, vec2(mix(lane.x, lane.x.mul(0.8).add(0.1), unlined), lane.y.div(ROAD_HALF * 2))).rgb;
  // A track is two ruts packed hard and pale by wheels, with looser, darker earth between them and at the sides.
  const rut = (middle: number) => smoothstep(0.17, 0.03, lane.x.sub(middle).abs());
  const tracked = beaten.mul(rut(0.27).add(rut(0.73)).mul(0.2).add(0.86));
  // What a paved way is paved with is in the photograph: the grey of tarmac, the pale slabs of a promenade,
  // the gold of packed sand under the trees of a square. The band takes that colour, with the grit of a
  // surface seen from close by; only where the photograph is the dark grey of a road does it get its lines.
  const seenFromAir = texture(ortho, vec2(positionWorld.x.div(sizeX), positionWorld.z.negate().div(sizeZ))).level(float(1.5)).rgb.mul(1.5);
  const ownColour = seenFromAir.div(seenFromAir.mul(0.55).add(1)).mul(1.2);
  const grit = luminance(texture(paints.tarmac, vec2(lane.x.mul(0.8).add(0.1), lane.y.div(ROAD_HALF * 2))).rgb).div(0.3).clamp(0.82, 1.12);
  const spread = ownColour.r.max(ownColour.g).max(ownColour.b).sub(ownColour.r.min(ownColour.g).min(ownColour.b));
  const tarmacked = smoothstep(0.5, 0.36, luminance(ownColour)).mul(smoothstep(0.1, 0.04, spread));
  // A promenade is laid in slabs: their joints, faint.
  const slab = vec2(lane.x.mul(5), lane.y.div(1.1));
  const joints = smoothstep(0.035, 0.0, slab.x.fract().sub(0.5).abs().sub(0.465).negate().min(slab.y.fract().sub(0.5).abs().sub(0.465).negate()));
  const walked = step(1.5, way).mul(float(1).sub(unlined));
  const surfaced = mix(ownColour.mul(grit).mul(mix(float(1), float(0.86), joints.mul(walked))), paved, tarmacked.mul(float(1).sub(walked)));
  dirtMaterial.colorNode = mix(tracked, surfaced, road);
  // A path is worn in the middle and grown over at the sides; a road ends where its tarmac ends.
  const grownOver = smoothstep(1, 0.5, attribute('edge', 'float').add(mx_noise_float(vec3(positionWorld.x, positionWorld.z, 9).mul(0.9)).mul(0.22))).mul(0.94);
  dirtMaterial.opacityNode = mix(grownOver, float(1), road);
  const dirt = new THREE.Mesh(bandOf([-PATH_HALF, -PATH_HALF * 0.55, 0, PATH_HALF * 0.55, PATH_HALF], 0.06, true), dirtMaterial);
  dirt.receiveShadow = true;
  dirt.renderOrder = 1;
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

  // ── What grows along the route. Trees stand in stretches of it, each drawn only when the camera is near.
  const stretches: Array<{ far: THREE.InstancedMesh[]; near: THREE.InstancedMesh[]; centre: THREE.Vector3; radius: number }> = [];
  const growth = new THREE.Group();
  // No two plants the same green: each takes its own shade, by its place in the line.
  const own = hash(instanceIndex).mul(0.36).add(0.84);
  const patchy = mx_noise_float(positionWorld.mul(0.55)).mul(0.16).add(1);
  // The photograph under a plant. Scrub and grass take most of their colour from it, so they are of a piece
  // with the ground they grow on and with the hills beyond, where the photograph is all there is.
  // It is read blurred, as the colour of the place and not of the spot: a bush by a track is not the white of the track.
  const under = texture(ortho, vec2(positionWorld.x.div(sizeX), positionWorld.z.negate().div(sizeZ))).level(float(3)).rgb.mul(1.5);
  const tinted = under.div(under.mul(0.55).add(1)).mul(1.2);
  // Pale ground is bare ground: what grows on it keeps a green of its own, and never glares.
  const pale = smoothstep(0.16, 0.42, luminance(tinted));
  // Seen from the air a wood is darker than its leaves are from beside it: the colour is lifted, and kept green.
  const place3 = mix(tinted.mul(1.7).add(vec3(0.012, 0.03, 0.004)), vec3(0.2, 0.27, 0.11), pale.mul(0.75));
  const FROM_PLACE: Record<PlantKind, number> = { pine: 0.3, oak: 0.3, deciduous: 0.3, olive: 0.3, bush: 0.55, grass: 0.65 };
  /** The colour of a leaf: the green of its kind, and the colour of the place it grows in. */
  const leafColour = (kind: PlantKind, map: THREE.Texture) => {
    const picture = texture(map, uv());
    // Grass goes from straw to green in patches, as a field does; a crown catches the sky on top.
    const tint = kind === 'grass' ? mix(vec3(1.05, 1, 0.9), vec3(0.78, 1.02, 0.7), smoothstep(-0.2, 0.5, mx_noise_float(vec3(positionWorld.x, positionWorld.z, 3).mul(0.07)))) : vec3(1.75, 1.75, 1.75).mul(normalWorld.y.mul(0.2).add(0.98));
    const ofKind = picture.rgb.mul(tint);
    const ofPlace = place3.mul(luminance(picture.rgb).mul(kind === 'grass' ? 2.9 : 3.6).add(0.25));
    return mix(ofKind, ofPlace, FROM_PLACE[kind]).mul(own).mul(patchy);
  };
  // The heart of a crown is leaves too, seen as a mass: a thicket laid over it from above and from the side.
  const thicketAt = (at: ReturnType<typeof vec2>) => luminance(texture(paints.thicket, at.div(1.9)).rgb).mul(3.4).add(0.25);
  const thicket = mix(thicketAt(vec2(positionWorld.x.add(positionWorld.z), positionWorld.y)), thicketAt(vec2(positionWorld.x, positionWorld.z)), normalWorld.y.abs());
  const heartOf = (kind: PlantKind) => mix(color(LEAF[kind]), place3.mul(1.25), FROM_PLACE[kind]).mul(own).mul(thicket);
  /** The body of a plant: bark on the trunk, and the heart of the crown in the shade of its own leaves. */
  const coreMaterial = (kind: PlantKind): THREE.MeshStandardNodeMaterial => {
    const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.95, metalness: 0 });
    const barked = texture(paints.bark, uv()).rgb.mul(1.25);
    material.colorNode = mix(barked, heartOf(kind), attribute('part', 'float')).mul(attribute('shade', 'float'));
    return material;
  };
  /** Its leaves: cards cut out by the picture of a spray of foliage. */
  const cardMaterial = (kind: PlantKind): THREE.MeshStandardNodeMaterial => {
    const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.42 });
    const picture = texture(kind === 'grass' ? paints.blades : paints.foliage[kind], uv());
    material.colorNode = leafColour(kind, kind === 'grass' ? paints.blades : paints.foliage[kind]).mul(attribute('shade', 'float'));
    // Leaves right in front of the lens are let go: a branch across the frame hides the route it stands by.
    material.opacityNode = kind === 'grass' ? picture.a : picture.a.mul(smoothstep(5, 11, distance(positionWorld, cameraPosition)));
    // A blade or a leaf is lit as the clump it belongs to, whichever of its two sides is seen.
    if (kind === 'grass') material.normalNode = transformNormalToView(vec3(0, 1, 0));
    return material;
  };
  /** A bush of the carpet: nothing but leaves, on cards that cross at its heart and cover it. */
  const shrubMaterial = (): THREE.MeshStandardNodeMaterial => {
    const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.92, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.42 });
    material.colorNode = leafColour('bush', paints.foliage.bush).mul(attribute('shade', 'float'));
    material.opacityNode = texture(paints.foliage.bush, uv()).a;
    return material;
  };
  const dummy = new THREE.Object3D();
  const grow = (kind: Exclude<PlantKind, 'bush' | 'grass'>, plants: ReadonlyArray<readonly [number, number, number]>): void => {
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
      // The same plants in four meshes that share their places: body and leaves, cut coarse for
      // afar and fine for near. Only the fine body casts a shadow: the shape of the crown, not of each leaf.
      const share = (geometry: THREE.BufferGeometry, material: THREE.Material): THREE.InstancedMesh => {
        const mesh = new THREE.InstancedMesh(geometry, material, ownPlants.length);
        mesh.instanceMatrix = matrices.instanceMatrix;
        mesh.boundingSphere = matrices.boundingSphere;
        mesh.visible = false;
        growth.add(mesh);
        return mesh;
      };
      growth.add(matrices);
      const near = [share(fine.core!, body), share(fine.cards, foliage)];
      const far = [share(coarse.core!, body), matrices];
      near[0]!.castShadow = true;
      stretches.push({ far, near, centre: matrices.boundingSphere!.center.clone(), radius: matrices.boundingSphere!.radius });
    }
  };
  // How far the leaves of a tree reach from its trunk, as a share of its height. A tree whose crown would
  // hang over the middle of the path is left out: the camera runs there, a little over head height.
  const REACH: Record<Exclude<PlantKind, 'bush' | 'grass'>, number> = { pine: 0.58, oak: 0.52, deciduous: 0.34, olive: 0.62 };
  for (const kind of ['pine', 'oak', 'deciduous', 'olive'] as const) {
    const clear = o.world.trees.filter((tree) => tree[3] === kind && nearest(tree[0], tree[1]).distance > tree[2] * REACH[kind] + 1.2);
    grow(kind, clear.map(([x, y, h]) => [x, y, h] as const));
  }

  // ── What covers the ground next to the runner: grass, the bushes of the scrub and of the floor of a wood,
  // stones. They go along with the runner (`createCarpet`), so they can be thick where they are seen.
  /** How far from the middle of the route its surface ends, at the point of it nearest to a place. */
  const edgeAt = (share: number): number => (pavedAt(share) ? ROAD_HALF + 0.5 : PATH_HALF);
  /** How green and dark the photograph is at a place, from 0 (pale, bare) to 1 (a wood): scrub is thick where it is. */
  const tones = readTones(ortho.image as CanvasImageSource, 4);
  const lushAt = (x: number, y: number): number => {
    const col = Math.min(tones.width - 1, Math.max(0, Math.floor((x / sizeX) * tones.width)));
    const row = Math.min(tones.height - 1, Math.max(0, Math.floor((1 - y / sizeZ) * tones.height)));
    const [r, g, b] = [tones.data[(row * tones.width + col) * 4]!, tones.data[(row * tones.width + col) * 4 + 1]!, tones.data[(row * tones.width + col) * 4 + 2]!];
    const dark = Math.min(1, Math.max(0.1, (0.72 - (0.3 * r + 0.59 * g + 0.11 * b) / 255) / 0.36));
    return dark * (g >= r * 0.96 ? 1 : 0.45);
  };
  /** True inside a building of the map. */
  const yards = new Map<number, Array<ReadonlyArray<readonly [number, number]>>>();
  const YARD_M = 24;
  for (const building of o.world.buildings) {
    const outer = building.rings[0];
    if (!outer) continue;
    const xs = outer.map((p) => p[0]);
    const ys = outer.map((p) => p[1]);
    for (let i = Math.floor((Math.min(...xs) - 1) / YARD_M); i <= Math.floor((Math.max(...xs) + 1) / YARD_M); i++) {
      for (let j = Math.floor((Math.min(...ys) - 1) / YARD_M); j <= Math.floor((Math.max(...ys) + 1) / YARD_M); j++) {
        (yards.get(i * 100003 + j) ?? yards.set(i * 100003 + j, []).get(i * 100003 + j)!).push(outer);
      }
    }
  }
  const indoors = (x: number, y: number): boolean => {
    for (const ring of yards.get(Math.floor(x / YARD_M) * 100003 + Math.floor(y / YARD_M)) ?? []) {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]!;
        const [xj, yj] = ring[j]!;
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) return true;
    }
    return false;
  };
  /**
   * Where the camera runs when there are houses: a track runs along a pavement, an arm's length from the
   * fronts, and a camera that follows it sees a wall. For each point of the route, how far it is to the
   * first house on either hand; the camera keeps to the middle of what is clear, a few metres at most
   * from the track, and comes to it gently.
   */
  const CLEAR_REACH_M = 16;
  const DRIFT_MOST_M = 6;
  const drift = new Float32Array(samples + 1);
  for (let i = 0; i <= samples; i++) {
    const [from, to] = [Math.max(0, i - 1), Math.min(samples, i + 1)];
    const [tx, ty] = [drawn[to * 2]! - drawn[from * 2]!, drawn[to * 2 + 1]! - drawn[from * 2 + 1]!];
    const span = Math.hypot(tx, ty) || 1;
    const clear = (side: number): number => {
      for (let reach = 1; reach <= CLEAR_REACH_M; reach++) if (indoors(drawn[i * 2]! + (-ty / span) * side * reach, drawn[i * 2 + 1]! + (tx / span) * side * reach)) return reach - 1;
      return CLEAR_REACH_M;
    };
    // To the left of the way it runs is positive. In the open there is nothing to keep clear of.
    drift[i] = Math.min(DRIFT_MOST_M, Math.max(-DRIFT_MOST_M, (clear(1) - clear(-1)) / 2));
  }
  for (let pass = 0; pass < 2; pass++) {
    const rough = Float32Array.from(drift);
    for (let i = 0; i <= samples; i++) {
      let [sum, count] = [0, 0];
      for (let k = Math.max(0, i - 12); k <= Math.min(samples, i + 12); k++) [sum, count] = [sum + rough[k]!, count + 1];
      drift[i] = sum / count;
    }
  }
  const driftAt = (share: number): number => {
    const at = Math.min(samples, Math.max(0, share * samples));
    const base = Math.min(samples - 1, Math.floor(at));
    return drift[base]! + (drift[base + 1]! - drift[base]!) * (at - base);
  };
  /** Sows a cell of a carpet: a grid of places inside it, each a little off its place, and what may grow at each. */
  const sown = (cellM: number, across: number, plant: (gi: number, gj: number, x: number, y: number, clear: (margin: number) => boolean, put: Put) => void) => (i: number, j: number, put: Put): void => {
    const step = cellM / across;
    // Most cells are nowhere near the path: only those that are look for it plant by plant.
    const byPath = nearest((i + 0.5) * cellM, (j + 0.5) * cellM).distance < cellM * 0.71 + ROAD_HALF + 4;
    for (let a = 0; a < across; a++) {
      for (let b = 0; b < across; b++) {
        const [gi, gj] = [i * across + a, j * across + b];
        const [x, y] = [(gi + scatter(gi, gj, 2)) * step, (gj + scatter(gi, gj, 3)) * step];
        if (x < 0 || y < 0 || x > sizeX || y > sizeZ) continue;
        plant(gi, gj, x, y, (margin) => {
          if (!byPath) return true;
          const near = nearest(x, y);
          return near.distance > edgeAt(near.share) + margin;
        }, put);
      }
    }
  };
  const carpets: Carpet[] = [];
  /** Lays the carpets. `lite` makes them smaller: for a phone, which has less to draw them with and shows less of them. */
  const layCarpets = (lite: boolean): void => {
    if (!landKinds) return;
    // How much of each grows on each kind of ground: unknown, wood, scrub, meadow, crops, built, bare, water.
    const grassy = [0.5, 0.4, 0.5, 0.95, 0.6, 0.12, 0.2, 0, 0];
    const bushy = [0.1, 0.42, 0.92, 0.04, 0, 0, 0.06, 0, 0];
    const stony = [0.03, 0.07, 0.14, 0.02, 0, 0, 0.3, 0, 0.01];
    carpets.push(
      createCarpet(plantGeometry('grass').cards, cardMaterial('grass'), { cellM: 6, radiusM: lite ? 30 : 44, perCell: 169 }, sown(6, 13, (gi, gj, x, y, clear, put) => {
        // Among houses grass grows only where the photograph is green: a garden, a verge. Not on a pavement.
        const kind = kindAt(x, y);
        if (scatter(gi, gj, 6) >= grassy[kind]! * (kind === 5 ? lushAt(x, y) : 0.4 + 0.6 * lushAt(x, y)) || !clear(-0.15) || indoors(x, y)) return;
        put(x, y, groundAt(x, y), 0.4 + scatter(gi, gj, 7) ** 2 * 0.75, scatter(gi, gj, 8) * Math.PI, 1.25);
      })),
      createCarpet(shrubGeometry(), shrubMaterial(), { cellM: 12, radiusM: lite ? 75 : 120, perCell: 36 }, sown(12, 6, (gi, gj, x, y, clear, put) => {
        const kind = kindAt(x, y);
        if (scatter(gi, gj, 4) >= bushy[kind]! * lushAt(x, y)) return;
        // The scrub of these hills stands shoulder high and more; under trees it is lower.
        const size = kind === 2 ? 0.7 + scatter(gi, gj, 5) ** 1.6 * 1.6 : 0.5 + scatter(gi, gj, 5) ** 1.6 * 1.1;
        const wide = 0.8 + scatter(gj, gi, 9) * 0.7;
        if (!clear(size * wide * 0.62 + 0.5) || indoors(x, y)) return;
        put(x, y, groundAt(x, y), size, scatter(gi, gj, 8) * Math.PI * 2, wide);
      })),
    );
    const stoneMaterial = new THREE.MeshStandardNodeMaterial({ roughness: 1, metalness: 0 });
    const mottled = mx_fractal_noise_float(positionLocal.mul(3.1).add(hash(instanceIndex).mul(40)), 3, 2.2, 0.55);
    stoneMaterial.colorNode = mix(color(0x8d8778), color(0xcfc7b4), smoothstep(-0.35, 0.45, mottled)).mul(mix(vec3(0.74, 0.8, 0.62), vec3(1, 1, 1), smoothstep(-0.1, 0.25, mx_noise_float(positionLocal.mul(1.7).add(7))))).mul(attribute('shade', 'float'));
    const stones = createCarpet(stoneGeometry(), stoneMaterial, { cellM: 15, radiusM: lite ? 75 : 120, perCell: 9 }, sown(15, 3, (gi, gj, x, y, clear, put) => {
      if (scatter(gi, gj, 11) >= stony[kindAt(x, y)]!) return;
      const size = 0.3 + scatter(gi, gj, 12) ** 2 * 1.3;
      if (!clear(size * 0.7) || indoors(x, y)) return;
      put(x, y, groundAt(x, y), size, scatter(gi, gj, 13) * Math.PI * 2, 0.8 + scatter(gj, gi, 14) * 0.7);
    }));
    // Bushes and stones throw their shadow where there is a screen wide enough to see it.
    stones.mesh.castShadow = carpets[1]!.mesh.castShadow = !lite;
    carpets.push(stones);
    for (const { mesh } of carpets) {
      mesh.receiveShadow = true;
      mesh.visible = false;
      growth.add(mesh);
    }
  };

  // ── The buildings of the map: walls with their windows, a roof of tile on a house and of sheet on a shed.
  const roofTones = readTones(ortho.image as CanvasImageSource, 1);
  /** The colour of the photograph at a place, 0–255: a roof is the colour it has from the air. */
  const photoAt = (x: number, y: number): readonly [number, number, number] => {
    const col = Math.min(roofTones.width - 1, Math.max(0, Math.floor((x / sizeX) * roofTones.width)));
    const row = Math.min(roofTones.height - 1, Math.max(0, Math.floor((1 - y / sizeZ) * roofTones.height)));
    const i = (row * roofTones.width + col) * 4;
    return [roofTones.data[i]!, roofTones.data[i + 1]!, roofTones.data[i + 2]!];
  };
  // Where OpenStreetMap has a bar or a shop, the wall nearest to it gets a shop front at street level.
  const shops = (o.world.places ?? []).filter((place) => place.door && SHOP_KINDS.has(place.kind)).map((place) => [place.x, place.y] as const);
  // A building modelled by hand takes the place of the one the map has under it.
  const landmarks = o.world.landmarks ?? [];
  const standsOn = (landmark: Landmark, ring: ReadonlyArray<readonly [number, number]> | undefined): boolean => {
    let inside = false;
    for (let i = 0, j = (ring?.length ?? 0) - 1; ring && i < ring.length; j = i++) {
      const [xi, yi] = ring[i]!;
      const [xj, yj] = ring[j]!;
      if (yi > landmark.y !== yj > landmark.y && landmark.x < ((xj - xi) * (landmark.y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const standing = o.world.buildings.filter((building) => !landmarks.some((landmark) => standsOn(landmark, building.rings[0])));
  const built = buildingsOf(standing, groundAt, photoAt, shops);
  const handmade = landmarks.map((landmark) => {
    const model = buildLandmark(landmark.model);
    model.position.set(landmark.x, groundAt(landmark.x, landmark.y), -landmark.y);
    model.rotation.y = landmark.turn;
    return model;
  });
  const wallMaterial = new THREE.MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0 });
  // A renderer takes eight buffers to a mesh at most: what a wall is goes four to a buffer.
  const look = attribute('look', 'vec4');
  const more = attribute('more', 'vec3');
  const tone = look.x;
  const isRoof = look.y;
  const wall = uv();
  // A wall is bays across and floors up, whole ones: `uv` counts them. Each bay of each floor is one of the
  // pictures of the strip: a window, a balcony, closed shutters, bare wall; at street level, a door now and then.
  const [bayOf, floorOf] = [wall.x.floor(), wall.y.floor().max(0)];
  const pick = hash(bayOf.mul(13).add(floorOf.mul(71)).add(tone.mul(977).floor()).add(4000));
  const atStreet = step(wall.y, 1);
  // 1 is a house, a half a block of flats, 0 a shed.
  const isHouse = step(0.25, look.z);
  const upstairs = step(0.45, pick).add(step(0.72, pick)).add(step(0.9, pick));
  const old = mix(upstairs, step(pick, 0.3).mul(4), atStreet);
  // A modern block: a terrace to each bay of each floor, one in four with its awning down; at street level, shops and a door now and then.
  const block = mix(float(7).add(step(0.75, pick)), mix(float(6), float(4), step(0.72, pick)), atStreet);
  const house = mix(old, block, more.z);
  // A shed is bare wall, with a gate here and there.
  const shed = mix(float(3), float(5), atStreet.mul(step(0.8, pick)));
  const which = mix(mix(mix(shed, house, isHouse), float(6), more.y.mul(atStreet)), float(3), look.w);
  const within = vec2(wall.x.fract().add(which).div(BAYS), wall.y.fract());
  const facade = texture(paints.bays, within).grad(vec2(dFdx(wall.x).div(BAYS), dFdx(wall.y)), vec2(dFdy(wall.x).div(BAYS), dFdy(wall.y))).rgb;
  const wallOf = (i: number) => color(WALLS[i]!);
  const takes = (i: number) => step(WALL_SHARES[i]!, tone);
  const plaster = mix(mix(mix(mix(mix(wallOf(0), wallOf(1), takes(0)), wallOf(2), takes(1)), wallOf(3), takes(2)), wallOf(4), takes(3)), wallOf(5), takes(4));
  // Below the floor a wall is its plinth: the same plaster, darker and rougher. On a slope it is as tall as the slope.
  const footing = plaster.mul(texture(paints.earth, vec2(wall.x.mul(1.3), wall.y.mul(1.3))).rgb.mul(0.55).add(0.38));
  const walls = mix(facade.mul(plaster).mul(mix(0.8, 1, smoothstep(0.05, 0.6, wall.y))), footing, step(wall.y, 0));
  // A roof is the colour it has in the photograph, where it stands: red tile, a grey terrace, the white of a
  // new sheet. The photograph gives the colour and a texture the grain: tile laid along the slope of a
  // pitched roof, the seams of the sheet on a shed, and little on a terrace.
  const fromAir = texture(ortho, vec2(positionWorld.x.div(sizeX), positionWorld.z.negate().div(sizeZ))).level(float(1)).rgb.mul(1.5);
  // Seen from the air at midday a roof is paler than it is from the street in the afternoon.
  const roofPhoto = saturation(fromAir.div(fromAir.mul(0.55).add(1)).mul(1.12), 1.45);
  const roofUV = vec2(wall.x.div(2.4), wall.y.div(2.4));
  const tileGrain = luminance(texture(paints.tiles, roofUV).rgb).div(luminance(texture(paints.tiles, roofUV).level(float(9)).rgb).max(0.03)).clamp(0.55, 1.5);
  const seams = fract(wall.x.div(1.1)).sub(0.5).abs().mul(0.3).add(0.88);
  const terrace = mx_noise_float(vec3(positionWorld.x, positionWorld.z, 0).mul(1.7)).mul(0.07).add(0.97);
  const pitched = more.x;
  const roofGrain = mix(mix(seams, terrace, isHouse), tileGrain, pitched);
  wallMaterial.colorNode = mix(walls, roofPhoto.mul(roofGrain), isRoof);
  const buildings = new THREE.Mesh(built, wallMaterial);
  buildings.castShadow = true;
  buildings.receiveShadow = true;

  // ── The sea, where the route has one: the model holds nothing there, and the photograph says what colour
  // the water is at each place, the pale shallows and the dark of the deep. On top of it, the ripple and the shine.
  const sea: THREE.Mesh[] = [];
  if (o.terrain.seaBedM !== undefined) {
    const water = new THREE.MeshStandardNodeMaterial({ roughness: 0.16, metalness: 0, transparent: true, depthWrite: false });
    const swell = vec3(positionWorld.x, positionWorld.z, 0);
    const tilt = (offset: number) => mx_noise_float(swell.mul(0.09).add(offset)).mul(0.05).add(mx_noise_float(swell.mul(0.45).add(offset * 2)).mul(0.05)).add(mx_noise_float(swell.mul(1.6).add(offset * 3)).mul(0.025));
    water.normalNode = transformNormalToView(vec3(tilt(3.1), 1, tilt(17.3)).normalize());
    const seen = texture(ortho, vec2(positionWorld.x.div(sizeX), positionWorld.z.negate().div(sizeZ))).level(float(2)).rgb.mul(1.5);
    const tinted = seen.div(seen.mul(0.55).add(1)).mul(1.1);
    water.colorNode = mix(tinted, vec3(0.03, 0.2, 0.3), 0.3);
    water.opacityNode = float(0.9);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(sizeX, sizeZ, 1, 1), water);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(sizeX / 2, lift(SEA_LEVEL_M), -sizeZ / 2);
    plane.receiveShadow = true;
    sea.push(plane);
  }

  // ── The runner: a figure in running kit, the shirt in the signal colour, on a ring that marks it from afar.
  const runnerMaterial = new THREE.MeshStandardNodeMaterial({ roughness: 0.75, metalness: 0 });
  const ringMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const outlineMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const cloth = (hex: number): THREE.MeshStandardNodeMaterial => new THREE.MeshStandardNodeMaterial({ roughness: 0.8, metalness: 0, color: hex });
  const [skin, shorts, shoe, hair] = [cloth(0xc48a66), cloth(0x1d222b), cloth(0xf0ede4), cloth(0x2b2019)];
  const runner = new THREE.Group();
  /** A rounded piece of the figure, hanging from the point it is given: `drop` is where its middle lies below it. */
  const piece = (material: THREE.Material, radius: number, length: number, drop: number, forward = 0): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), material);
    mesh.position.set(0, -drop, forward);
    mesh.castShadow = true;
    return mesh;
  };
  const hang = (at: readonly [number, number, number], ...parts: THREE.Object3D[]): THREE.Group => {
    const group = new THREE.Group();
    group.position.set(...at);
    group.add(...parts);
    return group;
  };
  // A leg hangs from the hip and bends at the knee; an arm hangs from the shoulder and bends at the elbow.
  const limbs = [1, -1].map((side) => {
    const foot = piece(shoe, 0.05, 0.15, 0.44, 0.06);
    foot.rotation.x = Math.PI / 2;
    const knee = hang([0, -0.45, 0], piece(skin, 0.055, 0.31, 0.21), foot);
    const hip = hang([side * 0.09, 0.93, 0], piece(skin, 0.074, 0.3, 0.225), piece(shorts, 0.088, 0.11, 0.1), knee);
    const elbow = hang([0, -0.28, 0], piece(skin, 0.038, 0.19, 0.13), piece(skin, 0.045, 0.01, 0.27));
    const shoulder = hang([side * 0.205, 1.45, 0], piece(skin, 0.044, 0.19, 0.14), piece(runnerMaterial, 0.058, 0.07, 0.07), elbow);
    return { hip, knee, shoulder, elbow, phase: side > 0 ? 0 : Math.PI };
  });
  const shoulders = piece(runnerMaterial, 0.085, 0.25, -1.44);
  shoulders.rotation.z = Math.PI / 2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), skin);
  head.position.set(0, 1.69, 0.02);
  const scalp = new THREE.Mesh(new THREE.SphereGeometry(0.122, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  scalp.position.set(0, 1.695, 0.004);
  scalp.rotation.x = -0.35;
  head.castShadow = scalp.castShadow = true;
  const figure = new THREE.Group();
  figure.add(piece(runnerMaterial, 0.15, 0.3, -1.22), shoulders, piece(shorts, 0.152, 0.06, -0.95), piece(skin, 0.048, 0.06, -1.57), head, scalp, ...limbs.flatMap((limb) => [limb.hip, limb.shoulder]));
  // Leaning into the run.
  figure.rotation.x = 0.1;
  const flat = (inner: number, outer: number, material: THREE.Material): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 40), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.2;
    return mesh;
  };
  // The ring is drawn after the path and the line of the route: none of them writes its depth, so the last one drawn is the one seen.
  const [halo, ring] = [flat(1.05, 1.5, outlineMaterial), flat(1.15, 1.4, ringMaterial)];
  halo.renderOrder = 4;
  ring.renderOrder = 5;
  runner.add(figure, halo, ring);
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
  const sun = new THREE.DirectionalLight(0xffe9c8, 3.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -SHADOW_REACH_M, right: SHADOW_REACH_M, top: SHADOW_REACH_M, bottom: -SHADOW_REACH_M, near: 20, far: 1400 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.7;
  scene.add(sky, ground, ...sea, ...handmade, dirt, aheadBand, doneBand, growth, buildings, runner, pointer, sun, sun.target, new THREE.HemisphereLight(0xd9e8ff, 0xbfae92, 2.25));

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
  const focus = new THREE.Vector3();
  const focused = new THREE.Vector3(Infinity, 0, 0);

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
  // The names the map writes along the route, each over its place: over the roof, where it is a building.
  const names = (o.world.places ?? [])
    .filter((place) => !PLACE_SKIPPED.has(place.kind))
    .map((place) => {
      let roof = 0;
      for (const building of o.world.buildings) {
        const outer = building.rings[0];
        if (!outer || Math.abs(outer[0]![0] - place.x) > 120 || Math.abs(outer[0]![1] - place.y) > 120) continue;
        let inside = false;
        for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
          const [xi, yi] = outer[i]!;
          const [xj, yj] = outer[j]!;
          if (yi > place.y !== yj > place.y && place.x < ((xj - xi) * (place.y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) roof = Math.max(roof, building.heightM);
      }
      const element = document.createElement('div');
      element.dataset['sceneLabel'] = 'name';
      const text = document.createElement('span');
      text.dataset['type'] = 'text-xs';
      const word = PLACE_WORDS[place.kind];
      // "Masia" over "Mas Ribot" says it twice.
      const said = word && (place.name.toLocaleLowerCase('ca').includes(word.toLocaleLowerCase('ca').slice(0, 4)) || (place.kind === 'masia' && /^(mas|can|cal|ca)\b/i.test(place.name)));
      if (word && !said) {
        const kicker = document.createElement('small');
        kicker.textContent = `${word} · `;
        text.append(kicker);
      }
      text.append(place.name);
      element.append(text);
      element.hidden = true;
      labels.append(element);
      return { element, at: new THREE.Vector3(place.x, groundAt(place.x, place.y) + roof + (roof ? 3.5 : 6), -place.y), weight: place.size, range: place.size < 5 ? DOOR_RANGE_M : NAME_RANGE_M, width: (place.name.length + (word && !said ? word.length + 3 : 0)) * 7 + 24 };
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
    const taken: Array<readonly [number, number, number]> = [];
    for (const mark of marks) {
      screen.copy(mark.at).project(camera);
      const far = mark.kind === 'km' && flying > 0.5 && camera.position.distanceTo(mark.at) > KM_MARK_RANGE;
      const show = !far && screen.z < 1 && Math.abs(screen.x) < 1 && Math.abs(screen.y) < 1 && !hidden(mark.at);
      mark.element.hidden = !show;
      if (show) mark.element.style.transform = `translate(${((screen.x + 1) / 2) * size.width}px, ${((1 - screen.y) / 2) * size.height}px) translate(-50%, -100%)`;
      if (show) taken.push([((screen.x + 1) / 2) * size.width, ((1 - screen.y) / 2) * size.height, mark.text.length * 8 + 24]);
    }
    // Names: the nearest and the ones the map writes largest first, a few at a time, none over another
    // nor over a mark of the course. The top of the frame is left to the switch of views.
    const most = size.width < size.height ? 3 : 6;
    const ranked = flying > 0.5 ? names.map((name) => ({ name, away: name.at.distanceTo(here) })).filter(({ name, away }) => away < name.range).sort((a, b) => b.name.weight * 30 - b.away - (a.name.weight * 30 - a.away)) : [];
    const showing = new Set<(typeof names)[number]>();
    for (const { name } of ranked) {
      if (showing.size >= most) break;
      screen.copy(name.at).project(camera);
      const [left, topPx] = [((screen.x + 1) / 2) * size.width, ((1 - screen.y) / 2) * size.height];
      if (screen.z >= 1 || left < name.width / 2 || left > size.width - name.width / 2 || topPx < 76 || topPx > size.height * 0.72 || hidden(name.at)) continue;
      if (taken.some(([x, y, w]) => Math.abs(x - left) < (w + name.width) / 2 + 8 && Math.abs(y - topPx) < 34)) continue;
      taken.push([left, topPx, name.width]);
      showing.add(name);
      name.element.style.transform = `translate(${left}px, ${topPx}px) translate(-50%, -100%)`;
    }
    for (const name of names) name.element.hidden = !showing.has(name);
  };

  /** Places runner and camera at a share of the route. */
  const place = (share: number, rest: boolean): void => {
    onPath(share, here);
    onPath(share + CAMERA.ahead / total, ahead);
    // The camera keeps to the path, behind the runner: a path is clear of trunks, a straight line back is not.
    onPath(share - CAMERA.back / total, behind);
    if (share * total < CAMERA.back) behind.copy(here).addScaledVector(aim.subVectors(ahead, here).setY(0).normalize(), -(CAMERA.back - share * total)).setY(groundAt(behind.x, -behind.z));
    follow.copy(behind);
    // Among houses the camera keeps to the middle of the street, not to the pavement the track runs along.
    const aside = driftAt(share - CAMERA.back / total);
    aim.subVectors(here, behind).setY(0).normalize();
    follow.x += aim.z * aside;
    follow.z -= aim.x * aside;
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
    // The stride follows the ground covered: a step every 1.2 m, whichever way the scroll goes. A leg swings
    // forward bent and lands almost straight; the arm of its side goes the other way, bent at the elbow.
    const stride = ((share * total) / 2.4) * Math.PI * 2;
    for (const limb of limbs) {
      const swing = Math.sin(stride + limb.phase);
      limb.hip.rotation.x = -(0.15 + 0.62 * swing);
      limb.knee.rotation.x = 0.2 + 1.15 * (0.5 + 0.5 * Math.cos(stride + limb.phase + 0.3)) ** 2;
      limb.shoulder.rotation.x = 0.62 * swing - 0.1;
      limb.elbow.rotation.x = -(1.3 + 0.25 * swing);
    }
    figure.position.y = Math.abs(Math.cos(stride)) * 0.06;
    figure.rotation.y = Math.sin(stride) * 0.09;
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
      for (const mesh of stretch.near) mesh.visible = near;
      for (const mesh of stretch.far) mesh.visible = !near && (flying < 0.5 || away < DRAW_RANGE_M);
    }
    // The carpets lie ahead of the runner, where the camera looks. While the route is being leafed through
    // fast they stay where they were, out of sight, and are laid again once the view slows down.
    focus.copy(here).addScaledVector(aim.setY(0).normalize(), 14);
    const leap = focus.distanceTo(focused) > 30;
    focused.copy(focus);
    carpetFocus.value.set(focus.x, focus.z);
    for (const carpet of carpets) {
      carpet.mesh.visible = flying > 0.5;
      if (flying > 0.5 && (rest || !leap)) carpet.follow(focus.x, -focus.z);
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
      place(shown, settled);
      if (post) post.render();
      else stage.renderer.render(scene, camera);
      stage.canvas.dataset['share'] = shown.toFixed(4);
      stage.canvas.dataset['plants'] = String(carpets.reduce((sum, carpet) => sum + carpet.planted, 0));
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
  // A narrow screen is a phone; a browser without WebGPU draws with an older renderer, or with none but the processor.
  layCarpets(matchMedia('(max-width: 48rem)').matches || stage.backend !== 'webgpu');
  stage.canvas.dataset['engine'] = `three-walk-${stage.backend}`;
  stage.canvas.dataset['trees'] = String(o.world.trees.length);
  // How much of what stands along the route is told house by house, and how many of its places have a name.
  stage.canvas.dataset['houses'] = String(o.world.buildings.filter((building) => building.floors !== undefined).length);
  stage.canvas.dataset['names'] = String(names.length);
  stage.canvas.dataset['landmarks'] = String(handmade.length);

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
  place(shown, true);
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

/** The photograph as numbers, a few of its pixels to each: enough to tell a wood from a field. */
function readTones(image: CanvasImageSource, shrink: number): { width: number; height: number; data: Uint8ClampedArray } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((image as HTMLImageElement).width / shrink));
  canvas.height = Math.max(1, Math.round((image as HTMLImageElement).height / shrink));
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, data: context.getImageData(0, 0, canvas.width, canvas.height).data };
}

/** Walls and roofs of every building as one mesh. On a wall `uv` counts bays across and floors up from the floor; on a roof, metres. */
function buildingsOf(buildings: ReadonlyArray<WalkBuilding>, groundAt: (x: number, y: number) => number, photoAt: (x: number, y: number) => readonly [number, number, number], shops: ReadonlyArray<readonly [number, number]>): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  /** Tone of the plaster, whether it is roof, what kind of building it is and whether the wall is bare; then whether the roof is pitched, the wall a shop front and the building a modern block. */
  const looks: number[] = [];
  const mores: number[] = [];
  const areaOf = (ring: ReadonlyArray<readonly [number, number]>): number => {
    let area = 0;
    for (let i = 0; i < ring.length; i++) area += ring[i]![0] * ring[(i + 1) % ring.length]![1] - ring[(i + 1) % ring.length]![0] * ring[i]![1];
    return area / 2;
  };
  const within = (x: number, y: number, ring: ReadonlyArray<readonly [number, number]>): boolean => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]!;
      const [xj, yj] = ring[j]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  // Where each building stands and how high it reaches, so a wall knows what it has against it.
  const stood = buildings.map((building) => {
    const outer = building.rings[0] ?? [];
    const levels = outer.map(([x, y]) => groundAt(x, y));
    const floor = levels.length ? Math.max(...levels) : 0;
    return { outer, foot: (levels.length ? Math.min(...levels) : 0) - 1.5, floor, top: floor + building.heightM };
  });
  const CELL = 24;
  const cells = new Map<number, number[]>();
  stood.forEach(({ outer }, index) => {
    if (outer.length < 3) return;
    const xs = outer.map((p) => p[0]);
    const ys = outer.map((p) => p[1]);
    for (let i = Math.floor(Math.min(...xs) / CELL); i <= Math.floor(Math.max(...xs) / CELL); i++) {
      for (let j = Math.floor(Math.min(...ys) / CELL); j <= Math.floor(Math.max(...ys) / CELL); j++) (cells.get(i * 100003 + j) ?? cells.set(i * 100003 + j, []).get(i * 100003 + j)!).push(index);
    }
  });
  /** The top of the building a point is in, other than the one asking; null in the open. */
  const against = (x: number, y: number, self: number): number | null => {
    for (const index of cells.get(Math.floor(x / CELL) * 100003 + Math.floor(y / CELL)) ?? []) {
      if (index !== self && within(x, y, stood[index]!.outer)) return stood[index]!.top;
    }
    return null;
  };
  // The wall each shop is on: the nearest one that gives on the open, within a few metres of where the map has the shop.
  const shopWalls = new Set<number>();
  for (const [sx, sy] of shops) {
    let [best, wall] = [9, -1];
    const seen = new Set<number>();
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const index of cells.get((Math.floor(sx / CELL) + i) * 100003 + Math.floor(sy / CELL) + j) ?? []) {
      if (seen.has(index)) continue;
      seen.add(index);
      const { outer } = stood[index]!;
      const facing = Math.sign(areaOf(outer)) || 1;
      for (let k = 0; k < outer.length; k++) {
        const [ax, ay] = outer[k]!;
        const [bx, by] = outer[(k + 1) % outer.length]!;
        const length = Math.hypot(bx - ax, by - ay);
        if (length < 2) continue;
        const t = Math.min(1, Math.max(0, ((sx - ax) * (bx - ax) + (sy - ay) * (by - ay)) / (length * length)));
        const away = Math.hypot(sx - ax - (bx - ax) * t, sy - ay - (by - ay) * t);
        if (away >= best || against((ax + bx) / 2 + ((by - ay) / length) * facing * 0.6, (ay + by) / 2 - ((bx - ax) / length) * facing * 0.6, index) !== null) continue;
        [best, wall] = [away, index * 4096 + k];
      }
    }
    if (wall >= 0) shopWalls.add(wall);
  }
  buildings.forEach((building, self) => {
    const { outer, foot, floor, top } = stood[self]!;
    if (outer.length < 3) return;
    const floors = building.floors ?? Math.max(1, Math.round(building.heightM / FLOOR_M));
    /** Height as floors: 0 at the floor, and whole floors up to the eaves. */
    const storey = (y: number): number => ((y - floor) / building.heightM) * floors;
    const tone = scatter(outer[0]![0], outer[0]![1], 6);
    const area = areaOf(outer);
    const holes = building.rings.slice(1).map((ring) => ring.map(([x, y]) => new THREE.Vector2(x, y)));
    const xs = outer.map((point) => point[0]);
    const ys = outer.map((point) => point[1]);
    const centre = [xs.reduce((sum, x) => sum + x, 0) / xs.length, ys.reduce((sum, y) => sum + y, 0) / ys.length] as const;
    // What it is: the cadastre says when it is a workshop or a farm building; where it says nothing, a big
    // low footprint is taken for a shed. Anything else has windows.
    const shed = building.use ? building.use === 'industrial' || building.use === 'agriculture' : Math.abs(area) >= 450 && building.heightM <= 7.5;
    // What is on top: where the photograph shows the warm colour of tile on a roof of the size of a house or a barn, a pitched roof of tile; otherwise a flat one.
    const [red, green, blue] = [0, 1, 2].map((channel) => [0.25, 0.5, 0.75].reduce((sum, t) => sum + photoAt(centre[0] + (outer[0]![0] - centre[0]) * (t - 0.5), centre[1] + (outer[0]![1] - centre[1]) * (t - 0.5))[channel]!, 0) / 3) as [number, number, number];
    const warm = red > blue * 1.18 && red > green * 1.02 && red > 70;
    // The cadastre gives the year: a building of three floors or more put up since the fifties is a block of terraces, and so
    // is the low front at its foot, which is a part of it. Where the cadastre gives no year, a tall one is taken for modern.
    const block = !shed && (building.year !== undefined ? building.year >= MODERN_FROM && Math.max(floors, building.tallest ?? 0) >= 3 : floors >= 5);
    const pitched = !block && !holes.length && Math.abs(area) < 600 && (building.floors === undefined ? !shed && Math.abs(area) < 450 : warm);
    const tile = shed ? 0 : pitched ? 1 : 0.5;
    const modern = block ? 1 : 0;
    let front = 0;
    const add = (p: readonly [number, number, number], n: readonly [number, number, number], st: readonly [number, number], roof: number, plain = 0): void => {
      positions.push(...p);
      normals.push(...n);
      uvs.push(...st);
      looks.push(tone, roof, tile, plain);
      mores.push(pitched ? 1 : 0, front, modern);
    };
    // Walls look outwards whichever way the ring was drawn.
    const outwards = Math.sign(area) || 1;
    /** An upright wall between two points of the map, from one height to another at each end. */
    const wallOf = (ax: number, ay: number, bx: number, by: number, low: number, highA: number, highB: number, bays: readonly [number, number], facing: number, plain: number): void => {
      const length = Math.hypot(bx - ax, by - ay);
      const normal = [((by - ay) / length) * facing, 0, ((bx - ax) / length) * facing] as const;
      const quad = [
        [[ax, low, -ay], [bays[0], storey(low)]],
        [[bx, low, -by], [bays[1], storey(low)]],
        [[bx, highB, -by], [bays[1], storey(highB)]],
        [[ax, highA, -ay], [bays[0], storey(highA)]],
      ] as const;
      for (const k of facing > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]) add(quad[k]![0], normal, quad[k]![1], 0, plain);
    };
    let attached = false;
    building.rings.forEach((ring, which) => {
      let run = 0;
      for (let i = 0; i < ring.length; i++) {
        const [ax, ay] = ring[i]!;
        const [bx, by] = ring[(i + 1) % ring.length]!;
        const length = Math.hypot(bx - ax, by - ay);
        if (length < 0.05) continue;
        // A wall with another house against it is a party wall: nothing of it shows below the neighbour's
        // roof, and what stands above it has no windows.
        let low = foot;
        let party = false;
        if (which === 0) {
          const [nx, ny] = [((by - ay) / length) * outwards * 0.6, (-(bx - ax) / length) * outwards * 0.6];
          const tops = [0.25, 0.5, 0.75].map((t) => against(ax + (bx - ax) * t + nx, ay + (by - ay) * t + ny, self)).filter((value): value is number => value !== null);
          if (tops.length >= 2) {
            party = attached = true;
            low = Math.min(...tops) - 0.3;
          }
        }
        // Whole bays to a wall, so no window is cut by a corner; a wall too short for one is bare.
        const bays = Math.max(1, Math.round(length / BAY_M));
        front = which === 0 && shopWalls.has(self * 4096 + i) ? 1 : 0;
        if (low < top - 0.4) wallOf(ax, ay, bx, by, low, top, top, [run, run + bays], outwards, party || length < BAY_M * 0.7 ? 1 : 0);
        front = 0;
        run += bays;
      }
    });
    const slope = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, st: (point: THREE.Vector3) => [number, number]): void => {
      const normal = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(c, a));
      if (normal.lengthSq() < 1e-8) return;
      normal.normalize();
      const upwards = normal.y >= 0;
      if (!upwards) normal.negate();
      for (const point of upwards ? [a, b, c] : [a, c, b]) add([point.x, point.y, point.z], [normal.x, normal.y, normal.z], st(point), 1);
    };
    if (pitched && !attached && Math.abs(area) < 450) {
      // A house on its own: four slopes of tile, from eaves that stand out from the wall up to a flat ridge.
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
        // Tiles run in rows along the eaves and climb the slope.
        const st = (point: THREE.Vector3): [number, number] => {
          const from = new THREE.Vector3().subVectors(point, a);
          const across = from.dot(along);
          return [across, Math.sqrt(Math.max(0, from.lengthSq() - across * across))];
        };
        slope(a, b, c, st);
        slope(a, c, d, st);
      }
      const cap = ridge.map(([x, y]) => new THREE.Vector2(x, y));
      for (const triangle of THREE.ShapeUtils.triangulateShape(cap, [])) {
        for (const k of triangle) add([cap[k]!.x, top + rise, -cap[k]!.y], [0, 1, 0], [cap[k]!.x, cap[k]!.y], 1);
      }
      // A chimney by the ridge: four bare walls and a slab on top.
      const [hx, hy] = [centre[0] + (outer[0]![0] - centre[0]) * 0.22, centre[1] + (outer[0]![1] - centre[1]) * 0.22];
      const stack = [[hx - 0.32, hy - 0.32], [hx + 0.32, hy - 0.32], [hx + 0.32, hy + 0.32], [hx - 0.32, hy + 0.32]] as const;
      const [low, high] = [top + rise * 0.5, top + rise + 0.95];
      stack.forEach(([ax, ay], i) => wallOf(ax, ay, stack[(i + 1) % 4]![0], stack[(i + 1) % 4]![1], low, high, high, [0, 0.2], 1, 1));
      for (const k of [0, 1, 2, 0, 2, 3]) add([stack[k]![0], high, -stack[k]![1]], [0, 1, 0], [0, storey(high)], 0, 1);
    } else if (pitched) {
      // A house in a row: two slopes of tile, the ridge along its longest wall, and the walls at both ends carried up to it.
      let [ux, uy, longest] = [1, 0, 0];
      for (let i = 0; i < outer.length; i++) {
        const [dx, dy] = [outer[(i + 1) % outer.length]![0] - outer[i]![0], outer[(i + 1) % outer.length]![1] - outer[i]![1]];
        if (Math.hypot(dx, dy) > longest) [ux, uy, longest] = [dx / Math.hypot(dx, dy), dy / Math.hypot(dx, dy), Math.hypot(dx, dy)];
      }
      const across = (x: number, y: number): number => (x - centre[0]) * -uy + (y - centre[1]) * ux;
      const reaches = outer.map(([x, y]) => across(x, y));
      const middle = (Math.min(...reaches) + Math.max(...reaches)) / 2;
      const half = Math.max(0.5, (Math.max(...reaches) - Math.min(...reaches)) / 2);
      const rise = Math.min(2.4, half * 0.42);
      const lean = Math.hypot(half, rise) / half;
      const heightAt = (x: number, y: number): number => top + rise * Math.max(0, 1 - Math.abs(across(x, y) - middle) / half);
      const st = (point: THREE.Vector3): [number, number] => [(point.x - centre[0]) * ux + (-point.z - centre[1]) * uy, Math.abs(across(point.x, -point.z) - middle) * lean];
      for (const side of [1, -1]) {
        // The part of the outline on one side of the ridge.
        const part: Array<readonly [number, number]> = [];
        for (let i = 0; i < outer.length; i++) {
          const [a, b] = [outer[i]!, outer[(i + 1) % outer.length]!];
          const [da, db] = [(across(a[0], a[1]) - middle) * side, (across(b[0], b[1]) - middle) * side];
          if (da >= 0) part.push(a);
          if (da >= 0 !== db >= 0) part.push([a[0] + ((b[0] - a[0]) * da) / (da - db), a[1] + ((b[1] - a[1]) * da) / (da - db)]);
        }
        if (part.length < 3) continue;
        const contour = part.map(([x, y]) => new THREE.Vector2(x, y));
        const lifted = part.map(([x, y]) => new THREE.Vector3(x, heightAt(x, y), -y));
        for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(contour, [])) slope(lifted[i!]!, lifted[j!]!, lifted[k!]!, st);
        // The gable: the wall under the slope, wherever the outline climbs towards the ridge.
        for (let i = 0; i < part.length; i++) {
          const [a, b] = [part[i]!, part[(i + 1) % part.length]!];
          const [ha, hb] = [heightAt(a[0], a[1]), heightAt(b[0], b[1])];
          const onRidge = Math.abs(across(a[0], a[1]) - middle) < 0.01 && Math.abs(across(b[0], b[1]) - middle) < 0.01;
          if (onRidge || Math.max(ha, hb) - top < 0.05 || Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.05) continue;
          wallOf(a[0], a[1], b[0], b[1], top, ha, hb, [0, 0.2], outwards, 1);
        }
      }
    } else {
      // A shed, a block of flats, a terrace, or a block round a courtyard: a flat roof.
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
  geometry.setAttribute('look', new THREE.Float32BufferAttribute(looks, 4));
  geometry.setAttribute('more', new THREE.Float32BufferAttribute(mores, 3));
  return geometry;
}
