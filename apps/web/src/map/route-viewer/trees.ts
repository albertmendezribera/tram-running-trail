import { type CustomLayerInterface, MercatorCoordinate } from 'maplibre-gl';

export interface TreeLayerOptions {
  /** Longitude and latitude the trees are measured from. */
  origin: readonly [number, number];
  /** East, north and up from the origin, and the height of the tree, all in metres; and its kind. */
  trees: ReadonlyArray<readonly [number, number, number, number, TreeKind]>;
  /** Where the camera is, in the same metres: far trees fade into the haze of the horizon. */
  camera(): readonly [number, number, number];
}

interface Species {
  /** Where the trunk ends and how thick it is, as shares of the height. */
  trunk: { top: number; radius: number };
  /** The crown: an ellipsoid, lumpy so no two sides of it look alike. */
  crown: { centre: number; wide: number; tall: number; lump: number };
  /** Greens of the species, as sRGB. */
  tints: ReadonlyArray<readonly [number, number, number]>;
}

/** The kinds of tree the land-cover map tells apart (`@tram/terrain-pipeline/world`). */
export type TreeKind = 'pine' | 'oak' | 'deciduous' | 'olive';

// One shape per kind of wood: the stone pine, an umbrella on a tall trunk; the evergreen oak
// (holm or cork), round and low; the deciduous tree of a riverside or a plantation, tall and
// narrow; the olive, small and grey. The kind is the map's; the shape stands for all its trees.
const SPECIES: Record<TreeKind, Species> = {
  pine: { trunk: { top: 0.68, radius: 0.02 }, crown: { centre: 0.8, wide: 0.36, tall: 0.2, lump: 0.22 }, tints: [[0.2, 0.33, 0.2], [0.24, 0.38, 0.22], [0.17, 0.29, 0.18]] },
  oak: { trunk: { top: 0.38, radius: 0.028 }, crown: { centre: 0.64, wide: 0.33, tall: 0.37, lump: 0.26 }, tints: [[0.3, 0.38, 0.19], [0.34, 0.42, 0.21], [0.25, 0.33, 0.17]] },
  deciduous: { trunk: { top: 0.34, radius: 0.016 }, crown: { centre: 0.62, wide: 0.2, tall: 0.39, lump: 0.2 }, tints: [[0.36, 0.5, 0.2], [0.41, 0.55, 0.23], [0.31, 0.45, 0.19]] },
  olive: { trunk: { top: 0.42, radius: 0.045 }, crown: { centre: 0.66, wide: 0.42, tall: 0.34, lump: 0.3 }, tints: [[0.42, 0.47, 0.36], [0.46, 0.5, 0.38], [0.37, 0.43, 0.33]] },
};

const SEGMENTS = 9;
const RINGS = 6;
/** Floats per vertex: position, normal, shade, part (0 trunk, 1 crown). */
const VERTEX = 8;
/** Floats per tree: where it stands, its height, its tint and how it is turned. */
const INSTANCE = 8;

