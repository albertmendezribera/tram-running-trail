// The real Calonge run for the M2 prototype: terrain and route built by
// `@tram/terrain-pipeline` from the GPX and the ICGC 5 m elevation model.
import type { TramRouteScroller } from '@tram/design-system/interactive/route-scroller.ts';
import type { Scene, SceneContext } from '@tram/design-system/interactive/viewer-3d-shell.ts';
import { mountRouteViewer } from '../three/route-viewer/scene.ts';
import route from './terrain/calonge/route.json';
import terrain from './terrain/calonge/terrain.json';
import terrainUrl from './terrain/calonge/terrain.webp?url';

/** The scroll runs the route: the camera follows the scroller's progress. */
export async function mount(context: SceneContext, scroller: TramRouteScroller): Promise<Scene> {
  const viewer = await mountRouteViewer(context, {
    terrainUrl,
    terrain,
    route: route as Array<[number, number]>,
    share: scroller.share,
    onStep: (direction) => scroller.stepKm(direction),
  });
  scroller.addEventListener('tram:progress', (event) => viewer.setShare((event as CustomEvent<{ share: number }>).detail.share), { signal: context.signal });
  return viewer;
}
