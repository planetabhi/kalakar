// Playground UI: reads the settings panel, roughens the current SVG in a worker,
// and paints the result. Single file at a time; everything runs client-side.
import { sketchSvg } from './transform.js';

const SAMPLE_SVG = `<svg width="68" height="60" viewBox="0 0 68 60" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M15.78 17.5L7.68 14.8L14.98 10.2L15.48 2L21.78 8.1L28.88 4.7L26.38 12.7L31.38 18.7L22.18 18.4L17.88 27L15.78 17.5Z" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" stroke="black"/>
<path d="M60.48 55.5C57.38 57.6 53.18 57.9 49.58 56.8C45.98 55.7 42.98 54.2 40.28 51.6C38.78 50.1 37.18 47.6 36.48 45.5C35.78 43.4 36.68 40.3 38.48 39.1C40.08 38 42.48 38.4 43.68 39.9C44.98 41.3 45.08 43.6 44.08 45.3C42.88 47.3 40.48 48.2 38.18 48C35.88 47.8 33.78 46.8 31.78 45.6C26.38 42.3 25.38 35.3 25.78 28.9" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" stroke="black"/>
</svg>`;

// Control schema — one entry per Style field, grouped into sections.
const SECTIONS = [
  {
    title: 'Linework',
    fields: [
      { key: 'looseness', type: 'range', min: 0, max: 5, step: 0.1, def: 1 },
      { key: 'waver', type: 'range', min: 0, max: 5, step: 0.1, def: 1 },
      { key: 'maxJitter', type: 'range', min: 0, max: 10, step: 0.1, def: 2 },
      { key: 'seed', type: 'seed', def: 0 },
      { key: 'singlePass', type: 'bool', def: false },
      { key: 'pinVertices', type: 'bool', def: false },
    ],
  },
  {
    title: 'Stroke',
    fields: [
      { key: 'stroke', type: 'color', def: '#000000' },
      { key: 'strokeWidth', type: 'range', min: 0, max: 10, step: 0.1, def: 1 },
    ],
  },
  {
    title: 'Fill / pigment',
    fields: [
      { key: 'fill', type: 'color', def: '', optional: true },
      { key: 'pigmentStyle', type: 'select', options: ['none', 'solid', 'hachure', 'crosshatch'], def: 'none' },
      { key: 'pigmentRoughnessGain', type: 'range', min: 0, max: 3, step: 0.1, def: 0.8 },
      { key: 'hatchAngle', type: 'range', min: -90, max: 90, step: 1, def: -41 },
      { key: 'hatchGap', type: 'range', min: -1, max: 40, step: 0.5, def: -1 },
      { key: 'pigmentWidth', type: 'range', min: -1, max: 10, step: 0.1, def: -1 },
      { key: 'pigmentSinglePass', type: 'bool', def: false },
    ],
  },
  {
    title: 'Output',
    fields: [
      { key: 'fixedDecimals', type: 'range', min: 0, max: 5, step: 1, def: 0 },
    ],
  },
];

const FIELDS = SECTIONS.flatMap((s) => s.fields);
const DEFAULTS = Object.fromEntries(FIELDS.map((f) => [f.key, f.def]));
const STORE_KEY = 'kalakar-playground';

const $ = (id) => document.getElementById(id);

const state = {
  source: '',
  name: 'sketch',
  showOriginal: false,
  zoom: 1,
  style: loadStyle(),
};

function loadStyle() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveStyle() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.style));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

// Build the render style, dropping values that should stay at the engine default.
function renderStyle() {
  const s = { ...state.style };
  const out = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'fill') {
      if (v) out.fill = v;
      continue;
    }
    if (k === 'fixedDecimals') {
      if (v > 0) out.fixedDecimals = v;
      continue;
    }
    out[k] = v;
  }
  return out;
}

// --- Worker with graceful fallback (module workers / file:// edge cases) ---
let worker = null;
let reqId = 0;
try {
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.addEventListener('message', (e) => {
    if (e.data.id !== reqId) return; // drop stale responses
    if (e.data.error) showError(e.data.error);
    else paint(e.data.markup);
  });
  worker.addEventListener('error', () => { worker = null; });
} catch {
  worker = null;
}

let fallbackRender = null;
async function ensureFallback() {
  if (fallbackRender) return fallbackRender;
  const mod = await import('../dist/index.js');
  fallbackRender = mod.render;
  return fallbackRender;
}

