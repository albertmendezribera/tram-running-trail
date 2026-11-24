// A route as a story (M5, E14): a tall image, 1080 × 1920, for the stories of Instagram and WhatsApp.
// The same names, figures and drawings as the page, set for a phone held upright: the name, the route
// on its contours, the figures and the profile. Nothing that matters is in the top or the bottom
// quarter of a thousand pixels, where the apps lay their own buttons over the image.
import { tramOg, type TramOgTerrain, type TramOgTheme } from '@tram/design-system/og';
import { formatMeasure } from '@tram/formats';
import { areaPath, createPlot, linePath, type ProfilePoint } from '@tram/design-system/patterns/elevation.ts';
import type { Plate } from '@tram/design-system/patterns/route-plate.ts';

export const STORY = { width: 1080, height: 1920 };
/** What the apps cover, at the top and at the bottom. */
const COVERED = 250;
const EDGE = 72;
const [WIDTH, HEIGHT] = [STORY.width, STORY.height];

/**
 * What writes the text of a story. At build time the letters are outlines read from the font files
 * (`render.ts`); in the browser, where a visitor makes a story of their own, they are drawn on a canvas
 * with the fonts of the page. The drawing asks only where a line goes and how wide it is.
 */
export interface Pen {
  /** A line of text, its baseline at `y`. `tracking` is in ems. Gives what to add to the drawing, and the width of the line. */
  write(text: string, face: 'display' | 'text', size: number, x: number, y: number, fill: string, options?: { anchor?: 'start' | 'end'; tracking?: number }): { svg: string; width: number };
  /** The largest size, up to `most`, at which a line fits a width. */
  fitted(text: string, face: 'display' | 'text', most: number, room: number): number;
}

/**
 * The designs a story comes in. All of them are the same house: the name of the site as on a bib, the
 * condensed face, the paper and the ink, the contour lines and the profile. What changes is what leads.
 */
export const STORY_DESIGNS = [
  { key: 'fitxa', name: 'Fitxa', leads: 'El plànol, les xifres i el perfil, com al full de resultats.' },
  { key: 'planol', name: 'Plànol', leads: 'El mapa de banda a banda, i el nom sobre una franja de tinta.' },
  { key: 'dorsal', name: 'Dorsal', leads: 'La distància, tan gran com un dorsal.' },
  { key: 'perfil', name: 'Perfil', leads: 'El perfil de la sortida, amb el punt més alt marcat.' },
  { key: 'trac', name: 'Traç', leads: 'Només la línia de la ruta, quilòmetre a quilòmetre.' },
] as const;
export type StoryDesign = (typeof STORY_DESIGNS)[number]['key'];

/** The window «Plànol» shows its map through, from edge to edge of the image. A plate of its own shape fills it whole. */
export const MAP_WINDOW = { y: 344, width: 1080, height: 886 };

export interface StoryCard {
  terrain: TramOgTerrain;
  kicker: string;
  title: string;
  place: string;
  /** Three or four, the first the one the route is known by. */
  figures: ReadonlyArray<{ value: string; label: string }>;
  profile: readonly ProfilePoint[];
  plate: Plate;
  /** The same route on ground framed to the shape of `MAP_WINDOW`, for «Plànol». Without it, the plate is fitted inside the window. */
  window?: Plate | undefined;
  /** Whose the relief of the plate is: said on the image itself, as its licence asks. Empty where the plate has no relief. */
  credit: string;
}

