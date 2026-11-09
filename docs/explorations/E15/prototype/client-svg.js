// Client part of the hand-made profile: moves the cursor to a km, with no library.
window.mount = (svg, points, x0, x1, y0, y1, min, max, km) => {
  const cursor = svg.querySelector('.cursor');
  const dot = cursor.querySelector('.m');
  const label = cursor.querySelector('.label');
  const nf = new Intl.NumberFormat('ca', { maximumFractionDigits: 1 });
  const find = (d) => {
    let lo = 0;
    let hi = points.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (points[mid][0] < d) lo = mid + 1;
      else hi = mid;
    }
    return points[lo];
  };
  return (d) => {
    const p = find(d);
    cursor.setAttribute('transform', `translate(${x0 + (p[0] / km) * (x1 - x0)} 0)`);
    dot.setAttribute('cy', y0 + ((p[1] - min) / (max - min)) * (y1 - y0));
    label.textContent = `${nf.format(p[0])} km`;
  };
};
