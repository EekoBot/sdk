import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/payloads/index.ts',
    'src/template/index.ts',
    'src/template/node.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
})
