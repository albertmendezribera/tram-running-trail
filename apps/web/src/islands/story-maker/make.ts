// The heavy half of the story maker, asked for only when a file is chosen: the visitor's track becomes
// a profile and a plate, and the story is drawn on a canvas. Nothing of the file leaves the browser.
// The one request made is for the relief of the rectangle the track falls in, to the ICGC's own server.
import type { TramOgTheme } from '@tram/design-system/og';
import { fetchTile, planTiles } from '@tram/terrain-pipeline/icgc';
import { buildPlate } from '@tram/terrain-pipeline/plate';
import { MAP_WINDOW, STORY, STORY_DESIGNS, storyCard, type Pen, type StoryDesign } from '../../og/story';
import { altOf, cardOf, type Outing, type Wording } from '../../story-maker/card';
import { frameOf, heightAt, ICGC_ZONE, inCatalonia, project, routeIn, settle, type Frame } from '../../story-maker/ground';
import { profileOf, readGpx, recordedSeconds, TrackError } from '../../story-maker/track';

export { TrackError };

export interface Prepared extends Outing {
  /** What the file calls the outing, when it does. */
  name: string | null;
  /** Why the plate has no relief, when it has none. */
  bare: 'outside' | 'unanswered' | null;
}

/** A track with no heights of its own, where the model cannot give them either. */
export class NoHeightsError extends Error {
  override name = 'NoHeightsError';
}

const WAIT_MS = 25_000;

/** The elevation model under a frame, row by row from the north, or null when the ICGC does not give it in time. */
async function reliefOf(frame: Frame): Promise<Float32Array | null> {
  const heights = new Float32Array(frame.cols * frame.rows);
  const top = frame.y0 + frame.rows * frame.cell;
  const fetched = Promise.all(
    planTiles(frame.cols, frame.rows).map(async (tile) => {
      const values = await fetchTile(frame.x0, top, frame.cell, tile);
      for (let r = 0; r < tile.rows; r++) heights.set(values.subarray(r * tile.cols, (r + 1) * tile.cols), (tile.row + r) * frame.cols + tile.col);
    }),
  );
  const late = new Promise<null>((resolve) => setTimeout(() => resolve(null), WAIT_MS));
  try {
    return (await Promise.race([fetched.then(() => heights), late])) ?? null;
  } catch {
    return null;
  }
}

/** Everything a story needs, from the text of a GPX. `tell` is called before the one request that leaves the browser. */
export async function prepare(xml: string, tell: (stage: 'relief') => void): Promise<Prepared> {
  const track = readGpx(xml);
  const { zone, xy } = project(track.points);
  const frame = frameOf(xy, zone);
  // «Plànol» shows the ground through a window of its own shape: more ground at the sides, in larger cells.
  const wide = frameOf(xy, zone, MAP_WINDOW.width / MAP_WINDOW.height);
  let heights: Float32Array | null = null;
  let around: Float32Array | null = null;
  let bare: Prepared['bare'] = 'outside';
  if (zone === ICGC_ZONE && inCatalonia(track.points)) {
    tell('relief');
    const [answered, more] = await Promise.all([reliefOf(frame), reliefOf(wide)]);
    heights = answered && settle(answered);
    around = more && settle(more);
    bare = heights ? null : answered ? 'outside' : 'unanswered';
  }
  // The heights of the watch where the file has them all; if not, those of the ground under each point.
  const own = track.points.every((point) => point.ele !== null);
  if (!own && !heights) throw new NoHeightsError();
  const elevations = own ? track.points.map((point) => point.ele!) : xy.map((point) => heightAt(frame, heights!, point));
  const profile = profileOf(track.points, elevations);
  const plateOf = (ground: Frame, relief: Float32Array | null) =>
    buildPlate({ heights: relief ?? new Float32Array(ground.cols * ground.rows), cols: ground.cols, rows: ground.rows, cell: ground.cell, route: routeIn(ground, xy), distanceKm: profile.at(-1)![0] });
  // Where the relief around did not come and the one of the route did, the window keeps the plate of the route.
  const window = around || !heights ? plateOf(wide, around) : undefined;
  return { name: track.name, profile, plate: plateOf(frame, heights), window, seconds: recordedSeconds(track.points), relief: heights !== null, bare };
}

type Face = 'display' | 'text';
interface Line {
  text: string;
  face: Face;
  size: number;
  x: number;
  y: number;
  fill: string;
  spacing: number;
}

