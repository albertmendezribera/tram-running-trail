import * as THREE from 'three/webgpu';

/** The buildings modelled by hand, one by one, from photographs of the real thing. */
export type LandmarkModel = 'far-de-palamos';

export interface Landmark {
  model: LandmarkModel;
  /** Metres east and north of the south-west corner of the terrain. */
  x: number;
  y: number;
  /** Turn about the vertical, in radians. */
  turn: number;
}

const paint = (hex: number, roughness = 0.85): THREE.MeshStandardNodeMaterial => new THREE.MeshStandardNodeMaterial({ color: hex, roughness, metalness: 0 });

/** A solid with flat faces: each face lit on its own, as a prism is. */
const faceted = (geometry: THREE.BufferGeometry): THREE.BufferGeometry => {
  const flat = geometry.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
};

/** Several small solids as one: a railing is a hundred bars, and one thing to draw. */
function joined(parts: ReadonlyArray<THREE.BufferGeometry>): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  for (const part of parts) {
    const flat = part.toNonIndexed();
    positions.push(...(flat.attributes['position']!.array as Float32Array));
    normals.push(...(flat.attributes['normal']!.array as Float32Array));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

/** A bar from one point to another. */
function bar(from: THREE.Vector3, to: THREE.Vector3, thick: number): THREE.BufferGeometry {
  const length = from.distanceTo(to);
  const geometry = new THREE.BoxGeometry(thick, length, thick);
  const turn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(to, from).normalize());
  geometry.applyQuaternion(turn);
  geometry.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
  return geometry;
}

/**
 * The lighthouse of Palamós, on the Punta des Molí (1865). From photographs: a white tower, a prism
 * of six sides that flares out under a gallery with a rail of black iron; on the gallery a low drum
 * the colour of fired clay, the lantern of glass in its dark frame, a grey dome, a ball and a vane.
 * Its measures: ten metres to the top of the dome and a gallery 3.6 m across, which is what the
 * ICGC's map has for it (the height it measured, and the outline seen from the air); the rest in
 * proportion, from the photographs. Which way its door faces is not known, and it has none.
 */
function farDePalamos(): THREE.Group {
  const group = new THREE.Group();
  const [white, iron, clay, glass, dome] = [paint(0xf4f2ec), paint(0x16181b, 0.6), paint(0xc58d78), paint(0x2a3a44, 0.15), paint(0x41464c, 0.55)];
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, y: number): void => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = y;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  // The shaft is sunk a little, so it stands on a slope too.
  const [SHAFT, GALLERY] = [1.36, 2.08];
  add(faceted(new THREE.CylinderGeometry(SHAFT, SHAFT, 8.1, 6)), white, 2.55);
  add(faceted(new THREE.CylinderGeometry(2.0, SHAFT, 0.8, 6)), white, 7.0);
  add(faceted(new THREE.CylinderGeometry(GALLERY, GALLERY, 0.14, 6)), white, 7.47);
  // The rail: on each of the six sides a rail above, one below and the bars between them.
  const [low, high, at] = [7.56, 8.56, 2.0];
  const corner = (k: number, y: number): THREE.Vector3 => new THREE.Vector3(Math.sin((k * Math.PI) / 3) * at, y, Math.cos((k * Math.PI) / 3) * at);
  const bars: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 6; k++) {
    bars.push(bar(corner(k, high), corner(k + 1, high), 0.05), bar(corner(k, low), corner(k + 1, low), 0.04), bar(corner(k, low), corner(k, high), 0.05));
    for (let i = 1; i < 11; i++) bars.push(bar(corner(k, low).lerp(corner(k + 1, low), i / 11), corner(k, high).lerp(corner(k + 1, high), i / 11), 0.025));
  }
  add(joined(bars), iron, 0);
  add(new THREE.CylinderGeometry(0.92, 0.98, 0.4, 24), clay, 7.74);
  add(new THREE.CylinderGeometry(0.8, 0.8, 1.15, 20), glass, 8.515);
  // The frame of the lantern: a ring under the glass, one over it and the uprights between the panes.
  const frame: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.85, 0.85, 0.07, 20).translate(0, 7.975, 0), new THREE.CylinderGeometry(0.85, 0.85, 0.07, 20).translate(0, 9.055, 0)];
  for (let k = 0; k < 8; k++) {
    const [x, z] = [Math.sin((k * Math.PI) / 4) * 0.82, Math.cos((k * Math.PI) / 4) * 0.82];
    frame.push(bar(new THREE.Vector3(x, 7.94, z), new THREE.Vector3(x, 9.09, z), 0.05));
  }
  add(joined(frame), iron, 0);
  add(new THREE.ConeGeometry(0.98, 0.7, 24), dome, 9.44);
  add(new THREE.CylinderGeometry(0.16, 0.2, 0.22, 12), dome, 9.89);
  add(new THREE.SphereGeometry(0.11, 12, 8), iron, 10.08);
  add(joined([bar(new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, 10.85, 0), 0.03), bar(new THREE.Vector3(-0.22, 10.62, 0), new THREE.Vector3(0.22, 10.62, 0), 0.04)]), iron, 0);
  return group;
}

const MODELS: Record<LandmarkModel, () => THREE.Group> = { 'far-de-palamos': farDePalamos };

/** A landmark as a group with its foot at the origin. */
export const buildLandmark = (model: LandmarkModel): THREE.Group => MODELS[model]();
