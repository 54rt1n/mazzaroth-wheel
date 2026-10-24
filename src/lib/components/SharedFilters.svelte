<script lang="ts">
  import { atlas } from '../state.svelte'
  import SearchFilter from './SearchFilter.svelte'
  import MonthFilter from './MonthFilter.svelte'
  import PathFilter from './PathFilter.svelte'
  import ObserverControls from './ObserverControls.svelte'
  let { onchange }: { onchange: () => void } = $props()
</script>
<section class="shared-filters" aria-label="Shared filters and observer settings">
  <div hidden={atlas.view === 'ground'}>
    <div class="chart-topline"><PathFilter {onchange} /></div>
    <div class="register-tools shared-entry-filters"><SearchFilter {onchange} /><MonthFilter {onchange} /></div>
  </div>
  <details class="shared-observer" open hidden={atlas.view === 'register'}>
    <summary>Observer, epoch &amp; reading time</summary>
    <ObserverControls {onchange} />
  </details>
</section>
