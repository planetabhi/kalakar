import type { Point } from '../internal/geometry.js';

/** A straight fill line between two points. */
export type Line = [Point, Point];

interface Edge {
  ymin: number;
  ymax: number;
  x: number;
  islope: number;
}

function rotate(p: Point, rad: number): Point {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

/**
 * Even-odd scan-line hachure: parallel fill lines at `angleDeg` degrees, spaced
 * by `gap`. Holes are carved automatically via even-odd pairing of crossings.
 */
export function hachureLines(polygons: Point[][], gap: number, angleDeg: number): Line[] {
  const g = Math.max(gap, 0.1);
  const rad = (angleDeg * Math.PI) / 180;
  const rotated = polygons.map((poly) => poly.map((p) => rotate(p, -rad)));

  const edges: Edge[] = [];
  for (const poly of rotated) {
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % poly.length];
      if (p1[1] === p2[1]) {
        continue;
      }
      const down = p1[1] < p2[1];
      edges.push({
        ymin: down ? p1[1] : p2[1],
        ymax: down ? p2[1] : p1[1],
        x: down ? p1[0] : p2[0],
        islope: (p2[0] - p1[0]) / (p2[1] - p1[1]),
      });
    }
  }
  if (!edges.length) {
    return [];
  }

  let minY = Infinity;
  let maxY = -Infinity;
  for (const e of edges) {
    if (e.ymin < minY) minY = e.ymin;
    if (e.ymax > maxY) maxY = e.ymax;
  }

  const lines: Line[] = [];
  for (let y = minY + g / 2; y < maxY; y += g) {
    const xs: number[] = [];
    for (const e of edges) {
      if (y >= e.ymin && y < e.ymax) {
        xs.push(e.x + (y - e.ymin) * e.islope);
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      lines.push([rotate([xs[i], y], rad), rotate([xs[i + 1], y], rad)]);
    }
  }
  return lines;
}
