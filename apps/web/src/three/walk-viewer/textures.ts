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

/** Plaster with its stains, near white: the colour of the building is laid over it. A line of shade under the floor above. */
const plaster = (context: CanvasRenderingContext2D, size: number, random: () => number): void => {
  context.fillStyle = hsl(40, 12, 90);
  context.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 14; i++) {
    context.fillStyle = hsl(36, 14, 70 + random() * 26, 0.22);
    context.fillRect(random() * size, random() * size, 2 + random() * 5, 2 + random() * 9);
  }
  context.fillStyle = hsl(34, 10, 60, 0.35);
  context.fillRect(0, 0, size, 3);
};
/** An opening in the wall: its shadow at the top and one side, and what fills it. */
const opening = (context: CanvasRenderingContext2D, left: number, top: number, wide: number, tall: number, fill: string | CanvasGradient): void => {
  context.fillStyle = hsl(30, 12, 50);
  context.fillRect(left - 5, top - 6, wide + 10, tall + 8);
  context.fillStyle = fill;
  context.fillRect(left, top, wide, tall);
};
const glassOf = (context: CanvasRenderingContext2D, left: number, top: number, wide: number, tall: number): CanvasGradient => {
  const glass = context.createLinearGradient(left, top, left + wide, top + tall);
  glass.addColorStop(0, hsl(208, 30, 30));
  glass.addColorStop(0.55, hsl(210, 34, 16));
  glass.addColorStop(1, hsl(206, 26, 36));
  return glass;
};
/** A shutter, slat by slat. */
const shutter = (context: CanvasRenderingContext2D, left: number, top: number, wide: number, tall: number): void => {
  context.fillStyle = hsl(150, 22, 30);
  context.fillRect(left, top, wide, tall);
  context.fillStyle = hsl(150, 24, 20, 0.7);
  for (let y = top + 4; y < top + tall - 3; y += 7) context.fillRect(left + 3, y, wide - 6, 2.5);
};
const frame = (context: CanvasRenderingContext2D, left: number, top: number, wide: number, tall: number, bars: number): void => {
  context.strokeStyle = hsl(36, 14, 94);
  context.lineWidth = 3;
  context.strokeRect(left + 1.5, top + 1.5, wide - 3, tall - 3);
  context.beginPath();
  context.moveTo(left + wide / 2, top);
  context.lineTo(left + wide / 2, top + tall);
  for (let k = 1; k <= bars; k++) {
    context.moveTo(left, top + (tall * k) / (bars + 1));
    context.lineTo(left + wide, top + (tall * k) / (bars + 1));
  }
  context.stroke();
};
const sill = (context: CanvasRenderingContext2D, left: number, y: number, wide: number, random: () => number): void => {
  context.fillStyle = hsl(34, 12, 78);
  context.fillRect(left - 10, y, wide + 20, 7);
  context.fillStyle = hsl(30, 10, 40, 0.4);
  context.fillRect(left - 10, y + 7, wide + 20, 5);
  // Rain marks under the sill.
  for (let i = 0; i < 9; i++) {
    context.fillStyle = hsl(34, 10, 52, 0.12 + random() * 0.1);
    context.fillRect(left - 8 + random() * (wide + 12), y + 9, 2 + random() * 4, 14 + random() * 36);
  }
};

/**
 * A bay of a modern block: the terrace runs on into the bays at both sides, so nothing in it stops at an
 * edge. The wall behind is in the shade of the terrace above; in it, sliding glass from floor to lintel;
 * in front, the rail and the edge of the floor slab. With an awning let down, or without.
 */
