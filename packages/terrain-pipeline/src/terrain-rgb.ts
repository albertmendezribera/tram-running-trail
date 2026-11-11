/**
 * Terrain-RGB: elevation = -10000 + (R · 65536 + G · 256 + B) · 0.1 m. Three 8-bit
 * channels keep 0.1 m steps, and a lossless WebP of smooth terrain is small (E01).
 */
export function encodeTerrainRgb(heights: ArrayLike<number>): Uint8Array {
  const out = new Uint8Array(heights.length * 3);
  for (let i = 0; i < heights.length; i++) {
    const v = Math.round((heights[i]! + 10000) * 10);
    out[i * 3] = (v >> 16) & 255;
    out[i * 3 + 1] = (v >> 8) & 255;
    out[i * 3 + 2] = v & 255;
  }
  return out;
}

/** Decodes RGB or RGBA pixels; `channels` is 3 or 4. */
export function decodeTerrainRgb(pixels: ArrayLike<number>, channels: 3 | 4 = 4): Float32Array {
  const out = new Float32Array(pixels.length / channels);
  for (let i = 0; i < out.length; i++) {
    const k = i * channels;
    out[i] = -10000 + (pixels[k]! * 65536 + pixels[k + 1]! * 256 + pixels[k + 2]!) * 0.1;
  }
  return out;
}
