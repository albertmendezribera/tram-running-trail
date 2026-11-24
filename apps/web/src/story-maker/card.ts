// What the story of a visitor's own outing shows: the same figures, in the same order, as the story of
// a route of the site (`og/stories.ts`), from the track the visitor brought.
import { summarize } from '@tram/design-system/patterns/elevation.ts';
import type { Plate } from '@tram/design-system/patterns/route-plate.ts';
import { formatMeasure } from '@tram/formats';
import { clock } from '../og/clock';
import { STORY_DESIGNS, type StoryCard, type StoryDesign } from '../og/story';

/** The relief of the plate is the ICGC's; its licence asks to be named where the work is shown. */
export const RELIEF = 'Relleu: ICGC, CC BY 4.0';

export interface Outing {
  profile: ReadonlyArray<readonly [number, number]>;
  plate: Plate;
  /** The same route on ground framed to the window of «Plànol». */
  window?: Plate | undefined;
  /** Seconds the watch was recording, or null when the file has no times. */
  seconds: number | null;
  /** Whether the plate has contour lines: only where the ICGC's model reaches. */
  relief: boolean;
}

export interface Wording {
  title: string;
  place: string;
  /** Whether the time and the pace are told. They are the visitor's own, and theirs to leave out. */
  time: boolean;
}

export function cardOf({ profile, plate, window, seconds, relief }: Outing, { title, place, time }: Wording): StoryCard {
  const summary = summarize(profile);
  const distance = { value: formatMeasure(Number(summary.distanceKm.toFixed(2)), 'km', 'ca'), label: 'Distància' };
  const gain = { value: formatMeasure(Math.round(summary.gainM), 'm-gain', 'ca'), label: 'Desnivell positiu' };
  const figures =
    time && seconds
      ? [distance, { value: clock(seconds), label: 'Temps' }, { value: formatMeasure(seconds / summary.distanceKm, 'pace', 'ca'), label: 'Ritme mitjà' }, gain]
      : [distance, gain, { value: formatMeasure(Math.round(summary.highest[1]), 'm', 'ca'), label: 'Punt més alt' }];
  // A track says how much it climbs, not what is underfoot: nothing is claimed about the surface.
  return { terrain: 'mixed', kicker: 'Ruta', title, place, figures, profile, plate, window, credit: relief ? RELIEF : '' };
}

/** What an image shows, in words, for whoever does not see it. */
export const altOf = (card: StoryCard, design: StoryDesign, theme: string): string => {
  const figures = card.figures.map((f) => `${f.label.toLocaleLowerCase('ca')} ${f.value}`).join(', ');
  const shown: Record<StoryDesign, string> = {
    fitxa: `el recorregut${card.credit ? ' sobre les corbes de nivell' : ''}, ${figures}, i el perfil`,
    planol: `el mapa del recorregut de banda a banda${card.credit ? ', amb les corbes de nivell' : ''}, i a sota, ${figures}`,
    dorsal: `la distància en gran, ${figures}, i el perfil`,
    perfil: `el perfil amb el punt més alt marcat, i ${figures}`,
    trac: `la línia del recorregut amb els quilòmetres numerats, i ${figures}`,
  };
  return `Imatge vertical de ${card.title}, disseny «${STORY_DESIGNS.find((entry) => entry.key === design)!.name}» (${theme}): ${shown[design]}.`;
};

/** A name as part of a file name. */
export const fileSlug = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('ca')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'ruta';
