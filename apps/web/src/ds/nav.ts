/** The catalogue, grouped as in CLAUDE.md 6.7. */
export const GROUPS = [
  { title: 'Sistema', items: [{ href: '/ds/', title: 'Catàleg' }, { href: '/ds/fonaments/', title: 'Fonaments' }] },
  {
    title: 'Primitives',
    items: [
      { href: '/ds/primitives/text/', title: 'Text i títols' },
      { href: '/ds/primitives/actions/', title: 'Enllaç i botó' },
      { href: '/ds/primitives/media/', title: 'Icona, filet i figura' },
      { href: '/ds/primitives/layout/', title: 'Composició' },
      { href: '/ds/primitives/measure/', title: 'Measure' },
      { href: '/ds/primitives/data-table/', title: 'DataTable' },
    ],
  },
  {
    title: 'Patrons',
    items: [
      { href: '/ds/patterns/bib/', title: 'Bib' },
      { href: '/ds/patterns/stat-block/', title: 'StatBlock' },
      { href: '/ds/patterns/elevation-profile/', title: 'ElevationProfile' },
      { href: '/ds/patterns/climb-list/', title: 'ClimbList' },
    ],
  },
  {
    title: 'Interactius',
    items: [
      { href: '/ds/interactive/segmented-control/', title: 'SegmentedControl' },
      { href: '/ds/interactive/theme-toggle/', title: 'ThemeToggle' },
      { href: '/ds/interactive/viewer-3d-shell/', title: 'Viewer3DShell' },
    ],
  },
  { title: 'Moments', items: [{ href: '/ds/moments/recorrer-el-tram/', title: 'M2 · Recórrer el tram' }] },
] as const;

export const NAV = GROUPS.flatMap((group) => group.items.map((item) => ({ ...item, group: group.title })));

export const MODES = [
  { theme: 'light', terrain: 'road' },
  { theme: 'light', terrain: 'trail' },
  { theme: 'night', terrain: 'road' },
  { theme: 'night', terrain: 'trail' },
] as const;
