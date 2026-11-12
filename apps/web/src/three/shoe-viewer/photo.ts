import * as THREE from 'three/webgpu';
import { float, mix, normalLocal, positionLocal, smoothstep, texture, uniform, vec2 } from 'three/tsl';

/** What `photo_model.py` reads off the brand's product photos: the outline of the shoe from the side and from above. */
export interface PhotoModel {
  lengthMm: number;
  heightMm: number;
  widthMm: number;
  /** At each station from heel to toe: shares of the height from the top of the side photo… */
  top: Array<number | null>;
  bottom: Array<number | null>;
  /** …and shares of the width from the left of the photo from above. */
  left: Array<number | null>;
  right: Array<number | null>;
  /** Colour under the shoe, 0–255: the photos used do not show the sole square on. */
  sole: [number, number, number];
}

export interface PhotoShoe {
  model: PhotoModel;
  lateral: string;
  medial: string;
  top: string;
  /** The shoe from behind, when the brand shows it. */
  heel?: string | undefined;
}

/**
 * Half of a cross-section of a shoe, from under its middle up to its ridge, as shares
 * of half its width and of its height: widest at the sole, narrower towards the laces.
 * A shape common to every shoe: only the outlines come from the photos.
 */
const SECTION: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [0.5, 0], [0.86, 0.015], [0.98, 0.09], [1, 0.2], [0.97, 0.36], [0.88, 0.55], [0.74, 0.74], [0.52, 0.9], [0.26, 0.98], [0, 1],
];

const filled = (values: Array<number | null>, fallback: number): number[] => values.map((v) => v ?? fallback);

/** The shoe as the brand's photos show it: their outline given volume, and the photos laid over it. */
export async function buildPhotoShoe({ model, lateral, medial, top, heel }: PhotoShoe): Promise<{ mesh: THREE.Mesh; dispose(): void }> {
  const loader = new THREE.TextureLoader();
  const textures = await Promise.all([lateral, medial, top, ...(heel ? [heel] : [])].map((url) => loader.loadAsync(url)));
  for (const t of textures) {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
  }
  const [lateralMap, medialMap, topMap, heelMap] = textures as [THREE.Texture, THREE.Texture, THREE.Texture, THREE.Texture | undefined];

  const { lengthMm: L, heightMm: H, widthMm: W } = model;
  const stations = model.top.length;
  const tops = filled(model.top, 0.5);
  const bottoms = filled(model.bottom, 0.5);
  const lefts = filled(model.left, 0.5);
  const rights = filled(model.right, 0.5);
  // One ring per station: up one side, over the ridge, down the other.
  const ring = [...SECTION.map(([z, y]) => [z, y] as const), ...SECTION.slice(1, -1).reverse().map(([z, y]) => [-z, y] as const)];
  const positions: number[] = [];
  for (let i = 0; i < stations; i++) {
    const x = (i / (stations - 1)) * L;
    const yTop = (1 - tops[i]!) * H;
    const yBottom = (1 - bottoms[i]!) * H;
    // The lateral side is at −z: seen from there the toe is to the left, as in the brand's lateral photo.
    const zLeft = (0.5 - rights[i]!) * W;
    const zRight = (0.5 - lefts[i]!) * W;
    const centre = (zLeft + zRight) / 2;
    const half = Math.max(0.5, (zRight - zLeft) / 2);
    for (const [z, y] of ring) positions.push(x, yBottom + (yTop - yBottom) * y, centre + half * z);
  }
  const indices: number[] = [];
  const n = ring.length;
  for (let i = 0; i < stations - 1; i++) {
    for (let k = 0; k < n; k++) {
      const a = i * n + k;
      const b = i * n + ((k + 1) % n);
      // Wound so the faces look outwards: the photos are chosen by where each face looks.
      indices.push(a, b + n, b, a, a + n, b + n);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Each photo is laid on from where it was taken: the two sides, and from above.
  const along = positionLocal.x.div(L);
  const up = positionLocal.y.div(H);
  const across = float(0.5).sub(positionLocal.z.div(W));
  const fromLateral = texture(lateralMap, vec2(float(1).sub(along), up));
  const fromMedial = texture(medialMap, vec2(along, up));
  const fromAbove = texture(topMap, vec2(across, float(1).sub(along)));
  const sole = uniform(new THREE.Color().setRGB(model.sole[0] / 255, model.sole[1] / 255, model.sole[2] / 255, THREE.SRGBColorSpace));
  const side = mix(fromLateral, fromMedial, smoothstep(-0.12, 0.12, normalLocal.z));
  // From behind the lateral side is at the left, as in the photo of the heel. Only the heel takes it:
  // further on, a face that looks back (the rise of the tongue) is still a side of the shoe.
  const back = heelMap ? mix(side, texture(heelMap, vec2(positionLocal.z.div(W).add(0.5), up)), smoothstep(0.3, 0.75, normalLocal.x.negate()).mul(float(1).sub(smoothstep(0.06, 0.2, along)))) : side;
  const upper = mix(back, fromAbove, smoothstep(0.45, 0.8, normalLocal.y));
  const material = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  material.colorNode = mix(upper.rgb, sole, smoothstep(0.75, 0.95, normalLocal.y.negate()));

  return {
    mesh: new THREE.Mesh(geometry, material),
    dispose() {
      geometry.dispose();
      material.dispose();
      for (const t of textures) t.dispose();
    },
  };
}
