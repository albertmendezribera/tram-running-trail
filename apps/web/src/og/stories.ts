// The stories of the site: every race and route with a track, in the two themes. The same names and
// figures as the image a link is shared with (`cards.ts`), and one figure more, for the room there is.
import { summarize } from '@tram/design-system/patterns/elevation.ts';
import type { TramOgTheme } from '@tram/design-system/og';
import { formatMeasure } from '@tram/formats';
import { RACES, ROUTES, routeOf, visible } from '../content';
import { ogCards } from './cards';
import type { StoryCard } from './story';

export interface Story {
  /** Its address under `/stories/`, without the `.png`: `rutes/calonge`, `rutes/calonge-nit`. */
  path: string;
  theme: TramOgTheme;
  card: StoryCard;
}

/** A time as a runner writes it: `1:23:15`, or `58:53` under the hour. The page keeps the clock of a results sheet. */
const clock = (seconds: number): string => {
  const s = Math.round(seconds);
  const tail = `${String(Math.floor(s / 60) % 60).padStart(s >= 3600 ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`;
  return s >= 3600 ? `${Math.floor(s / 3600)}:${tail}` : tail;
};

/** The relief of every plate is the ICGC's; its licence asks to be named where the work is shown. */
const RELIEF = 'Relleu: ICGC, CC BY 4.0';
const THEMES: ReadonlyArray<{ theme: TramOgTheme; suffix: string; name: string }> = [
  { theme: 'light', suffix: '', name: 'Clara' },
  { theme: 'night', suffix: '-nit', name: 'Fosca' },
];

export function stories(): Story[] {
  const tracks = new Map<string, ReturnType<typeof routeOf>>([...visible(RACES).map((race) => [`curses/${race.slug}`, routeOf(race.courses[0]!.route)] as const), ...visible(ROUTES).map((route) => [`rutes/${route.slug}`, route] as const)]);
  return ogCards().flatMap((entry) => {
    const route = tracks.get(entry.path);
    if (entry.kind !== 'route' || !route) return [];
    const summary = summarize(route.profile);
    const [distance, gain] = entry.card.figures;
    // A route that tells its time is shared as a run is told: how far, how long, how fast, how much it climbs.
    // The time is of whoever ran the route: the story of a race, which is nobody's run, does not carry it.
    const timeS = entry.path.startsWith('rutes/') ? route.timeS : undefined;
    const figures = timeS
      ? [distance!, { value: clock(timeS), label: 'Temps' }, { value: formatMeasure(timeS / summary.distanceKm, 'pace', 'ca'), label: 'Ritme mitjà' }, gain!]
      : [...entry.card.figures, { value: formatMeasure(Math.round(summary.highest[1]), 'm', 'ca'), label: 'Punt més alt' }];
    const card: StoryCard = { ...entry.card, figures, plate: route.plate, credit: RELIEF };
    return THEMES.map(({ theme, suffix }) => ({ path: `${entry.path}${suffix}`, theme, card }));
  });
}

/** The stories of a page, for its share block: where each is, what it is called and what it shows. `path` as in `ogOf`. */
export function storiesOf(path: string): Array<{ href: string; file: string; name: string; alt: string }> {
  const own = stories().filter((story) => story.path === path || story.path === `${path}-nit`);
  return own.map((story) => {
    const { name } = THEMES.find((entry) => entry.theme === story.theme)!;
    return {
      href: `/stories/${story.path}.png`,
      file: `tram-${story.path.replace(/\//g, '-')}.png`,
      name,
      alt: `Imatge vertical de ${story.card.title} (${name.toLocaleLowerCase('ca')}): el recorregut sobre les corbes de nivell, ${story.card.figures.map((f) => `${f.label.toLocaleLowerCase('ca')} ${f.value}`).join(', ')}, i el perfil.`,
    };
  });
}
