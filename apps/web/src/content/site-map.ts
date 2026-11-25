// The site by its parts, for the menu and for the map at the foot of every page. Nothing is listed by
// hand: a part is there because the build has its pages, so the test environment and production each
// show their own.
import { ROUTES, STORY_MAKER_SHOWN, visible } from './index';
import { calendarRaces } from './calendar';
import { facets, hrefOf } from './facets';
import { catalogShoes } from './shoe-catalog';
import { needPath, needs } from './shoe-needs';
import { visibleShoes } from './shoes';

export interface SiteLink {
  href: string;
  label: string;
}

export interface SiteSection {
  title: string;
  href?: string;
  links: SiteLink[];
}

/** The three sections: what the site is about. They are the menu. */
export const SECTIONS: readonly SiteLink[] = [
  { href: '/ca/curses/', label: 'Curses' },
  { href: '/ca/rutes/', label: 'Rutes' },
  { href: '/ca/sabatilles/', label: 'Sabatilles' },
];

/** What has a way in from every page without being a section: a town to walk in 3D, the story maker. */
export function tools(): SiteLink[] {
  return [...visible(ROUTES).flatMap((route) => (route.onFoot ? [{ href: route.onFoot.href, label: `${route.name} a peu` }] : [])), ...(STORY_MAKER_SHOWN ? [{ href: '/ca/stories/', label: 'Stories' }] : [])];
}

/** The map at the foot of every page: each section with the main pages under it. */
export function siteMap(): SiteSection[] {
  const kinds = calendarRaces().length ? facets().filter((facet) => facet.kind === 'type') : [];
  const shoes = catalogShoes().length + visibleShoes().length;
  const more = tools();
  return [
    { title: 'Curses', href: '/ca/curses/', links: [{ href: '/ca/curses/', label: 'Calendari' }, ...kinds.map((facet) => ({ href: hrefOf(facet), label: facet.title }))] },
    { title: 'Rutes', href: '/ca/rutes/', links: visible(ROUTES).map((route) => ({ href: `/ca/rutes/${route.slug}/`, label: route.name })) },
    ...(shoes
      ? [
          {
            title: 'Sabatilles',
            href: '/ca/sabatilles/',
            links: [{ href: '/ca/sabatilles/', label: 'Catàleg' }, ...needs().map((need) => ({ href: needPath(need), label: need.title })), ...(catalogShoes().length ? [{ href: '/ca/comparar/', label: 'Comparador' }] : [])],
          },
        ]
      : []),
    ...(more.length ? [{ title: 'Eines', links: more }] : []),
  ];
}
