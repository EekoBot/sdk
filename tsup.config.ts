import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/payloads/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
})
