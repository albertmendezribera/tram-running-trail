// Client part of the ECharts profile: modular import, tooltip and axis pointer for the sync.
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, MarkPointComponent, TooltipComponent, VisualMapPiecewiseComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([LineChart, GridComponent, MarkPointComponent, TooltipComponent, VisualMapPiecewiseComponent, SVGRenderer]);

window.mount = (el, option, theme, themeName, width, height) => {
  echarts.registerTheme(themeName, theme);
  const chart = echarts.init(el, themeName, { renderer: 'svg', width, height });
  chart.setOption(option);
  const xs = option.series[1].data;
  return (d) => {
    let lo = 0;
    let hi = xs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (xs[mid][0] < d) lo = mid + 1;
      else hi = mid;
    }
    chart.dispatchAction({ type: 'showTip', seriesIndex: 1, dataIndex: lo });
  };
};