/** The faces of the page, at the weights the stories of the site are written in (`og/render.ts`). */
const WEIGHT: Record<Face, number> = { display: 700, text: 400 };
const family = (face: Face): string => getComputedStyle(document.documentElement).getPropertyValue(`--tram-sys-font-${face}`).trim() || 'sans-serif';
const fontOf = (face: Face, size: number): string => `${WEIGHT[face]} ${size}px ${family(face)}`;
/**
 * The font of the site itself, the first of the list, asked for by name. The list goes on with stand-ins
 * made of fonts of the system (Arial, Roboto): where the device has none of one of them, asking for the
 * whole list fails, and so the story was not drawn on a phone without Arial.
 */
const own = (face: Face): string => `${WEIGHT[face]} 100px ${family(face).split(',')[0]}`;

/** A pen that measures with the fonts of the page and keeps each line, to be drawn over the shapes afterwards. */
function canvasPen(lines: Line[]): Pen {
  const ruler = document.createElement('canvas').getContext('2d')!;
  const widthOf = (text: string, face: Face, size: number, tracking: number): number => {
    ruler.font = fontOf(face, size);
    return ruler.measureText(text).width + tracking * size * [...text].length;
  };
  return {
    write(text, face, size, x, y, fill, { anchor = 'start', tracking = 0 } = {}) {
      const width = widthOf(text, face, size, tracking);
      lines.push({ text, face, size, x: anchor === 'end' ? x - width : x, y, fill, spacing: tracking * size });
      return { svg: '', width };
    },
    fitted: (text, face, most, room) => Math.min(most, (most * room) / widthOf(text, face, most, 0)),
  };
}

function writeLine(ctx: CanvasRenderingContext2D, { text, face, size, x, y, fill, spacing }: Line): void {
  ctx.font = fontOf(face, size);
  ctx.fillStyle = fill;
  ctx.strokeStyle = fill;
  // The display face is thickened with a stroke of its own colour, as in the stories of the site.
  ctx.lineWidth = size * 0.022;
  ctx.lineJoin = 'round';
  const put = (piece: string, at: number): void => {
    if (face === 'display') ctx.strokeText(piece, at, y);
    ctx.fillText(piece, at, y);
  };
  const spaced = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if (spacing === 0 || 'letterSpacing' in spaced) {
    spaced.letterSpacing = `${spacing}px`;
    put(text, x);
    spaced.letterSpacing = '0px';
    return;
  }
  // Where the canvas cannot space letters, each is put in its place.
  let pen = x;
  for (const letter of text) {
    put(letter, pen);
    pen += ctx.measureText(letter).width + spacing;
  }
}

const THEMES: Record<TramOgTheme, { suffix: string; name: string }> = { light: { suffix: '', name: 'clara' }, night: { suffix: '-nit', name: 'fosca' } };

export interface Drawn {
  design: StoryDesign;
  /** What follows the name of the outing in the name of the file: the design and, for the dark one, the theme. */
  suffix: string;
  alt: string;
  blob: Blob;
}

/** The story of an outing in every design, in one theme, each a PNG of 1080 × 1920. `each` is told as every one is ready. */
export async function draw(outing: Outing, wording: Wording, theme: TramOgTheme, each?: (story: Drawn) => void): Promise<Drawn[]> {
  // The fonts are waited for, never depended on: without them the text is written in the stand-in the page itself would use.
  await Promise.allSettled((['display', 'text'] as const).map((face) => document.fonts.load(own(face))));
  const card = cardOf(outing, wording);
  const drawn: Drawn[] = [];
  for (const { key: design } of STORY_DESIGNS) {
    const lines: Line[] = [];
    const svg = storyCard(card, theme, canvasPen(lines), design);
    const address = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const shapes = new Image();
      // `decode()` is refused for an SVG by some browsers: the load of the image is waited for instead.
      await new Promise<void>((resolve, reject) => {
        shapes.onload = () => resolve();
        shapes.onerror = () => reject(new Error('the shapes of the story could not be read as an image'));
        shapes.src = address;
      });
      const canvas = document.createElement('canvas');
      [canvas.width, canvas.height] = [STORY.width, STORY.height];
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(shapes, 0, 0, STORY.width, STORY.height);
      for (const line of lines) writeLine(ctx, line);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('the canvas gave no image');
      const story = { design, suffix: `-${design}${THEMES[theme].suffix}`, alt: altOf(card, design, THEMES[theme].name), blob };
      drawn.push(story);
      each?.(story);
    } finally {
      URL.revokeObjectURL(address);
    }
  }
  return drawn;
}
