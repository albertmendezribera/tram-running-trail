// Reads windows of the ICGC surface model (LiDAR 2021-2023, 1 m, CC BY 4.0) from its one big file, by range requests.
// node fetch-dsm.mjs <name>:<centreX>:<centreY>:<sideM> ...   (local metres of the Palamós route terrain)
import { fromUrl } from 'geotiff';
import { writeFileSync } from 'node:fs';
const URL_DSM = 'https://datacloud.icgc.cat/datacloud/model-superficies/tif_unzip/model-superficies-lidar-catalunya-1m-2021-2023.tif';
const ORIGIN = { x: 507310, y: 4631290 };
const tiff = await fromUrl(URL_DSM);
const image = await tiff.getImage();
const [ox, oy] = image.getOrigin(); const [rx, ry] = image.getResolution();
console.log('size', image.getWidth(), image.getHeight(), 'origin', ox, oy, 'res', rx, ry, 'nodata', image.getGDALNoData(), 'tile', image.getTileWidth(), image.getTileHeight());
for (const spec of process.argv.slice(2)) {
  const [name, cx, cy, side] = spec.split(':').map((v, i) => (i ? Number(v) : v));
  const [minX, maxY] = [ORIGIN.x + cx - side / 2, ORIGIN.y + cy + side / 2];
  const col = Math.round((minX - ox) / rx), row = Math.round((maxY - oy) / ry);
  const [data] = await image.readRasters({ window: [col, row, col + side, row + side] });
  let min = Infinity, max = -Infinity, none = 0;
  for (const v of data) { if (v < -1000) { none++; continue; } if (v < min) min = v; if (v > max) max = v; }
  writeFileSync(`data/${name}.f32`, Buffer.from(Float32Array.from(data).buffer));
  writeFileSync(`data/${name}.json`, JSON.stringify({ name, side, cellM: 1, x0: cx - side / 2, yTop: cy + side / 2, utm: [minX, maxY], min, max, none }));
  console.log(name, side, 'min', min.toFixed(1), 'max', max.toFixed(1), 'nodata', none);
}
