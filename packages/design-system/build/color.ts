import type { ColorValue } from './model.ts';

const to255 = (c: number): number => Math.round(c * 255);

export function hexFromComponents(c: readonly [number, number, number]): string {
  return '#' + c.map((v) => to255(v).toString(16).padStart(2, '0')).join('');
}

export function componentsFromHex(hex: string): [number, number, number] {
  const n = (i: number): number => Number((parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(4));
  return [n(1), n(3), n(5)];
}

export function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance. Uses the 8-bit values the browser will paint. */
export function relativeLuminance(c: ColorValue): number {
  const [r, g, b] = c.components.map((v) => srgbToLinear(to255(v) / 255)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Composites `fg` (with alpha) over an opaque `bg`, in sRGB like the browser does. */
export function composite(fg: ColorValue, bg: ColorValue): ColorValue {
  if (fg.alpha >= 1) return fg;
  const components = fg.components.map((v, i) => v * fg.alpha + bg.components[i]! * (1 - fg.alpha)) as [
    number,
    number,
    number,
  ];
  return { colorSpace: 'srgb', components, alpha: 1, hex: hexFromComponents(components) };
}

export function contrastRatio(fg: ColorValue, bg: ColorValue): number {
  const a = relativeLuminance(composite(fg, bg));
  const b = relativeLuminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
