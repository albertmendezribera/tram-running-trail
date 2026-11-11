import { decodeTerrainRgb } from '@tram/terrain-pipeline/terrain-rgb';

export interface TerrainMeta {
  cols: number;
  rows: number;
  /** Cell size in metres. */
  cell: number;
  min: number;
  max: number;
}

export interface Heights {
  data: Float32Array;
  width: number;
  height: number;
}

/**
 * Elevations from the terrain-RGB image of `@tram/terrain-pipeline` (E01). The
 * pixels are data, not colour: no colour management, no premultiplication.
 */
export async function loadHeights(url: string, meta: TerrainMeta, signal: AbortSignal): Promise<Heights> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`terrain ${response.status}`);
  const bitmap = await createImageBitmap(await response.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const { width, height } = bitmap;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const data = decodeTerrainRgb(context.getImageData(0, 0, width, height).data, 4);

  // A browser that altered the pixels would give a terrain that looks plausible and is wrong.
  let min = Infinity;
  let max = -Infinity;
  for (const h of data) {
    if (h < min) min = h;
    if (h > max) max = h;
  }
  if (width !== meta.cols || height !== meta.rows || Math.abs(min - meta.min) > 0.5 || Math.abs(max - meta.max) > 0.5) {
    throw new Error(`terrain decoded as ${width}×${height}, ${min.toFixed(1)}–${max.toFixed(1)} m; expected ${meta.cols}×${meta.rows}, ${meta.min}–${meta.max} m`);
  }
  return { data, width, height };
}