let lastMarkup = '';

function run() {
  if (!state.source) return;
  saveStyle();
  if (state.showOriginal) { paint(state.source); return; }
  const style = renderStyle();
  if (worker) {
    worker.postMessage({ id: ++reqId, svg: state.source, style });
  } else {
    ensureFallback()
      .then((render) => paint(sketchSvg(state.source, render, style)))
      .catch((err) => showError(String(err)));
  }
}

function paint(markup) {
  lastMarkup = state.showOriginal ? lastMarkup : markup;
  const shown = state.showOriginal ? state.source : markup;
  $('stageInner').innerHTML = shown;
  $('markup').textContent = shown;
  updateStats();
  applyZoom();
}

function showError(msg) {
  $('stageInner').innerHTML = `<div class="empty"><strong>Could not render</strong>${escapeHtml(msg)}</div>`;
}

function updateStats() {
  const stats = $('stats');
  if (!state.source || state.showOriginal) { stats.textContent = ''; return; }
  const before = new TextEncoder().encode(state.source).length;
  const after = new TextEncoder().encode(lastMarkup).length;
  const delta = before ? Math.round(((after - before) / before) * 100) : 0;
  stats.textContent = `${formatBytes(after)} · ${delta >= 0 ? '+' : ''}${delta}%`;
}

