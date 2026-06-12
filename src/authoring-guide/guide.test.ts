/**
 * Drift guard for the authoring guide.
 *
 * The guide is assembled from the SDK's own typed constants, so the compiler
 * already forces a catalog entry per event/op. These tests pin the OTHER
 * direction: everything the runtime ships actually surfaces in the rendered
 * markdown — a new event, op, field type, or forbidden pattern cannot be
 * added without the guide documenting it.
 */
import { describe, it, expect } from 'vitest'
import { EVENT_TYPES } from '../events'
import { VERSION } from '../index'
import { ACTION_OPS, ANIMATION_PRESETS, QUEUE_POLICIES, TIMER_TICK } from '../interactions/types'
import { MANIFEST_FIELD_SCOPES, MANIFEST_FIELD_TYPES } from '../template/manifest'
import { AUTHORING_GUIDE, AUTHORING_GUIDE_SECTIONS, AUTHORING_GUIDE_VERSION } from './guide'
import { FORBIDDEN_PATTERNS } from './catalog'

describe('AUTHORING_GUIDE', () => {
  it('is a non-trivial markdown document', () => {
    expect(AUTHORING_GUIDE.length).toBeGreaterThan(5000)
    expect(AUTHORING_GUIDE.startsWith('# ')).toBe(true)
  })

  it('mentions every EVENT_TYPES member verbatim', () => {
    for (const event of EVENT_TYPES) {
      expect(AUTHORING_GUIDE, `guide is missing event \`${event}\``).toContain(event)
    }
  })

  it('mentions the internal timer_tick event', () => {
    expect(AUTHORING_GUIDE).toContain(TIMER_TICK)
  })

  it('mentions every ACTION_OPS member verbatim', () => {
    for (const op of ACTION_OPS) {
      expect(AUTHORING_GUIDE, `guide is missing op \`${op}\``).toContain(op)
    }
  })

  it('mentions every FORBIDDEN_PATTERNS pattern verbatim', () => {
    for (const { pattern } of FORBIDDEN_PATTERNS) {
      expect(AUTHORING_GUIDE, `guide is missing forbidden pattern \`${pattern}\``).toContain(
        pattern
      )
    }
  })

  it('mentions every MANIFEST_FIELD_TYPES member verbatim', () => {
    for (const type of MANIFEST_FIELD_TYPES) {
      expect(AUTHORING_GUIDE, `guide is missing field type \`${type}\``).toContain(type)
    }
  })

  it('mentions every MANIFEST_FIELD_SCOPES member verbatim', () => {
    for (const scope of MANIFEST_FIELD_SCOPES) {
      expect(AUTHORING_GUIDE, `guide is missing field scope \`${scope}\``).toContain(scope)
    }
  })

  it('mentions every animation preset and queue policy verbatim', () => {
    for (const preset of ANIMATION_PRESETS) {
      expect(AUTHORING_GUIDE, `guide is missing preset \`${preset}\``).toContain(preset)
    }
    for (const policy of QUEUE_POLICIES) {
      expect(AUTHORING_GUIDE, `guide is missing queue policy \`${policy}\``).toContain(policy)
    }
  })

  it('has no unresolved template interpolations', () => {
    expect(AUTHORING_GUIDE).not.toContain('${')
  })

  it('AUTHORING_GUIDE_VERSION equals the SDK VERSION and appears in the guide', () => {
    expect(AUTHORING_GUIDE_VERSION).toBe(VERSION)
    expect(AUTHORING_GUIDE).toContain(VERSION)
  })
})

describe('AUTHORING_GUIDE_SECTIONS', () => {
  const EXPECTED_IDS = [
    'the-widget-contract',
    'the-manifest',
    'two-phase-tokens',
    'declarative-interactions',
    'archetype-recipes',
    'the-sdk-escape-hatch',
    'styling-rules',
    'assets',
    'forbidden-patterns',
    'local-testing',
  ]

  it('exposes exactly the expected section ids', () => {
    expect(Object.keys(AUTHORING_GUIDE_SECTIONS).sort()).toEqual([...EXPECTED_IDS].sort())
  })

  it('every section is non-empty and present verbatim in the full guide', () => {
    for (const [id, body] of Object.entries(AUTHORING_GUIDE_SECTIONS)) {
      expect(id.length, 'empty section id').toBeGreaterThan(0)
      expect(body.trim().length, `section \`${id}\` is empty`).toBeGreaterThan(0)
      expect(AUTHORING_GUIDE, `section \`${id}\` body not found in the full guide`).toContain(body)
      expect(AUTHORING_GUIDE, `section anchor \`#${id}\` not found in the full guide`).toContain(
        `{#${id}}`
      )
    }
  })
})
