import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildConfigFromFields, loadManifest, loadTemplateFiles } from './loader'
import type { ManifestField } from './manifest'

describe('buildConfigFromFields', () => {
  const fields: ManifestField[] = [
    { key: 'goalTitle', label: 'Title', type: 'text', scope: 'global', defaultValue: 'My Goal' },
    { key: 'progress', label: 'Progress', type: 'number', scope: 'variant', defaultValue: 0 },
    { key: 'accent', label: 'Accent', type: 'color', scope: 'both', defaultValue: '#fff' },
  ]

  it('keys config by field.key', () => {
    expect(buildConfigFromFields(fields)).toEqual({
      goalTitle: 'My Goal',
      progress: 0,
      accent: '#fff',
    })
  })

  it('includes both-scoped fields in the global scope', () => {
    expect(buildConfigFromFields(fields, 'global')).toEqual({
      goalTitle: 'My Goal',
      accent: '#fff',
    })
  })

  it('includes both-scoped fields in the variant scope', () => {
    expect(buildConfigFromFields(fields, 'variant')).toEqual({
      progress: 0,
      accent: '#fff',
    })
  })

  it('omits fields without a default value', () => {
    const f: ManifestField[] = [{ key: 'x', label: 'X', type: 'text', scope: 'global' }]
    expect(buildConfigFromFields(f)).toEqual({})
  })
})

describe('loadManifest / loadTemplateFiles', () => {
  let dir: string
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'eeko-sdk-'))
    await writeFile(
      join(dir, 'widget.json'),
      JSON.stringify({ name: 'T', componentType: 'alert', fields: [] })
    )
    await writeFile(join(dir, 'index.html'), '<div>hi</div>')
    await writeFile(join(dir, 'styles.css'), '.x{}')
    await writeFile(join(dir, 'script.js'), 'console.log(1)')
  })
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('loadManifest reads and validates widget.json', async () => {
    const m = await loadManifest(dir)
    expect(m.name).toBe('T')
    expect(m.componentType).toBe('alert')
  })

  it('loadManifest throws on an invalid manifest', async () => {
    const bad = await mkdtemp(join(tmpdir(), 'eeko-sdk-bad-'))
    await writeFile(join(bad, 'widget.json'), JSON.stringify({ componentType: 'alert' }))
    await expect(loadManifest(bad)).rejects.toThrow(/name/i)
    await rm(bad, { recursive: true, force: true })
  })

  it('loadTemplateFiles reads index.html, styles.css and script.js', async () => {
    const files = await loadTemplateFiles(dir)
    expect(files.html).toBe('<div>hi</div>')
    expect(files.css).toBe('.x{}')
    expect(files.js).toBe('console.log(1)')
  })
})