function sheet({ terrain, kicker, title, place, figures, profile, plate, credit }: StoryCard, theme: TramOgTheme, { write, fitted }: Pen): string {
  const { color } = tramOg[theme][terrain];
  const parts: string[] = [`<rect width="${WIDTH}" height="${HEIGHT}" fill="${color.surface}"/>`];

  // The name of the site as on a bib, and what the page is, under what the apps cover.
  const top = COVERED + 24;
  parts.push(`<rect x="${EDGE}" y="${top + 6}" width="56" height="11" fill="${color.accent}"/>`);
  parts.push(write('TRAM', 'display', 64, EDGE + 76, top + 40, color.text, { tracking: 0.02 }).svg);
  parts.push(write(kicker.toLocaleUpperCase('ca'), 'text', 28, WIDTH - EDGE, top + 32, color['text-muted'], { anchor: 'end', tracking: 0.06 }).svg);
  parts.push(`<rect x="${EDGE}" y="${top + 66}" width="${WIDTH - EDGE * 2}" height="4" fill="${color['rule-strong']}"/>`);

  // The name as large as the width lets it be, standing on a line that does not move: a long name is smaller, not lower.
  const size = fitted(title, 'display', 250, WIDTH - EDGE * 2);
  const base = top + 290;
  parts.push(write(title, 'display', size, EDGE - size * 0.012, base, color.text, { tracking: -0.01 }).svg);
  // The place under the name, clear of the letters that hang below its line.
  const under = base + size * 0.24 + 48;
  if (place) parts.push(write(place, 'text', 40, EDGE, under, color['text-muted']).svg);

  // The route on its contours. A plate taller than wide leaves the figures a column at its side; a wide one, a row under it.
  const upright = plate.height > plate.width;
  const box = upright ? { x: EDGE, y: under + 52, width: 520, height: 700 } : { x: EDGE, y: under + 52, width: WIDTH - EDGE * 2, height: figures.length > 3 ? 400 : 460 };
  const fit = Math.min(box.width / plate.width, box.height / plate.height);
  const drawn = { width: plate.width * fit, height: plate.height * fit };
  const px = (n: number): string => (n / fit).toFixed(2);
  const contours = plate.contours.map((line) => `<path d="${line.d}" stroke-width="${px(line.major ? 2.6 : 1.3)}" stroke-opacity="${line.major ? 0.9 : 0.55}"/>`).join('');
  const marks = plate.marks.map((mark) => `<circle cx="${mark.x}" cy="${mark.y}" r="${px(6)}" fill="${color.surface}" stroke="${color['data-primary']}" stroke-width="${px(3)}"/>`).join('');
  parts.push(
    `<g transform="translate(${box.x} ${box.y}) scale(${fit.toFixed(4)})" fill="none" stroke-linejoin="round" stroke-linecap="round">` +
      `<g stroke="${color['map-contour']}">${contours}</g>` +
      // The route with a rim of paper, so it is read over the contours it crosses.
      `<path d="${plate.route}" stroke="${color.surface}" stroke-width="${px(18)}"/><path d="${plate.route}" stroke="${color['data-primary']}" stroke-width="${px(9)}"/>` +
      marks +
      `<rect x="${(plate.finish[0] - 11 / fit).toFixed(2)}" y="${(plate.finish[1] - 11 / fit).toFixed(2)}" width="${px(22)}" height="${px(22)}" fill="${color['data-primary']}" stroke="${color.surface}" stroke-width="${px(4)}"/>` +
      `<circle cx="${plate.start[0]}" cy="${plate.start[1]}" r="${px(14)}" fill="${color.accent}" stroke="${color.surface}" stroke-width="${px(5)}"/>` +
      `</g>`,
  );
  if (credit) parts.push(write(credit, 'text', 22, box.x, box.y + drawn.height + 40, color['text-muted']).svg);

  // Under four figures the profile is lower: they need the room, and it keeps its shape.
  const tall = figures.length > 3 && !upright ? 170 : 230;
  const foot = HEIGHT - COVERED - 20;
  // The figures, as on a results sheet: the number large, its name small under it.
  const label = (text: string, x: number, y: number): string => write(text.toLocaleUpperCase('ca'), 'text', 24, x, y, color['text-muted'], { tracking: 0.06 }).svg;
  if (upright) {
    const x = box.x + drawn.width + 56;
    const room = WIDTH - EDGE - x;
    // The column is as tall as the box: four figures stand closer, and a little smaller, than three.
    const [most, pitch] = figures.length > 3 ? [118, 176] : [150, 230];
    figures.forEach((figure, i) => {
      const y = box.y + most * 0.86 + i * pitch;
      parts.push(write(figure.value, 'display', fitted(figure.value, 'display', most, room), x, y, color.text).svg, label(figure.label, x, y + 40));
    });
  } else {
    // Between the plate and the profile: three in a row, or four as two rows of two.
    const [from, to] = [box.y + drawn.height + 40, foot - tall];
    const across = figures.length > 3 ? 2 : figures.length;
    const rows = Math.ceil(figures.length / across);
    const [most, pitch] = rows > 1 ? [112, 158] : [130, 0];
    const first = (from + to) / 2 + 30 - ((rows - 1) * pitch) / 2;
    const room = (WIDTH - EDGE * 2) / across;
    figures.forEach((figure, i) => {
      const [x, y] = [EDGE + (i % across) * room, first + Math.floor(i / across) * pitch];
      parts.push(write(figure.value, 'display', fitted(figure.value, 'display', most, room - 40), x, y, color.text).svg, label(figure.label, x, y + 40));
    });
  }

  // The profile from edge to edge. Its line stays over what the apps cover; its fill runs down to the foot of the image.
  const low = Math.min(...profile.map((p) => p[1]));
  // A flat route is drawn flat: the box stands for a hundred metres at least, as on the page.
  const high = Math.max(...profile.map((p) => p[1]), low + 100);
  const plot = createPlot(profile, [low, high], WIDTH, tall);
  const tone = terrain === 'road' ? color['data-road']! : terrain === 'trail' ? color['data-trail']! : color['data-primary']!;
  parts.push(
    `<g transform="translate(0 ${foot - tall})"><path d="${areaPath(profile, plot)}" fill="${tone}" fill-opacity="0.22"/><path d="${linePath(profile, plot)}" fill="none" stroke="${tone}" stroke-width="7" stroke-linejoin="round"/></g>` +
      `<rect y="${foot}" width="${WIDTH}" height="${HEIGHT - foot}" fill="${tone}" fill-opacity="0.22"/>`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${parts.join('')}</svg>`;
}

type Colours = Record<string, string>;
const TOP = COVERED + 24;
const FOOT = HEIGHT - COVERED - 20;
const toneOf = (terrain: TramOgTerrain, color: Colours): string => (terrain === 'road' ? color['data-road']! : terrain === 'trail' ? color['data-trail']! : color['data-primary']!);
/** A colour part of the way from one to another: the muted ink of a block printed the other way round. */
const mix = (from: string, to: string, share: number): string => {
  const [a, b] = [from, to].map((hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)));
  return `#${a!.map((channel, i) => Math.round(channel + (b![i]! - channel) * share).toString(16).padStart(2, '0')).join('')}`;
};

/** The name of the site as on a bib and what the page is, under what the apps cover: the head of every design. */
function head(kicker: string, color: Colours, { write }: Pen): string {
  return (
    `<rect x="${EDGE}" y="${TOP + 6}" width="56" height="11" fill="${color['accent']}"/>` +
    write('TRAM', 'display', 64, EDGE + 76, TOP + 40, color['text']!, { tracking: 0.02 }).svg +
    write(kicker.toLocaleUpperCase('ca'), 'text', 28, WIDTH - EDGE, TOP + 32, color['text-muted']!, { anchor: 'end', tracking: 0.06 }).svg +
    `<rect x="${EDGE}" y="${TOP + 66}" width="${WIDTH - EDGE * 2}" height="4" fill="${color['rule-strong']}"/>`
  );
}

/** A plate drawn at a place and a scale: its contours where asked, the route over them, the kilometres, the start and the finish. */
function map(plate: Plate, at: { x: number; y: number; fit: number }, color: Colours, { contours = true, line = 9, ink = color['data-primary']! }: { contours?: boolean; line?: number; ink?: string } = {}): string {
  const px = (n: number): string => (n / at.fit).toFixed(2);
  const lines = contours ? plate.contours.map((c) => `<path d="${c.d}" stroke-width="${px(c.major ? 2.6 : 1.3)}" stroke-opacity="${c.major ? 0.9 : 0.55}"/>`).join('') : '';
  const marks = plate.marks.map((mark) => `<circle cx="${mark.x}" cy="${mark.y}" r="${px(line * 0.67)}" fill="${color['surface']}" stroke="${ink}" stroke-width="${px(line / 3)}"/>`).join('');
  return (
    `<g transform="translate(${at.x.toFixed(1)} ${at.y.toFixed(1)}) scale(${at.fit.toFixed(4)})" fill="none" stroke-linejoin="round" stroke-linecap="round">` +
    `<g stroke="${color['map-contour']}">${lines}</g>` +
    // The route with a rim of paper, so it is read over the contours it crosses.
    `<path d="${plate.route}" stroke="${color['surface']}" stroke-width="${px(line * 2)}"/><path d="${plate.route}" stroke="${ink}" stroke-width="${px(line)}"/>` +
    marks +
    `<rect x="${(plate.finish[0] - (line * 1.2) / at.fit).toFixed(2)}" y="${(plate.finish[1] - (line * 1.2) / at.fit).toFixed(2)}" width="${px(line * 2.4)}" height="${px(line * 2.4)}" fill="${ink}" stroke="${color['surface']}" stroke-width="${px(line * 0.45)}"/>` +
    `<circle cx="${plate.start[0]}" cy="${plate.start[1]}" r="${px(line * 1.55)}" fill="${color['accent']}" stroke="${color['surface']}" stroke-width="${px(line * 0.55)}"/>` +
    `</g>`
  );
}

/** Where a plate goes to sit whole inside a box, in its middle. */
const inside = (plate: Plate, box: { x: number; y: number; width: number; height: number }): { x: number; y: number; fit: number } => {
  const fit = Math.min(box.width / plate.width, box.height / plate.height);
  return { x: box.x + (box.width - plate.width * fit) / 2, y: box.y + (box.height - plate.height * fit) / 2, fit };
};

/** The profile along the foot of the image, from edge to edge: its line over what the apps cover, its fill down to the end. */
function footProfile(profile: readonly ProfilePoint[], tall: number, tone: string): string {
  const low = Math.min(...profile.map((p) => p[1]));
  // A flat route is drawn flat: the box stands for a hundred metres at least, as on the page.
  const high = Math.max(...profile.map((p) => p[1]), low + 100);
  const plot = createPlot(profile, [low, high], WIDTH, tall);
  return (
    `<g transform="translate(0 ${FOOT - tall})"><path d="${areaPath(profile, plot)}" fill="${tone}" fill-opacity="0.22"/><path d="${linePath(profile, plot)}" fill="none" stroke="${tone}" stroke-width="7" stroke-linejoin="round"/></g>` +
    `<rect y="${FOOT}" width="${WIDTH}" height="${HEIGHT - FOOT}" fill="${tone}" fill-opacity="0.22"/>`
  );
}

/** Figures side by side: the number large, its name small under it. */
function row(figures: StoryCard['figures'], y: number, most: number, value: string, name: string, { write, fitted }: Pen): string {
  const room = (WIDTH - EDGE * 2) / figures.length;
  return figures
    .map((figure, i) => {
      const x = EDGE + i * room;
      return write(figure.value, 'display', fitted(figure.value, 'display', most, room - 28), x, y, value).svg + write(figure.label.toLocaleUpperCase('ca'), 'text', 21, x, y + 36, name, { tracking: 0.06 }).svg;
    })
    .join('');
}

/** «Plànol»: the map from edge to edge, and the name and the figures on a band of ink under it. */
function mapStory({ kicker, title, place, figures, plate, window, credit }: StoryCard, theme: TramOgTheme, pen: Pen): string {
  const color: Colours = tramOg[theme].mixed.color;
  const { write, fitted } = pen;
  const frame = { x: 0, y: MAP_WINDOW.y, width: MAP_WINDOW.width, height: MAP_WINDOW.height };
  const band = frame.y + frame.height;
  const parts = [`<rect width="${WIDTH}" height="${HEIGHT}" fill="${color['surface']}"/>`, map(window ?? plate, inside(window ?? plate, frame), color, { line: 11 })];
  // The head on paper over the map, and the band under it: what the map runs under is covered, not cut.
  parts.push(`<rect width="${WIDTH}" height="${frame.y}" fill="${color['surface']}"/>`, head(kicker, color, pen));
  if (credit) {
    const said = write(credit, 'text', 22, EDGE, band - 24, color['text-muted']!);
    parts.push(`<rect x="${EDGE - 14}" y="${band - 54}" width="${(said.width + 28).toFixed(1)}" height="42" fill="${color['surface']}"/>`, said.svg);
  }
  // Printed the other way round: ink for the ground, paper for the letters.
  const [ground, ink] = [color['text']!, color['surface']!];
  const quiet = mix(ink, ground, 0.38);
  parts.push(`<rect y="${band}" width="${WIDTH}" height="${HEIGHT - band}" fill="${ground}"/>`, `<rect x="${EDGE}" y="${band - 7}" width="150" height="14" fill="${color['accent']}"/>`);
  const size = fitted(title, 'display', 150, WIDTH - EDGE * 2);
  const base = band + 44 + size * 0.72;
  parts.push(write(title, 'display', size, EDGE - size * 0.012, base, ink, { tracking: -0.01 }).svg);
  if (place) parts.push(write(place, 'text', 34, EDGE, base + size * 0.24 + 40, quiet).svg);
  parts.push(row(figures, FOOT - 70, figures.length > 3 ? 88 : 104, ink, quiet, pen));
  return parts.join('');
}

/** «Dorsal»: the distance as large as the image is wide, and the rest as the lines of a results sheet. */
function bibStory({ terrain, kicker, title, place, figures, profile }: StoryCard, theme: TramOgTheme, pen: Pen): string {
  const color: Colours = tramOg[theme][terrain].color;
  const { write, fitted } = pen;
  const parts = [`<rect width="${WIDTH}" height="${HEIGHT}" fill="${color['surface']}"/>`, head(kicker, color, pen)];
  const size = fitted(title, 'display', 130, WIDTH - EDGE * 2);
  const base = TOP + 128 + size * 0.74;
  parts.push(write(title, 'display', size, EDGE - size * 0.012, base, color['text']!, { tracking: -0.01 }).svg);
  if (place) parts.push(write(place, 'text', 36, EDGE, base + size * 0.24 + 40, color['text-muted']!).svg);
  // The first figure, the one the route is known by: its number alone, its unit at its side.
  const [lead, ...others] = figures;
  const [number = '', ...unit] = lead!.value.split(/\s+/u);
  const tall = fitted(number, 'display', 500, WIDTH - EDGE * 2 - 170);
  const stand = 1010;
  const drawn = write(number, 'display', tall, EDGE - tall * 0.02, stand, color['text']!, { tracking: -0.02 });
  parts.push(drawn.svg, write(unit.join(' '), 'display', 150, EDGE + drawn.width + 6, stand, color['accent']!).svg);
  parts.push(write(lead!.label.toLocaleUpperCase('ca'), 'text', 24, EDGE, stand + 50, color['text-muted']!, { tracking: 0.06 }).svg);
  parts.push(`<rect x="${EDGE}" y="${stand + 78}" width="${WIDTH - EDGE * 2}" height="12" fill="${color['text']}"/>`);
  // The others, a line each, the name at the left and the figure at the right.
  const step = 132;
  others.forEach((figure, i) => {
    const y = stand + 90 + i * step;
    parts.push(
      write(figure.label.toLocaleUpperCase('ca'), 'text', 26, EDGE, y + 82, color['text-muted']!, { tracking: 0.06 }).svg,
      write(figure.value, 'display', 96, WIDTH - EDGE, y + 98, color['text']!, { anchor: 'end' }).svg,
      `<rect x="${EDGE}" y="${y + step - 2}" width="${WIDTH - EDGE * 2}" height="2" fill="${color['rule-strong']}"/>`,
    );
  });
  parts.push(footProfile(profile, FOOT - (stand + 90 + others.length * step) - 24 > 220 ? 220 : 124, toneOf(terrain, color)));
  return parts.join('');
}

/** «Perfil»: the profile of the outing as the picture, on its levels and with its highest point marked, over the figures. */
function profileStory({ terrain, kicker, title, place, figures, profile }: StoryCard, theme: TramOgTheme, pen: Pen): string {
  const color: Colours = tramOg[theme][terrain].color;
  const { write, fitted } = pen;
  const tone = toneOf(terrain, color);
  const parts = [`<rect width="${WIDTH}" height="${HEIGHT}" fill="${color['surface']}"/>`, head(kicker, color, pen)];
  const size = fitted(title, 'display', 170, WIDTH - EDGE * 2);
  const base = TOP + 128 + size * 0.74;
  parts.push(write(title, 'display', size, EDGE - size * 0.012, base, color['text']!, { tracking: -0.01 }).svg);
  if (place) parts.push(write(place, 'text', 38, EDGE, base + size * 0.24 + 44, color['text-muted']!).svg);

  const chart = { x: EDGE, y: 770, width: WIDTH - EDGE * 2, height: 490 };
  const low = Math.min(...profile.map((p) => p[1]));
  const top = profile.reduce((best, p) => (p[1] > best[1] ? p : best));
  // A flat route is drawn flat: the box stands for a hundred metres at least, as on the page.
  const high = Math.max(top[1], low + 100);
  const plot = createPlot(profile, [low, high], chart.width, chart.height);
  const length = profile.at(-1)![0];
  const yOf = (elevation: number): number => chart.y + chart.height - ((elevation - low) / (high - low)) * chart.height;
  // The levels the ground is read against, a few of them, each with its height at the right.
  const span = high - low;
  const step = span <= 150 ? 50 : span <= 400 ? 100 : span <= 1000 ? 250 : 500;
  for (let level = Math.ceil((low + step * 0.2) / step) * step; level < high - step * 0.1; level += step) {
    parts.push(`<rect x="${chart.x}" y="${(yOf(level) - 1).toFixed(1)}" width="${chart.width}" height="2" fill="${color['rule']}"/>`, write(formatMeasure(level, 'm', 'ca'), 'text', 22, WIDTH - EDGE, yOf(level) - 10, color['text-muted']!, { anchor: 'end' }).svg);
  }
  // A tick to a kilometre along the ground line; on a long outing, to every five or ten.
  const every = length > 60 ? 10 : length > 24 ? 5 : 1;
  const ticks = Array.from({ length: Math.floor(length / every) }, (_, i) => chart.x + (((i + 1) * every) / length) * chart.width)
    .map((x) => `<rect x="${(x - 1).toFixed(1)}" y="${chart.y + chart.height}" width="2" height="14" fill="${color['rule-strong']}"/>`)
    .join('');
  const peakX = chart.x + (top[0] / length) * chart.width;
  parts.push(
    `<g transform="translate(${chart.x} ${chart.y})"><path d="${areaPath(profile, plot)}" fill="${tone}" fill-opacity="0.22"/><path d="${linePath(profile, plot)}" fill="none" stroke="${tone}" stroke-width="8" stroke-linejoin="round"/></g>`,
    `<rect x="${chart.x}" y="${chart.y + chart.height}" width="${chart.width}" height="4" fill="${color['rule-strong']}"/>`,
    ticks,
    `<circle cx="${peakX.toFixed(1)}" cy="${yOf(top[1]).toFixed(1)}" r="13" fill="${color['accent']}" stroke="${color['surface']}" stroke-width="5"/>`,
  );
  // The highest point is named over the chart, at the side it falls on; the two ends of the ground line say how long it is.
  const peak = `${formatMeasure(Math.round(top[1]), 'm', 'ca')} · km ${formatMeasure(Number(top[0].toFixed(1)), 'km', 'ca').split(/\s+/u)[0]}`;
  const right = peakX > WIDTH / 2;
  parts.push(
    write('PUNT MÉS ALT', 'text', 22, right ? WIDTH - EDGE : EDGE, chart.y - 66, color['text-muted']!, { anchor: right ? 'end' : 'start', tracking: 0.06 }).svg,
    write(peak, 'text', 32, right ? WIDTH - EDGE : EDGE, chart.y - 26, color['text']!, { anchor: right ? 'end' : 'start' }).svg,
    write('0', 'text', 24, chart.x, chart.y + chart.height + 46, color['text-muted']!).svg,
    write(formatMeasure(Number(length.toFixed(2)), 'km', 'ca'), 'text', 24, WIDTH - EDGE, chart.y + chart.height + 46, color['text-muted']!, { anchor: 'end' }).svg,
  );
  // The figures under it, as on the sheet: three in a row, or four as two rows of two.
  const across = figures.length > 3 ? 2 : figures.length;
  const rows = Math.ceil(figures.length / across);
  const [most, pitch] = rows > 1 ? [112, 158] : [130, 0];
  const first = (chart.y + chart.height + 70 + FOOT + 10) / 2 + 30 - ((rows - 1) * pitch) / 2;
  const room = (WIDTH - EDGE * 2) / across;
  figures.forEach((figure, i) => {
    const [x, y] = [EDGE + (i % across) * room, first + Math.floor(i / across) * pitch];
    parts.push(write(figure.value, 'display', fitted(figure.value, 'display', most, room - 40), x, y, color['text']!).svg, write(figure.label.toLocaleUpperCase('ca'), 'text', 24, x, y + 40, color['text-muted']!, { tracking: 0.06 }).svg);
  });
  return parts.join('');
}

/** «Traç»: the line of the route and nothing under it, with its kilometres numbered, and the words small at the foot. */
function lineStory({ kicker, title, place, figures, plate }: StoryCard, theme: TramOgTheme, pen: Pen): string {
  const color: Colours = tramOg[theme].mixed.color;
  const { write, fitted } = pen;
  const parts = [`<rect width="${WIDTH}" height="${HEIGHT}" fill="${color['surface']}"/>`, head(kicker, color, pen)];
  const box = { x: EDGE + 24, y: TOP + 150, width: WIDTH - EDGE * 2 - 48, height: 830 };
  const at = inside(plate, box);
  parts.push(map(plate, at, color, { contours: false, line: 13, ink: color['text']! }));
  // The kilometres by their number; on a long outing, every fifth.
  const every = plate.marks.length > 60 ? 10 : plate.marks.length > 16 ? 5 : 1;
  // Where the route comes back over itself two kilometres fall on the same place: the first keeps its number.
  const numbered: Array<[number, number]> = [];
  for (const mark of plate.marks) {
    const [x, y] = [at.x + mark.x * at.fit, at.y + mark.y * at.fit];
    if (mark.km % every !== 0 || numbered.some(([px, py]) => Math.hypot(px - x, py - y) < 44)) continue;
    numbered.push([x, y]);
    parts.push(write(String(mark.km), 'text', 24, x + 16, y - 14, color['text-muted']!).svg);
  }
  const line = box.y + box.height + 56;
  parts.push(`<rect x="${EDGE}" y="${line}" width="${WIDTH - EDGE * 2}" height="4" fill="${color['rule-strong']}"/>`, `<rect x="${EDGE}" y="${line - 5}" width="150" height="14" fill="${color['accent']}"/>`);
  const size = fitted(title, 'display', 150, WIDTH - EDGE * 2);
  const base = line + 44 + size * 0.72;
  parts.push(write(title, 'display', size, EDGE - size * 0.012, base, color['text']!, { tracking: -0.01 }).svg);
  if (place) parts.push(write(place, 'text', 34, EDGE, base + size * 0.24 + 38, color['text-muted']!).svg);
  // The figures in one line, as they are said aloud.
  const said = figures.map((figure) => figure.value).join('   ·   ');
  parts.push(write(said, 'text', fitted(said, 'text', 34, WIDTH - EDGE * 2), EDGE, FOOT - 6, color['text']!).svg);
  return parts.join('');
}

const DRAWN: Record<Exclude<StoryDesign, 'fitxa'>, (card: StoryCard, theme: TramOgTheme, pen: Pen) => string> = { planol: mapStory, dorsal: bibStory, perfil: profileStory, trac: lineStory };

/** A story, in one of its designs and one of the two themes, as an SVG of 1080 × 1920. */
export function storyCard(card: StoryCard, theme: TramOgTheme, pen: Pen, design: StoryDesign = 'fitxa'): string {
  if (design === 'fitxa') return sheet(card, theme, pen);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${DRAWN[design](card, theme, pen)}</svg>`;
}
