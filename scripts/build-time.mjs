import { build } from 'vite'
import { fileURLToPath } from 'node:url'

await build({
  configFile: false,
  publicDir: false,
  build: {
    outDir: fileURLToPath(new URL('../public/runtime/', import.meta.url)),
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: fileURLToPath(new URL('../src/lib/astronomy/calendar.ts', import.meta.url)),
      name: 'MazzarothTime',
      formats: ['umd'],
      fileName: () => 'calendar.js',
    },
  },
})
