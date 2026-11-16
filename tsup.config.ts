import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/core.ts'],
  format: ['esm'],
  dts: false,
  clean: true,
  treeshake: true,
  sourcemap: false,
  target: 'es2022',
});