const noise = (a: number, b: number): number => {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/** One tree of a species, one unit tall, standing on z = 0. */
function meshOf({ trunk, crown }: Species): Float32Array {
  const out: number[] = [];
  const push = (p: number[], n: number[], shade: number, part: number): void => void out.push(...p, ...n, shade, part);
  const quad = (a: number[][], b: number[][], c: number[][], d: number[][], part: number): void => {
    for (const [p, n, s] of [a, b, c, a, c, d] as Array<[number[], number[], number[]]>) push(p, n, s[0]!, part);
  };
  // Trunk: a tapered column, sunk a little so a slope never shows its foot in the air.
  const sides = 5;
  for (let k = 0; k < sides; k++) {
    const corner = (i: number, z: number, r: number): number[][] => {
      const angle = (i / sides) * Math.PI * 2;
      return [[Math.cos(angle) * r, Math.sin(angle) * r, z], [Math.cos(angle), Math.sin(angle), 0], [0.85]];
    };
    quad(corner(k, -0.08, trunk.radius * 1.5), corner(k + 1, -0.08, trunk.radius * 1.5), corner(k + 1, trunk.top, trunk.radius), corner(k, trunk.top, trunk.radius), 0);
  }
  // Crown: rings of a sphere pushed in and out, darker underneath, where the light does not reach.
  const vertex = (ring: number, segment: number): number[][] => {
    const phi = (ring / RINGS) * Math.PI;
    const theta = ((segment % SEGMENTS) / SEGMENTS) * Math.PI * 2;
    const lump = ring === 0 || ring === RINGS ? 1 : 1 + crown.lump * (noise(ring, segment % SEGMENTS) - 0.5) * 2;
    const [x, y, z] = [Math.sin(phi) * Math.cos(theta), Math.sin(phi) * Math.sin(theta), Math.cos(phi)];
    const normal = [x / crown.wide, y / crown.wide, z / crown.tall];
    const length = Math.hypot(...normal);
    return [[x * crown.wide * lump, y * crown.wide * lump, crown.centre + z * crown.tall * lump], normal.map((v) => v / length), [0.58 + 0.5 * ((z + 1) / 2)]];
  };
  for (let ring = 0; ring < RINGS; ring++) for (let s = 0; s < SEGMENTS; s++) quad(vertex(ring, s), vertex(ring + 1, s), vertex(ring + 1, s + 1), vertex(ring, s + 1), 1);
  return new Float32Array(out);
}

/** Where the sun is: south-west and well up, the same as on the walls. */
const SUN = [-0.5, -0.45, 0.74] as const;
/** The haze of the horizon, as in the sky of the map. */
const HAZE = [0.9, 0.93, 0.96] as const;

const VERTEX_SHADER = `#version 300 es
uniform mat4 u_matrix;
uniform vec3 u_sun;
uniform vec3 u_camera;
in vec3 a_position;
in vec3 a_normal;
in float a_shade;
in float a_part;
in vec4 a_tree;
in vec3 a_tint;
in float a_turn;
out vec3 v_color;
out vec3 v_leaf;
out float v_part;
out float v_haze;
void main() {
  float c = cos(a_turn);
  float s = sin(a_turn);
  vec3 p = vec3(a_position.x * c - a_position.y * s, a_position.x * s + a_position.y * c, a_position.z) * a_tree.w;
  vec3 n = normalize(vec3(a_normal.x * c - a_normal.y * s, a_normal.x * s + a_normal.y * c, a_normal.z));
  // Wrapped light: the side away from the sun is dim, not black, as under an open sky.
  float light = 0.48 + 0.6 * clamp(dot(n, u_sun) * 0.5 + 0.5, 0.0, 1.0);
  v_color = mix(vec3(0.32, 0.25, 0.19), a_tint, a_part) * light * a_shade;
  // Each tree its own foliage: the pattern is read where the leaf is on the tree, not on the map.
  v_leaf = p + vec3(a_turn * 7.0);
  v_part = a_part;
  vec3 world = a_tree.xyz + p;
  v_haze = smoothstep(500.0, 3200.0, distance(world, u_camera)) * 0.55;
  gl_Position = u_matrix * vec4(world, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec3 u_haze;
in vec3 v_color;
in vec3 v_leaf;
in float v_part;
in float v_haze;
out vec4 color;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
void main() {
  // Clumps of leaves in light and in shade: two sizes of them, so a crown is not one flat green.
  float leaves = noise(v_leaf * 0.8) * 0.6 + noise(v_leaf * 2.6) * 0.4;
  vec3 lit = v_color * mix(1.0, mix(0.62, 1.3, leaves), v_part);
  color = vec4(mix(lit, u_haze, v_haze), 1.0);
}`;

// The shade each tree casts on the ground: a soft dark patch, away from the sun.
const SHADOW_VERTEX_SHADER = `#version 300 es
uniform mat4 u_matrix;
uniform vec3 u_sun;
in vec2 a_corner;
in vec4 a_tree;
out vec2 v_uv;
void main() {
  vec2 away = normalize(-u_sun.xy);
  float reach = a_tree.w * 0.36;
  // Longer along the shadow than across it, and lifted a hand above the ground the map draws.
  vec2 offset = away * (a_corner.x * reach * 1.5 + a_tree.w * 0.3) + vec2(-away.y, away.x) * a_corner.y * reach;
  v_uv = a_corner;
  gl_Position = u_matrix * vec4(a_tree.xy + offset, a_tree.z + 0.6, 1.0);
}`;

const SHADOW_FRAGMENT_SHADER = `#version 300 es
precision mediump float;
in vec2 v_uv;
out vec4 color;
void main() {
  float shade = smoothstep(1.0, 0.2, length(v_uv)) * 0.34;
  // Premultiplied: the map's own framebuffer is.
  color = vec4(vec3(0.03, 0.05, 0.03) * shade, shade);
}`;

/**
 * The trees of a route as meshes on the map: each species is drawn once per tree
 * in one call (instancing), so a wood of thousands costs the GPU little. Positions
 * are metres from an origin near the route, where 32-bit floats are still exact.
 */
export function createTreeLayer({ origin, trees, camera }: TreeLayerOptions): CustomLayerInterface {
  const corner = MercatorCoordinate.fromLngLat({ lng: origin[0], lat: origin[1] }, 0);
  const metre = corner.meterInMercatorCoordinateUnits();
  let program: WebGLProgram | null = null;
  let shadows: WebGLProgram | null = null;
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  const batches: Array<{ vao: WebGLVertexArrayObject; shade: WebGLVertexArrayObject; vertices: number; count: number; buffers: WebGLBuffer[] }> = [];
  const matrix = new Float32Array(16);
  const shared: WebGLBuffer[] = [];

  return {
    id: 'trees',
    type: 'custom',
    renderingMode: '3d',
    onAdd(_map, gl) {
      const compile = (type: number, source: string): WebGLShader => {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`tree shader: ${gl.getShaderInfoLog(shader)}`);
        return shader;
      };
      const link = (vertex: string, fragment: string): WebGLProgram => {
        const linked = gl.createProgram()!;
        gl.attachShader(linked, compile(gl.VERTEX_SHADER, vertex));
        gl.attachShader(linked, compile(gl.FRAGMENT_SHADER, fragment));
        gl.linkProgram(linked);
        if (!gl.getProgramParameter(linked, gl.LINK_STATUS)) throw new Error(`tree program: ${gl.getProgramInfoLog(linked)}`);
        return linked;
      };
      program = link(VERTEX_SHADER, FRAGMENT_SHADER);
      shadows = link(SHADOW_VERTEX_SHADER, SHADOW_FRAGMENT_SHADER);
      for (const name of ['u_matrix', 'u_sun', 'u_camera', 'u_haze']) uniforms[name] = gl.getUniformLocation(program, name);
      for (const name of ['u_matrix', 'u_sun']) uniforms[`shadow_${name}`] = gl.getUniformLocation(shadows, name);
      const cornerBuffer = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);

      shared.push(cornerBuffer);
      (Object.keys(SPECIES) as TreeKind[]).forEach((kind) => {
        const species = SPECIES[kind];
        const own = trees.filter((tree) => tree[4] === kind);
        if (!own.length) return;
        const instances = new Float32Array(own.length * INSTANCE);
        own.forEach(([east, north, up, height], i) => {
          const tint = species.tints[Math.floor(noise(east, north) * species.tints.length)]!;
          instances.set([east, north, up, height * (0.9 + noise(north, east) * 0.2), ...tint, noise(east + north, 3) * Math.PI * 2], i * INSTANCE);
        });
        const mesh = meshOf(species);
        const vao = gl.createVertexArray()!;
        gl.bindVertexArray(vao);
        const attribute = (name: string, size: number, stride: number, offset: number, perInstance: boolean, of: WebGLProgram = program!): void => {
          const index = gl.getAttribLocation(of, name);
          if (index < 0) return;
          gl.enableVertexAttribArray(index);
          gl.vertexAttribPointer(index, size, gl.FLOAT, false, stride * 4, offset * 4);
          gl.vertexAttribDivisor(index, perInstance ? 1 : 0);
        };
        const meshBuffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, meshBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
        attribute('a_position', 3, VERTEX, 0, false);
        attribute('a_normal', 3, VERTEX, 3, false);
        attribute('a_shade', 1, VERTEX, 6, false);
        attribute('a_part', 1, VERTEX, 7, false);
        const instanceBuffer = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, instances, gl.STATIC_DRAW);
        attribute('a_tree', 4, INSTANCE, 0, true);
        attribute('a_tint', 3, INSTANCE, 4, true);
        attribute('a_turn', 1, INSTANCE, 7, true);
        // The same trees again, as the patches of shade under them.
        const shade = gl.createVertexArray()!;
        gl.bindVertexArray(shade);
        gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
        attribute('a_corner', 2, 2, 0, false, shadows!);
        gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
        attribute('a_tree', 4, INSTANCE, 0, true, shadows!);
        gl.bindVertexArray(null);
        batches.push({ vao, shade, vertices: mesh.length / VERTEX, count: own.length, buffers: [meshBuffer, instanceBuffer] });
      });
    },
    render(gl, { defaultProjectionData }) {
      if (!program) return;
      // Metres from the origin → the map's own coordinates → the screen. Worked out in doubles
      // and only then handed to the GPU: the origin is a large number, the trees small ones.
      const m = defaultProjectionData.mainMatrix as ArrayLike<number>;
      for (let row = 0; row < 4; row++) {
        matrix[row] = m[row]! * metre;
        matrix[4 + row] = -m[4 + row]! * metre;
        matrix[8 + row] = m[8 + row]! * metre;
        matrix[12 + row] = m[row]! * corner.x + m[4 + row]! * corner.y + m[12 + row]!;
      }
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.disable(gl.CULL_FACE);
      // First the shade on the ground, laid over the photograph without hiding what stands on it…
      gl.useProgram(shadows);
      gl.uniformMatrix4fv(uniforms['shadow_u_matrix']!, false, matrix);
      gl.uniform3f(uniforms['shadow_u_sun']!, ...SUN);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      for (const batch of batches) {
        gl.bindVertexArray(batch.shade);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, batch.count);
      }
      // …then the trees themselves.
      gl.useProgram(program);
      gl.uniformMatrix4fv(uniforms['u_matrix']!, false, matrix);
      gl.uniform3f(uniforms['u_sun']!, ...SUN);
      gl.uniform3f(uniforms['u_camera']!, ...camera());
      gl.uniform3f(uniforms['u_haze']!, ...HAZE);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      for (const batch of batches) {
        gl.bindVertexArray(batch.vao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, batch.vertices, batch.count);
      }
      gl.bindVertexArray(null);
    },
    onRemove(_map, gl) {
      for (const batch of batches) {
        gl.deleteVertexArray(batch.vao);
        gl.deleteVertexArray(batch.shade);
        for (const buffer of batch.buffers) gl.deleteBuffer(buffer);
      }
      for (const buffer of shared) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      if (shadows) gl.deleteProgram(shadows);
      program = shadows = null;
    },
  };
}
