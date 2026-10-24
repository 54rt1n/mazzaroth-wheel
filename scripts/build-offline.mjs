import { readFile, writeFile } from 'node:fs/promises'

const root = new URL('../dist/', import.meta.url)
const read = (file) => readFile(new URL(file, root), 'utf8')
const script = (code, module = false) => `<script${module ? ' type="module"' : ''}>${code.replaceAll('</', '<\\/')}</script>`
let html = await read('index.html')
const favicon = Buffer.from(await read('favicon.svg')).toString('base64')
html = html.replace(/<link rel="icon"[^>]*>/, () => `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${favicon}" />`)
const entry = html.match(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/)
const css = html.match(/<link[^>]*href="([^"]+\.css)"[^>]*>/)
if (!entry || !css) throw new Error('Expected one Vite entry script and stylesheet.')
const localPath = (path) => path.replace(/^\.\//, '')
const javascript = await read(localPath(entry[1]))
let stylesheet = await read(localPath(css[1]))
const stylesheetURL = new URL(localPath(css[1]), root)
for (const match of stylesheet.matchAll(/url\(["']?([^"')]+\.woff2)["']?\)/g)) {
  const font = await readFile(new URL(match[1], stylesheetURL))
  stylesheet = stylesheet.replace(match[0], () => `url(data:font/woff2;base64,${font.toString('base64')})`)
}
const fontLicense = await read('fonts/nordwand-mono/LICENSE-FONT.txt')
stylesheet = `/* Nordwand Mono font license\n${fontLicense.replaceAll('*/', '* /')}\n*/\n${stylesheet}`
html = html.replace(entry[0], '').replace(css[0], () => `<style>${stylesheet}</style>`)

const parts = []
for (const file of ['vendor/d3.min.js', 'vendor/astronomy.browser.min.js', 'calendar.js', 'observer.js', 'ground-sky.js']) {
  parts.push(script(await read(`runtime/${file}`)))
}
const json = (value) => JSON.stringify(value).replaceAll('<', '\\u003c')
parts.push(script(`window.MAZZAROTH_DATA=${json(JSON.parse(await read('resources/data.json')))};window.MAZZAROTH_CONSTELLATIONS=${json(JSON.parse(await read('resources/constellations.json')))};window.MAZZAROTH_RUNTIME_READY=true;`))
// Keep provenance archives and coordinate downloads available in the offline file.
const downloads = {}
for (const [file, type] of [
  ['resources/constellation-sources.zip', 'application/zip'], ['resources/star-coordinates.csv', 'text/csv'],
  ['LICENSE', 'text/plain'], ['NOTICE', 'text/plain'], ['THIRD_PARTY_NOTICES.txt', 'text/plain'],
]) {
  const bytes = await readFile(new URL(file, root))
  downloads[file] = { type, base64: bytes.toString('base64') }
}
parts.push(script(`const downloads=${json(downloads)};
document.addEventListener('click',event=>{
  const anchor=event.target.closest?.('a[download]');if(!anchor)return;
  if(anchor.getAttribute('href')==='mazzaroth-wheel.html'){event.preventDefault();return;}
  const href=anchor.getAttribute('href');
  const dataset=href==='resources/data.json'?window.MAZZAROTH_DATA:href==='resources/constellations.json'?window.MAZZAROTH_CONSTELLATIONS:null;
  const item=downloads[href];if(!dataset&&!item)return;
  event.preventDefault();const bytes=dataset?JSON.stringify(dataset):Uint8Array.from(atob(item.base64),c=>c.charCodeAt(0));
  const url=URL.createObjectURL(new Blob([bytes],{type:dataset?'application/json':item.type}));const link=document.createElement('a');
  link.href=url;link.download=anchor.getAttribute('href').split('/').pop();link.click();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
});`))
parts.push(script(javascript, true))
// A replacement callback preserves literal $ sequences inside vendored code.
html = html.replace('</body>', () => `${parts.join('\n')}\n</body>`)
await writeFile(new URL('mazzaroth-wheel.html', root), html)
console.log(`Offline atlas: ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB`)
