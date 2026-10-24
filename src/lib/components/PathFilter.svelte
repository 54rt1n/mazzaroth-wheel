<script lang="ts">
  import { atlas, type Path } from '../state.svelte'
  let { onchange }: { onchange: () => void } = $props()
  const paths: Path[] = ['all', 'Enlil', 'Anu', 'Ea']
</script>
<div class="path-filters" role="group" aria-label="Filter by path">
  {#each paths as path}
    <button class="path-chip" class:active={atlas.path === path}
      data-path={path} aria-pressed={atlas.path === path}
      onclick={() => { atlas.path = path; onchange() }}>
      {#if path !== 'all'}<i class={path.toLowerCase()}></i>{/if}
      {path === 'all' ? 'All paths' : path}
    </button>
  {/each}
</div>
