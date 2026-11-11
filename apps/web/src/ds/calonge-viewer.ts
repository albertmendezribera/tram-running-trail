// The real Calonge run for the M2 prototype: terrain and route built by
// `@tram/terrain-pipeline` from the GPX and the ICGC 5 m elevation model.
import { formatMeasure, formatNumber } from '@tram/formats';
import type { TramRouteScroller } from '@tram/design-system/interactive/route-scroller.ts';
import type { Scene, SceneContext } from '@tram/design-system/interactive/viewer-3d-shell.ts';
import { elevationAt, gradeBands, summarize } from '@tram/design-system/patterns/elevation.ts';
import { toLngLat } from '@tram/terrain-pipeline/utm';
import type { RouteMark, RouteViewer } from '../three/route-viewer/scene.ts';
import route from './terrain/calonge/route.json';
import terrain from './terrain/calonge/terrain.json';
import terrainUrl from './terrain/calonge/terrain.webp?url';
import { MODE_FIELD, preferredMode, rememberMode, type ViewerMode } from './viewer-mode.ts';

/** Course markers, computed from the profile: each kilometre, start, finish and the highest point. */
function marks(scroller: TramRouteScroller): RouteMark[] {
  const { points, start, finish, locale } = scroller.route;
  const first = points[0]![0];
  const length = points.at(-1)![0] - first;
  const out: RouteMark[] = [];
  for (let km = Math.ceil(first + 0.5); km < first + length - 0.3; km++) out.push({ share: (km - first) / length, text: formatNumber(km, locale, 0), kind: 'km' });
  const [topKm, topM] = summarize(points).highest;
  out.push({ share: (topKm - first) / length, text: `Cim · ${formatMeasure(topM, 'm', locale)}`, kind: 'place' });
  // A loop starts and ends at the same place: one label, not two on top of each other.
  const [a, b] = [route[0]!, route.at(-1)!];
  if (Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!) < 80) out.push({ share: 0, text: `${start} · ${finish}`, kind: 'place' });
  else out.push({ share: 0, text: start, kind: 'place' }, { share: 1, text: finish, kind: 'place' });
  return out;
}

/** The grade bands of the profile, as shares of the route: the 3D route shows the same ones. */
function grades(scroller: TramRouteScroller): Array<{ from: number; to: number; level: number }> {
  const { points } = scroller.route;
  const first = points[0]![0];
  const length = points.at(-1)![0] - first;
  return gradeBands(points).map((band) => ({ from: (band.from - first) / length, to: (band.to - first) / length, level: band.level }));
}

async function start(mode: ViewerMode, context: SceneContext, scroller: TramRouteScroller): Promise<RouteViewer> {
  const shared = {
    share: scroller.share,
    marks: marks(scroller),
    grades: grades(scroller),
    onStep: (direction: -1 | 1) => scroller.stepKm(direction),
    onPoint: (share: number | null) => scroller.preview(share),
    onPick: (share: number) => scroller.goTo(share),
  };
  if (mode === 'map') {
    const { mountRouteViewer } = await import('../three/route-viewer/scene.ts');
    return mountRouteViewer(context, { ...shared, terrainUrl, terrain, route: route as Array<[number, number]> });
  }
  const { mountRealRouteViewer } = await import('../map/route-viewer/scene.ts');
  const { points } = scroller.route;
  const first = points[0]![0];
  const length = points.at(-1)![0] - first;
  return mountRealRouteViewer(context, {
    ...shared,
    path: (route as Array<[number, number]>).map(([x, y]) => toLngLat(terrain.x0 + x, terrain.y0 + y)),
    elevationAt: (share) => elevationAt(points, first + share * length),
  });
}

/**
 * The scroll runs the route: the camera follows the scroller, and both mark what
 * the other points at. The mode switch swaps the engine without losing the place.
 */
export async function mount(context: SceneContext, scroller: TramRouteScroller): Promise<Scene> {
  // The switch is the truth: it may have been used before the 3D was asked for.
  const chosen = (): ViewerMode => (scroller.querySelector<HTMLInputElement>(`input[name="${MODE_FIELD}"]:checked`)?.value as ViewerMode | undefined) ?? preferredMode();
  let mode = chosen();
  let viewer = await start(mode, context, scroller);
  let active = true;
  const on = <T,>(target: EventTarget, type: string, handle: (detail: T, event: Event) => void): void =>
    target.addEventListener(type, (event) => handle((event as CustomEvent<T>).detail, event), { signal: context.signal });
  on<{ share: number }>(scroller, 'tram:progress', ({ share }) => viewer.setShare(share));
  on<{ share: number | null }>(scroller, 'tram:preview', ({ share }) => viewer.setPreview(share));

  // Brings the view in line with the switch, however many times it changed meanwhile.
  let swapping = false;
  const reconcile = async (): Promise<void> => {
    if (swapping) return;
    swapping = true;
    context.container.setAttribute('aria-busy', 'true');
    try {
      while (chosen() !== mode && !context.signal.aborted) {
        const next = chosen();
        try {
          // The new view is ready before the old one goes: no empty frame in between.
          const fresh = await start(next, context, scroller);
          viewer.dispose();
          viewer = fresh;
          mode = next;
          viewer.setActive?.(active);
        } catch (error) {
          console.error(error);
          const previous = scroller.querySelector<HTMLInputElement>(`input[name="${MODE_FIELD}"][value="${mode}"]`);
          if (previous) previous.checked = true;
          rememberMode(mode);
        }
      }
    } finally {
      swapping = false;
      context.container.removeAttribute('aria-busy');
    }
  };
  on<undefined>(scroller, 'change', (_, event) => {
    if ((event.target as HTMLInputElement).name === MODE_FIELD) void reconcile();
  });
  // The switch may have moved while the first view was loading.
  void reconcile();

  return {
    step: (direction) => viewer.step?.(direction),
    setActive(next) {
      active = next;
      viewer.setActive?.(next);
    },
    dispose: () => viewer.dispose(),
  };
}
