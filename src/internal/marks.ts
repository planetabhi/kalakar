/** A single pen instruction within a Layer. */
export interface Mark {
  verb: 'move' | 'curve' | 'line';
  coords: number[];
}

/** A group of Marks with a role in the final artwork. */
export interface Layer {
  role: 'stroke' | 'pigment' | 'pigment-sketch';
  marks: Mark[];
}

/** The result of rendering a path: ordered stroke + pigment layers. */
export interface Artwork {
  /** Path `d` strings for outline (stroke) layers. */
  strokes: string[];
  /** Path `d` strings for solid fill (pigment) layers. Empty unless a solid fill is requested. */
  pigments: string[];
  /** Path `d` strings for hachure/crosshatch fills. Stroke these with the fill color. */
  pigmentStrokes: string[];
  /** Structured layers for advanced consumers. */
  layers: Layer[];
}

/** Serialize a Layer's Marks into an SVG path `d` string. */
export function marksToPath(layer: Layer, fixedDecimals?: number): string {
  let path = '';
  for (const mark of layer.marks) {
    const data =
      typeof fixedDecimals === 'number' && fixedDecimals >= 0
        ? mark.coords.map((d) => +d.toFixed(fixedDecimals))
        : mark.coords;
    switch (mark.verb) {
      case 'move':
        path += `M${data[0]} ${data[1]} `;
        break;
      case 'curve':
        path += `C${data[0]} ${data[1]}, ${data[2]} ${data[3]}, ${data[4]} ${data[5]} `;
        break;
      case 'line':
        path += `L${data[0]} ${data[1]} `;
        break;
    }
  }
  return path.trim();
}
