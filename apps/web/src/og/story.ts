// A route as a story (M5, E14): a tall image, 1080 × 1920, for the stories of Instagram and WhatsApp.
// The same names, figures and drawings as the page, set for a phone held upright: the name, the route
// on its contours, the figures and the profile. Nothing that matters is in the top or the bottom
// quarter of a thousand pixels, where the apps lay their own buttons over the image.
import { tramOg, type TramOgTerrain, type TramOgTheme } from '@tram/design-system/og';
import { areaPath, createPlot, linePath, type ProfilePoint } from '@tram/design-system/patterns/elevation.ts';
import type { Plate } from '@tram/design-system/patterns/route-plate.ts';
import { fitted, write } from './render.ts';

export const STORY = { width: 1080, height: 1920 };
/** What the apps cover, at the top and at the bottom. */
const COVERED = 250;
const EDGE = 72;
const [WIDTH, HEIGHT] = [STORY.width, STORY.height];

export interface StoryCard {
  terrain: TramOgTerrain;
  kicker: string;
  title: string;
  place: string;
  /** Two or three, the first the one the route is known by. */
  figures: ReadonlyArray<{ value: string; label: string }>;
  profile: readonly ProfilePoint[];
  plate: Plate;
  /** Whose the relief of the plate is: said on the image itself, as its licence asks. */
  credit: string;
}

export function storyCard({ terrain, kicker, title, place, figures, profile, plate, credit }: StoryCard, theme: TramOgTheme = 'light'): string {
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
  parts.push(write(place, 'text', 40, EDGE, under, color['text-muted']).svg);

  // The route on its contours. A plate taller than wide leaves the figures a column at its side; a wide one, a row under it.
  const upright = plate.height > plate.width;
  const box = upright ? { x: EDGE, y: under + 52, width: 520, height: 700 } : { x: EDGE, y: under + 52, width: WIDTH - EDGE * 2, height: 460 };
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
  parts.push(write(credit, 'text', 22, box.x, box.y + drawn.height + 40, color['text-muted']).svg);

  const tall = 230;
  const foot = HEIGHT - COVERED - 20;
  // The figures, as on a results sheet: the number large, its name small under it.
  const label = (text: string, x: number, y: number): string => write(text.toLocaleUpperCase('ca'), 'text', 24, x, y, color['text-muted'], { tracking: 0.06 }).svg;
  if (upright) {
    const x = box.x + drawn.width + 56;
    const room = WIDTH - EDGE - x;
    figures.forEach((figure, i) => {
      const y = box.y + 130 + i * 230;
      parts.push(write(figure.value, 'display', fitted(figure.value, 'display', 150, room), x, y, color.text).svg, label(figure.label, x, y + 40));
    });
  } else {
    // Half way between the plate and the profile.
    const y = (box.y + drawn.height + 40 + foot - tall) / 2 + 30;
    const room = (WIDTH - EDGE * 2) / figures.length;
    figures.forEach((figure, i) => {
      const x = EDGE + i * room;
      parts.push(write(figure.value, 'display', fitted(figure.value, 'display', 130, room - 40), x, y, color.text).svg, label(figure.label, x, y + 40));
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
