import * as THREE from 'three/webgpu';
import { attribute, distance, mix, positionLocal, smoothstep, uniform, vec2 } from 'three/tsl';

export interface CarpetOptions {
  /** Side of a cell, in metres: the ground is covered a cell at a time. */
  cellM: number;
  /** How far from the point it follows the carpet reaches, in metres. */
  radiusM: number;
  /** The most plants a cell can hold. */
  perCell: number;
}

/** Sets one plant down: metres east and north, the height of the ground, its size, its turn and how wide it is for its height. */
export type Put = (x: number, y: number, ground: number, size: number, turn: number, wide?: number) => void;

export interface Carpet {
  readonly mesh: THREE.InstancedMesh;
  /** How many plants the carpet holds where it lies now. */
  readonly planted: number;
  /** Moves the carpet under a point of the map. It is cheap unless the point has left its cell. */
  follow(x: number, y: number): void;
}

/** Where every carpet is centred: the point of the route the view is at, as the scene has it (east, and north negated). */
export const carpetFocus = uniform(new THREE.Vector2());

/**
 * What covers the ground next to the runner, and only there: grass, bushes, stones. A fixed number
 * of plants is moved along as the runner goes, a cell of ground at a time, so the ground by the
 * path can be thick with them without the whole route holding them all. What grows in a cell
 * depends only on the cell: coming back to a place finds the same plants.
 */
export function createCarpet(geometry: THREE.BufferGeometry, material: THREE.NodeMaterial, { cellM, radiusM, perCell }: CarpetOptions, fill: (i: number, j: number, put: Put) => void): Carpet {
  const reach = Math.ceil(radiusM / cellM) + 1;
  // Cells whose middle is within reach of the middle of the cell the point is in.
  const ring: Array<readonly [number, number]> = [];
  for (let di = -reach; di <= reach; di++) for (let dj = -reach; dj <= reach; dj++) if (Math.hypot(di, dj) * cellM <= radiusM + cellM * 0.71) ring.push([di, dj]);
  const capacity = ring.length * perCell;
  const own = geometry.clone();
  // Where each plant stands, in the scene: the renderer has it in the matrix, the fading needs it on its own.
  const spots = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  own.setAttribute('spot', spots);
  // A plant shrinks into its own foot as the carpet leaves it behind: nothing pops in or out at the rim.
  // By the time this is worked out the plant is already in its place, so it is its place it shrinks towards.
  const spot = attribute('spot', 'vec3');
  material.positionNode = mix(spot, positionLocal, smoothstep(radiusM, radiusM * 0.7, distance(vec2(spot.x, spot.z), carpetFocus)));
  const mesh = new THREE.InstancedMesh(own, material, capacity);
  mesh.frustumCulled = false;
  const matrices = mesh.instanceMatrix.array as Float32Array;
  matrices.fill(0);
  const slots = new Map<number, number>();
  const held = new Uint16Array(ring.length);
  const free = ring.map((_, slot) => slot);
  const dummy = new THREE.Object3D();
  const key = (i: number, j: number): number => i * 100003 + j;
  let at: number | null = null;
  return {
    mesh,
    get planted() {
      return held.reduce((sum, count) => sum + count, 0);
    },
    follow(x, y) {
      const [ci, cj] = [Math.floor(x / cellM), Math.floor(y / cellM)];
      if (at === key(ci, cj)) return;
      at = key(ci, cj);
      const wanted = new Set(ring.map(([di, dj]) => key(ci + di, cj + dj)));
      for (const [cell, slot] of slots) {
        if (wanted.has(cell)) continue;
        slots.delete(cell);
        matrices.fill(0, slot * perCell * 16, (slot + 1) * perCell * 16);
        held[slot] = 0;
        free.push(slot);
      }
      for (const [di, dj] of ring) {
        const cell = key(ci + di, cj + dj);
        if (slots.has(cell)) continue;
        const slot = free.pop()!;
        slots.set(cell, slot);
        let count = 0;
        fill(ci + di, cj + dj, (px, py, ground, size, turn, wide = 1) => {
          if (count >= perCell) return;
          const index = slot * perCell + count++;
          dummy.position.set(px, ground, -py);
          dummy.rotation.set(0, turn, 0);
          dummy.scale.set(size * wide, size, size * wide);
          dummy.updateMatrix();
          dummy.matrix.toArray(matrices, index * 16);
          spots.setXYZ(index, px, ground, -py);
        });
        held[slot] = count;
      }
      mesh.instanceMatrix.needsUpdate = true;
      spots.needsUpdate = true;
    },
  };
}
