import type { Artwork } from './internal/marks.js';
import { marksToPath } from './internal/marks.js';
import type { Style } from './style.js';
import { resolveStyle } from './style.js';
import { renderPathLayers } from './engine/render-path.js';

/**
 * Render a single SVG path `d` string into a sketchy, hand-drawn Artwork.
 * Pure and DOM-free: returns path `d` strings, never DOM nodes.
 */
export function render(pathData: string, style?: Style): Artwork {
  const resolved = resolveStyle(style);
  const layers = renderPathLayers(pathData, resolved);
  const strokes: string[] = [];
  const pigments: string[] = [];
  const pigmentStrokes: string[] = [];
  for (const layer of layers) {
    const d = marksToPath(layer, resolved.fixedDecimals);
    if (layer.role === 'stroke') {
      strokes.push(d);
    } else if (layer.role === 'pigment') {
      pigments.push(d);
    } else {
      pigmentStrokes.push(d);
    }
  }
  return { strokes, pigments, pigmentStrokes, layers };
}
