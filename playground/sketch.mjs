// Local-only playground (not shipped): roughens every <path> and basic shape
// (line, polyline, polygon, rect, circle, ellipse) in each SVG under
// playground/raw/, writes sketchy copies to playground/output/, then builds a
// self-contained before/after gallery at playground/preview/index.html.
// Run with: pnpm playground
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { render } from '../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const rawDir = join(here, 'raw');
const outDir = join(here, 'output');
const previewDir = join(here, 'preview');
rmSync(outDir, { recursive: true, force: true }); // start clean so removed inputs don't leave orphans
mkdirSync(outDir, { recursive: true });
mkdirSync(previewDir, { recursive: true });

// Tweak these to explore the configurable look.
const style = {
  seed: 42,
  looseness: 0.5,
  waver: 0.8,
  maxJitter: 1.4,
  strokeWidth: 1.5,
  pigmentStyle: 'solid', // try 'hachure' or 'crosshatch'
};

function attrsOf(tag) {
  const attrs = {};
  for (const m of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

// Geometry attributes are regenerated as a roughened `d`; everything else
// (class, id, fill, stroke, stroke-width, fill-rule, ...) is carried through so
// the sketchy shape keeps the raw element's styling, including CSS-class styling.
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

function sketchElement(tag, name) {
  const a = attrsOf(tag);
  const d = elementToD(name, a);
  if (!d) return tag;

  const fill = a.fill && a.fill !== 'none' ? a.fill : undefined;
  const strokeWidth = a['stroke-width'] ? parseFloat(a['stroke-width']) : style.strokeWidth;

  // Explicit fill color: demo the pigment pipeline (solid/hachure).
  if (fill) {
    const hasStroke = !!a.stroke && a.stroke !== 'none';
    const art = render(d, { ...style, stroke: hasStroke ? a.stroke : 'none', strokeWidth, fill, pigmentStyle: style.pigmentStyle });
    const pigmentWidth = Math.max(strokeWidth / 2, 0.5);
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
    rough = render(d, { ...style, stroke: '#000', strokeWidth, pigmentStyle: 'none' }).strokes.join(' ');
  } catch {
    return tag;
  }
  return rough ? `<path${passthrough(a)} d="${rough}"/>` : tag;
}

function sketchSvg(svg) {
  return svg.replace(
    /<(path|line|polyline|polygon|rect|circle|ellipse)\b[^>]*\/>/g,
    (tag, name) => sketchElement(tag, name),
  );
}

function previewHtml(cards) {
  const items = cards
    .map(
      (c) => `    <figure class="card">
      <figcaption>${c.file}</figcaption>
      <div class="pair">
        <div class="cell"><span>raw</span>${c.raw}</div>
        <div class="cell"><span>sketchy</span>${c.sketchy}</div>
      </div>
    </figure>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>kalakar playground</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; padding: 2rem; font: 14px/1.5 system-ui, sans-serif; background: #fff; color: #111; }
    h1 { font-size: 1rem; font-weight: 600; margin: 0 0 1.5rem; }
    .grid { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    .card { margin: 0; border: 1px solid color-mix(in srgb, currentColor 15%, transparent); border-radius: 8px; overflow: hidden; }
    figcaption { padding: 0.5rem 0.75rem; font-size: 12px; opacity: 0.7; border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent); }
    .pair { display: grid; grid-template-columns: 1fr 1fr; }
    .cell { position: relative; padding: 1.25rem; display: grid; place-items: center; }
    .cell + .cell { border-left: 1px solid color-mix(in srgb, currentColor 15%, transparent); }
    .cell span { position: absolute; top: 0.4rem; left: 0.5rem; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; opacity: 0.4; }
    .cell svg { width: 100%; height: auto; max-width: 96px; }
  </style>
</head>
<body>
  <div class="grid">
${items}
  </div>
</body>
</html>
`;
}

const files = readdirSync(rawDir).filter((f) => f.endsWith('.svg'));
const cards = [];
for (const file of files) {
  const svg = readFileSync(join(rawDir, file), 'utf8');
  const sketchy = sketchSvg(svg);
  const outName = file.replace(/\.svg$/, '.sketchy.svg');
  writeFileSync(join(outDir, outName), sketchy);
  cards.push({ file, raw: svg, sketchy });
  console.log(`✓ ${file} → output/${outName}`);
}

writeFileSync(join(previewDir, 'index.html'), previewHtml(cards));
console.log(`\nDone. ${files.length} icon(s). Open playground/preview/index.html`);
