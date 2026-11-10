export const NAV = [
  { href: '/ds/', title: 'Catàleg' },
  { href: '/ds/fonaments/', title: 'Fonaments' },
  { href: '/ds/primitives/measure/', title: 'Measure' },
  { href: '/ds/primitives/data-table/', title: 'DataTable' },
  { href: '/ds/patterns/bib/', title: 'Bib' },
  { href: '/ds/patterns/stat-block/', title: 'StatBlock' },
  { href: '/ds/patterns/elevation-profile/', title: 'ElevationProfile' },
  { href: '/ds/patterns/climb-list/', title: 'ClimbList' },
  { href: '/ds/interactive/segmented-control/', title: 'SegmentedControl' },
  { href: '/ds/interactive/viewer-3d-shell/', title: 'Viewer3DShell' },
  { href: '/ds/moments/recorrer-el-tram/', title: 'M2 · Recórrer el tram' },
] as const;

export const MODES = [
  { theme: 'light', terrain: 'road' },
  { theme: 'light', terrain: 'trail' },
  { theme: 'night', terrain: 'road' },
  { theme: 'night', terrain: 'trail' },
] as const;
