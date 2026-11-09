// E15 prototypes: the same synthetic profile drawn with hand-made SVG and with ECharts.
// isPlaceholder: the elevation is generated, it is not a real course.
import { area, line } from 'd3-shape';
import { scaleLinear } from 'd3-scale';

export function makeProfile(n = 1200, km = 28.4) {
  const points = [];
  for (let i = 0; i < n; i++) {
    const d = (i / (n - 1)) * km;
    points.push([Number(d.toFixed(3)), Number((700 + 420 * Math.sin(d / 4.7) + 180 * Math.sin(d / 1.6 + 1) + 60 * Math.sin(d / 0.55) + 25 * Math.sin(d / 0.2 + 2)).toFixed(1))]);
  }
  const bands = [];
  const step = Math.round((0.25 / km) * (n - 1));
  for (let i = 0; i < n - 1; i += step) {
    const a = points[i];
    const b = points[Math.min(i + step, n - 1)];
    const grade = (Math.abs(b[1] - a[1]) / ((b[0] - a[0]) * 1000)) * 100;
    const cls = grade < 5 ? 0 : grade < 10 ? 1 : grade < 15 ? 2 : 3;
    const last = bands.at(-1);
    if (last && last.cls === cls) last.to = b[0];
    else bands.push({ from: a[0], to: b[0], cls });
  }
  const pois = [
    { km: 6.1, kind: 'aid' },
    { km: 13.7, kind: 'summit' },
    { km: 21.2, kind: 'aid' },
  ];
  return { points, bands, pois, km };
}

const SUMMIT = 'M0 -6 L6 5 L-6 5 Z';
const AID = 'M-5 -1.5 H-1.5 V-5 H1.5 V-1.5 H5 V1.5 H1.5 V5 H-1.5 V1.5 H-5 Z';
const OPACITY = [0.22, 0.45, 0.7, 1];

export const margin = { top: 16, right: 12, bottom: 24, left: 44 };

export function renderSvg({ points, bands, pois, km }, width, height) {
  const x = scaleLinear([0, km], [margin.left, width - margin.right]);
  const es = points.map((p) => p[1]);
  const y = scaleLinear([Math.min(...es), Math.max(...es)], [height - margin.bottom, margin.top]).nice();
  const base = y.range()[0];
  const fill = area().x((p) => x(p[0])).y0(base).y1((p) => y(p[1])).digits(1);
  const top = line().x((p) => x(p[0])).y((p) => y(p[1])).digits(1);
  const ticksX = x.ticks(width < 500 ? 5 : 14);
  const ticksY = y.ticks(4);
  const poi = (p) => {
    const q = points.reduce((a, b) => (Math.abs(b[0] - p.km) < Math.abs(a[0] - p.km) ? b : a));
    return `<path class="poi" transform="translate(${x(q[0]).toFixed(1)} ${(y(q[1]) - 10).toFixed(1)})" d="${p.kind === 'summit' ? SUMMIT : AID}"/>`;
  };
  return `<svg class="profile" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Perfil altimètric de mostra">
<style>.profile text{font:500 12px var(--tram-sys-font-data);font-variant-numeric:tabular-nums lining-nums;fill:var(--tram-sys-text-muted)}.profile .g{stroke:var(--tram-sys-rule);stroke-width:1}.profile .b{fill:var(--tram-sys-map-contour)}.profile .t{fill:none;stroke:var(--tram-sys-data-primary);stroke-width:2}.profile .poi{fill:var(--tram-sys-text)}.profile .m{fill:var(--tram-sys-data-active);stroke:var(--tram-sys-text);stroke-width:1.5}.profile .c{stroke:var(--tram-sys-text);stroke-width:1}</style>
${ticksY.map((t) => `<line class="g" x1="${margin.left}" x2="${width - margin.right}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/><text x="${margin.left - 6}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end">${t}</text>`).join('')}
${bands.map((b) => `<path class="b" fill-opacity="${OPACITY[b.cls]}" d="${fill(points.filter((p) => p[0] >= b.from && p[0] <= b.to))}"/>`).join('')}
<path class="t" d="${top(points)}"/>
${ticksX.map((t) => `<text x="${x(t).toFixed(1)}" y="${height - 6}" text-anchor="middle">${t}</text>`).join('')}
${pois.map(poi).join('')}
<g class="cursor" transform="translate(${margin.left} 0)"><line class="c" y1="${margin.top}" y2="${base}"/><circle class="m" r="5"/><text class="label" y="${margin.top - 4}"></text></g>
</svg>`;
}

export function echartsOption({ points, bands, pois, km }, width, theme) {
  const rgba = (a) => `rgba(156,98,55,${a})`;
  const pieces = bands.map((b) => ({ gt: b.from, lte: b.to, color: rgba(OPACITY[b.cls]) }));
  const near = (p) => points.reduce((a, b) => (Math.abs(b[0] - p.km) < Math.abs(a[0] - p.km) ? b : a));
  const ink = theme === 'tram-night' ? '#e8e5dc' : '#141518';
  return {
    animation: false,
    grid: { left: margin.left, right: margin.right, top: margin.top, bottom: margin.bottom },
    tooltip: { trigger: 'axis', transitionDuration: 0 },
    xAxis: { type: 'value', min: 0, max: km, interval: width < 500 ? 5 : 2, splitLine: { show: false } },
    yAxis: { type: 'value', scale: true },
    visualMap: { show: false, seriesIndex: 0, dimension: 0, pieces },
    series: [
      { type: 'line', data: points, showSymbol: false, areaStyle: {}, lineStyle: { width: 0 }, silent: true },
      {
        type: 'line',
        data: points,
        showSymbol: false,
        lineStyle: { width: 2, color: ink },
        itemStyle: { color: '#ff5a1f', borderColor: ink, borderWidth: 1.5 },
        markPoint: {
          symbolSize: 12,
          itemStyle: { color: ink },
          label: { show: false },
          data: pois.map((p) => ({ coord: near(p), symbol: `path://${p.kind === 'summit' ? SUMMIT : AID}`, symbolOffset: [0, -10] })),
        },
      },
    ],
  };
}
