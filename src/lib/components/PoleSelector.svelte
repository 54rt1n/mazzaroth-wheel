<script lang="ts">
  import { atlas } from '../state.svelte'
</script>
<fieldset id="center-controls" class="center-controls">
  <legend>Rotation pole &amp; epoch</legend>
  <div class="pole-epoch-row">
    <div class="center-options">
      <label><input type="radio" name="projection-center" value="ncp" checked={atlas.poleChoice === 'ncp'}> Celestial pole</label>
      <label><input type="radio" name="projection-center" value="polaris" checked={atlas.poleChoice === 'polaris'}> Polaris</label>
      <label><input type="radio" name="projection-center" value="thuban" checked={atlas.poleChoice === 'thuban'}> Thuban</label>
      <label><input type="radio" name="projection-center" value="kochab" checked={atlas.poleChoice === 'kochab'}> Kochab</label>
      <label><input type="radio" name="projection-center" value="custom" checked={atlas.poleChoice === 'custom'}> Custom</label>
    </div>
    <div class="epoch-fields">
      <label for="observer-year">Year</label>
      <input id="observer-year" aria-label="Epoch year" type="number" min="1" max="3000" step="1" value="1200">
      <label class="sr-only" for="observer-era">Era</label>
      <select id="observer-era" aria-label="Era"><option value="bce">BCE</option><option value="ce">CE</option></select>
    </div>
  </div>
</fieldset>

<style>
  .pole-epoch-row { display: flex; align-items: center; flex-wrap: wrap; gap: 14px 28px; }
  .epoch-fields { display: flex; align-items: center; gap: 8px; }
  .epoch-fields > label { font-size: 11px; color: #aebed3; }
  #observer-year { width: 7rem; font-variant-numeric: tabular-nums; }
  #observer-era { width: 5rem; }
</style>
