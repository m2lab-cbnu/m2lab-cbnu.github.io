// Marching squares: line segments where a gridded field crosses `level`.
// data is row-major (nx columns, ny rows) over [x0, x1] × [y0, y1]. Returns {x, y} arrays
// with NaN between segments, ready for Plot.setSeries.

export function contour(data, nx, ny, x0, x1, y0, y1, level) {
  const X = [], Y = [];
  const dx = (x1 - x0) / (nx - 1), dy = (y1 - y0) / (ny - 1);
  const v = (i, j) => data[j * nx + i];
  const lerp = (a, b, va, vb) => a + (b - a) * (level - va) / (vb - va);
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
    if (!(Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && Number.isFinite(d))) continue;
    const xa = x0 + i * dx, xb = xa + dx, ya = y0 + j * dy, yb = ya + dy;
    const pts = [];
    if ((a < level) !== (b < level)) pts.push([lerp(xa, xb, a, b), ya]);
    if ((b < level) !== (c < level)) pts.push([xb, lerp(ya, yb, b, c)]);
    if ((c < level) !== (d < level)) pts.push([lerp(xb, xa, c, d), yb]);
    if ((d < level) !== (a < level)) pts.push([xa, lerp(yb, ya, d, a)]);
    if (pts.length === 2) { X.push(pts[0][0], pts[1][0], NaN); Y.push(pts[0][1], pts[1][1], NaN); }
    else if (pts.length === 4) { // saddle: pair by the centre value
      const m = (a + b + c + d) / 4;
      const order = (m < level) === (a < level) ? [0, 3, 1, 2] : [0, 1, 2, 3];
      X.push(pts[order[0]][0], pts[order[1]][0], NaN, pts[order[2]][0], pts[order[3]][0], NaN);
      Y.push(pts[order[0]][1], pts[order[1]][1], NaN, pts[order[2]][1], pts[order[3]][1], NaN);
    }
  }
  return { x: X, y: Y };
}
