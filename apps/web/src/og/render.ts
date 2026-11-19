// The image a page is shared with (M5, E14): drawn at build time from the same figures and the same
// tokens as the page. An SVG whose text is already outlines, so it needs no font where it is rendered,
// turned into a PNG of 1200 × 630.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tramOg, type TramOgTerrain } from '@tram/design-system/og';
import { areaPath, createPlot, linePath, type ProfilePoint } from '@tram/design-system/patterns/elevation.ts';
import { buildShoeProfile, type ShoeSpecs, toCurve, toPath } from '@tram/shoe-geometry';
import * as fontkit from 'fontkit';
import sharp from 'sharp';

const [WIDTH, HEIGHT, EDGE] = [1200, 630, 56];
const require = createRequire(import.meta.url);
const open = (file: string): fontkit.Font => fontkit.create(readFileSync(require.resolve(`@tram/design-system/fonts/${file}`))) as fontkit.Font;
/**
 * The faces of the site, at the weight their files open with: 700 for the condensed display face
 * and 400 for text. The heavier weights of the page are instances of a variable font, which the
 * library cannot draw from these files; the display face is thickened with a stroke of its own colour.
 */
const FACES = { display: open('sofia-sans-extra-condensed-latin-700-900.woff2'), text: open('sofia-sans-latin-400-700.woff2') };

interface Written {
  svg: string;
  width: number;
}
/** A line of text as outlines, its baseline at `y`. `tracking` is in ems. */
export function write(text: string, face: keyof typeof FACES, size: number, x: number, y: number, fill: string, { anchor = 'start', tracking = 0 }: { anchor?: 'start' | 'end'; tracking?: number } = {}): Written {
  const font = FACES[face];
  const scale = size / font.unitsPerEm;
  const run = font.layout(text);
  const extra = tracking * font.unitsPerEm;
  const width = (run.advanceWidth + extra * run.glyphs.length) * scale;
  let pen = 0;
  const paths = run.glyphs.map((glyph, i) => {
    const d = glyph.path.toSVG();
    const at = pen + run.positions[i]!.xOffset;
    pen += run.positions[i]!.xAdvance + extra;
    return d ? `<path transform="translate(${at.toFixed(1)} 0)" d="${d}"/>` : '';
  });
  const left = anchor === 'end' ? x - width : x;
  // A font counts upwards; a drawing counts downwards.
  const bold = face === 'display' ? ` stroke="${fill}" stroke-width="${(font.unitsPerEm * 0.022).toFixed(1)}" stroke-linejoin="round"` : '';
  return { svg: `<g transform="translate(${left.toFixed(1)} ${y}) scale(${scale.toFixed(5)} ${(-scale).toFixed(5)})" fill="${fill}"${bold}>${paths.join('')}</g>`, width };
}
/** The largest size, up to `most`, at which a line fits a width. */
export const fitted = (text: string, face: keyof typeof FACES, most: number, room: number): number => Math.min(most, (most * room) / write(text, face, most, 0, 0, '#000').width);

interface Frame {
  terrain: TramOgTerrain;
  /** Small capitals over the title: what the page is. */
  kicker: string;
  title: string;
  /** A second line under the title, smaller: the place. */
  place?: string | undefined;
  figures: ReadonlyArray<{ value: string; label: string }>;
  /** Drawn along the bottom, over the whole width. */
  foot: (colour: Record<string, string>) => string;
}

