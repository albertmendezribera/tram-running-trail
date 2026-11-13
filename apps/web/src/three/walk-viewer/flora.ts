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

/** A tuft of grass: a few blades fanned out from one foot, in metres. */
function tuft(positions: number[], normals: number[], shades: number[], parts: number[]): void {
  const blades = 8;
  for (let i = 0; i < blades; i++) {
    const turn = (i / blades) * Math.PI * 2 + cell(i, 1, 2) * 1.2;
    const lean = 0.06 + cell(i, 3, 4) * 0.2;
    const tall = 0.2 + cell(i, 5, 6) * 0.26;
    const [dx, dz] = [Math.cos(turn), Math.sin(turn)];
    const foot = [dx * 0.08, 0, dz * 0.08];
    const tip = [dx * (0.08 + lean), tall, dz * (0.08 + lean)];
    // Wider than a blade: each of these stands for a handful of them, seen from a few strides away.
    const [wx, wz] = [-dz * 0.05, dx * 0.05];
    for (const [point, shade] of [[[foot[0]! - wx, 0, foot[2]! - wz], 0.5], [[foot[0]! + wx, 0, foot[2]! + wz], 0.5], [tip, 1.15]] as Array<[number[], number]>) {
      positions.push(...point);
      // Lit as the ground it grows on, not as a wall: a field of blades shades evenly.
      normals.push(dx * 0.25, 0.94, dz * 0.25);
      shades.push(shade);
      parts.push(1);
    }
  }
}

/**
 * A plant one unit tall, standing on y = 0. Besides position and normal, each vertex says how lit it
 * is by its place in the crown (`shade`: darker underneath and inside) and whether it is wood or leaf (`part`).
 * `fine` cuts it finer, for the plants next to the camera.
 */
export function plantGeometry(kind: PlantKind, fine = false): THREE.BufferGeometry {
  const shape = SHAPES[kind];
  const positions: number[] = [];
  const normals: number[] = [];
  const shades: number[] = [];
  const parts: number[] = [];
  if (kind === 'grass') tuft(positions, normals, shades, parts);
  if (shape.trunk) {
    const sides = 5;
    const { top, radius } = shape.trunk;
    const ring = (i: number, y: number, r: number): [number[], number[]] => {
      const a = (i / sides) * Math.PI * 2;
      return [[Math.cos(a) * r, y, Math.sin(a) * r], [Math.cos(a), 0, Math.sin(a)]];
    };
    for (let i = 0; i < sides; i++) {
      // Sunk a little, so a slope never shows the foot of the trunk in the air.
      const quad = [ring(i, -0.1, radius * 1.6), ring(i + 1, -0.1, radius * 1.6), ring(i + 1, top, radius), ring(i, top, radius)];
      for (const k of [0, 2, 1, 0, 3, 2]) {
        positions.push(...quad[k]![0]);
        normals.push(...quad[k]![1]);
        shades.push(0.85);
        parts.push(0);
      }
    }
  }
  for (const blob of shape.blobs) {
    // From close by a clump is cut finer, so its outline is round; from afar the coarse one is the same shape.
    const sphere = new THREE.IcosahedronGeometry(1, blob.detail + (fine ? 1 : 0)).toNonIndexed();
    const points = sphere.getAttribute('position');
    for (let i = 0; i < points.count; i++) {
      const [x, y, z] = [points.getX(i), points.getY(i), points.getZ(i)];
      const push = 1 + shape.lump * (wobble(x, y, z) - 0.5) * 2;
      positions.push(blob.at[0] + x * blob.radii[0] * push, blob.at[1] + y * blob.radii[1] * push, blob.at[2] + z * blob.radii[2] * push);
      const n = new THREE.Vector3(x / blob.radii[0], y / blob.radii[1], z / blob.radii[2]).normalize();
      normals.push(n.x, n.y, n.z);
      // Dark under the clump, light on top; the small clumps a touch darker, as the inside of a crown.
      shades.push((0.66 + 0.4 * ((y + 1) / 2)) * (blob.detail ? 1 : 0.94));
      parts.push(1);
    }
    sphere.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('shade', new THREE.Float32BufferAttribute(shades, 1));
  geometry.setAttribute('part', new THREE.Float32BufferAttribute(parts, 1));
  return geometry;
}
