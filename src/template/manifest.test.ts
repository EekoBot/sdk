import { describe, it, expect } from 'vitest'
import { validateManifest } from './manifest'

describe('validateManifest', () => {
  it('accepts a minimal valid manifest', () => {
    const result = validateManifest({ name: 'My Alert', componentType: 'alert' })
    expect(result.ok).toBe(true)
  })

  it('normalizes missing fields/globalConfig/variantConfig to empties', () => {
    const result = validateManifest({ name: 'My Alert', componentType: 'alert' })
    if (!result.ok) throw new Error('expected ok')
    expect(result.manifest.fields).toEqual([])
    expect(result.manifest.globalConfig).toEqual({})
    expect(result.manifest.variantConfig).toEqual({})
  })

  it('rejects a non-object input', () => {
    const result = validateManifest('not a manifest')
    expect(result.ok).toBe(false)
  })

  it('rejects a manifest with a missing name', () => {
    const result = validateManifest({ componentType: 'alert' })
    if (result.ok) throw new Error('expected failure')
    expect(result.errors.join(' ')).toMatch(/name/i)
  })

  it('rejects a manifest whose componentType is empty', () => {
    const result = validateManifest({ name: 'My Alert', componentType: '' })
    if (result.ok) throw new Error('expected failure')
    expect(result.errors.join(' ')).toMatch(/componentType/i)
  })

  it('rejects a field missing a key', () => {
    const result = validateManifest({
      name: 'My Alert',
      componentType: 'alert',
      fields: [{ label: 'Colour', type: 'color', scope: 'global' }],
    })
    if (result.ok) throw new Error('expected failure')
    expect(result.errors.join(' ')).toMatch(/key/i)
  })

  it('rejects a field with an unknown type', () => {
    const result = validateManifest({
      name: 'My Alert',
      componentType: 'alert',
      fields: [{ key: 'x', label: 'X', type: 'rocketship', scope: 'global' }],
    })
    if (result.ok) throw new Error('expected failure')
    expect(result.errors.join(' ')).toMatch(/type/i)
  })

  it('rejects a field with an invalid scope', () => {
    const result = validateManifest({
      name: 'My Alert',
      componentType: 'alert',
      fields: [{ key: 'x', label: 'X', type: 'text', scope: 'everywhere' }],
    })
    if (result.ok) throw new Error('expected failure')
    expect(result.errors.join(' ')).toMatch(/scope/i)
  })

  it('accepts the full canonical field shape', () => {
    const result = validateManifest({
      name: 'Goal Bar',
      componentType: 'overlay',
      fields: [
        {
          key: 'goalTitle',
          label: 'Goal title',
          type: 'text',
          scope: 'global',
          defaultValue: 'Sub goal',
          required: true,
          category: 'Content',
        },
        {
          key: 'style',
          label: 'Style',
          type: 'select',
          scope: 'variant',
          options: [
            { label: 'Bar', value: 'bar' },
            { label: 'Ring', value: 'ring' },
          ],
        },
      ],
      behavior: { displayDuration: 5000 },
      globalConfig: { goalTitle: 'Sub goal' },
      variantConfig: { style: 'bar' },
    })
    if (!result.ok) throw new Error(result.errors.join(', '))
    expect(result.manifest.fields).toHaveLength(2)
    expect(result.manifest.fields[0].key).toBe('goalTitle')
  })

  it('rejects a field that is not an object', () => {
    const result = validateManifest({
      name: 'My Alert',
      componentType: 'alert',
      fields: ['nope'],
    })
    expect(result.ok).toBe(false)
  })

  it('rejects when fields is present but not an array', () => {
    const result = validateManifest({
      name: 'My Alert',
      componentType: 'alert',
      fields: { key: 'x' },
    })
    expect(result.ok).toBe(false)
  })

  describe('canvas', () => {
    it('accepts and preserves a valid canvas block', () => {
      const result = validateManifest({
        name: 'Vertical alert',
        componentType: 'alert',
        canvas: { width: 1080, height: 1920, preset: 'vertical-1080' },
      })
      if (!result.ok) throw new Error(result.errors.join(', '))
      expect(result.manifest.canvas).toEqual({
        width: 1080,
        height: 1920,
        preset: 'vertical-1080',
      })
    })

    it('omits canvas when absent (legacy widgets)', () => {
      const result = validateManifest({ name: 'A', componentType: 'alert' })
      if (!result.ok) throw new Error('expected ok')
      expect(result.manifest.canvas).toBeUndefined()
    })

    it('rejects a canvas with non-positive dimensions', () => {
      expect(
        validateManifest({ name: 'A', componentType: 'alert', canvas: { width: 0, height: 100 } }).ok
      ).toBe(false)
      expect(
        validateManifest({
          name: 'A',
          componentType: 'alert',
          canvas: { width: 100, height: -5 },
        }).ok
      ).toBe(false)
    })

    it('rejects a canvas that is not an object', () => {
      expect(
        validateManifest({ name: 'A', componentType: 'alert', canvas: '1920x1080' }).ok
      ).toBe(false)
    })

    it('clamps out-of-bounds dimensions to [16, 7680] (matching the server)', () => {
      const big = validateManifest({
        name: 'A',
        componentType: 'alert',
        canvas: { width: 8000, height: 1080 }
      })
      if (!big.ok) throw new Error(big.errors.join(', '))
      expect(big.manifest.canvas).toEqual({ width: 7680, height: 1080 })

      const tiny = validateManifest({
        name: 'A',
        componentType: 'alert',
        canvas: { width: 8, height: 1080 }
      })
      if (!tiny.ok) throw new Error(tiny.errors.join(', '))
      expect(tiny.manifest.canvas).toEqual({ width: 16, height: 1080 })
    })
  })
})
