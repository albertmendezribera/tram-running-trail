/** Ways of seeing the terrain. Each loads its own engine, and only when chosen. */
export type ViewerMode = 'walk' | 'real' | 'map';
/**
 * The ways offered today, in the order of the switch. The view from the ground ('walk') is parked: «Palamós
 * a peu» does what it tried to. Its engine and its data stay where they were, and naming it here brings it back.
 */
export const OFFERED_MODES: readonly ViewerMode[] = ['real', 'map'];
export const MODE_LABELS: Record<ViewerMode, string> = { walk: 'A peu', real: 'Realista', map: 'Cartogràfic' };
/** The flight («Fes el vol») is parked with it: the button is not drawn while this is false. */
export const FLIGHT_OFFERED = false;
/** A way that is offered. One that was remembered and is no longer offered is not: the default takes its place. */
export const isMode = (value: unknown): value is ViewerMode => OFFERED_MODES.includes(value as ViewerMode);
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
