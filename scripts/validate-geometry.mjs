import { cp, copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

// Run the preserved validators against this app's actual runtime and renderer.
// Temporary CommonJS packaging accommodates the original vendored UMD modules.
const root = new URL('../', import.meta.url)
const temporary = await mkdtemp(join(tmpdir(), 'mazzaroth-geometry-'))
try {
  await mkdir(join(temporary, 'scripts'))
  await cp(new URL('public/runtime/', root), join(temporary, 'dist'), { recursive: true })
  await writeFile(join(temporary, 'package.json'), '{"type":"commonjs"}')
  await copyFile(new URL('src/lib/legacy/renderer.js', root), join(temporary, 'dist/app.js'))
  await copyFile(new URL('public/resources/data.json', root), join(temporary, 'dist/data.json'))
  const tests = new URL('tests/geometry/', root)
  for (const file of (await readdir(tests)).filter((name) => name.endsWith('.mjs')).sort()) {
    const target = join(temporary, 'scripts', file)
    await copyFile(new URL(file, tests), target)
    const result = spawnSync(process.execPath, [target], { stdio: 'inherit' })
    if (result.status !== 0) throw new Error(`${file} failed: ${result.error ?? result.status}`)
  }
} finally {
  await rm(temporary, { recursive: true, force: true })
}
