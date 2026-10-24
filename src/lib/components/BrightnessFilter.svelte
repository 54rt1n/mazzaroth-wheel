<script lang="ts">
  import { atlas } from '../state.svelte'
  let { onchange }: { onchange: () => void } = $props()
</script>

<div id="brightness-controls" class="brightness-controls">
  <div class="brightness-heading">
    <label for="magnitude-limit">Brightness cutoff</label>
    <div class="brightness-readouts">
      <output id="magnitude-value" for="magnitude-limit">≤ 6.5 mag</output>
      <span id="brightness-count" aria-live="polite"></span>
    </div>
  </div>
  <input type="range" id="magnitude-limit" min="-1.5" max="6.5" value={atlas.magnitudeLimit}
    oninput={(event) => { atlas.magnitudeLimit = +event.currentTarget.value; onchange() }}
    step="0.1" aria-describedby="brightness-count">
  <div class="brightness-scale"><span>Brighter stars</span><span>Include fainter stars</span></div>
</div>

<style>
  .brightness-heading { flex-wrap: wrap; gap: 8px 16px; }
  .brightness-readouts { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; }
  #brightness-count { color: #8f9fb4; font-size: 10px; line-height: 1.5; }
</style>
