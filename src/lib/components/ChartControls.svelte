<script lang="ts">
  import { atlas } from '../state.svelte'
  let { onchange }: { onchange: () => void } = $props()
</script>

<section id="sky-controls" class="chart-controls" aria-label="Chart display" hidden={atlas.view === 'register'}>
  <div class="chart-controls-heading">
    <h3>Chart controls</h3>
    <button id="toggle-labels" class="small-button label-toggle" aria-pressed={atlas.labels}>Labels on</button>
  </div>

  <div hidden={atlas.view !== 'blend'}>
    <div class="chart-layer-groups">
      <fieldset class="chart-control-group" aria-label="Atlas layers">
        <legend>Layers</legend>
        <div class="chart-checks">
          <label><input type="checkbox" checked={atlas.wheelLayer} onchange={(event) => { atlas.wheelLayer = event.currentTarget.checked; onchange() }}> Calendar wheel</label>
          <label><input type="checkbox" checked={atlas.catalogueLayer} onchange={(event) => { atlas.catalogueLayer = event.currentTarget.checked; onchange() }}> Catalogue sky</label>
        </div>
      </fieldset>
      <fieldset class="chart-control-group">
        <legend>Sky details</legend>
        <div class="chart-checks">
          <label><input type="checkbox" id="background-stars" checked={atlas.background} disabled={!atlas.catalogueLayer}> Catalogue background</label>
          <label><input type="checkbox" id="reference-stars" checked={atlas.references} disabled={!atlas.catalogueLayer}> Reference stars</label>
          <label><input type="checkbox" id="show-grid" checked={atlas.grid}> Coordinate grid</label>
        </div>
      </fieldset>
    </div>

    <fieldset id="blend-controls" class="chart-control-group chart-adjustments">
      <legend>Orientation &amp; overlay</legend>
      <div class="chart-slider-grid">
        <label for="wheel-rotation">
          <span>Wheel angle <output id="wheel-rotation-value" for="wheel-rotation">{atlas.wheelRotation}°</output></span>
          <input type="range" id="wheel-rotation" min="0" max="360" value={atlas.wheelRotation} step="1" disabled={!atlas.wheelLayer}>
        </label>
        <label for="rotation">
          <span>Sky angle <output id="rotation-value" for="rotation">{atlas.rotation}°</output></span>
          <input type="range" id="rotation" min="0" max="360" value={atlas.rotation} step="1">
        </label>
        <label for="wheel-opacity">
          <span>Overlay strength <output id="wheel-opacity-value" for="wheel-opacity">{Math.round(atlas.wheelOpacity * 100)}%</output></span>
          <input type="range" id="wheel-opacity" min="10" max="100" value={atlas.wheelOpacity * 100} step="1" disabled={!atlas.wheelLayer}>
        </label>
      </div>
    </fieldset>

    <p class="chart-selection-hint">Select a name to trace its calendar slot to the sky.</p>

    <div class="chart-control-footer">
      <div class="chart-control-actions">
        <button class="small-button" id="center-pole">Reset sky orientation</button>
        <button class="small-button" id="pole-closeup" aria-expanded="false" aria-controls="pole-inset">Centre close-up</button>
      </div>
      <span id="sky-omissions"></span>
    </div>
  </div>
</section>

<style>
  .chart-controls {
    margin: 18px 22px;
    border: 1px solid #304155;
    border-radius: 9px;
    background: #0e1927;
    color: #c3cedd;
    overflow: hidden;
  }
  .chart-controls-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 15px 18px;
    border-bottom: 1px solid #29394b;
  }
  .chart-controls-heading h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    color: #e0e6ee;
  }
  .chart-controls .label-toggle {
    min-width: 85px;
    padding: 8px 12px;
    border-color: #4e5260;
    color: #c4ccd8;
  }
  .chart-controls .label-toggle[aria-pressed='true'] {
    color: #e2c58f;
    border-color: #756343;
    background: #d5ae6d10;
  }
  .chart-layer-groups {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    gap: 24px;
    padding: 20px 18px;
  }
  .chart-control-group {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .chart-control-group legend {
    margin-bottom: 10px;
    padding: 0;
    font-size: 11px;
    font-weight: 500;
    color: #92a6be;
  }
  .chart-checks {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 18px;
  }
  .chart-checks label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    font-size: 11px;
    line-height: 1.4;
    cursor: pointer;
  }
  .chart-checks input {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    margin: 0;
    accent-color: #d5ae6d;
    cursor: pointer;
  }
  .chart-checks label:has(input:disabled) {
    color: #66798f;
    cursor: default;
  }
  .chart-checks input:disabled { cursor: default; }
  .chart-adjustments {
    margin: 0 18px;
    padding-top: 16px;
    border-top: 1px solid #29394b;
  }
  .chart-adjustments legend {
    float: left;
    width: 100%;
    margin-bottom: 14px;
  }
  .chart-slider-grid {
    clear: both;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 24px;
    padding-bottom: 18px;
  }
  .chart-slider-grid label { min-width: 0; }
  .chart-slider-grid label > span {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    font-size: 11px;
    line-height: 1.5;
  }
  .chart-slider-grid output {
    color: #d7b778;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .chart-slider-grid input {
    display: block;
    width: 100%;
    height: 28px;
    margin: 8px 0 0;
    accent-color: #d5ae6d;
    cursor: pointer;
  }
  .chart-slider-grid label:has(input:disabled) { opacity: 0.45; }
  .chart-slider-grid input:disabled { cursor: default; }
  .chart-selection-hint {
    margin: 0;
    padding: 0 18px 16px;
    color: #8397af;
    font-size: 10px;
    line-height: 1.6;
  }
  .chart-control-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 20px;
    padding: 14px 18px;
    border-top: 1px solid #29394b;
    background: #0a1420;
  }
  .chart-control-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  #sky-omissions {
    color: #8397af;
    font-size: 10px;
    line-height: 1.6;
  }
  @media (max-width: 1100px) {
    .chart-layer-groups { grid-template-columns: 1fr; gap: 16px; }
  }
  @media (max-width: 600px) {
    .chart-controls { margin: 14px 10px; }
    .chart-controls-heading { padding: 12px 14px; }
    .chart-layer-groups { padding: 16px 14px; }
    .chart-adjustments { margin: 0 14px; }
    .chart-slider-grid { grid-template-columns: 1fr; gap: 14px; }
    .chart-checks label { min-height: 38px; }
    .chart-control-footer { padding: 12px 14px; }
    .chart-control-actions { width: 100%; }
    .chart-control-actions button { flex: 1; min-height: 40px; }
  }
</style>