const terrace = (context: CanvasRenderingContext2D, size: number, random: () => number, awning: boolean): void => {
  plaster(context, size, random);
  // The recess: the back wall in shade, darker under the slab above.
  const shade = context.createLinearGradient(0, 0, 0, size * 0.8);
  shade.addColorStop(0, hsl(30, 12, 30, 0.75));
  shade.addColorStop(1, hsl(30, 12, 52, 0.45));
  context.fillStyle = shade;
  context.fillRect(0, size * 0.05, size, size * 0.8);
  // Sliding doors of glass in a pale frame.
  const [left, top, wide, tall] = [size * 0.1, size * 0.16, size * 0.8, size * 0.66];
  context.fillStyle = glassOf(context, left, top, wide, tall);
  context.fillRect(left, top, wide, tall);
  context.strokeStyle = hsl(210, 6, 78);
  context.lineWidth = 3;
  context.strokeRect(left + 1.5, top + 1.5, wide - 3, tall - 3);
  context.beginPath();
  for (const share of [1 / 3, 2 / 3]) {
    context.moveTo(left + wide * share, top);
    context.lineTo(left + wide * share, top + tall);
  }
  context.stroke();
  // A curtain half drawn behind one of the panes.
  context.fillStyle = hsl(40, 20, 84, 0.5);
  context.fillRect(left + wide * (random() < 0.5 ? 0.02 : 0.68), top + 4, wide * 0.3, tall - 8);
  if (awning) {
    context.fillStyle = hsl(24 + random() * 10, 62, 52);
    context.fillRect(size * 0.06, size * 0.07, size * 0.88, size * 0.3);
    context.fillStyle = hsl(24, 50, 34, 0.5);
    for (let x = size * 0.06; x < size * 0.94; x += size * 0.11) context.fillRect(x, size * 0.07, 2, size * 0.3);
    context.fillStyle = hsl(220, 20, 10, 0.35);
    context.fillRect(size * 0.06, size * 0.37, size * 0.88, size * 0.05);
  }
  // The underside of the slab above, and its shadow.
  context.fillStyle = hsl(30, 10, 26, 0.7);
  context.fillRect(0, 0, size, size * 0.055);
  // The rail: a bar on top, thin uprights, and the edge of the floor it stands on.
  context.fillStyle = hsl(210, 20, 80, 0.28);
  context.fillRect(0, size * 0.6, size, size * 0.27);
  context.fillStyle = hsl(220, 8, 22);
  context.fillRect(0, size * 0.595, size, 4);
  for (let x = size / 32; x < size; x += size / 16) context.fillRect(x - 1, size * 0.6, 2, size * 0.27);
  context.fillStyle = hsl(40, 12, 92);
  context.fillRect(0, size * 0.87, size, size * 0.13);
  context.fillStyle = hsl(30, 10, 40, 0.5);
  context.fillRect(0, size * 0.87, size, 3);
};

/**
 * The bays of a wall, one picture each: a window with its shutters folded back, a balcony, a window shut,
 * bare wall, a front door, the gate of a shed, a shop front and two terraces of a modern block. A wall takes one for each bay of each floor.
 */
