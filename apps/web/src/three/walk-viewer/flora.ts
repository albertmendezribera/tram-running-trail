import * as THREE from 'three/webgpu';

/** The kinds of tree the land-cover map tells apart, and the bush of the scrub. */
export type PlantKind = 'pine' | 'oak' | 'deciduous' | 'olive' | 'bush' | 'grass';

interface Blob {
  /** Centre and radii of a clump of foliage, as shares of the height of the plant. */
  at: readonly [number, number, number];
  radii: readonly [number, number, number];
  /** How finely it is cut: 1 for the main clump, 0 for the small ones. */
  detail: 0 | 1;
}

interface Shape {
  trunk: { top: number; radius: number } | null;
  blobs: readonly Blob[];
  lump: number;
}

// One shape per kind of wood: the stone pine, an umbrella on a tall trunk; the evergreen oak (holm or cork),
// round and low; the deciduous tree of a riverside or a plantation, tall and narrow; the olive, wide and
// short. The kind is the map's; the shape stands for all the trees of that kind.
const SHAPES: Record<PlantKind, Shape> = {
  pine: {
    trunk: { top: 0.72, radius: 0.022 },
    blobs: [
      { at: [0, 0.82, 0], radii: [0.36, 0.16, 0.36], detail: 1 },
      { at: [0.2, 0.77, 0.1], radii: [0.22, 0.11, 0.22], detail: 0 },
      { at: [-0.18, 0.85, -0.13], radii: [0.2, 0.1, 0.2], detail: 0 },
    ],
    lump: 0.2,
  },
  oak: {
    trunk: { top: 0.42, radius: 0.03 },
    blobs: [
      { at: [0, 0.66, 0], radii: [0.31, 0.29, 0.31], detail: 1 },
      { at: [0.2, 0.56, 0.08], radii: [0.2, 0.18, 0.2], detail: 0 },
      { at: [-0.17, 0.6, -0.14], radii: [0.19, 0.19, 0.19], detail: 0 },
      { at: [0.02, 0.83, 0.1], radii: [0.18, 0.14, 0.18], detail: 0 },
    ],
    lump: 0.24,
  },
  deciduous: {
    trunk: { top: 0.32, radius: 0.018 },
    blobs: [
      { at: [0, 0.63, 0], radii: [0.17, 0.35, 0.17], detail: 1 },
      { at: [0.06, 0.44, 0.05], radii: [0.14, 0.2, 0.14], detail: 0 },
    ],
    lump: 0.18,
  },
  olive: {
    trunk: { top: 0.42, radius: 0.05 },
    blobs: [
      { at: [0, 0.68, 0], radii: [0.38, 0.27, 0.38], detail: 1 },
      { at: [0.22, 0.6, 0.1], radii: [0.24, 0.2, 0.24], detail: 0 },
      { at: [-0.2, 0.63, -0.1], radii: [0.22, 0.2, 0.22], detail: 0 },
    ],
    lump: 0.28,
  },
  bush: { trunk: null, blobs: [{ at: [0, 0.42, 0], radii: [0.62, 0.48, 0.62], detail: 0 }, { at: [0.3, 0.3, 0.2], radii: [0.4, 0.32, 0.4], detail: 0 }], lump: 0.3 },
  // Grass is blades, not clumps: see `tuft`.
  grass: { trunk: null, blobs: [], lump: 0 },
};

const cell = (x: number, y: number, z: number): number => {
  const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return v - Math.floor(v);
};
/** A smooth number in [0, 1) from a direction: neighbouring corners get neighbouring values, so a clump bulges, it does not crumple. */
const wobble = (x: number, y: number, z: number): number => {
  const [sx, sy, sz] = [x * 2.3 + 11, y * 2.3 + 17, z * 2.3 + 23];
  const [ix, iy, iz] = [Math.floor(sx), Math.floor(sy), Math.floor(sz)];
  const smooth = (v: number): number => v * v * (3 - 2 * v);
  const [fx, fy, fz] = [smooth(sx - ix), smooth(sy - iy), smooth(sz - iz)];
  const along = (dy: number, dz: number): number => cell(ix, iy + dy, iz + dz) + (cell(ix + 1, iy + dy, iz + dz) - cell(ix, iy + dy, iz + dz)) * fx;
  const low = along(0, 0) + (along(1, 0) - along(0, 0)) * fy;
  const high = along(0, 1) + (along(1, 1) - along(0, 1)) * fy;
  return low + (high - low) * fz;
};

export interface Plant {
  /** Trunk and the dark heart of the crown: what gives the plant its body and casts its shadow. Null for grass. */
  core: THREE.BufferGeometry | null;
  /** The foliage: cards of leaves all over the crown, each facing its own way. */
  cards: THREE.BufferGeometry;
}

const geometryOf = (attributes: Record<string, [number[], number]>): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry();
  for (const [name, [values, size]] of Object.entries(attributes)) geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, size));
  return geometry;
};

/** A tuft of grass: three cards of blades crossed at one foot, in metres. */
function tuft(): Plant {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const shades: number[] = [];
  for (let i = 0; i < 3; i++) {
    const turn = (i / 3) * Math.PI + 0.3;
    const [dx, dz] = [Math.cos(turn) * 0.42, Math.sin(turn) * 0.42];
    const corners: Array<[number[], number[]]> = [[[-dx, 0, -dz], [0, 0]], [[dx, 0, dz], [1, 0]], [[dx, 0.62, dz], [1, 1]], [[-dx, 0.62, -dz], [0, 1]]];
    for (const k of [0, 1, 2, 0, 2, 3]) {
      positions.push(...corners[k]![0]);
      // Lit as the ground it grows on: a field of blades shades evenly.
      normals.push(0, 1, 0);
      uvs.push(...corners[k]![1]);
      shades.push(0.7 + corners[k]![1][1]! * 0.45);
    }
  }
  return { core: null, cards: geometryOf({ position: [positions, 3], normal: [normals, 3], uv: [uvs, 2], shade: [shades, 1] }) };
}

