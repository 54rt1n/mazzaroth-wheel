<script lang="ts">
  import { atlas } from '../state.svelte'
  let { onchange }: { onchange: () => void } = $props()
</script>
<label class="search-box">
  <span class="sr-only">Search celestial names</span>
  <input id="search" type="search" placeholder="Search an ancient or modern name…"
    value={atlas.search} oninput={(event) => { atlas.search = event.currentTarget.value; onchange() }}>
</label>