const BAY_PAINTS: Paint[] = [
  (context, size, random) => {
    plaster(context, size, random);
    const [left, top, wide, tall] = [size * 0.3, size * 0.2, size * 0.4, size * 0.52];
    opening(context, left, top, wide, tall, glassOf(context, left, top, wide, tall));
    frame(context, left, top, wide, tall, 1);
    shutter(context, left - wide * 0.42 - 6, top - 2, wide * 0.42, tall + 4);
    shutter(context, left + wide + 6, top - 2, wide * 0.42, tall + 4);
    sill(context, left, top + tall + 5, wide, random);
  },
  (context, size, random) => {
    plaster(context, size, random);
    const [left, top, wide, tall] = [size * 0.3, size * 0.14, size * 0.4, size * 0.76];
    opening(context, left, top, wide, tall, glassOf(context, left, top, wide, tall));
    frame(context, left, top, wide, tall, 2);
    shutter(context, left - wide * 0.4 - 6, top - 2, wide * 0.4, tall + 2);
    shutter(context, left + wide + 6, top - 2, wide * 0.4, tall + 2);
    // The balcony: a slab, its shadow, and a rail of iron bars in front of the door.
    const [from, to, rail, slab] = [size * 0.1, size * 0.9, size * 0.6, size * 0.9];
    context.fillStyle = hsl(34, 10, 70);
    context.fillRect(from - 4, slab, to - from + 8, 9);
    context.fillStyle = hsl(30, 10, 34, 0.45);
    context.fillRect(from - 4, slab + 9, to - from + 8, 8);
    context.fillStyle = hsl(220, 8, 16);
    context.fillRect(from, rail, to - from, 4);
    context.fillRect(from, slab - 6, to - from, 3);
    for (let x = from; x <= to; x += (to - from) / 16) context.fillRect(x - 1, rail, 2.4, slab - rail);
  },
  (context, size, random) => {
    plaster(context, size, random);
    const [left, top, wide, tall] = [size * 0.3, size * 0.2, size * 0.4, size * 0.52];
    opening(context, left, top, wide, tall, hsl(150, 20, 22));
    shutter(context, left, top, wide / 2 - 1, tall);
    shutter(context, left + wide / 2 + 1, top, wide / 2 - 1, tall);
    sill(context, left, top + tall + 5, wide, random);
  },
  (context, size, random) => {
    plaster(context, size, random);
    // Bare wall: where the plaster has come away, and the damp that climbs from the street.
    for (let i = 0; i < 5; i++) {
      context.fillStyle = hsl(30, 16, 62 + random() * 14, 0.28);
      context.beginPath();
      context.ellipse(random() * size, random() * size, 10 + random() * 26, 6 + random() * 16, random() * 3, 0, Math.PI * 2);
      context.fill();
    }
  },
  (context, size, random) => {
    plaster(context, size, random);
    const [left, top, wide, tall] = [size * 0.31, size * 0.2, size * 0.38, size * 0.8];
    opening(context, left, top, wide, tall, hsl(24, 34, 24));
    // A door of planks, with its lintel, its knob and a step.
    context.fillStyle = hsl(24, 30, 15, 0.8);
    for (let x = left + wide / 5; x < left + wide - 2; x += wide / 5) context.fillRect(x, top, 2, tall);
    context.fillStyle = hsl(32, 12, 72);
    context.fillRect(left - 12, top - 14, wide + 24, 10);
    context.fillStyle = hsl(44, 50, 62);
    context.beginPath();
    context.arc(left + wide * 0.82, top + tall * 0.55, 4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = hsl(30, 8, 58);
    context.fillRect(left - 14, size - 8, wide + 28, 8);
    // A lamp by the door.
    context.fillStyle = hsl(220, 8, 18);
    context.fillRect(left + wide + 22, top + 6, 10, 16);
    context.fillStyle = hsl(48, 60, 78);
    context.fillRect(left + wide + 24, top + 10, 6, 9);
  },
  (context, size, random) => {
    plaster(context, size, random);
    const [left, top, wide, tall] = [size * 0.08, size * 0.12, size * 0.84, size * 0.88];
    opening(context, left, top, wide, tall, hsl(210, 8, 46));
    // A gate of sheet, rolled up and down: its ribs.
    context.fillStyle = hsl(210, 8, 30, 0.7);
    for (let y = top + 6; y < top + tall; y += 12) context.fillRect(left, y, wide, 3);
    context.fillStyle = hsl(210, 6, 62, 0.5);
    for (let y = top + 10; y < top + tall; y += 12) context.fillRect(left, y, wide, 2);
  },
  (context, size, random) => {
    plaster(context, size, random);
    // A shop front: glass from side to side with a door in it, a board over it and an awning out over the pavement.
    const [left, top, wide, tall] = [size * 0.07, size * 0.3, size * 0.86, size * 0.7];
    opening(context, left, top, wide, tall, glassOf(context, left, top, wide, tall));
    // What the glass lets see: shelves, a counter, a lamp lit.
    for (let i = 0; i < 7; i++) {
      context.fillStyle = hsl(30 + random() * 30, 30, 34 + random() * 24, 0.5);
      context.fillRect(left + 8 + random() * (wide * 0.55), top + tall * (0.35 + random() * 0.4), 14 + random() * 30, 10 + random() * 26);
    }
    context.fillStyle = hsl(46, 70, 80, 0.5);
    context.fillRect(left + wide * 0.2, top + 8, wide * 0.3, 5);
    context.strokeStyle = hsl(220, 8, 14);
    context.lineWidth = 4;
    context.strokeRect(left + 2, top + 2, wide - 4, tall - 2);
    context.beginPath();
    context.moveTo(left + wide * 0.68, top);
    context.lineTo(left + wide * 0.68, top + tall);
    context.stroke();
    context.fillStyle = hsl(44, 40, 70);
    context.fillRect(left + wide * 0.7, top + tall * 0.5, 3, 16);
    // The board with the name, which a texture cannot write: the name is the label over the house.
    context.fillStyle = hsl(210, 14, 20);
    context.fillRect(left - 4, size * 0.12, wide + 8, size * 0.1);
    context.fillStyle = hsl(40, 30, 88, 0.85);
    context.fillRect(left + wide * 0.22, size * 0.155, wide * 0.56, size * 0.03);
    // The awning, in stripes, and the shade it throws on the glass.
    for (let x = 0; x < 12; x++) {
      context.fillStyle = x % 2 ? hsl(40, 30, 92) : hsl(8, 52, 46);
      context.fillRect(left - 8 + (x * (wide + 16)) / 12, size * 0.22, (wide + 16) / 12 + 0.5, size * 0.11);
    }
    context.fillStyle = hsl(220, 20, 10, 0.4);
    context.fillRect(left, size * 0.33, wide, size * 0.07);
    context.fillStyle = hsl(30, 8, 58);
    context.fillRect(0, size - 6, size, 6);
  },
  // A block of flats of the last sixty years: each floor a terrace from side to side, glass set back behind it.
  (context, size, random) => terrace(context, size, random, false),
  (context, size, random) => terrace(context, size, random, true),
];

/** The pictures of a bay side by side in one texture: a wall reads the one it wants (`scene.ts`). */
function strip(size: number, seed: number, paints: readonly Paint[]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size * paints.length;
  canvas.height = size;
  const context = canvas.getContext('2d')!;
  paints.forEach((paint, i) => {
    context.save();
    context.translate(i * size, 0);
    context.beginPath();
    context.rect(0, 0, size, size);
    context.clip();
    paint(context, size, seeded(seed + i));
    context.restore();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** One leaf: a blade with a lit half and a midrib, pointing along `angle` from its stalk. */
const leafOf = (context: CanvasRenderingContext2D, x: number, y: number, angle: number, long: number, wide: number, hue: number, light: number): void => {
  const [cx, cy] = [x + (Math.cos(angle) * long) / 2, y + (Math.sin(angle) * long) / 2];
  context.fillStyle = hsl(hue, 42, light);
  context.beginPath();
  context.ellipse(cx, cy, long / 2, wide / 2, angle, 0, Math.PI * 2);
  context.fill();
  // The half that catches the light, and the rib between the two.
  context.fillStyle = hsl(hue + 6, 46, light + 11, 0.75);
  context.beginPath();
  context.ellipse(cx - Math.sin(angle) * wide * 0.16, cy + Math.cos(angle) * wide * 0.16, long * 0.42, wide * 0.26, angle, 0, Math.PI * 2);
  context.fill();
  stroke(context, x, y, angle, long * 0.92, Math.max(0.8, wide * 0.09), hsl(hue - 6, 36, light - 12, 0.7));
};

/** A mass of leaves seen from outside the crown: leaves over leaves, dark between them. It repeats. */
const thicket: Paint = (context, size, random) => {
  context.fillStyle = hsl(90, 30, 9);
  context.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    const depth = i / 2600;
    const [x, y, angle, long] = [random() * size, random() * size, random() * Math.PI * 2, size * (0.02 + random() * 0.022)];
    const tone = 14 + depth * 26 + random() * 14;
    wrapped(size, x, y, long * 2, (px, py) => leafOf(context, px, py, angle, long, long * 0.48, 90, tone));
  }
};

/**
 * A spray of foliage on a clear ground, for the cards of a crown: leaves every way, thick at its heart and
 * loose at its rim, so the edge of a card is leaves and not a line. The first leaves painted are the ones
 * deep in the crown, in shade; the last ones are in the light.
 */
const sprigs = (count: number, long: number, wide: number, hue: number, light: number): Paint => (context, size, random) => {
  const centre = size / 2;
  for (let i = 0; i < count; i++) {
    const depth = i / count;
    const turn = random() * Math.PI * 2;
    const from = random() ** 0.62 * size * 0.44;
    const length = long * (0.7 + random() * 0.6);
    leafOf(context, centre + Math.cos(turn) * from - length / 2, centre + Math.sin(turn) * from, random() * Math.PI * 2, length, wide * (0.8 + random() * 0.4), hue + (random() - 0.5) * 24, light - 10 + depth * 22 + random() * 8);
  }
};
/** The same for a pine: tufts of needles at the end of each twig. */
const needles: Paint = (context, size, random) => {
  const centre = size / 2;
  for (let i = 0; i < 230; i++) {
    const depth = i / 230;
    const turn = random() * Math.PI * 2;
    const from = Math.sqrt(random()) * size * 0.34;
    const [x, y] = [centre + Math.cos(turn) * from, centre + Math.sin(turn) * from];
    const heading = random() * Math.PI * 2;
    const tone = 15 + depth * 24;
    for (let k = 0; k < 15; k++) stroke(context, x, y, heading + (k - 7) * 0.2 + (random() - 0.5) * 0.1, size * (0.045 + random() * 0.045), size / 380, hsl(96 + random() * 28, 34 + random() * 18, tone + random() * 12));
  }
};
/** Blades of grass standing up from the bottom edge: a tuft seen from the side, each blade wide at its foot and ending in a point. */
const blades: Paint = (context, size, random) => {
  for (let i = 0; i < 130; i++) {
    const depth = i / 130;
    const x = size * (0.07 + random() * 0.86);
    const tall = size * (0.3 + random() * 0.66);
    const lean = (random() - 0.5) * size * 0.34;
    const wide = size * (0.012 + random() * 0.016);
    context.fillStyle = random() < 0.45 ? hsl(48 + random() * 14, 36 + random() * 18, 26 + depth * 24 + random() * 10) : hsl(72 + random() * 28, 36 + random() * 22, 16 + depth * 22 + random() * 10);
    context.beginPath();
    context.moveTo(x - wide, size);
    context.quadraticCurveTo(x - wide * 0.5 + lean * 0.25, size - tall * 0.6, x + lean, size - tall);
    context.quadraticCurveTo(x + wide * 0.5 + lean * 0.25, size - tall * 0.6, x + wide, size);
    context.fill();
  }
};

export interface WalkTextures {
  grass: THREE.Texture;
  dryGrass: THREE.Texture;
  litter: THREE.Texture;
  earth: THREE.Texture;
  tarmac: THREE.Texture;
  bark: THREE.Texture;
  thicket: THREE.Texture;
  tiles: THREE.Texture;
  /** The bays of a wall, side by side. */
  bays: THREE.Texture;
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
    thicket: tile(512, 19, thicket),
    tiles: tile(256, 17, tiles),
    bays: strip(256, 18, BAY_PAINTS),
    foliage: {
      pine: tile(512, 21, needles, true),
      // Holm and cork oak: small, dark, leathery. A plantation tree: large and light. Olive: narrow and grey. Heath and lentisk: tiny.
      oak: tile(512, 22, sprigs(1100, 30, 14, 96, 20), true),
      deciduous: tile(512, 23, sprigs(700, 44, 27, 94, 31), true),
      olive: tile(512, 24, sprigs(1200, 30, 9, 100, 38), true),
      bush: tile(512, 25, sprigs(1700, 21, 9, 88, 25), true),
    },
    blades: tile(512, 26, blades, true),
  };
  const every = [all.grass, all.dryGrass, all.litter, all.earth, all.tarmac, all.bark, all.thicket, all.tiles, all.bays, all.blades, ...Object.values(all.foliage)];
  return { ...all, dispose: () => every.forEach((texture) => texture.dispose()) };
}
