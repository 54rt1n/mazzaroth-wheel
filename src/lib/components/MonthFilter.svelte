<script lang="ts">
  import { atlas, months } from '../state.svelte'
  let { onchange }: { onchange: () => void } = $props()
</script>
<label class="month-select"><span>Month</span>
  <select id="month-filter" value={atlas.month}
    onchange={(event) => { atlas.month = +event.currentTarget.value; onchange() }}>
    <option value={0}>All twelve months</option>
    {#each months as month, index}<option value={index + 1}>{month}</option>{/each}
  </select>
</label>