function formatBytes(n) {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} kB`;
}

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

// --- Settings panel ---
function buildSettings() {
  const form = $('settings');
  for (const section of SECTIONS) {
    const h = document.createElement('h2');
    h.textContent = section.title;
    form.append(h);
    for (const f of section.fields) form.append(buildField(f));
  }

  const actions = document.createElement('div');
  actions.className = 'settings-actions';
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Reset';
  reset.addEventListener('click', resetSettings);
  const randomize = document.createElement('button');
  randomize.type = 'button';
  randomize.textContent = 'Randomize seed';
  randomize.addEventListener('click', () => setValue('seed', Math.floor(Math.random() * 1e6)));
  actions.append(reset, randomize);
  form.append(actions);
}

function buildField(f) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const id = `f-${f.key}`;
  const label = labelFor(f.key);
  const val = state.style[f.key];

  if (f.type === 'range') {
    wrap.innerHTML = `<div class="row"><label for="${id}">${label}</label><output id="${id}-out"></output></div>`;
    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = f.min; input.max = f.max; input.step = f.step;
    input.value = val;
    const out = wrap.querySelector('output');
    out.textContent = f.key === 'fixedDecimals' && val === 0 ? 'off' : val;
    input.addEventListener('input', () => {
      const n = parseFloat(input.value);
      out.textContent = f.key === 'fixedDecimals' && n === 0 ? 'off' : n;
      state.style[f.key] = n;
      run();
    });
    wrap.append(input);
  } else if (f.type === 'bool') {
    wrap.classList.add('inline');
    wrap.innerHTML = `<label for="${id}">${label}</label>`;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.checked = !!val;
    input.addEventListener('change', () => { state.style[f.key] = input.checked; run(); });
    wrap.append(input);
  } else if (f.type === 'select') {
    wrap.innerHTML = `<div class="row"><label for="${id}">${label}</label></div>`;
    const sel = document.createElement('select');
    sel.id = id;
    for (const opt of f.options) {
      const o = document.createElement('option');
      o.value = opt; o.textContent = opt;
      if (opt === val) o.selected = true;
      sel.append(o);
    }
    sel.addEventListener('change', () => { state.style[f.key] = sel.value; run(); });
    wrap.append(sel);
  } else if (f.type === 'seed') {
    wrap.innerHTML = `<div class="row"><label for="${id}">${label}</label></div>`;
    const input = document.createElement('input');
    input.type = 'number';
    input.id = id;
    input.step = 1;
    input.value = val;
    input.addEventListener('input', () => { state.style[f.key] = parseInt(input.value || '0', 10); run(); });
    wrap.append(input);
  } else if (f.type === 'color') {
    wrap.innerHTML = `<div class="row"><label for="${id}">${label}</label></div>`;
    const row = document.createElement('div');
    row.className = 'color-field';
    const color = document.createElement('input');
    color.type = 'color';
    color.id = id;
    color.value = val || '#000000';
    const none = document.createElement('label');
    const noneBox = document.createElement('input');
    noneBox.type = 'checkbox';
    noneBox.checked = f.optional ? !val : val === 'none';
    none.append(noneBox, document.createTextNode(' none'));
    color.addEventListener('input', () => {
      noneBox.checked = false;
      state.style[f.key] = color.value;
      run();
    });
    noneBox.addEventListener('change', () => {
      state.style[f.key] = noneBox.checked ? (f.optional ? '' : 'none') : color.value;
      run();
    });
    row.append(color, none);
    wrap.append(row);
  }
  return wrap;
}

function labelFor(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase());
}

function setValue(key, value) {
  state.style[key] = value;
  const input = $(`f-${key}`);
  if (input) input.value = value;
  run();
}

function resetSettings() {
  state.style = { ...DEFAULTS };
  rebuildSettings();
  run();
}

function rebuildSettings() {
  $('settings').innerHTML = '';
  buildSettings();
}

// --- Input entry points ---
function loadSvg(text, name) {
  state.source = text.trim();
  if (name) state.name = name.replace(/\.svg$/i, '');
  state.showOriginal = false;
  updateToggle();
  resetZoom();
  run();
}

function onFiles(files) {
  const file = [...files].find((f) => f.name.endsWith('.svg') || f.type.includes('svg'));
  if (!file) return;
  file.text().then((t) => loadSvg(t, file.name));
}

// --- Tabs, toggle, zoom ---
function selectTab(which) {
  const image = which === 'image';
  $('tabImage').setAttribute('aria-selected', String(image));
  $('tabMarkup').setAttribute('aria-selected', String(!image));
  $('imageView').hidden = !image;
  $('markupView').hidden = image;
}

function updateToggle() {
  const btn = $('toggleBtn');
  btn.textContent = state.showOriginal ? 'Sketchy' : 'Original';
  btn.setAttribute('aria-pressed', String(state.showOriginal));
  btn.title = state.showOriginal ? 'Show the sketchy result' : 'Show the original SVG';
}

function applyZoom() {
  $('stageInner').style.transform = `scale(${state.zoom})`;
}
function resetZoom() { state.zoom = 1; applyZoom(); $('zoomReset').textContent = '100%'; }
function bumpZoom(factor) {
  state.zoom = Math.min(8, Math.max(0.1, state.zoom * factor));
  $('zoomReset').textContent = `${Math.round(state.zoom * 100)}%`;
  applyZoom();
}

// --- Download / copy ---
function download() {
  if (!lastMarkup) return;
  const blob = new Blob([lastMarkup], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.name}.sketchy.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

async function copy() {
  if (!lastMarkup) return;
  try {
    await navigator.clipboard.writeText(lastMarkup);
    flash($('copyBtn'), 'Copied');
  } catch {
    flash($('copyBtn'), 'Failed');
  }
}

function flash(btn, text) {
  const prev = btn.textContent;
  btn.textContent = text;
  setTimeout(() => { btn.textContent = prev; }, 1200);
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (text.includes('<svg')) loadSvg(text, 'pasted');
    else flash($('pasteBtn'), 'No SVG');
  } catch {
    flash($('pasteBtn'), 'Blocked');
  }
}

// --- Wire up ---
function init() {
  buildSettings();

  $('openBtn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', (e) => onFiles(e.target.files));
  $('sampleBtn').addEventListener('click', () => loadSvg(SAMPLE_SVG, 'sample'));
  $('pasteBtn').addEventListener('click', pasteFromClipboard);
  $('copyBtn').addEventListener('click', copy);
  $('downloadBtn').addEventListener('click', download);

  $('tabImage').addEventListener('click', () => selectTab('image'));
  $('tabMarkup').addEventListener('click', () => selectTab('markup'));
  $('toggleBtn').addEventListener('click', () => { state.showOriginal = !state.showOriginal; updateToggle(); run(); });

  $('zoomIn').addEventListener('click', () => bumpZoom(1.25));
  $('zoomOut').addEventListener('click', () => bumpZoom(0.8));
  $('zoomReset').addEventListener('click', resetZoom);

  // Drag and drop anywhere.
  const body = document.body;
  body.addEventListener('dragover', (e) => { e.preventDefault(); body.classList.add('dragover'); });
  body.addEventListener('dragleave', (e) => { if (e.relatedTarget === null) body.classList.remove('dragover'); });
  body.addEventListener('drop', (e) => {
    e.preventDefault();
    body.classList.remove('dragover');
    if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
  });

  updateToggle();
  loadSvg(SAMPLE_SVG, 'sample');
}

init();
