import * as THREE from 'three/webgpu';

/**
 * The textures of the view from the ground, painted on a canvas when the view starts: no image is
 * downloaded and none is a photograph of anything. Each is a tile that repeats, drawn from a seed,
 * so it is the same on every visit.
 */
type Paint = (context: CanvasRenderingContext2D, size: number, random: () => number) => void;

const seeded = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

function tile(size: number, seed: number, paint: Paint, alpha = false): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d')!;
  if (!alpha) {
    context.fillStyle = '#808080';
    context.fillRect(0, 0, size, size);
  }
  paint(context, size, seeded(seed));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = alpha ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

const hsl = (h: number, s: number, l: number, a = 1): string => `hsla(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%, ${a})`;
/** Draws something at a point and again across the edges of the tile, so the tile repeats without a seam. */
const wrapped = (size: number, x: number, y: number, reach: number, draw: (x: number, y: number) => void): void => {
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) if (x + dx > -reach && x + dx < size + reach && y + dy > -reach && y + dy < size + reach) draw(x + dx, y + dy);
};
const stroke = (context: CanvasRenderingContext2D, x: number, y: number, angle: number, length: number, width: number, colour: string): void => {
  context.strokeStyle = colour;
  context.lineWidth = width;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
  context.stroke();
};

/** Grass seen from above: blades in every direction, straw among the green. `dry` is how much of it is straw. */
const grass = (dry: number): Paint => (context, size, random) => {
  context.fillStyle = hsl(72 - dry * 22, 36 - dry * 8, 36 + dry * 14);
  context.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 26; i++) {
    const straw = random() < dry;
    const colour = straw ? hsl(46 + random() * 14, 38 + random() * 20, 46 + random() * 26, 0.8) : hsl(72 + random() * 34, 34 + random() * 28, 20 + random() * 30, 0.8);
    const [x, y, angle, length] = [random() * size, random() * size, random() * Math.PI * 2, 4 + random() * 9];
    wrapped(size, x, y, 14, (px, py) => stroke(context, px, py, angle, length, 1 + random() * 1.1, colour));
  }
};

/** The floor of a wood: fallen needles and leaves over dark earth. */
const litter: Paint = (context, size, random) => {
  context.fillStyle = hsl(36, 24, 36);
  context.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 22; i++) {
    const colour = hsl(28 + random() * 26, 24 + random() * 28, 28 + random() * 40, 0.75);
    const [x, y, angle, length] = [random() * size, random() * size, random() * Math.PI * 2, 3 + random() * 10];
    wrapped(size, x, y, 12, (px, py) => stroke(context, px, py, angle, length, 0.8 + random() * 1.2, colour));
  }
};

/** Beaten earth: grit, pebbles and their little shadows. */
const earth: Paint = (context, size, random) => {
  context.fillStyle = hsl(36, 30, 62);
  context.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 30; i++) {
    context.fillStyle = hsl(30 + random() * 14, 18 + random() * 22, 44 + random() * 34, 0.5);
    context.fillRect(random() * size, random() * size, 1 + random() * 2, 1 + random() * 2);
  }
  for (let i = 0; i < size / 2.2; i++) {
    const [x, y, r] = [random() * size, random() * size, 1.5 + random() * 4.5];
    const tone = 46 + random() * 30;
    wrapped(size, x, y, 8, (px, py) => {
      context.fillStyle = hsl(30, 14, 24, 0.45);
      context.beginPath();
      context.ellipse(px + r * 0.35, py + r * 0.4, r, r * 0.8, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = hsl(32 + random() * 10, 14, tone);
      context.beginPath();
      context.ellipse(px, py, r, r * 0.8, random() * 3, 0, Math.PI * 2);
      context.fill();
    });
  }
};

