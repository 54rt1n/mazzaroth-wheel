<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { atlas, pages } from './lib/state.svelte'
  import { loadRuntime } from './lib/runtime'
  import { createRenderer, type Renderer } from './lib/legacy/renderer.js'
  import AtlasPage from './lib/pages/AtlasPage.svelte'
  import GroundSkyPage from './lib/pages/GroundSkyPage.svelte'
  import RegisterPage from './lib/pages/RegisterPage.svelte'
  import SharedFilters from './lib/components/SharedFilters.svelte'
  import ChartControls from './lib/components/ChartControls.svelte'
  import PoleCalibration from './lib/components/PoleCalibration.svelte'
  import EntryDetail from './lib/components/EntryDetail.svelte'
  import SourcesDialog from './lib/components/SourcesDialog.svelte'
  import Introduction from './lib/components/Introduction.svelte'
  import Footer from './lib/components/Footer.svelte'

  let renderer: Renderer | undefined
  let ready = $state(false)
  let error = $state('')
  const refresh = () => renderer?.refresh()

  async function route() {
    const path = location.hash.replace(/^#\/?/, '')
    const page = pages.find((item) => item.page === path) ?? pages[0]
    atlas.view = page.view
    await tick()
    if (ready) renderer?.setView(page.view)
  }

  onMount(() => {
    let disposed = false
    window.addEventListener('hashchange', route)
    void (async () => {
      await route()
      try {
        await loadRuntime()
        if (disposed) return
        renderer = createRenderer(atlas)
        await renderer.start()
        if (disposed) { renderer.destroy(); return }
        ready = true
      } catch (cause) {
        if (!disposed) error = cause instanceof Error ? cause.message : String(cause)
      }
    })()
    return () => {
      disposed = true
      window.removeEventListener('hashchange', route)
      renderer?.destroy()
    }
  })
</script>

<a class="skip-link" href="#explorer" onclick={(event) => {
  event.preventDefault()
  document.getElementById('explorer')?.focus()
  document.getElementById('explorer')?.scrollIntoView()
}}>Skip to star explorer</a>
<header class="masthead">
  <a class="brand" href="#/atlas" aria-label="Mazzaroth home">
    <svg viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r="18"></circle><circle cx="21" cy="21" r="11"></circle><circle cx="21" cy="21" r="3"></circle><path d="M21 0v9M21 33v9M0 21h9M33 21h9"></path></svg>
    <span>MAZZAROTH<small>A CELESTIAL RESEARCH ATLAS</small></span>
  </a>
  <button class="text-button" id="open-sources">Sources &amp; method ↗</button>
</header>
<main>
  <Introduction />
  {#if error}<p class="app-error" role="alert">The atlas could not start: {error}. Reload to try again.</p>{/if}
  <section id="explorer" class="explorer" tabindex="-1" aria-label="Interactive celestial explorer" aria-busy={!ready}>
    <div class="explorer-toolbar">
      <nav class="page-nav" aria-label="Atlas pages">
        {#each pages as page}
          <a href={'#/' + page.page} aria-current={atlas.view === page.view ? 'page' : undefined}>{page.label}</a>
        {/each}
      </nav>
      <div class="toolbar-meta"><span id="frame-label"></span><button class="icon-button" id="reset" title="Reset view and filters" aria-label="Reset view and filters" disabled={!ready}>↺</button><button class="small-button" id="export-svg" disabled={!ready}>Export SVG ↓</button></div>
    </div>
    <fieldset class="application-controls" disabled={!ready}>
      <legend class="sr-only">Atlas controls and pages</legend>
      <SharedFilters onchange={refresh} />
      <div class="explorer-body">
        <div class="chart-column" id="chart-panel">
          <div class="chart-topline"><span class="live-count" id="count-label" aria-live="polite">Loading catalogue…</span></div>
          <!-- Keep render surfaces mounted to retain cameras and their listeners. -->
          <div hidden={atlas.view !== 'blend'}><AtlasPage /></div>
          <div hidden={atlas.view !== 'ground'}><GroundSkyPage /></div>
          <div hidden={atlas.view !== 'register'}><RegisterPage /></div>
          <ChartControls onchange={refresh} />
          <div hidden={atlas.view !== 'blend'}><PoleCalibration /></div>
          <div class="chart-foot" hidden={atlas.view === 'register'}><p id="chart-explanation"></p></div>
        </div>
        <EntryDetail />
      </div>
    </fieldset>
  </section>
  <Footer />
</main>
<SourcesDialog />
