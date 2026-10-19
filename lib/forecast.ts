/** Ordinary least-squares fit over (year, total) pairs, extrapolated one
 * year past the last point given. Intentionally simple — a straight line
 * through whole-fiscal-year totals — matching the roadmap's ask for "an
 * easy" forecast rather than a seasonal/ARIMA model; it doesn't know about
 * capacity changes, policy changes, or anything else that isn't already
 * visible as a trend in the totals themselves. Returns null when there
 * aren't at least 2 points to draw a line through, or when every x value
 * given is identical (no trend is definable). */
export function linearForecastNextYear(
  rows: { year: number; total: number }[]
): { year: number; total: number } | null {
  const n = rows.length;
  if (n < 2) return null;
  const xs = rows.map((r) => r.year);
  const ys = rows.map((r) => r.total);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    num += dx * (ys[i] - my);
    den += dx * dx;
  }
  if (den === 0) return null;
  const slope = num / den;
  const intercept = my - slope * mx;
  const nextYear = Math.max(...xs) + 1;
  const total = Math.max(0, Math.round(intercept + slope * nextYear));
  return { year: nextYear, total };
}
