import { copyFile, readFile, writeFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
await copyFile(new URL('LICENSE', root), new URL('public/LICENSE', root))
await copyFile(new URL('NOTICE', root), new URL('public/NOTICE', root))
await copyFile(new URL('node_modules/svelte/LICENSE.md', root), new URL('public/runtime/vendor/LICENSE-svelte.txt', root))
const sections = [await readFile(new URL('NOTICE', root), 'utf8'), await readFile(new URL('THIRD_PARTY_NOTICES.md', root), 'utf8')]
for (const [name, file] of [
  ['Svelte', 'public/runtime/vendor/LICENSE-svelte.txt'],
  ['D3', 'public/runtime/vendor/LICENSE-d3.txt'],
  ['Astronomy Engine', 'public/runtime/vendor/LICENSE-astronomy.txt'],
  ['Nordwand Mono', 'public/fonts/nordwand-mono/LICENSE-FONT.txt'],
]) {
  sections.push(`\n## ${name}\n\n${await readFile(new URL(file, root), 'utf8')}`)
}
await writeFile(new URL('public/THIRD_PARTY_NOTICES.txt', root), sections.join('\n'))
