// Colour audit (E09): contrast in both themes, readability in sunlight and
// colour-vision deficiencies. Uses the build's own resolver and contrast.
// Usage: node scripts/color-audit.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDesignSystem } from '../build/build.ts';
import { contrastRatio, relativeLuminance, srgbToLinear } from '../build/color.ts';
import type { ColorValue, Selection } from '../build/model.ts';
import { Resolver } from '../build/resolve.ts';

const pkg = fileURLToPath(new URL('..', import.meta.url));
const { set } = buildDesignSystem({
  read: (p) => {
    try {
      return readFileSync(join(pkg, 'tokens', p), 'utf8');
    } catch {
      return undefined;
    }
  },
});
if (!set) throw new Error('tokens do not build');
const r = new Resolver(set);
const THEMES: Record<string, Selection> = {
  light: { theme: 'light', terrain: 'mixed', density: 'comfortable' },
  night: { theme: 'night', terrain: 'mixed', density: 'comfortable' },
};
const c = (id: string, sel: Selection): ColorValue => r.color(id, sel);
const f2 = (n: number): string => n.toFixed(2).replace('.', ',');

// --- Contrast ---------------------------------------------------------------
const TEXT = ['sys.text', 'sys.text.muted', 'sys.accent.text'];
const GRAPHIC = ['sys.focus', 'sys.rule.strong', 'sys.data.road', 'sys.data.trail', 'sys.data.active', 'sys.data.active.outline', 'sys.map.contour', 'sys.map.vegetation', 'sys.map.water', 'sys.data.grade.1', 'sys.data.grade.2', 'sys.data.grade.3', 'sys.data.grade.4'];
const BACKGROUNDS = ['sys.surface', 'sys.surface.alt'];

console.log('## Contrast WCAG\n');
console.log('| Rol | Mínim | Clar · surface | Clar · surface.alt | Nit · surface | Nit · surface.alt |');
console.log('|---|---|---|---|---|---|');
for (const [ids, min] of [[TEXT, 4.5], [GRAPHIC, 3]] as const) {
  for (const id of ids) {
    const cells = Object.values(THEMES).flatMap((sel) =>
      BACKGROUNDS.map((bg) => {
        const ratio = contrastRatio(c(id, sel), c(bg, sel));
        return ratio >= min ? f2(ratio) : `**${f2(ratio)}**`;
      }),
    );
    console.log(`| \`${id}\` | ${min} | ${cells.join(' | ')} |`);
  }
}
const onAccent = Object.values(THEMES).map((sel) => f2(contrastRatio(c('sys.on-accent', sel), c('sys.accent', sel))));
console.log(`| \`sys.on-accent\` sobre \`sys.accent\` | 4.5 | ${onAccent[0]} | | ${onAccent[1]} | |`);

// --- Sunlight -------------------------------------------------------------------
// Light reflected by the screen adds the same luminance to both colours. Assumed:
// 1,000 cd/m² peak white, 4.5 % reflectance. Indoors 500 lux, shade 10,000 lux,
// direct sun 100,000 lux. Flare is expressed as a fraction of the screen's white.
const FLARE = { interior: (500 * 0.045) / Math.PI / 1000, ombra: (10_000 * 0.045) / Math.PI / 1000, sol: (100_000 * 0.045) / Math.PI / 1000 };
const flared = (fg: ColorValue, bg: ColorValue, f: number): number => {
  const a = relativeLuminance(fg) + f;
  const b = relativeLuminance(bg) + f;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
const SUN_PAIRS: Array<[string, string]> = [
  ['sys.text', 'sys.surface'],
  ['sys.text.muted', 'sys.surface'],
  ['sys.accent.text', 'sys.surface'],
  ['sys.data.active', 'sys.surface'],
  ['sys.data.trail', 'sys.surface'],
  ['sys.on-accent', 'sys.accent'],
];
console.log(`\n## Contrast amb llum ambiental (model)\n`);
console.log(`Reflex afegit, en fracció del blanc de la pantalla: interior ${f2(FLARE.interior)}, ombra ${f2(FLARE.ombra)}, sol directe ${f2(FLARE.sol)}.\n`);
console.log('| Parella | Tema | Sense reflex | Interior | Ombra | Sol directe |');
console.log('|---|---|---|---|---|---|');
for (const [fg, bg] of SUN_PAIRS) {
  for (const [theme, sel] of Object.entries(THEMES)) {
    const values = [0, FLARE.interior, FLARE.ombra, FLARE.sol].map((f) => f2(flared(c(fg, sel), c(bg, sel), f)));
    console.log(`| \`${fg}\` / \`${bg}\` | ${theme} | ${values.join(' | ')} |`);
  }
}

// --- Colour-vision deficiencies ---------------------------------------------------
// Machado, Oliveira & Fernandes (2009), severity 1.0, on linear sRGB.
type M = readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];
const CVD: Record<string, M | null> = {
  normal: null,
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const linear = (v: ColorValue): [number, number, number] => v.components.map((x) => srgbToLinear(Math.round(x * 255) / 255)) as [number, number, number];
const apply = (m: M | null, rgb: [number, number, number]): [number, number, number] =>
  m ? (m.map((row) => Math.min(1, Math.max(0, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]))) as [number, number, number]) : rgb;