/** A road: tarmac with its grit and a few cracks. One tile is the width of the road; its edge lines are painted in. */
const tarmac: Paint = (context, size, random) => {
  context.fillStyle = hsl(220, 4, 31);
  context.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 40; i++) {
    context.fillStyle = hsl(220, 4, 20 + random() * 30, 0.5);
    context.fillRect(random() * size, random() * size, 1 + random(), 1 + random());
  }
  for (let i = 0; i < 5; i++) {
    let [x, y] = [random() * size, random() * size];
    context.strokeStyle = hsl(220, 6, 15, 0.7);
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(x, y);
    for (let k = 0; k < 14; k++) context.lineTo((x += (random() - 0.5) * 22), (y += 4 + random() * 12));
    context.stroke();
  }
  // Worn white lines at both edges.
  for (const x of [size * 0.045, size * 0.955]) {
    context.fillStyle = hsl(50, 12, 86, 0.85);
    context.fillRect(x - size * 0.012, 0, size * 0.024, size);
    for (let i = 0; i < 60; i++) {
      context.fillStyle = hsl(220, 4, 30, 0.6);
      context.fillRect(x - size * 0.014 + random() * size * 0.028, random() * size, 2 + random() * 3, 2 + random() * 6);
    }
  }
};

/** Bark: ridges running up the trunk. */
const bark: Paint = (context, size, random) => {
  context.fillStyle = hsl(24, 22, 28);
  context.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 3; i++) {
    const x = random() * size;
    wrapped(size, x, random() * size, 40, (px, py) => stroke(context, px, py, Math.PI / 2 + (random() - 0.5) * 0.25, 14 + random() * 44, 1 + random() * 2.4, hsl(20 + random() * 14, 16 + random() * 18, 14 + random() * 34, 0.7)));
  }
};

/** Roof tiles in rows, each row a shade of its own, each tile its own again. */
const tiles: Paint = (context, size, random) => {
  const rows = 8;
  const columns = 10;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      context.fillStyle = hsl(14 + random() * 10, 46 + random() * 14, 40 + random() * 14);
      context.fillRect((c / columns) * size, (r / rows) * size, size / columns + 1, size / rows + 1);
      context.fillStyle = hsl(14, 40, 22, 0.55);
      context.fillRect((c / columns) * size, (r / rows) * size, 2, size / rows);
    }
    const shade = context.createLinearGradient(0, (r / rows) * size, 0, ((r + 1) / rows) * size);
    shade.addColorStop(0, 'rgba(0,0,0,0.38)');
    shade.addColorStop(0.3, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(255,240,220,0.1)');
    context.fillStyle = shade;
    context.fillRect(0, (r / rows) * size, size, size / rows);
  }
};

/**
 * One bay of a wall: plaster with its stains and a window with frame, sill and shutters. A wall
 * repeats it across and up; the building's own colour is laid over it, so the plaster is near white.
 */
const bay: Paint = (context, size, random) => {
  context.fillStyle = hsl(40, 12, 90);
  context.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 14; i++) {
    context.fillStyle = hsl(36, 14, 70 + random() * 26, 0.22);
    context.fillRect(random() * size, random() * size, 2 + random() * 5, 2 + random() * 9);
  }
  const [left, top, wide, tall] = [size * 0.3, size * 0.2, size * 0.4, size * 0.52];
  // The window sits in the wall: a shadow at its top and one side.
  context.fillStyle = hsl(30, 12, 52);
  context.fillRect(left - 5, top - 6, wide + 10, tall + 11);
  const glass = context.createLinearGradient(left, top, left + wide, top + tall);
  glass.addColorStop(0, hsl(208, 30, 30));
  glass.addColorStop(0.55, hsl(210, 34, 16));
  glass.addColorStop(1, hsl(206, 26, 36));
  context.fillStyle = glass;
  context.fillRect(left, top, wide, tall);
  context.strokeStyle = hsl(36, 14, 94);
  context.lineWidth = 3;
  context.strokeRect(left + 1.5, top + 1.5, wide - 3, tall - 3);
  context.beginPath();
  context.moveTo(left + wide / 2, top);
  context.lineTo(left + wide / 2, top + tall);
  context.moveTo(left, top + tall * 0.42);
  context.lineTo(left + wide, top + tall * 0.42);
  context.stroke();
  // Shutters folded back on the wall, slat by slat.
  for (const x of [left - wide * 0.42 - 6, left + wide + 6]) {
    context.fillStyle = hsl(150, 22, 30);
    context.fillRect(x, top - 2, wide * 0.42, tall + 4);
    context.fillStyle = hsl(150, 24, 20, 0.7);
    for (let y = top + 2; y < top + tall; y += 7) context.fillRect(x + 3, y, wide * 0.42 - 6, 2.5);
  }
  context.fillStyle = hsl(34, 12, 78);
  context.fillRect(left - 10, top + tall + 5, wide + 20, 7);
  context.fillStyle = hsl(30, 10, 40, 0.4);
  context.fillRect(left - 10, top + tall + 12, wide + 20, 5);
  // Rain marks under the sill.
  for (let i = 0; i < 9; i++) {
    context.fillStyle = hsl(34, 10, 52, 0.12 + random() * 0.1);
    context.fillRect(left - 8 + random() * (wide + 12), top + tall + 14, 2 + random() * 4, 20 + random() * 46);
  }
};