/**
 * A plant one unit tall, standing on y = 0. Its body is a trunk and the clumps of its crown, shrunk
 * and dark; its leaves are cards spread over those clumps, lit as the clump they belong to, so the
 * crown shades as a volume and ends in leaves. `fine` cuts the body finer and gives it more cards,
 * for the plants next to the camera.
 */
export function plantGeometry(kind: PlantKind, fine = false): Plant {
  if (kind === 'grass') return tuft();
  const shape = SHAPES[kind];
  const core = { positions: [] as number[], normals: [] as number[], uvs: [] as number[], shades: [] as number[], parts: [] as number[] };
  if (shape.trunk) {
    const sides = fine ? 7 : 5;
    const { top, radius } = shape.trunk;
    const ring = (i: number, y: number, r: number): [number[], number[], number[]] => {
      const a = (i / sides) * Math.PI * 2;
      // Bark wraps the trunk twice and climbs it: its ridges stay as wide as they are tall.
      return [[Math.cos(a) * r, y, Math.sin(a) * r], [Math.cos(a), 0, Math.sin(a)], [(i / sides) * 2, y * 6]];
    };
    for (let i = 0; i < sides; i++) {
      // Sunk a little, so a slope never shows the foot of the trunk in the air.
      const quad = [ring(i, -0.1, radius * 1.6), ring(i + 1, -0.1, radius * 1.6), ring(i + 1, top, radius), ring(i, top, radius)];
      for (const k of [0, 2, 1, 0, 3, 2]) {
        core.positions.push(...quad[k]![0]);
        core.normals.push(...quad[k]![1]);
        core.uvs.push(...quad[k]![2]);
        core.shades.push(0.9);
        core.parts.push(0);
      }
    }
  }
  const cards = { positions: [] as number[], normals: [] as number[], uvs: [] as number[], shades: [] as number[] };
  shape.blobs.forEach((blob, b) => {
    // The heart of the clump: smaller than its leaves reach, and in their shade.
    const sphere = new THREE.IcosahedronGeometry(1, fine ? 1 : 0);
    const points = sphere.getAttribute('position');
    for (let i = 0; i < points.count; i++) {
      const [x, y, z] = [points.getX(i), points.getY(i), points.getZ(i)];
      const push = (1 + shape.lump * (wobble(x, y, z) - 0.5) * 2) * 0.8;
      core.positions.push(blob.at[0] + x * blob.radii[0] * push, blob.at[1] + y * blob.radii[1] * push, blob.at[2] + z * blob.radii[2] * push);
      const n = new THREE.Vector3(x / blob.radii[0], y / blob.radii[1], z / blob.radii[2]).normalize();
      core.normals.push(n.x, n.y, n.z);
      core.uvs.push(0, 0);
      core.shades.push(0.5 + 0.25 * ((y + 1) / 2));
      core.parts.push(1);
    }
    sphere.dispose();
    // Its leaves: cards set all round it (a spiral over the sphere spreads them evenly), each tilted its own way.
    const count = Math.round((fine ? 46 : 16) * (blob.detail ? 1 : 0.5));
    const span = Math.min(blob.radii[0], blob.radii[2]) * (blob.detail ? 1.25 : 1.5);
    const out = new THREE.Vector3();
    const facing = new THREE.Vector3();
    const side = new THREE.Vector3();
    const upward = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const y = 1 - (2 * (i + 0.5)) / count;
      const around = i * 2.399963 + b;
      const r = Math.sqrt(1 - y * y);
      out.set(Math.cos(around) * r, y, Math.sin(around) * r);
      const reach = 0.82 + cell(i, b, 1) * 0.3;
      const at = [blob.at[0] + out.x * blob.radii[0] * reach, blob.at[1] + out.y * blob.radii[1] * reach, blob.at[2] + out.z * blob.radii[2] * reach];
      facing.set(out.x + (cell(i, b, 2) - 0.5) * 1.3, out.y + (cell(i, b, 3) - 0.5) * 1.3, out.z + (cell(i, b, 4) - 0.5) * 1.3).normalize();
      side.crossVectors(facing, Math.abs(facing.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
      upward.crossVectors(side, facing);
      const half = (span * (0.8 + cell(i, b, 5) * 0.5)) / 2;
      const corner = (u: number, v: number): number[] => [at[0]! + (side.x * u + upward.x * v) * half, at[1]! + (side.y * u + upward.y * v) * half, at[2]! + (side.z * u + upward.z * v) * half];
      const quad: Array<[number[], number[]]> = [[corner(-1, -1), [0, 0]], [corner(1, -1), [1, 0]], [corner(1, 1), [1, 1]], [corner(-1, 1), [0, 1]]];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        cards.positions.push(...quad[k]![0]);
        // Lit as the clump at this point, not as a flat card: the crown shades as one volume.
        cards.normals.push(out.x, out.y * 0.8 + 0.2, out.z);
        cards.uvs.push(...quad[k]![1]);
        cards.shades.push((0.62 + 0.5 * ((out.y + 1) / 2)) * (blob.detail ? 1 : 0.93));
      }
    }
  });
  return {
    core: geometryOf({ position: [core.positions, 3], normal: [core.normals, 3], uv: [core.uvs, 2], shade: [core.shades, 1], part: [core.parts, 1] }),
    cards: geometryOf({ position: [cards.positions, 3], normal: [cards.normals, 3], uv: [cards.uvs, 2], shade: [cards.shades, 1] }),
  };
}
