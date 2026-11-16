import { describe, it, expect } from 'vitest';
import { render } from '../src/index.js';

const ICON_LINE =
  'M21 7v11.6c0 1.33-1.07 2.4-2.4 2.4H5.4C4.07 21 3 19.93 3 18.6V7m-.4-4h18.8A1.6 1.6 0 0 1 23 4.6v.8A1.6 1.6 0 0 1 21.4 7H2.6A1.6 1.6 0 0 1 1 5.4v-.8A1.6 1.6 0 0 1 2.6 3';

describe('render', () => {
  it('produces a stroke layer for a plain path', () => {
    const art = render('M0 0 L10 0 L10 10 Z', { seed: 1 });
    expect(art.strokes.length).toBe(1);
    expect(art.pigments.length).toBe(0);
    expect(art.strokes[0]).toMatch(/^M/);
  });

  it('is deterministic for a fixed seed', () => {
    const a = render(ICON_LINE, { seed: 42 });
    const b = render(ICON_LINE, { seed: 42 });
    expect(a.strokes).toEqual(b.strokes);
  });

  it('varies output across different seeds', () => {
    const a = render(ICON_LINE, { seed: 1 });
    const b = render(ICON_LINE, { seed: 2 });
    expect(a.strokes).not.toEqual(b.strokes);
  });

  it('handles arc (A) commands by converting them to curves', () => {
    const art = render('M80 80 A 45 45 0 0 0 125 125 L 125 80 Z', { seed: 7 });
    expect(art.strokes[0]).toContain('C');
    expect(Number.isNaN(parseFloat(art.strokes[0].slice(1)))).toBe(false);
  });

  it('emits a pigment layer only when a fill + pigmentStyle is set', () => {
    const none = render('M0 0 L10 0 L10 10 Z', { seed: 1, fill: '#000' });
    expect(none.pigments.length).toBe(0);
    const solid = render('M0 0 L10 0 L10 10 Z', { seed: 1, fill: '#000', pigmentStyle: 'solid' });
    expect(solid.pigments.length).toBe(1);
  });

  it('omits the stroke layer when stroke is "none"', () => {
    const art = render('M0 0 L10 0 L10 10 Z', { seed: 1, stroke: 'none', fill: '#000', pigmentStyle: 'solid' });
    expect(art.strokes.length).toBe(0);
    expect(art.pigments.length).toBe(1);
  });

  it('single pass yields a shorter path than the default double pass', () => {
    const dbl = render(ICON_LINE, { seed: 3 });
    const single = render(ICON_LINE, { seed: 3, singlePass: true });
    expect(single.strokes[0].length).toBeLessThan(dbl.strokes[0].length);
  });

  it('returns an empty artwork for an empty path', () => {
    const art = render('', { seed: 1 });
    expect(art.strokes).toEqual([]);
    expect(art.pigments).toEqual([]);
    expect(art.pigmentStrokes).toEqual([]);
    expect(art.layers).toEqual([]);
  });

  it('emits hachure fills as pigmentStrokes, not solid pigments', () => {
    const art = render('M0 0 L20 0 L20 20 L0 20 Z', {
      seed: 1,
      fill: '#000',
      pigmentStyle: 'hachure',
    });
    expect(art.pigments.length).toBe(0);
    expect(art.pigmentStrokes.length).toBe(1);
    expect(art.pigmentStrokes[0]).toMatch(/^M/);
    expect(art.layers.some((l) => l.role === 'pigment-sketch')).toBe(true);
  });

  it('crosshatch lays down more fill marks than hachure', () => {
    const base = { seed: 1, fill: '#000', stroke: 'none' } as const;
    const hachure = render('M0 0 L20 0 L20 20 L0 20 Z', { ...base, pigmentStyle: 'hachure' });
    const cross = render('M0 0 L20 0 L20 20 L0 20 Z', { ...base, pigmentStyle: 'crosshatch' });
    const hachureMarks = hachure.layers[0].marks.length;
    const crossMarks = cross.layers[0].marks.length;
    expect(crossMarks).toBeGreaterThan(hachureMarks);
  });

  it('rounds output coordinates with fixedDecimals', () => {
    const art = render('M0 0 L10 0 L10 10 Z', { seed: 1, fixedDecimals: 1 });
    const longDecimal = /\d+\.\d{3,}/;
    expect(longDecimal.test(art.strokes[0])).toBe(false);
  });
});
