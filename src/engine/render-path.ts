import type { Mark, Layer } from '../internal/marks.js';
import type { Point } from '../internal/geometry.js';
import type { ResolvedStyle } from '../style.js';
import { parsePath, absolutize, normalize, type Segment } from './path-data.js';
import { doubleLine, bezierTo } from './linework.js';
import { pathToPolygons } from './polygon.js';
import { hachureLines } from './hachure.js';

/** Roughen a run of normalized M/L/C/Z segments into sketchy stroke Marks. */
function segmentMarks(segments: Segment[], s: ResolvedStyle): Mark[] {
  const marks: Mark[] = [];
  let first: Point = [0, 0];
  let current: Point = [0, 0];
  for (const { key, data } of segments) {
    switch (key) {
      case 'M':
        current = [data[0], data[1]];
        first = [data[0], data[1]];
        break;
      case 'L':
        marks.push(...doubleLine(current[0], current[1], data[0], data[1], s));
        current = [data[0], data[1]];
        break;
      case 'C': {
        const [x1, y1, x2, y2, x, y] = data;
        marks.push(...bezierTo(x1, y1, x2, y2, x, y, current, s));
        current = [x, y];
        break;
      }
      case 'Z':
        marks.push(...doubleLine(current[0], current[1], first[0], first[1], s));
        current = [first[0], first[1]];
        break;
    }
  }
  return marks;
}

/** Roughen a path `d` string into sketchy stroke Marks. */
function strokeMarks(d: string, s: ResolvedStyle): Mark[] {
  return segmentMarks(normalize(absolutize(parsePath(d))), s);
}

/** Split normalized segments into subpaths, each beginning at an `M`. */
function splitSubpaths(segments: Segment[]): Segment[][] {
  const subpaths: Segment[][] = [];
  let current: Segment[] | undefined;
  for (const seg of segments) {
    if (seg.key === 'M' || !current) {
      current = [];
      subpaths.push(current);
    }
    current.push(seg);
  }
  return subpaths;
}

/**
 * Build fill (Pigment) Marks that preserve subpath boundaries so `fill-rule`
 * can carve holes. Each subpath becomes one continuous contour; subpaths stay
 * separate (their leading `move` is kept).
 */
function fillMarks(d: string, s: ResolvedStyle): Mark[] {
  const subpaths = splitSubpaths(normalize(absolutize(parsePath(d))));
  const marks: Mark[] = [];
  for (const sub of subpaths) {
    const contour = segmentMarks(sub, s);
    // Collapse the subpath into a single continuous contour (keep only its first move).
    for (let i = 0; i < contour.length; i++) {
      if (i === 0 || contour[i].verb !== 'move') {
        marks.push(contour[i]);
      }
    }
  }
  return marks;
}

/** Build hachure/crosshatch fill Marks: sketchy parallel lines across the shape. */
function hatchMarks(d: string, s: ResolvedStyle, angles: number[]): Mark[] {
  const polygons = pathToPolygons(d);
  if (!polygons.length) {
    return [];
  }
  let gap = s.hatchGap;
  if (gap < 0) {
    const width = s.pigmentWidth > 0 ? s.pigmentWidth : Math.max(s.strokeWidth / 2, 0.5);
    gap = width * 4;
  }
  const marks: Mark[] = [];
  for (const angle of angles) {
    for (const [a, b] of hachureLines(polygons, gap, angle)) {
      marks.push(...doubleLine(a[0], a[1], b[0], b[1], s));
    }
  }
  return marks;
}

/** Produce the ordered layers (pigment first, then stroke) for a path. */
export function renderPathLayers(d: string, s: ResolvedStyle): Layer[] {
  const layers: Layer[] = [];
  if (!d) {
    return layers;
  }
  const cleaned = d.replace(/\n/g, ' ').replace(/(-\s)/g, '-');

  const hasFill = !!s.fill && s.fill !== 'transparent' && s.fill !== 'none' && s.pigmentStyle !== 'none';
  const hasStroke = s.stroke !== 'none';

  if (hasFill) {
    if (s.pigmentStyle === 'solid') {
      // Solid pigment: a looser single-pass outline with subpath boundaries
      // preserved so `fill-rule` can carve holes.
      const fillStyle: ResolvedStyle = {
        ...s,
        singlePass: true,
        looseness: s.looseness ? s.looseness + s.pigmentRoughnessGain : 0,
        hand: undefined,
      };
      layers.push({ role: 'pigment', marks: fillMarks(cleaned, fillStyle) });
    } else {
      // Hachure / crosshatch pigment: sketchy parallel lines (stroked, not filled).
      const angles = s.pigmentStyle === 'crosshatch'
        ? [s.hatchAngle, s.hatchAngle + 90]
        : [s.hatchAngle];
      const lineStyle: ResolvedStyle = { ...s, singlePass: s.pigmentSinglePass, hand: undefined };
      layers.push({ role: 'pigment-sketch', marks: hatchMarks(cleaned, lineStyle, angles) });
    }
  }

  if (hasStroke) {
    layers.push({ role: 'stroke', marks: strokeMarks(cleaned, s) });
  }

  return layers;
}
