import { defineConfig, loadEnv } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'MAZZAROTH_')
  return {
    plugins: [svelte()],
    base: './',
    preview: {
      allowedHosts: (env.MAZZAROTH_PREVIEW_HOSTS ?? '').split(',').map((host) => host.trim()).filter(Boolean),
    },
  }
})
