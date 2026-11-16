![kalakar playground](playground/__cover.webp)

# kalakar

kalakar turns an SVG path into a hand-drawn, sketchy version. It accepts the `d` attribute of a path and returns new path `d` strings. kalakar is pure, runs without the DOM, and has zero runtime dependencies.

## Install

```sh
npm install kalakar
```

## Usage

Pass the `d` attribute of a path to `render`. It returns an `Artwork` object:

```ts
import { render } from 'kalakar';

const art = render('M3 3 H21 V21 H3 Z', { looseness: 1, seed: 42 });
```

The `Artwork` object contains the following properties:

- `strokes` holds the outline path `d` strings. Stroke these with the stroke color.
- `pigments` holds the solid fill path `d` strings. Fill these with the fill color.
- `pigmentStrokes` holds the hachure and crosshatch fill path `d` strings. Stroke these with the fill color.
- `layers` holds the structured layers for advanced use.

## Intensity

The second argument to `render` is a style object. The `looseness` option controls the intensity. A value of `0` returns an exact copy, `1` applies the default effect, and higher values produce a rougher result.

## Fills

The same style object controls fills. Set a `fill` color and choose a `pigmentStyle`:

```ts
render(d, { fill: '#e11', pigmentStyle: 'solid' });
render(d, { fill: '#e11', pigmentStyle: 'hachure' });
render(d, { fill: '#e11', pigmentStyle: 'crosshatch' });
```

The `solid` style returns paths in `art.pigments` and preserves `fill-rule` holes. Fill these with the fill color. The `hachure` and `crosshatch` styles return open lines in `art.pigmentStrokes`. Stroke these with the fill color. A shape smaller than `hatchGap` receives no hatch lines, so lower the gap for small shapes.

## Options

The fields above are the common ones. The `Style` object accepts the full set:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `looseness` | `number` | `1` | Sets the overall roughness. A value of `0` keeps the path exact. |
| `waver` | `number` | `1` | Controls how much straight lines bow. |
| `maxJitter` | `number` | `2` | Sets the maximum random point offset in pixels. |
| `seed` | `number` | `0` | Sets the deterministic seed. A value of `0` produces random output on each call. |
| `stroke` | `string` | `'#000'` | Sets the outline color. A value of `'none'` skips the stroke layer. |
| `strokeWidth` | `number` | `1` | Sets the outline width in pixels. |
| `singlePass` | `boolean` | `false` | Disables the double-stroke effect and draws one pass. |
| `pinVertices` | `boolean` | `false` | Keeps endpoints exact and jitters the rest of the line. |
| `fill` | `string` | none | Sets the fill color. |
| `pigmentStyle` | `'none' \| 'solid' \| 'hachure' \| 'crosshatch'` | `'none'` | Sets the fill style. Requires a `fill` color. |
| `pigmentRoughnessGain` | `number` | `0.8` | Adds extra looseness to a solid fill pass. |
| `hatchAngle` | `number` | `-41` | Sets the angle of hachure and crosshatch lines in degrees. |
| `hatchGap` | `number` | `-1` | Sets the gap between hatch lines in pixels. A value of `-1` uses `pigmentWidth` times four. |
| `pigmentWidth` | `number` | `-1` | Sets the width of hatch lines in pixels. A value of `-1` uses `strokeWidth` divided by two. |
| `pigmentSinglePass` | `boolean` | `false` | Disables the double-stroke on hatch lines. |
| `fixedDecimals` | `number` | none | Rounds output coordinates to the given number of decimal places. |

## Supported input

kalakar roughens a single SVG path `d` string. It supports the standard path commands `M`, `L`, `H`, `V`, `C`, `S`, `Q`, `T`, `A`, and `Z`, and converts arcs to curves internally. A fixed `seed` produces identical output on every call.

---

MIT License · By [@planetabhi](https://planetabhi.com/) ⋛⋋( ⊙◊⊙)⋌⋚