const oklab = ([R, G, B]: [number, number, number]): [number, number, number] => {
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
};
const deltaE = (a: ColorValue, b: ColorValue, m: M | null): number => {
  const [x, y] = [oklab(apply(m, linear(a))), oklab(apply(m, linear(b)))];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) * 100;
};
const CVD_PAIRS: Array<[string, string]> = [
  ['sys.data.road', 'sys.data.trail'],
  ['sys.data.active', 'sys.data.trail'],
  ['sys.data.active', 'sys.map.vegetation'],
  ['sys.map.contour', 'sys.map.vegetation'],
  ['sys.map.contour', 'sys.map.water'],
  ['sys.map.vegetation', 'sys.map.water'],
  // The grade scale of the route: neighbouring levels, and what it must not be mistaken for.
  ['sys.data.grade.1', 'sys.data.grade.2'],
  ['sys.data.grade.2', 'sys.data.grade.3'],
  ['sys.data.grade.3', 'sys.data.grade.4'],
  ['sys.data.grade.1', 'sys.map.contour'],
  ['sys.data.grade.4', 'sys.data.primary'],
  ['sys.data.grade.2', 'sys.data.active'],
];
console.log('\n## Distància de color amb daltonisme (ΔE OKLab × 100)\n');
console.log('Per sota de 10, la parella es confon fàcilment; per sota de 5, gairebé no es distingeix.\n');
console.log(`| Parella | Tema | ${Object.keys(CVD).join(' | ')} |`);
console.log(`|---|---|${Object.keys(CVD).map(() => '---').join('|')}|`);
for (const [a, b] of CVD_PAIRS) {
  for (const [theme, sel] of Object.entries(THEMES)) {
    const values = Object.values(CVD).map((m) => {
      const d = deltaE(c(a, sel), c(b, sel), m);
      return d < 10 ? `**${d.toFixed(1).replace('.', ',')}**` : d.toFixed(1).replace('.', ',');
    });
    console.log(`| \`${a}\` / \`${b}\` | ${theme} | ${values.join(' | ')} |`);
  }
}

// --- Night neutrality -----------------------------------------------------------
const lch = (v: ColorValue): string => {
  const [L, a, b] = oklab(linear(v));
  const hue = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return `L ${f2(L)} · C ${Math.hypot(a, b).toFixed(3).replace('.', ',')} · h ${Math.round(hue)}°`;
};
const slate: ColorValue = { colorSpace: 'srgb', components: [15 / 255, 23 / 255, 42 / 255], alpha: 1, hex: '#0f172a' };
console.log('\n## Neutralitat del mode nit (OKLCH)\n');
console.log('| Color | OKLCH |');
console.log('|---|---|');
console.log(`| \`sys.surface\` nit (${c('sys.surface', THEMES.night!).hex}) | ${lch(c('sys.surface', THEMES.night!))} |`);
console.log(`| \`sys.surface.alt\` nit (${c('sys.surface.alt', THEMES.night!).hex}) | ${lch(c('sys.surface.alt', THEMES.night!))} |`);
console.log(`| \`sys.text\` nit (${c('sys.text', THEMES.night!).hex}) | ${lch(c('sys.text', THEMES.night!))} |`);
console.log(`| Blau pissarra prohibit (#0f172a) | ${lch(slate)} |`);