/** A spray of foliage on a clear ground: the leaves of a crown, a card at a time. */
const spray = (leaf: (context: CanvasRenderingContext2D, x: number, y: number, angle: number, random: () => number) => void, count: number): Paint => (context, size, random) => {
  const centre = size / 2;
  for (let i = 0; i < count; i++) {
    // Thick at the heart, thin at the rim: a round clump, not a square of leaves.
    const reach = Math.sqrt(random()) * size * 0.46;
    const turn = random() * Math.PI * 2;
    leaf(context, centre + Math.cos(turn) * reach, centre + Math.sin(turn) * reach, random() * Math.PI * 2, random);
  }
};
const needles = spray((context, x, y, angle, random) => {
  for (let k = 0; k < 7; k++) stroke(context, x, y, angle + (k - 3) * 0.3, 15 + random() * 12, 1.5, hsl(98 + random() * 26, 32 + random() * 22, 16 + random() * 28));
}, 300);
const leaves = (hue: number, light: number, long: number): Paint =>
  spray((context, x, y, angle, random) => {
    context.fillStyle = hsl(hue + random() * 22, 30 + random() * 24, light + random() * 26);
    context.beginPath();
    context.ellipse(x, y, long * (0.8 + random() * 0.5), long * 0.42, angle, 0, Math.PI * 2);
    context.fill();
  }, 520);
/** Blades of grass standing up from the bottom edge: a tuft seen from the side. */
const blades: Paint = (context, size, random) => {
  for (let i = 0; i < 90; i++) {
    const x = size * (0.08 + random() * 0.84);
    const tall = size * (0.35 + random() * 0.6);
    const lean = (random() - 0.5) * size * 0.3;
    context.strokeStyle = random() < 0.55 ? hsl(48 + random() * 14, 40 + random() * 18, 44 + random() * 26) : hsl(74 + random() * 26, 34 + random() * 22, 26 + random() * 26);
    context.lineWidth = 2 + random() * 2.5;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(x, size);
    context.quadraticCurveTo(x + lean * 0.3, size - tall * 0.6, x + lean, size - tall);
    context.stroke();
  }
};

export interface WalkTextures {
  grass: THREE.Texture;
  dryGrass: THREE.Texture;
  litter: THREE.Texture;
  earth: THREE.Texture;
  tarmac: THREE.Texture;
  bark: THREE.Texture;
  tiles: THREE.Texture;
  bay: THREE.Texture;
  foliage: Record<'pine' | 'oak' | 'deciduous' | 'olive' | 'bush', THREE.Texture>;
  blades: THREE.Texture;
  dispose(): void;
}

export function paintTextures(): WalkTextures {
  const all = {
    grass: tile(512, 11, grass(0.25)),
    dryGrass: tile(512, 12, grass(0.8)),
    litter: tile(512, 13, litter),
    earth: tile(512, 14, earth),
    tarmac: tile(512, 15, tarmac),
    bark: tile(256, 16, bark),
    tiles: tile(256, 17, tiles),
    bay: tile(256, 18, bay),
    foliage: {
      pine: tile(256, 21, needles, true),
      oak: tile(256, 22, leaves(78, 16, 9), true),
      deciduous: tile(256, 23, leaves(84, 24, 13), true),
      olive: tile(256, 24, leaves(96, 34, 10), true),
      bush: tile(256, 25, leaves(72, 24, 8), true),
    },
    blades: tile(256, 26, blades, true),
  };
  const every = [all.grass, all.dryGrass, all.litter, all.earth, all.tarmac, all.bark, all.tiles, all.bay, all.blades, ...Object.values(all.foliage)];
  return { ...all, dispose: () => every.forEach((texture) => texture.dispose()) };
}
