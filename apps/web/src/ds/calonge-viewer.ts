// The real Calonge run for the M2 prototype: terrain and route built by
// `@tram/terrain-pipeline` from the GPX and the ICGC 5 m elevation model.
import { formatMeasure, formatNumber } from '@tram/formats';
import type { TramRouteScroller } from '@tram/design-system/interactive/route-scroller.ts';
import type { Scene, SceneContext } from '@tram/design-system/interactive/viewer-3d-shell.ts';
import { summarize } from '@tram/design-system/patterns/elevation.ts';
import { mountRouteViewer, type RouteMark } from '../three/route-viewer/scene.ts';
import route from './terrain/calonge/route.json';
import terrain from './terrain/calonge/terrain.json';
import terrainUrl from './terrain/calonge/terrain.webp?url';

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

/** The scroll runs the route: the camera follows the scroller, and both mark what the other points at. */
export async function mount(context: SceneContext, scroller: TramRouteScroller): Promise<Scene> {
  const viewer = await mountRouteViewer(context, {
    terrainUrl,
    terrain,
    route: route as Array<[number, number]>,
    share: scroller.share,
    marks: marks(scroller),
    onStep: (direction) => scroller.stepKm(direction),
    onPoint: (share) => scroller.preview(share),
    onPick: (share) => scroller.goTo(share),
  });
  const on = <T,>(type: string, handle: (detail: T) => void): void => scroller.addEventListener(type, (event) => handle((event as CustomEvent<T>).detail), { signal: context.signal });
  on<{ share: number }>('tram:progress', ({ share }) => viewer.setShare(share));
  on<{ share: number | null }>('tram:preview', ({ share }) => viewer.setPreview(share));
  return viewer;
}
