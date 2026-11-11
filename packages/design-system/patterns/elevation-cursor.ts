import { elevationAt, type ProfilePoint } from './elevation.ts';

export interface ProfileCursor {
  /** Moves the cursor to a kilometre of the route. */
  setKm(km: number): void;
}

const controllers = new WeakMap<HTMLElement, ProfileCursor>();

/**
 * The cursor of an ElevationProfile rendered with `cursor`. Moving the pointer
 * over the chart emits `tram:km` (bubbling, detail: { km, commit }) so a page
 * can keep a 3D view or a scroll position in sync, both ways (CLAUDE.md 8.1).
 * When the pointer leaves it emits `tram:km-leave`: the preview is over.
 */
export function profileCursor(figure: HTMLElement): ProfileCursor | undefined {
  const existing = controllers.get(figure);
  if (existing) return existing;
  const data = figure.querySelector<HTMLScriptElement>('script[data-points]');
  const plot = figure.querySelector<HTMLElement>('.plot');
  const mark = figure.querySelector<HTMLElement>('[data-cursor-mark]');
  if (!data || !plot || !mark) return undefined;
  const { points, low, high } = JSON.parse(data.textContent ?? '{}') as { points: ProfilePoint[]; low: number; high: number };
  const first = points[0]![0];
  const last = points.at(-1)![0];

  const controller: ProfileCursor = {
    setKm(km) {
      const k = Math.min(last, Math.max(first, km));
      mark.hidden = false;
      mark.style.left = `${((k - first) / (last - first)) * 100}%`;
      mark.style.setProperty('--dot', `${(1 - (elevationAt(points, k) - low) / (high - low)) * 100}%`);
    },
  };

  const kmAt = (event: PointerEvent): number => {
    const box = plot.getBoundingClientRect();
    return first + Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) * (last - first);
  };
  const emit = (event: PointerEvent, commit: boolean): void => {
    const km = kmAt(event);
    controller.setKm(km);
    figure.dispatchEvent(new CustomEvent('tram:km', { bubbles: true, detail: { km, commit } }));
  };
  plot.addEventListener('pointermove', (e) => emit(e, false));
  plot.addEventListener('click', (e) => emit(e, true));
  plot.addEventListener('pointerleave', () => figure.dispatchEvent(new CustomEvent('tram:km-leave', { bubbles: true })));

  controllers.set(figure, controller);
  return controller;
}

for (const figure of document.querySelectorAll<HTMLElement>('figure[data-cursor]')) profileCursor(figure);
