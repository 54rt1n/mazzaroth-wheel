const scripts = ['vendor/d3.min.js', 'vendor/astronomy.browser.min.js', 'calendar.js', 'observer.js', 'ground-sky.js']
let runtime: Promise<void> | undefined
export function loadRuntime(): Promise<void> {
  if ('MAZZAROTH_RUNTIME_READY' in window && window.MAZZAROTH_RUNTIME_READY) return Promise.resolve()
  return runtime ??= (async () => {
    for (const file of scripts) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = `${import.meta.env.BASE_URL}runtime/${file}`
        script.onload = () => resolve()
        script.onerror = () => reject(new Error(`Could not load sky runtime: ${file}`))
        document.head.append(script)
      })
    }
  })()
}
