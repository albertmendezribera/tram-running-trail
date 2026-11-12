/**
 * TRAM's own pictograms: flat, geometric, drawn on a 16 × 16 grid and filled
 * with the text colour. No icon font and no outside set (CLAUDE.md 7.5).
 */
export const ICONS = {
  // Directions and actions
  'arrow-right': 'M2 7h8.2L6.6 3.4 8 2l6 6-6 6-1.4-1.4L10.2 9H2z',
  'arrow-down': 'M7 2h2v8.2l3.6-3.6L14 8l-6 6-6-6 1.4-1.4L7 10.2z',
  'arrow-up-right': 'M5 3h8v8h-2V6.4l-6.6 6.6L3 11.6 9.6 5H5z',
  check: 'M6.2 12.6 2 8.4l1.4-1.4 2.8 2.8L12.6 3.4 14 4.8z',
  close: 'M3.4 2 8 6.6 12.6 2 14 3.4 9.4 8l4.6 4.6-1.4 1.4L8 9.4 3.4 14 2 12.6 6.6 8 2 3.4z',
  plus: 'M7 2h2v5h5v2H9v5H7V9H2V7h5z',
  minus: 'M2 7h12v2H2z',
  // Course markers, the same shapes as on the elevation profile
  summit: 'M8 1.5 15 14H1z',
  'aid-station': 'M6 2h4v4h4v4h-4v4H6v-4H2V6h4z',
  checkpoint: 'M2 2h12v12H2z',
  'km-marker': 'M6 1h4v14H6z',
  landmark: 'M8 1l7 7-7 7-7-7z',
  // Terrain
  // A road running to the horizon, with its centre line; a ridge for the trail.
  road: 'M6 2h4l5 12H1zM7.5 3.5h1v2h-1zM7.5 7.5h1v2.5h-1zM7.5 12h1v2h-1z',
  trail: 'M1 14 5.5 6l2.5 3.5L10.5 5 15 14z',
} as const;

export type IconName = keyof typeof ICONS;
