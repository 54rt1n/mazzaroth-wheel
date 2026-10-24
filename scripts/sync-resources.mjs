import { editResourceCopy } from './resource-copy.mjs'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'

const source = new URL('../.data/', import.meta.url)
const destination = new URL('../public/resources/', import.meta.url)
const names = ['data.json', 'constellations.json']
const downloads = ['constellation-sources.zip', 'star-coordinates.csv']
const check = process.argv.includes('--check')

// Parse both inputs and apply presentation edits before replacing snapshots.
const inputs = await Promise.all(names.map(async (name) => JSON.parse(await readFile(new URL(name, source), 'utf8'))))
const { data, constellations } = editResourceCopy(...inputs)
const edited = [data, constellations]

await mkdir(destination, { recursive: true })
for (const [index, name] of names.entries()) {
  const content = JSON.stringify(edited[index])
  if (check) {
    if (await readFile(new URL(name, destination), 'utf8') !== content) throw new Error(`Packaged resource differs: ${name}; run npm run resources:build`)
  } else await writeFile(new URL(name, destination), content)
  console.log(`${check ? 'Verified' : 'Packaged'} resources/${name}`)
}
for (const name of downloads) {
  if (check) {
    const input = await readFile(new URL(name, source))
    if (!input.equals(await readFile(new URL(name, destination)))) throw new Error(`Packaged resource differs: ${name}; run npm run resources:build`)
  } else await copyFile(new URL(name, source), new URL(name, destination))
  console.log(`${check ? 'Verified' : 'Packaged'} resources/${name}`)
}
