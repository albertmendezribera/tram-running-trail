import type { TokenSet } from '../model.ts';
import { Resolver, type TargetRequirements } from '../resolve.ts';
import { GENERATED_NOTICE, matrix, px, toSource, unionType } from './shared.ts';

const COLOR_TOKENS = [
  'sys.surface',
  'sys.text',
  'sys.text.muted',
  'sys.rule',
  'sys.rule.strong',
  'sys.data.road',
  'sys.data.trail',
  'sys.data.active',
  'sys.map.water',
  'sys.map.vegetation',
] as const;

const DIMENSION_TOKENS = ['sys.space.2', 'sys.space.3', 'sys.space.6'] as const;

export const ECHARTS_REQUIREMENTS: TargetRequirements = {
  target: 'ECharts theme',
  color: COLOR_TOKENS,
  dimension: DIMENSION_TOKENS,
};

/**
 * ECharts 6 theme objects, one per theme context ("tram-light", "tram-night").
 *
 * ECharts needs literal colours (it interpolates them for hover and emphasis),
 * so values are resolved hex rather than CSS variables. Terrain does not change
 * the theme: road and trail series are always given their own colour AND their
 * own pattern by the chart specs (CLAUDE.md 7.3).
 *
 * Pending, until the tokens exist: typography (E08), line widths and radii.
 */
export function emitEcharts(set: TokenSet): string {
  const r = new Resolver(set);
  const themes: Record<string, unknown> = {};
  for (const { keys, sel } of matrix(set, ['theme'])) {
    const c = (id: (typeof COLOR_TOKENS)[number]): string => r.color(id, sel).hex;
    const s = (id: (typeof DIMENSION_TOKENS)[number]): number => px(r.dimension(id, sel));
    const axis = {
      axisLine: { lineStyle: { color: c('sys.rule.strong') } },
      axisTick: { lineStyle: { color: c('sys.rule.strong') } },
      axisLabel: { color: c('sys.text.muted') },
      splitLine: { lineStyle: { color: c('sys.rule') } },
      splitArea: { show: false },
    };
    themes[`tram-${keys[0]}`] = {
      backgroundColor: 'transparent',
      color: [c('sys.data.road'), c('sys.data.trail'), c('sys.map.water'), c('sys.map.vegetation')],
      textStyle: { color: c('sys.text') },
      title: { textStyle: { color: c('sys.text') }, subtextStyle: { color: c('sys.text.muted') } },
      legend: { textStyle: { color: c('sys.text.muted') } },
      grid: { left: s('sys.space.6'), right: s('sys.space.6'), top: s('sys.space.6'), bottom: s('sys.space.6') },
      categoryAxis: axis,
      valueAxis: axis,
      timeAxis: axis,
      logAxis: axis,
      tooltip: {
        backgroundColor: c('sys.surface'),
        borderColor: c('sys.rule.strong'),
        padding: [s('sys.space.2'), s('sys.space.3')],
        textStyle: { color: c('sys.text') },
        axisPointer: { lineStyle: { color: c('sys.data.active') }, crossStyle: { color: c('sys.data.active') } },
      },
    };
  }
  const names = Object.keys(themes);
  return `// ${GENERATED_NOTICE}

export type TramEchartsThemeName = ${unionType(names)};

export const tramEchartsThemes = ${toSource(themes)} as const satisfies Record<TramEchartsThemeName, object>;

/** Registers every TRAM theme on an ECharts instance: \`registerTramEchartsThemes(echarts)\` with \`echarts/core\`. */
export function registerTramEchartsThemes(echarts: { registerTheme(name: string, theme: object): void }): void {
  for (const [name, theme] of Object.entries(tramEchartsThemes)) echarts.registerTheme(name, theme);
}
`;
}
