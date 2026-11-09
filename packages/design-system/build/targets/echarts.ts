import type { TokenSet } from '../model.ts';
import { Resolver } from '../resolve.ts';
import { GENERATED_NOTICE, matrix, px, toSource, unionType } from './shared.ts';

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
    const c = (id: string): string => r.color(id, sel).hex;
    const s = (id: string): number => px(r.dimension(id, sel));
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
