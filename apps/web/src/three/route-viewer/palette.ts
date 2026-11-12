import { tramThreeColors, type TramColorName, type TramTerrain, type TramThreeColor } from '@tram/design-system/three';

export type Palette = Record<TramColorName, TramThreeColor>;

/**
 * The colours of the modes in force where the scene sits: `data-theme` and
 * `data-terrain` nest, and without `data-theme` the theme follows the system.
 * Calls `apply` now and again whenever the system theme changes.
 */
export function watchPalette(element: HTMLElement, signal: AbortSignal, apply: (palette: Palette) => void): void {
  const dark = matchMedia('(prefers-color-scheme: dark)');
  const read = (): void => {
    const scheme = getComputedStyle(element).colorScheme;
    const theme = scheme === 'dark' ? 'night' : scheme === 'light' ? 'light' : dark.matches ? 'night' : 'light';
    const terrain = (element.closest<HTMLElement>('[data-terrain]')?.dataset['terrain'] ?? 'mixed') as TramTerrain;
    apply(tramThreeColors[theme][terrain]);
  };
  read();
  dark.addEventListener('change', read, { signal });
  // The reader can switch the night theme on the page at any time.
  const observer = new MutationObserver(read);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  signal.addEventListener('abort', () => observer.disconnect(), { once: true });
}
