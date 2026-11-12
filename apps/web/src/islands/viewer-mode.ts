/** Ways of seeing the terrain. Each loads its own engine, and only when chosen. */
export type ViewerMode = 'walk' | 'real' | 'map';
export const isMode = (value: unknown): value is ViewerMode => value === 'walk' || value === 'real' || value === 'map';
/** Name of the switch's radio group. One route viewer per page. */
export const MODE_FIELD = 'route-view';
const MODE_KEY = 'tram-viewer-mode';

/** The photograph costs megabytes: with data saving on, the drawn map comes first. */
export function preferredMode(): ViewerMode {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    if (isMode(saved)) return saved;
  } catch {
    // Storage can be blocked: the default applies.
  }
  return (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ? 'map' : 'real';
}

export function rememberMode(mode: ViewerMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Not remembered, that is all.
  }
}
