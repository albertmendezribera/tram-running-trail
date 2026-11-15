// What each shared image shows: the same names and figures as its page, from the same content.
import { summarize } from '@tram/design-system/patterns/elevation.ts';
import { formatMeasure } from '@tram/formats';
import { RACES, ROUTES, routeOf, visible } from '../content';
import { pairSlug, shoeName, visiblePairs } from '../content/shoes';
import type { PairCard, RouteCard } from './render';

export type OgCard = { path: string; kind: 'route'; card: RouteCard } | { path: string; kind: 'pair'; card: PairCard };

const TERRAIN = { road: 'Cursa d’asfalt', trail: 'Cursa de muntanya', mixed: 'Cursa' } as const;

/** The image of a page, for its head: where it is and what it shows. `path` is the page's own, without slashes at the ends. */
export function ogOf(path: string): { path: string; alt: string } | undefined {
  const card = ogCards().find((c) => c.path === path)?.card;
  return card && { path: `/og/${path}.png`, alt: `${card.title}: ${card.figures.map((f) => `${f.label.toLocaleLowerCase('ca')} ${f.value}`).join(', ')}` };
}

export function ogCards(): OgCard[] {
  const races = visible(RACES).map((race): OgCard => {
    const course = race.courses[0]!;
    const route = routeOf(course.route);
    return {
      path: `curses/${race.slug}`,
      kind: 'route',
      card: {
        terrain: race.terrain,
        kicker: TERRAIN[race.terrain],
        title: race.name,
        place: race.place,
        figures: [
          { value: formatMeasure(Number((course.distanceM / 1000).toFixed(2)), 'km', 'ca'), label: 'Distància' },
          { value: formatMeasure(course.elevationGainM, 'm-gain', 'ca'), label: 'Desnivell positiu' },
        ],
        profile: route.profile,
        plan: { d: route.plate.route, width: route.plate.width, height: route.plate.height },
      },
    };
  });
  const routes = visible(ROUTES).map((route): OgCard => {
    const summary = summarize(route.profile);
    return {
      path: `rutes/${route.slug}`,
      kind: 'route',
      card: {
        // A track says how much it climbs, not what is underfoot: nothing is claimed about the surface.
        terrain: 'mixed',
        kicker: 'Ruta',
        title: route.name,
        place: route.place,
        figures: [
          { value: formatMeasure(Number(summary.distanceKm.toFixed(2)), 'km', 'ca'), label: 'Distància' },
          { value: formatMeasure(Math.round(summary.gainM), 'm-gain', 'ca'), label: 'Desnivell positiu' },
        ],
        profile: route.profile,
        plan: { d: route.plate.route, width: route.plate.width, height: route.plate.height },
      },
    };
  });
  const pairs = visiblePairs().map(([a, b]): OgCard => {
    const drop = (s: typeof a): number => Number((s.specs.stackHeelMm - s.specs.stackForefootMm).toFixed(1));
    const both = (unit: 'g' | 'mm', x: number | null, y: number | null): string => `${formatMeasure(x, unit, 'ca')} / ${formatMeasure(y, unit, 'ca')}`;
    return {
      path: `comparar/${pairSlug(a, b)}`,
      kind: 'pair',
      card: {
        kicker: 'Comparador',
        title: `${shoeName(a)} vs ${shoeName(b)}`,
        figures: [
          { value: both('g', a.specs.weightG, b.specs.weightG), label: 'Pes' },
          { value: both('mm', drop(a), drop(b)), label: 'Drop' },
        ],
        shoes: [
          { specs: a.specs, terrain: a.terrain },
          { specs: b.specs, terrain: b.terrain },
        ],
      },
    };
  });
  return [...races, ...routes, ...pairs];
}
