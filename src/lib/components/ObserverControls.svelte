<script lang="ts">
  import PoleSelector from './PoleSelector.svelte'
  import BrightnessFilter from './BrightnessFilter.svelte'
  import { atlas } from '../state.svelte'
  let { onchange }: { onchange: () => void } = $props()
</script>
<section id="observer-controls" class="observer-controls" aria-label="Observer readout controls">
 <PoleSelector />
 <div hidden={atlas.view === 'register'}><BrightnessFilter {onchange} /></div>
 <div class="observer-heading"><label class="observer-switch"><input id="observer-enabled" type="checkbox" checked> Observer readout</label><fieldset class="reading-period"><legend class="sr-only">Reading period</legend><label><input type="radio" name="reading-period" value="morning" checked> Morning</label><label><input type="radio" name="reading-period" value="evening"> Evening</label></fieldset></div>
 <div id="observer-fields"><div class="observer-inputs">
  <label>Place<select id="observer-place" aria-label="Place"><option value="babylon">Babylon</option><option value="assur">Assur</option><option value="custom">Custom</option></select></label>
  <label>Latitude (0–89.9°N)<input id="observer-latitude" type="number" min="0" max="89.9" step="0.01" value="32.54" title="Northern latitudes only"></label>
  <label>Longitude (°E)<input id="observer-longitude" type="number" min="-180" max="180" step="0.01" value="44.42"></label>
 </div>
 <div class="season-control"><label for="observer-calendarDay">Nominal calendar · 12 × 30 days</label><output id="observer-calendar-value">Duʾūzu / Tammuz · 1</output><div class="calendar-inputs"><label>Month<select id="observer-calendar-month"></select></label><label>Day<input id="observer-calendar-day" type="number" min="1" max="30" step="1" value="1"></label></div><input id="observer-calendarDay" type="range" min="0" max="359" step="1" value="90" aria-describedby="observer-calendar-scale"><div class="season-marks"><button data-calendar-day="0">I · Nisan</button><button data-calendar-day="90">IV · Tammuz</button><button data-calendar-day="180">VII · Tishrei</button><button data-calendar-day="270">X · Tevet</button></div></div>
 <details class="reading-settings"><summary>Reading time &amp; calibration</summary><div class="reading-grid"><label>Timing rule<select id="observer-timing" aria-label="Timing rule"><option value="solar">Sun below horizon</option><option value="culmination">Timing star at culmination</option></select></label><label id="observer-twilight-label">Sun altitude (°)<input id="observer-twilight" type="number" min="-18" max="-1" step="1" value="-9"></label><label id="observer-target-label" hidden>Timing star<select id="observer-target" aria-label="Timing star"></select></label></div><p>−9° is an adjustable test setting, not a prescribed ancient hour. A timing star sets the meridian reading; the Sun’s resulting altitude becomes a check. The assumed pole has no unique culmination and cannot be a timing star.</p></details>
 <div class="observer-model-readout">
 <p class="observer-status" id="observer-status" role="status"></p><p class="observer-help">365 elapsed days → 360 nominal days. Nisannu / Nisan 1 starts at the spring equinox of the selected rotation axis.</p>
 <p id="observer-pole-model" class="observer-help" hidden></p>
 <p id="observer-calendar-scale" class="calendar-scale"></p>
 </div>
 </div>
 <div class="observer-legend"><span><i class="horizon-key"></i>Horizon · 0°</span><span><i class="meridian-key"></i>Local meridian · through zenith</span><span><i class="altitude-key"></i>6° altitude guide</span><span>Dim stars lie below the horizon</span></div>
</section>
