/** One WCS request: a block of `cols × rows` cells whose north-west corner is (x, yTop). */
export interface Tile {
  col: number;
  row: number;
  cols: number;
  rows: number;
}

/**
 * Splits a grid into requests the ICGC WCS accepts. Its documented limit is
 * about 35,800 cells per request; 180 × 180 = 32,400 stays under it.
 */
export function planTiles(cols: number, rows: number, size = 180): Tile[] {
  const tiles: Tile[] = [];
  for (let row = 0; row < rows; row += size) {
    for (let col = 0; col < cols; col += size) tiles.push({ col, row, cols: Math.min(size, cols - col), rows: Math.min(size, rows - row) });
  }
  return tiles;
}

export const ICGC_ATTRIBUTION = 'Model d’elevacions: © Institut Cartogràfic i Geològic de Catalunya (ICGC), CC BY 4.0';

/** Fetches one tile of the 5 m model. The service picks 5 m or 15 m from the cell size requested. */
export async function fetchTile(x0: number, yTop: number, cell: number, tile: Tile): Promise<Float32Array> {
  const minX = x0 + tile.col * cell;
  const maxY = yTop - tile.row * cell;
  const bbox = [minX, maxY - tile.rows * cell, minX + tile.cols * cell, maxY].join(',');
  const url =
    'https://geoserveis.icgc.cat/icc_mdt/wcs/service?SERVICE=WCS&VERSION=1.0.0&REQUEST=GetCoverage&COVERAGE=icc:met' +
    `&CRS=EPSG:25831&BBOX=${bbox}&WIDTH=${tile.cols}&HEIGHT=${tile.rows}&FORMAT=ArcGrid`;
  const text = await (await fetch(url)).text();
  const lines = text.trim().split('\n');
  const header = Object.fromEntries(lines.slice(0, 6).map((l) => l.trim().split(/\s+/) as [string, string]));
  if (Number(header['CELLSIZE']) !== cell) throw new Error(`ICGC returned cell size ${header['CELLSIZE']} instead of ${cell}: ${text.slice(0, 160)}`);
  const values = Float32Array.from(lines.slice(6).join(' ').trim().split(/\s+/).map(Number));
  if (values.length !== tile.cols * tile.rows) throw new Error(`ICGC returned ${values.length} cells instead of ${tile.cols * tile.rows}`);
  return values;
}
