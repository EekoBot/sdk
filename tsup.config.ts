import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/payloads/index.ts',
    'src/template/index.ts',
    'src/template/node.ts',
    'src/runtime-bridge.ts',
    'src/interactions/index.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
})
