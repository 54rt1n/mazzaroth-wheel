import type { AtlasState, View } from '../state.svelte'
export interface Renderer {
  start(): Promise<void>
  refresh(): void
  setView(view: View): void
  destroy(): void
}
export function createRenderer(state: AtlasState): Renderer
