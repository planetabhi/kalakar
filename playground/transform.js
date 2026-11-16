// Shared SVG -> sketchy transform. Pure string work; `render` is injected so the
// same logic runs in the worker (browser) and could run in Node. Roughens every
// <path> and basic shape (line, polyline, polygon, rect, circle, ellipse) while
// preserving each element's own styling, including CSS-class styling.

function attrsOf(tag) {
  const attrs = {};
  for (const m of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

// Geometry attributes are regenerated as a roughened `d`; everything else
// (class, id, fill, stroke, stroke-width, fill-rule, ...) is carried through.
const GEOM_ATTRS = new Set([
  'd', 'points', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry',
]);

function passthrough(a) {
  return Object.entries(a)
    .filter(([k]) => !GEOM_ATTRS.has(k))
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('');
}

function num(a, k) {
  return parseFloat(a[k] || '0');
}

function pointsToD(points, close) {
  const n = (points || '').trim().split(/[\s,]+/).map(Number).filter((v) => !Number.isNaN(v));
  if (n.length < 4) return '';
  let d = `M${n[0]} ${n[1]}`;
  for (let i = 2; i + 1 < n.length; i += 2) {
    d += ` L${n[i]} ${n[i + 1]}`;
  }
  return close ? `${d} Z` : d;
}

/** Build an SVG path `d` string for a shape element, or '' if unsupported. */
function elementToD(name, a) {
  switch (name) {
    case 'path':
      return a.d || '';
    case 'line':
      return `M${num(a, 'x1')} ${num(a, 'y1')} L${num(a, 'x2')} ${num(a, 'y2')}`;
    case 'polyline':
      return pointsToD(a.points, false);
    case 'polygon':
      return pointsToD(a.points, true);
    case 'rect': {
      const x = num(a, 'x'), y = num(a, 'y'), w = num(a, 'width'), h = num(a, 'height');
      if (w <= 0 || h <= 0) return '';
      return `M${x} ${y} L${x + w} ${y} L${x + w} ${y + h} L${x} ${y + h} Z`;
    }
    case 'circle': {
      const cx = num(a, 'cx'), cy = num(a, 'cy'), r = num(a, 'r');
      if (r <= 0) return '';
      return `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
    }
    case 'ellipse': {
      const cx = num(a, 'cx'), cy = num(a, 'cy'), rx = num(a, 'rx'), ry = num(a, 'ry');
      if (rx <= 0 || ry <= 0) return '';
      return `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
    }
    default:
      return '';
  }
}

function sketchElement(tag, name, render, style) {
  const a = attrsOf(tag);
  const d = elementToD(name, a);
  if (!d) return tag;

  const fill = a.fill && a.fill !== 'none' ? a.fill : style.fill;
  const strokeWidth = a['stroke-width'] ? parseFloat(a['stroke-width']) : style.strokeWidth;

  // Explicit fill color: run the pigment pipeline (solid/hachure/crosshatch).
  if (fill && style.pigmentStyle && style.pigmentStyle !== 'none') {
    const hasStroke = !!a.stroke && a.stroke !== 'none';
    const art = render(d, { ...style, stroke: hasStroke ? a.stroke : 'none', strokeWidth, fill });
    const pigmentWidth = style.pigmentWidth > 0 ? style.pigmentWidth : Math.max(strokeWidth / 2, 0.5);
    const opacity = a['fill-opacity'] ? ` fill-opacity="${a['fill-opacity']}"` : '';
    const rule = a['fill-rule'] ? ` fill-rule="${a['fill-rule']}"` : '';
    const strokeOpacity = a['fill-opacity'] ? ` stroke-opacity="${a['fill-opacity']}"` : '';
    const out = [];
    for (const dd of art.pigments) {
      out.push(`<path fill="${fill}"${opacity}${rule} d="${dd}"/>`);
    }
    for (const dd of art.pigmentStrokes) {
      out.push(`<path fill="none" stroke="${fill}" stroke-width="${pigmentWidth}"${strokeOpacity} stroke-linecap="round" stroke-linejoin="round" d="${dd}"/>`);
    }
    if (hasStroke) {
      for (const dd of art.strokes) {
        out.push(`<path fill="none" stroke="${a.stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" d="${dd}"/>`);
      }
    }
    return out.length ? out.join('') : tag;
  }

  // Otherwise roughen the outline and keep the element's own styling (class/attrs).
  let rough;
  try {
    rough = render(d, { ...style, strokeWidth, pigmentStyle: 'none' }).strokes.join(' ');
  } catch {
    return tag;
  }
  if (!rough) return tag;
  // Keep the source stroke color/width via passthrough; only inject a default
  // stroke when the element carries no stroke styling of its own.
  const styled = a.stroke || a.class || a.style;
  const fallback = styled ? '' : ` fill="none" stroke="${style.stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`;
  return `<path${passthrough(a)}${fallback} d="${rough}"/>`;
}

/** Roughen every supported element in an SVG string. */
export function sketchSvg(svg, render, style) {
  return svg.replace(
    /<(path|line|polyline|polygon|rect|circle|ellipse)\b[^>]*\/>/g,
    (tag, name) => sketchElement(tag, name, render, style),
  );
}
