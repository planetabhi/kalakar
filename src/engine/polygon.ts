import type { Point } from '../internal/geometry.js';
import { parsePath, absolutize, normalize } from './path-data.js';

/** Sample a cubic Bezier into `steps` points (excluding the start point). */
function cubicPoints(p0: Point, c1: Point, c2: Point, p1: Point, steps: number): Point[] {
  const pts: Point[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const a = mt * mt * mt;
    const b = 3 * mt * mt * t;
    const c = 3 * mt * t * t;
    const d = t * t * t;
    pts.push([
      a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0],
      a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1],
    ]);
  }
  return pts;
}

/**
 * Flatten a path `d` into closed polygons (one per subpath), sampling every
 * curve into line segments. Used as input to the hachure fill scan-line.
 */
export function pathToPolygons(d: string, curveSteps = 16): Point[][] {
  const segments = normalize(absolutize(parsePath(d)));
  const polygons: Point[][] = [];
  let current: Point[] | null = null;
  let pos: Point = [0, 0];
  let start: Point = [0, 0];
  const ensure = () => {
    if (!current) {
      current = [[pos[0], pos[1]]];
      polygons.push(current);
    }
    return current;
  };
  for (const { key, data } of segments) {
    switch (key) {
      case 'M':
        current = [[data[0], data[1]]];
        polygons.push(current);
        pos = [data[0], data[1]];
        start = [data[0], data[1]];
        break;
      case 'L':
        pos = [data[0], data[1]];
        ensure().push([pos[0], pos[1]]);
        break;
      case 'C': {
        const end: Point = [data[4], data[5]];
        const sampled = cubicPoints(pos, [data[0], data[1]], [data[2], data[3]], end, curveSteps);
        const poly = ensure();
        for (const p of sampled) {
          poly.push(p);
        }
        pos = end;
        break;
      }
      case 'Z':
        pos = [start[0], start[1]];
        break;
    }
  }
  return polygons.filter((p) => p.length >= 2);
}
