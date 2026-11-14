// Buildings of the Spanish cadastre (Dirección General del Catastro, INSPIRE service): each house on its
// own, with the floors it has above ground, the use of the building and the year it was built.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const CADASTRE_ATTRIBUTION = 'Cases, plantes i ús dels edificis: © Dirección General del Catastro';
const SERVICE = 'http://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx?service=wfs&version=2&request=getfeature&SRSname=EPSG::25831';
/** Side of a request, in metres. The service answers a square kilometre of town in a couple of minutes. */
export const CADASTRE_TILE_M = 1000;

export type Use = 'residential' | 'agriculture' | 'industrial' | 'office' | 'retail' | 'public';
const USES: Record<string, Use> = { '1_residential': 'residential', '2_agriculture': 'agriculture', '3_industrial': 'industrial', '4_1_office': 'office', '4_2_retail': 'retail', '4_3_publicServices': 'public' };

export interface CadastrePart {
  /** Cadastral reference of the building the part belongs to. */
  building: string;
  floors: number;
  /** Outline and holes, in UTM 31N metres. */
  rings: Array<Array<[number, number]>>;
}
export interface CadastreBuilding {
  use: Use | null;
  /** Year it was built, or null when the cadastre does not say. */
  year: number | null;
}

/** The squares of the grid a set of points comes within `reach` metres of, by their south-west corner. */
export function tilesNear(points: ReadonlyArray<readonly [number, number]>, reach: number, size = CADASTRE_TILE_M): Array<[number, number]> {
  const keys = new Set<string>();
  for (const [x, y] of points) {
    for (let tx = Math.floor((x - reach) / size); tx <= Math.floor((x + reach) / size); tx++) {
      for (let ty = Math.floor((y - reach) / size); ty <= Math.floor((y + reach) / size); ty++) keys.add(`${tx * size},${ty * size}`);
    }
  }
  return [...keys].sort().map((key) => key.split(',').map(Number) as [number, number]);
}

/**
 * One square of the service, as it answers it. Kept on disk: the service is slow, and a route is built
 * more than once. A square of town too dense for the service to answer is asked for in four.
 */
async function tileXml(kind: 'BUILDING' | 'BUILDINGPART', x: number, y: number, cache: string, size = CADASTRE_TILE_M): Promise<string[]> {
  mkdirSync(cache, { recursive: true });
  const file = join(cache, `${kind}-${x}-${y}${size === CADASTRE_TILE_M ? '' : `-${size}`}.xml`);
  if (existsSync(file)) return [readFileSync(file, 'latin1')];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`${SERVICE}&typenames=BU.${kind}&bbox=${x},${y},${x + size},${y + size}`, { signal: AbortSignal.timeout(600_000) });
      const text = Buffer.from(await response.arrayBuffer()).toString('latin1');
      // A square of sea or of open country: the service calls having nothing an error.
      const answer = text.includes('No records founded') ? '' : text;
      if (answer && (!response.ok || !answer.includes('FeatureCollection'))) throw new Error(`cadastre ${kind} ${x},${y}: ${response.status} ${text.slice(0, 120)}`);
      writeFileSync(file, answer, 'latin1');
      return [answer];
    } catch (error) {
      if (attempt === 1 && size <= 250) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }
  const half = size / 2;
  const quarters: string[] = [];
  for (const [dx, dy] of [[0, 0], [half, 0], [0, half], [half, half]] as const) quarters.push(...(await tileXml(kind, x + dx, y + dy, cache, half)));
  return quarters;
}

const ringsOf = (xml: string): Array<Array<[number, number]>> =>
  [...xml.matchAll(/<gml:posList[^>]*>([^<]+)</g)].map(([, list]) => {
    const values = list!.trim().split(/\s+/).map(Number);
    const ring: Array<[number, number]> = [];
    for (let i = 0; i + 1 < values.length; i += 2) ring.push([values[i]!, values[i + 1]!]);
    return ring;
  });

export function parseParts(xml: string): CadastrePart[] {
  const parts: CadastrePart[] = [];
  for (const [body] of xml.matchAll(/<bu-ext2d:BuildingPart\b[\s\S]*?<\/bu-ext2d:BuildingPart>/g)) {
    const id = /<base:localId>([^<]+)</.exec(body)?.[1];
    const floors = Number(/<bu-ext2d:numberOfFloorsAboveGround>(\d+)</.exec(body)?.[1]);
    // One surface may hold several patches: each is an outline followed by its holes.
    for (const [patch] of body.matchAll(/<gml:PolygonPatch>[\s\S]*?<\/gml:PolygonPatch>/g)) {
      const rings = ringsOf(patch);
      if (id && Number.isFinite(floors) && rings[0] && rings[0].length >= 4) parts.push({ building: id.replace(/_part\d+$/, ''), floors, rings });
    }
  }
  return parts;
}

export function parseBuildings(xml: string): Map<string, CadastreBuilding> {
  const buildings = new Map<string, CadastreBuilding>();
  for (const [body] of xml.matchAll(/<bu-ext2d:Building\b[\s\S]*?<\/bu-ext2d:Building>/g)) {
    const id = /<base:localId>([^<]+)</.exec(body)?.[1];
    if (!id) continue;
    const year = Number(/<bu-core2d:beginning>(\d{4})-/.exec(body)?.[1]);
    // The cadastre writes year 1 for "unknown".
    buildings.set(id, { use: USES[/<bu-ext2d:currentUse>([^<]+)</.exec(body)?.[1] ?? ''] ?? null, year: year > 1000 ? year : null });
  }
  return buildings;
}

/** Every part and building of the cadastre in the squares given, each once. */
export async function fetchCadastre(tiles: ReadonlyArray<readonly [number, number]>, cache: string, log: (line: string) => void = () => {}): Promise<{ parts: CadastrePart[]; buildings: Map<string, CadastreBuilding> }> {
  const parts = new Map<string, CadastrePart>();
  const buildings = new Map<string, CadastreBuilding>();
  for (const [x, y] of tiles) {
    const found = (await tileXml('BUILDINGPART', x, y, cache)).flatMap(parseParts);
    for (const part of found) parts.set(`${part.building}|${part.rings[0]![0]!.join(',')}|${part.rings[0]!.length}`, part);
    for (const xml of await tileXml('BUILDING', x, y, cache)) for (const [id, building] of parseBuildings(xml)) buildings.set(id, building);
    log(`cadastre ${x},${y}: ${found.length} parts`);
  }
  return { parts: [...parts.values()], buildings };
}
