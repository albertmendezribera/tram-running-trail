// Terrain and route of a route folder → plate.json, the route as a map plate (E03).
// Usage: node src/plate-cli.ts <routeDir> <distanceKm>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { buildPlate } from './plate.ts';
import { decodeTerrainRgb } from './terrain-rgb.ts';

const [dir, distance] = process.argv.slice(2);
if (!dir || !distance) throw new Error('usage: node src/plate-cli.ts <routeDir> <distanceKm>');
const meta = JSON.parse(readFileSync(join(dir, 'terrain.json'), 'utf8')) as { cols: number; rows: number; cell: number };
const route = JSON.parse(readFileSync(join(dir, 'route.json'), 'utf8')) as Array<[number, number]>;
const { data, info } = await sharp(join(dir, 'terrain.webp')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
if (info.width !== meta.cols || info.height !== meta.rows) throw new Error(`terrain is ${info.width}×${info.height}, expected ${meta.cols}×${meta.rows}`);
const plate = buildPlate({ heights: decodeTerrainRgb(data, 3), cols: meta.cols, rows: meta.rows, cell: meta.cell, route, distanceKm: Number(distance) });
const json = JSON.stringify(plate);
writeFileSync(join(dir, 'plate.json'), json + '\n');
console.log(`${plate.contours.length} contour levels every ${plate.intervalM} m, ${plate.marks.length} km marks, plate.json ${(json.length / 1024).toFixed(1)} KB`);
