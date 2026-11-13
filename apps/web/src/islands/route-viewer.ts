// Mounts the 3D view of a route of the content folder: its terrain and track
// were built by `@tram/terrain-pipeline` from the GPX and the ICGC elevation model.
import { formatMeasure, formatNumber } from '@tram/formats';
import type { TramRouteScroller } from '@tram/design-system/interactive/route-scroller.ts';
import type { Scene, SceneContext } from '@tram/design-system/interactive/viewer-3d-shell.ts';
import { elevationAt, gradeBands, summarize } from '@tram/design-system/patterns/elevation.ts';
import { toLngLat } from '@tram/terrain-pipeline/utm';
type TreeKind = 'pine' | 'oak' | 'deciduous' | 'olive';
import type { TerrainMeta } from '../three/route-viewer/heights.ts';
import type { RouteMark, RouteViewer } from '../three/route-viewer/scene.ts';
import { MODE_FIELD, preferredMode, rememberMode, type ViewerMode } from './viewer-mode.ts';

// Each route's files load only when its page asks for them.
const TERRAINS = import.meta.glob<TerrainMeta & { x0: number; y0: number }>('../content/routes/*/terrain.json', { import: 'default' });
const TRACKS = import.meta.glob<Array<[number, number]>>('../content/routes/*/route.json', { import: 'default' });
const IMAGES = import.meta.glob<string>('../content/routes/*/terrain.webp', { query: '?url', import: 'default' });
/** What stands along the route (`world-cli`): asked for only by the view from the ground. */
const WORLDS = import.meta.glob<{ kinds: TreeKind[]; trees: number[]; buildings: Array<{ h: number; rings: number[][] }>; land?: { x0: number; y0: number; cols: number; rows: number; cellM: number } }>('../content/routes/*/world.json', { import: 'default' });
const ORTHOS = import.meta.glob<string>('../content/routes/*/ortho.webp', { query: '?url', import: 'default' });
const LANDS = import.meta.glob<string>('../content/routes/*/land.png', { query: '?url', import: 'default' });

interface RouteFiles {
  slug: string;
  terrain: TerrainMeta & { x0: number; y0: number };
  track: Array<[number, number]>;
  terrainUrl: string;
}

async function filesOf(slug: string): Promise<RouteFiles> {
  const at = (ext: string): string => `../content/routes/${slug}/${ext}`;
  const [terrain, track, terrainUrl] = await Promise.all([TERRAINS[at('terrain.json')]?.(), TRACKS[at('route.json')]?.(), IMAGES[at('terrain.webp')]?.()]);
  if (!terrain || !track || !terrainUrl) throw new Error(`no terrain for the route "${slug}"`);
  return { slug, terrain, track, terrainUrl };
}

/** Course markers, computed from the profile: each kilometre, start, finish and the highest point. */
function marks(scroller: TramRouteScroller, track: Array<[number, number]>): RouteMark[] {
  const { points, start, finish, locale } = scroller.route;
  const first = points[0]![0];
  const length = points.at(-1)![0] - first;
  const out: RouteMark[] = [];
  for (let km = Math.ceil(first + 0.5); km < first + length - 0.3; km++) out.push({ share: (km - first) / length, text: formatNumber(km, locale, 0), kind: 'km' });
  // A summit is named only where there is one: on a flat route the highest point is not a place.
  const summary = summarize(points);
  const [topKm, topM] = summary.highest;
  if (topM - summary.lowest[1] >= 100) out.push({ share: (topKm - first) / length, text: `Cim · ${formatMeasure(topM, 'm', locale)}`, kind: 'place' });
  // A loop starts and ends at the same place: one label, not two on top of each other.
  const [a, b] = [track[0]!, track.at(-1)!];
  if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 80) out.push({ share: 0, text: `${start} · ${finish}`, kind: 'place' });
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

async function start(mode: ViewerMode, context: SceneContext, scroller: TramRouteScroller, files: RouteFiles): Promise<RouteViewer> {
  const { terrain, track, terrainUrl } = files;
  const shared = {
    share: scroller.share,
    marks: marks(scroller, track),
    grades: grades(scroller),
    onStep: (direction: -1 | 1) => scroller.stepKm(direction),
    onPoint: (share: number | null) => scroller.preview(share),
    onPick: (share: number) => scroller.goTo(share),
  };
  if (mode === 'map') {
    const { mountRouteViewer } = await import('../three/route-viewer/scene.ts');
    return mountRouteViewer(context, { ...shared, terrainUrl, terrain, route: track });
  }
  if (mode === 'walk') {
    // The view from the ground: its own scene, with the photograph of the ground and what stands along the route.
    const at = (file: string): string => `../content/routes/${files.slug}/${file}`;
    const [{ mountWalkViewer }, stored, orthoUrl, landUrl] = await Promise.all([import('../three/walk-viewer/scene.ts'), WORLDS[at('world.json')]?.(), ORTHOS[at('ortho.webp')]?.(), LANDS[at('land.png')]?.()]);
    if (!stored || !orthoUrl) throw new Error(`no world for the route "${files.slug}"`);
    // Stored in tenths of a metre from the corner of the terrain.
    const world = {
      trees: Array.from({ length: stored.trees.length / 5 }, (_, i): [number, number, number, TreeKind] => [stored.trees[i * 5]! / 10, stored.trees[i * 5 + 1]! / 10, stored.trees[i * 5 + 2]! / 10, stored.kinds[stored.trees[i * 5 + 4]!] ?? 'oak']),
      buildings: stored.buildings.map((b) => ({ heightM: b.h, rings: b.rings.map((ring) => Array.from({ length: ring.length / 2 }, (_, i): [number, number] => [ring[i * 2]! / 10, ring[i * 2 + 1]! / 10])) })),
      land: stored.land,
    };
    return mountWalkViewer(context, { ...shared, terrainUrl, terrain, route: track, orthoUrl, landUrl, world });
  }
  const { mountRealRouteViewer } = await import('../map/route-viewer/scene.ts');
  const { points } = scroller.route;
  const first = points[0]![0];
  const length = points.at(-1)![0] - first;
  return mountRealRouteViewer(context, {
    ...shared,
    path: track.map(([x, y]) => toLngLat(terrain.x0 + x, terrain.y0 + y)),
    elevationAt: (share) => elevationAt(points, first + share * length),
  });
}

/**
 * The scroll runs the route: the camera follows the scroller, and both mark what
 * the other points at. The mode switch swaps the engine without losing the place.
 */
export async function mount(context: SceneContext, scroller: TramRouteScroller, slug: string): Promise<Scene> {
  const files = await filesOf(slug);
  // The switch is the truth: it may have been used before the 3D was asked for.
  const chosen = (): ViewerMode => (scroller.querySelector<HTMLInputElement>(`input[name="${MODE_FIELD}"]:checked`)?.value as ViewerMode | undefined) ?? preferredMode();
  let mode = chosen();
  let viewer = await start(mode, context, scroller, files);
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
          const fresh = await start(next, context, scroller, files);
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
