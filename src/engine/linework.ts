import type { Mark } from '../internal/marks.js';
import { Hand } from '../internal/hand.js';
import type { ResolvedStyle } from '../style.js';

function random(s: ResolvedStyle): number {
  if (!s.hand) {
    s.hand = new Hand(s.seed || 0);
  }
  return s.hand.next();
}

function offset(min: number, max: number, s: ResolvedStyle, roughnessGain = 1): number {
  return s.looseness * roughnessGain * ((random(s) * (max - min)) + min);
}

function offsetOpt(x: number, s: ResolvedStyle, roughnessGain = 1): number {
  return offset(-x, x, s, roughnessGain);
}

function line(x1: number, y1: number, x2: number, y2: number, s: ResolvedStyle, move: boolean, overlay: boolean): Mark[] {
  const lengthSq = Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2);
  const length = Math.sqrt(lengthSq);
  let roughnessGain = 1;
  if (length < 200) {
    roughnessGain = 1;
  } else if (length > 500) {
    roughnessGain = 0.4;
  } else {
    roughnessGain = -0.0016668 * length + 1.233334;
  }

  let off = s.maxJitter || 0;
  if ((off * off * 100) > lengthSq) {
    off = length / 10;
  }
  const halfOffset = off / 2;
  const divergePoint = 0.2 + random(s) * 0.2;
  let midDispX = s.waver * s.maxJitter * (y2 - y1) / 200;
  let midDispY = s.waver * s.maxJitter * (x1 - x2) / 200;
  midDispX = offsetOpt(midDispX, s, roughnessGain);
  midDispY = offsetOpt(midDispY, s, roughnessGain);
  const marks: Mark[] = [];
  const randomHalf = () => offsetOpt(halfOffset, s, roughnessGain);
  const randomFull = () => offsetOpt(off, s, roughnessGain);
  const pin = s.pinVertices;

  if (move) {
    if (overlay) {
      marks.push({ verb: 'move', coords: [x1 + (pin ? 0 : randomHalf()), y1 + (pin ? 0 : randomHalf())] });
    } else {
      marks.push({ verb: 'move', coords: [x1 + (pin ? 0 : randomFull()), y1 + (pin ? 0 : randomFull())] });
    }
  }

  const jitter = overlay ? randomHalf : randomFull;
  marks.push({
    verb: 'curve',
    coords: [
      midDispX + x1 + (x2 - x1) * divergePoint + jitter(),
      midDispY + y1 + (y2 - y1) * divergePoint + jitter(),
      midDispX + x1 + 2 * (x2 - x1) * divergePoint + jitter(),
      midDispY + y1 + 2 * (y2 - y1) * divergePoint + jitter(),
      x2 + (pin ? 0 : jitter()),
      y2 + (pin ? 0 : jitter()),
    ],
  });
  return marks;
}

/** A single or double sketchy line between two points. */
export function doubleLine(x1: number, y1: number, x2: number, y2: number, s: ResolvedStyle): Mark[] {
  const o1 = line(x1, y1, x2, y2, s, true, false);
  if (s.singlePass) {
    return o1;
  }
  return o1.concat(line(x1, y1, x2, y2, s, true, true));
}

/** A sketchy cubic bezier from `current` through control points to (x, y). */
export function bezierTo(
  x1: number, y1: number, x2: number, y2: number, x: number, y: number,
  current: [number, number], s: ResolvedStyle,
): Mark[] {
  const marks: Mark[] = [];
  const ros = [s.maxJitter || 1, (s.maxJitter || 1) + 0.3];
  const iterations = s.singlePass ? 1 : 2;
  const pin = s.pinVertices;
  for (let i = 0; i < iterations; i++) {
    if (i === 0) {
      marks.push({ verb: 'move', coords: [current[0], current[1]] });
    } else {
      marks.push({ verb: 'move', coords: [current[0] + (pin ? 0 : offsetOpt(ros[0], s)), current[1] + (pin ? 0 : offsetOpt(ros[0], s))] });
    }
    const f: [number, number] = pin ? [x, y] : [x + offsetOpt(ros[i], s), y + offsetOpt(ros[i], s)];
    marks.push({
      verb: 'curve',
      coords: [
        x1 + offsetOpt(ros[i], s), y1 + offsetOpt(ros[i], s),
        x2 + offsetOpt(ros[i], s), y2 + offsetOpt(ros[i], s),
        f[0], f[1],
      ],
    });
  }
  return marks;
}