function frame({ terrain, kicker, title, place, figures, foot }: Frame): string {
  const { color } = tramOg.light[terrain];
  const parts: string[] = [`<rect width="${WIDTH}" height="${HEIGHT}" fill="${color.surface}"/>`];
  // The name of the site as on a bib, a bar in the accent before it, and what the page is at the far side.
  parts.push(`<rect x="${EDGE}" y="${EDGE + 4}" width="40" height="8" fill="${color.accent}"/>`);
  parts.push(write('TRAM', 'display', 44, EDGE + 56, EDGE + 28, color.text, { tracking: 0.02 }).svg);
  parts.push(write(kicker.toLocaleUpperCase('ca'), 'text', 20, WIDTH - EDGE, EDGE + 22, color['text-muted'], { anchor: 'end', tracking: 0.06 }).svg);
  parts.push(`<rect x="${EDGE}" y="${EDGE + 50}" width="${WIDTH - EDGE * 2}" height="3" fill="${color['rule-strong']}"/>`);
  const size = fitted(title, 'display', 168, WIDTH - EDGE * 2);
  const base = EDGE + 74 + size * 0.74;
  parts.push(write(title, 'display', size, EDGE - size * 0.012, base, color.text, { tracking: -0.01 }).svg);
  if (place) parts.push(write(place, 'text', 28, EDGE, base + 44, color['text-muted']).svg);
  // The figures, as on a results sheet: the number large, its name small under it.
  let x = EDGE;
  const row = base + (place ? 44 : 0) + 96;
  for (const figure of figures) {
    const value = write(figure.value, 'display', 84, x, row, color.text);
    parts.push(value.svg, write(figure.label.toLocaleUpperCase('ca'), 'text', 17, x, row + 28, color['text-muted'], { tracking: 0.06 }).svg);
    x += Math.max(value.width, write(figure.label.toLocaleUpperCase('ca'), 'text', 17, 0, 0, '#000', { tracking: 0.06 }).width) + 56;
  }
  parts.push(foot(color));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${parts.join('')}</svg>`;
}

export interface RouteCard {
  terrain: TramOgTerrain;
  kicker: string;
  title: string;
  place: string;
  figures: ReadonlyArray<{ value: string; label: string }>;
  profile: readonly ProfilePoint[];
  /** The line of the route seen from above (its plate): what tells one flat route from another. */
  plan?: { d: string; width: number; height: number } | undefined;
}

/** A race or a route: its name, its figures and its real profile along the bottom. */
export function routeCard({ profile, plan, ...rest }: RouteCard): string {
  return frame({
    ...rest,
    foot(color) {
      const tall = 176;
      // The route from above, at the right, as large as fits between the title and the profile.
      const box = { width: 330, height: 230 };
      const fit = plan ? Math.min(box.width / plan.width, box.height / plan.height) : 1;
      const drawn = plan
        ? `<g transform="translate(${(WIDTH - EDGE - plan.width * fit).toFixed(1)} ${(HEIGHT - tall - 24 - plan.height * fit).toFixed(1)}) scale(${fit.toFixed(4)})"><path d="${plan.d}" fill="none" stroke="${color['data-primary']}" stroke-width="${(4 / fit).toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"/></g>`
        : '';
      const low = Math.min(...profile.map((p) => p[1]));
      // A flat route is drawn flat: the box stands for a hundred metres at least, as on the page.
      const high = Math.max(...profile.map((p) => p[1]), low + 100);
      const plot = createPlot(profile, [low, high], WIDTH, tall);
      const tone = rest.terrain === 'road' ? color['data-road']! : rest.terrain === 'trail' ? color['data-trail']! : color['data-primary']!;
      return `<g transform="translate(0 ${HEIGHT - tall})"><path d="${areaPath(profile, plot)}" fill="${tone}" fill-opacity="0.22"/><path d="${linePath(profile, plot)}" fill="none" stroke="${tone}" stroke-width="5" stroke-linejoin="round"/></g>${drawn}`;
    },
  });
}

export interface PairCard {
  kicker: string;
  title: string;
  figures: ReadonlyArray<{ value: string; label: string }>;
  shoes: readonly [{ specs: ShoeSpecs; terrain: TramOgTerrain }, { specs: ShoeSpecs; terrain: TramOgTerrain }];
}

/** A comparison: the two shoes in profile, one over the other and heel to heel, as in the X-ray of the page. */
export function pairCard({ shoes, ...rest }: PairCard): string {
  return frame({
    ...rest,
    terrain: 'mixed',
    foot(color) {
      const profiles = shoes.map(({ specs }) => buildShoeProfile(specs));
      const long = Math.max(...profiles.map((p) => p.lengthMm));
      const tall = Math.max(...profiles.map((p) => p.heightMm + p.depthMm));
      const scale = Math.min((WIDTH * 0.5) / long, 250 / tall);
      const drawn = profiles.map((profile, i) => {
        const tone = shoes[i]!.terrain === 'road' ? color['data-road']! : shoes[i]!.terrain === 'trail' ? color['data-trail']! : color['data-primary']!;
        const sole = [toPath(profile.midsole), toPath(profile.outsole), ...profile.lugs.map((lug) => toPath(lug))].map((d) => `<path d="${d}" fill="${tone}" fill-opacity="0.3" stroke="${tone}" stroke-width="${(2.2 / scale).toFixed(2)}"/>`).join('');
        return `${sole}<path d="${toCurve(profile.upper)}" fill="none" stroke="${tone}" stroke-width="${(2.6 / scale).toFixed(2)}"/>`;
      });
      // Both stand on the same ground, heels at the same place, at the right of the card.
      const depth = Math.max(...profiles.map((p) => p.depthMm));
      return `<g transform="translate(${(WIDTH - EDGE - long * scale).toFixed(1)} ${(HEIGHT - 34 - depth * scale).toFixed(1)}) scale(${scale.toFixed(4)})">${drawn.join('')}</g><rect x="${EDGE}" y="${HEIGHT - 30}" width="${WIDTH - EDGE * 2}" height="3" fill="${color['rule-strong']}"/>`;
    },
  });
}

/** The drawing as a PNG, the size networks ask for. */
export const toPng = (svg: string): Promise<Buffer> => sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
