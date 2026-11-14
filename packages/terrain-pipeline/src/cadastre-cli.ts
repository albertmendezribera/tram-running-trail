// Fetches the cadastre along a route into the cache, ahead of world-cli.
// Usage: node src/cadastre-cli.ts <routeDir> <cacheDir>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchCadastre, tilesNear } from './cadastre.ts';

const [dir, cache] = process.argv.slice(2);
if (!dir || !cache) throw new Error('usage: node src/cadastre-cli.ts <routeDir> <cacheDir>');
const meta = JSON.parse(readFileSync(join(dir, 'terrain.json'), 'utf8')) as { x0: number; y0: number };
const route = (JSON.parse(readFileSync(join(dir, 'route.json'), 'utf8')) as Array<[number, number]>).map(([x, y]): [number, number] => [meta.x0 + x, meta.y0 + y]);
const tiles = tilesNear(route, 130);
console.log(`${tiles.length} squares`);
const { parts, buildings } = await fetchCadastre(tiles, cache, console.log);
console.log(`${parts.length} parts of ${buildings.size} buildings`);
