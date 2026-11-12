import { type ExpressionSpecification, type GeoJSONSource, type GeoJSONSourceSpecification, type LayerSpecification, LngLat, Map as MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl';
// As text, not as a stylesheet of the page: the bundler would otherwise ship it with every page of the site.
import styles from 'maplibre-gl/dist/maplibre-gl.css?inline';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type { SceneContext } from '@tram/design-system/interactive/viewer-3d-shell.ts';
import { tramThreeColors, type TramColorName, type TramTerrain } from '@tram/design-system/three';
import type { RouteMark, RouteViewer } from '../../three/route-viewer/scene.ts';
import { createTreeLayer, type TreeKind } from './trees.ts';

export interface RealRouteViewerOptions {
  /** Route as longitude and latitude, in order. */
  path: ReadonlyArray<readonly [number, number]>;
  /** Elevation of the route in metres at a share of its length (0–1). */
  elevationAt(share: number): number;
  /** Vertical exaggeration. A photograph bears less of it than a drawing. */
  exaggeration?: number;
  share?: number;
  grades?: ReadonlyArray<{ from: number; to: number; level: number }>;
  marks?: ReadonlyArray<RouteMark>;
  onStep?(direction: -1 | 1): string | void;
  onPoint?(share: number | null): void;
  onPick?(share: number): void;
  /** The camera runs close behind the runner, near the ground, instead of flying high over the route. */
  walk?: boolean | undefined;
  /** What stands along the route: buildings with their height and trees, as longitude and latitude. */
  world?: { /** Longitude, latitude, height of the tree and elevation of the ground under it, in metres, and its kind. */ trees: ReadonlyArray<readonly [number, number, number, number, TreeKind]>; buildings: ReadonlyArray<{ heightM: number; rings: ReadonlyArray<ReadonlyArray<readonly [number, number]>> }> } | undefined;
}

/** ICGC services for MapLibre: orthophoto and 5 m terrain, CC BY 4.0, no key. */
const ORTHOPHOTO = 'https://geoserveis.icgc.cat/servei/catalunya/mapa-base/wmts/orto/MON3857NW/{z}/{x}/{y}.png';
const TERRAIN = 'https://geoserveis.icgc.cat/servei/catalunya/contextmaps-terreny-5m-rgb/wmts/{z}/{x}/{y}.png';

/** Follow camera, in metres: the same flight as the cartographic viewer. */
const FOLLOW = { back: 420, up: 260, ahead: 0.04 };
/** From the ground: a few strides behind the runner and just over the trees. */
const WALK = { back: 88, up: 34, ahead: 0.012 };
/** The plaster of a wall and the tile of a roof. A photograph sets the palette here, not the tokens. */
const WALL = '#d8d0c4';
const ROOF = '#b0694b';
const EASE_MS = 110;
const KM_MARK_RANGE = 1800;
const POINT_RADIUS = 28;
const GRADES = ['data-grade-1', 'data-grade-2', 'data-grade-3', 'data-grade-4'] as const;
const METRES_PER_DEGREE = 111_320;

type Vec = [x: number, y: number, z: number];
const lerp = (a: Vec, b: Vec, t: number): Vec => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const ease = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * Route viewer, realistic style (E02): the ICGC orthophoto draped on the real
 * terrain, in MapLibre GL JS. It flies, labels and points like the cartographic
 * viewer and draws only when something changes.
 */
export async function mountRealRouteViewer({ container, signal, reducedMotion }: SceneContext, o: RealRouteViewerOptions): Promise<RouteViewer> {
  setWorkerUrl(workerUrl);
  if (!document.querySelector('style[data-maplibre]')) {
    const sheet = document.createElement('style');
    sheet.dataset['maplibre'] = '';
    sheet.textContent = styles;
    document.head.append(sheet);
  }
  // On foot nothing is stretched: a tree or a house next to a hill made taller would look like a toy.
  const exaggeration = o.walk ? 1 : Math.min(2.5, Math.max(1, o.exaggeration ?? 1.3));
  const follow0 = o.walk ? WALK : FOLLOW;

  // A local frame in metres (east, north, up) keeps the camera maths the same as in the 3D scene.
  const [lng0, lat0] = o.path[0]!;
  const perLng = METRES_PER_DEGREE * Math.cos((lat0 * Math.PI) / 180);
  const local = o.path.map(([lng, lat]) => [(lng - lng0) * perLng, (lat - lat0) * METRES_PER_DEGREE] as const);
  const toLngLat = (p: Vec): LngLat => new LngLat(lng0 + p[0] / perLng, lat0 + p[1] / METRES_PER_DEGREE);
  const run = [0];
  for (let i = 1; i < local.length; i++) run.push(run[i - 1]! + Math.hypot(local[i]![0] - local[i - 1]![0], local[i]![1] - local[i - 1]![1]));
  const total = run.at(-1)!;
  const at = (share: number): Vec => {
    const s = Math.min(1, Math.max(0, share));
    const d = s * total;
    let i = Math.min(local.length - 2, Math.floor(s * (local.length - 1)));
    while (i > 0 && run[i]! > d) i--;
    while (i < local.length - 2 && run[i + 1]! < d) i++;
    const span = run[i + 1]! - run[i]!;
    const t = span > 0 ? (d - run[i]!) / span : 0;
    return [local[i]![0] + (local[i + 1]![0] - local[i]![0]) * t, local[i]![1] + (local[i + 1]![1] - local[i]![1]) * t, o.elevationAt(s) * exaggeration];
  };
  const xs = local.map((p) => p[0]);
  const ys = local.map((p) => p[1]);
  const size = { x: Math.max(...xs) - Math.min(...xs), y: Math.max(...ys) - Math.min(...ys) };
  let top = 0;
  for (let i = 0; i <= 50; i++) top = Math.max(top, o.elevationAt(i / 50) * exaggeration);
  const centre: Vec = [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2, top * 0.3];

  // Over a photograph the ground is dark: the night colours of the tokens read on it in both themes.
  const terrainMode = (container.closest<HTMLElement>('[data-terrain]')?.dataset['terrain'] ?? 'mixed') as TramTerrain;
  const color = (name: TramColorName): string => `#${tramThreeColors.night[terrainMode][name].hex.toString(16).padStart(6, '0')}`;
  const point = (p: Vec) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: toLngLat(p).toArray() } });

  // What stands along the route: the buildings as prisms of their mapped height on the terrain.
  // The trees are meshes of their own (trees.ts), added once the map is there.
  const worldSources: Record<string, GeoJSONSourceSpecification> = {};
  const worldLayers: LayerSpecification[] = [];
  if (o.world) {
    worldSources['buildings'] = {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: o.world.buildings.map((b) => ({ type: 'Feature' as const, properties: { top: b.heightM }, geometry: { type: 'Polygon' as const, coordinates: b.rings.map((ring) => ring.map(([lng, lat]) => [lng, lat])) } })) },
    };
    worldLayers.push(
      { id: 'buildings', type: 'fill-extrusion', source: 'buildings', paint: { 'fill-extrusion-color': WALL, 'fill-extrusion-height': ['get', 'top'], 'fill-extrusion-vertical-gradient': true } },
      // A slab of tile on each: from above a town is its roofs.
      { id: 'roofs', type: 'fill-extrusion', source: 'buildings', paint: { 'fill-extrusion-color': ROOF, 'fill-extrusion-base': ['get', 'top'], 'fill-extrusion-height': ['+', ['get', 'top'], 0.5], 'fill-extrusion-vertical-gradient': false } },
    );
  }

  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;inset:0';
  container.append(host);
  const map = new MapLibreMap({
    container: host,
    // The scroll flies the camera: the map itself takes no gestures, so the page keeps scrolling.
    interactive: false,
    attributionControl: false,
    maxPitch: 85,
    canvasContextAttributes: { antialias: true },
    center: toLngLat(centre),
    zoom: 12,
    style: {
      version: 8,
      sources: {
        orthophoto: { type: 'raster', tiles: [ORTHOPHOTO], tileSize: 256, maxzoom: 20 },
        terrain: { type: 'raster-dem', tiles: [TERRAIN], tileSize: 512, minzoom: 7, maxzoom: 14 },
        route: { type: 'geojson', lineMetrics: true, data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: o.path.map(([lng, lat]) => [lng, lat]) } } },
        runner: { type: 'geojson', data: point(at(o.share ?? 0)) },
        pointer: { type: 'geojson', data: point(at(0)) },
        ...worldSources,
      },
      layers: [
        { id: 'orthophoto', type: 'raster', source: 'orthophoto' },
        { id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': color('surface'), 'line-opacity': 0.6, 'line-width': 8 } },
        { id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-width': 4.5, 'line-color': color('data-primary') } },
        ...worldLayers,
        { id: 'pointer', type: 'circle', source: 'pointer', layout: { visibility: 'none' }, paint: { 'circle-radius': 5, 'circle-color': color('surface'), 'circle-stroke-color': color('data-active-outline'), 'circle-stroke-width': 2.5 } },
        // The runner: signal colour with its mandatory outline (E09).
        { id: 'runner', type: 'circle', source: 'runner', paint: { 'circle-radius': 8, 'circle-color': color('data-active'), 'circle-stroke-color': color('data-active-outline'), 'circle-stroke-width': 3 } },
      ],
      terrain: { source: 'terrain', exaggeration },
      sky: { 'sky-color': '#7fb2e5', 'horizon-color': '#e6eef5', 'fog-color': '#e6eef5', 'fog-ground-blend': o.walk ? 0.35 : 0.55, 'horizon-fog-blend': 0.7, 'sky-horizon-blend': 0.8, 'atmosphere-blend': 0.6 },
      // A low sun from the south-west gives each wall and each crown a lit side and a dark one.
      light: { anchor: 'map', position: [1.4, 225, 38], intensity: 0.5, color: '#fff3dd' },
    },
  });
  const abort = new AbortController();
  const remove = (): void => {
    abort.abort();
    map.remove();
    host.remove();
  };
  try {
    await new Promise<void>((resolve, reject) => {
      map.once('load', () => resolve());
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  } catch (error) {
    remove();
    throw error;
  }
  if (o.world?.trees.length) {
    const trees = o.world.trees.map(([lng, lat, height, ground, kind]): [number, number, number, number, TreeKind] => [(lng - lng0) * perLng, (lat - lat0) * METRES_PER_DEGREE, ground * exaggeration, height, kind]);
    // Under the runner and the pointer, which are drawn over everything.
    map.addLayer(createTreeLayer({ origin: [lng0, lat0], trees, camera: () => camera }), 'pointer');
    map.getCanvas().dataset['trees'] = String(trees.length);
  }
  const canvas = map.getCanvas();
  canvas.dataset['engine'] = 'maplibre';
  let frames = 0;
  map.on('render', () => (canvas.dataset['frames'] = String(++frames)));

  /** What is left to run shows its grade; what has been run is one light line, as inked in. */
  const gradient = (share: number): ExpressionSpecification => {
    const s = Math.min(0.9999, Math.max(0.0001, share));
    const bands = o.grades?.length ? o.grades : [{ from: 0, to: 1, level: 0 }];
    const stops: Array<number | string> = [];
    let from = s;
    for (const band of bands) {
      if (band.to <= s) continue;
      const edge = Math.max(band.from, s);
      if (stops.length && edge <= from) continue;
      stops.push(edge, color(GRADES[Math.min(3, Math.max(0, Math.round(band.level)))]!));
      from = edge;
    }
    return ['step', ['line-progress'], color('data-primary'), ...stops] as unknown as ExpressionSpecification;
  };

  const marks = (o.marks ?? []).map((mark) => {
    const element = document.createElement('div');
    element.dataset['sceneLabel'] = mark.kind;
    element.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.dataset['type'] = mark.kind === 'km' ? 'data-sm' : 'text-xs';
    text.textContent = mark.text;
    element.append(text);
    const position = at(mark.share);
    const marker = new Marker({ element, anchor: 'bottom', opacityWhenCovered: '0' }).setLngLat(toLngLat(position)).addTo(map);
    return { ...mark, element, marker, position };
  });

  const overview: Vec = [0, 0, 0];
  const fit = (): void => {
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const half = (map.getVerticalFieldOfView() * Math.PI) / 360;
    const narrow = Math.min(half, Math.atan(Math.tan(half) * aspect));
    // The long side of the route across a wide frame, as in the cartographic viewer.
    const fromEast = size.y > size.x === aspect > 1;
    const direction: Vec = fromEast ? [0.78, -0.32, 0.5] : [0.32, -0.78, 0.5];
    const length = Math.hypot(...direction);
    const distance = (0.62 * Math.hypot(size.x, size.y)) / Math.sin(narrow);
    overview[0] = centre[0] + (direction[0] / length) * distance;
    overview[1] = centre[1] + (direction[1] / length) * distance;
    overview[2] = centre[2] + (direction[2] / length) * distance;
  };
  fit();

  const heading: [number, number] = [0, 0];
  let camera: Vec = overview;
  let drawn = -1;
  /** Places runner and camera at a share of the route. Returns true once the camera has settled. */
  const place = (share: number, k: number): boolean => {
    const here = at(share);
    const ahead = at(share + follow0.ahead);
    const behind = at(share - follow0.ahead / 2);
    let hx = ahead[0] - behind[0];
    let hy = ahead[1] - behind[1];
    const n = Math.hypot(hx, hy);
    if (n > 1) [hx, hy] = [hx / n, hy / n];
    else [hx, hy] = heading;
    // The heading eases on its own: a hairpin turns the camera, it does not flip it.
    if ((heading[0] === 0 && heading[1] === 0) || k >= 1) [heading[0], heading[1]] = [hx, hy];
    else {
      const [x, y] = [heading[0] + (hx - heading[0]) * k * 0.5, heading[1] + (hy - heading[1]) * k * 0.5];
      const m = Math.hypot(x, y) || 1;
      [heading[0], heading[1]] = [x / m, y / m];
    }
    const settled = heading[0] * hx + heading[1] * hy > 0.99995;
    if (settled) [heading[0], heading[1]] = [hx, hy];

    const follow: Vec = [here[0] - heading[0] * follow0.back, here[1] - heading[1] * follow0.back, here[2] + follow0.up];
    // Start and finish show the whole route; in between the camera runs with the runner.
    const near = ease(0, 0.03, share) * (1 - ease(0.97, 1, share));
    camera = lerp(overview, follow, near);
    const target = lerp(centre, lerp(here, ahead, 0.35), near);
    map.jumpTo(map.calculateCameraOptionsFromTo(toLngLat(camera), camera[2], toLngLat(target), target[2]));

    (map.getSource('runner') as GeoJSONSource).setData(point(here));
    if (Math.abs(share - drawn) > 0.0005) {
      drawn = share;
      map.setPaintProperty('route', 'line-gradient', gradient(share));
    }
    for (const mark of marks) {
      const far = mark.kind === 'km' && Math.hypot(mark.position[0] - camera[0], mark.position[1] - camera[1], mark.position[2] - camera[2]) > KM_MARK_RANGE;
      mark.element.hidden = far;
    }
    return settled;
  };

  let wanted = Math.min(1, Math.max(0, o.share ?? 0));
  let shown = wanted;
  let last = 0;
  let active = true;
  let pending = 0;
  const frame = (): void => {
    pending = 0;
    if (!active) return;
    const now = performance.now();
    const k = reducedMotion ? 1 : 1 - Math.exp(-(last ? Math.min(100, now - last) : 16) / EASE_MS);
    shown += (wanted - shown) * k;
    if (Math.abs(wanted - shown) < 2e-4) shown = wanted;
    const settled = place(shown, k) && shown === wanted;
    canvas.dataset['share'] = shown.toFixed(4);
    canvas.dataset['moving'] = String(!settled);
    last = settled ? 0 : now;
    if (!settled) invalidate();
  };
  const invalidate = (): void => {
    if (active && !pending) pending = requestAnimationFrame(frame);
  };
  map.on('resize', () => {
    fit();
    invalidate();
  });
  place(shown, 1);
  canvas.dataset['share'] = shown.toFixed(4);
  canvas.dataset['moving'] = 'false';
  // The poster stays until the photograph is there, or a few seconds at most on a slow line.
  await Promise.race([new Promise((resolve) => map.once('idle', resolve)), new Promise((resolve) => setTimeout(resolve, 4000))]);
  if (signal.aborted) {
    remove();
    throw signal.reason;
  }

  // Pointing at the route: the nearest point on screen, within reach of a finger.
  const samples = Array.from({ length: 400 }, (_, i) => ({ share: i / 399, at: toLngLat(at(i / 399)) }));
  const shareAt = (event: MouseEvent): number | null => {
    const box = host.getBoundingClientRect();
    let best: number | null = null;
    let reach = POINT_RADIUS;
    for (const sample of samples) {
      const p = map.project(sample.at);
      const d = Math.hypot(p.x - (event.clientX - box.left), p.y - (event.clientY - box.top));
      if (d < reach) [reach, best] = [d, sample.share];
    }
    return best;
  };
  let pointed: number | null = null;
  const pointAt = (share: number | null): void => {
    if (share === pointed) return;
    pointed = share;
    host.style.cursor = share === null ? '' : 'pointer';
    o.onPoint?.(share);
  };
  host.addEventListener('pointermove', (event) => event.pointerType === 'mouse' && pointAt(shareAt(event)), { signal: abort.signal });
  host.addEventListener('pointerleave', () => pointAt(null), { signal: abort.signal });
  host.addEventListener(
    'click',
    (event) => {
      const share = shareAt(event);
      if (share !== null) o.onPick?.(share);
    },
    { signal: abort.signal },
  );

  return {
    setShare(share) {
      wanted = Math.min(1, Math.max(0, share));
      invalidate();
    },
    setPreview(share) {
      map.setLayoutProperty('pointer', 'visibility', share === null ? 'none' : 'visible');
      if (share !== null) (map.getSource('pointer') as GeoJSONSource).setData(point(at(share)));
      canvas.dataset['preview'] = share === null ? '' : share.toFixed(4);
    },
    setActive(next) {
      active = next;
      if (active) invalidate();
      else cancelAnimationFrame(pending), (pending = 0);
    },
    step: (direction) => o.onStep?.(direction),
    dispose() {
      active = false;
      cancelAnimationFrame(pending);
      for (const mark of marks) mark.marker.remove();
      remove();
    },
  };
}
