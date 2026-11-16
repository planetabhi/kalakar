// Module Web Worker: roughens SVG off the main thread so slider drags stay smooth.
//
// Local dev imports the freshly built engine from ../dist. For the hosted static
// site, swap this line to the published CDN build, e.g.:
//   import { render } from 'https://cdn.jsdelivr.net/npm/kalakar@0.1.0/dist/index.js';
import { render } from '../dist/index.js';
import { sketchSvg } from './transform.js';

self.addEventListener('message', (e) => {
  const { id, svg, style } = e.data;
  try {
    const markup = sketchSvg(svg, render, style);
    self.postMessage({ id, markup });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message ? err.message : err) });
  }
});
