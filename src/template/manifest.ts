/**
 * @eeko/sdk - Widget Manifest Schema (`widget.json`)
 *
 * The canonical shape of a widget's `widget.json` manifest, mirrored from the
 * server's `ComponentFieldDefinition` (`@live-alerts/shared-types/components`)
 * so a widget validated locally (via `eeko build`) validates the same way the
 * nexus-api accepts it on commit.
 *
 * This module is browser-safe (no Node APIs, zero runtime deps). The matching
 * `loadManifest()` file loader lives in `./loader` (Node-only).
 */

/**
 * Field input types. Mirrors `ComponentFieldType` on the server. `image`,
 * `audio`, and `video` values are `eeko-asset://<id>` references resolved by
 * the widget-host at serve time.
 */
import type { WidgetInteractions } from '../interactions/types'

export const MANIFEST_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'color',
  'select',
  'boolean',
  'url',
  'image',
  'audio',
  'video',
  'font',
  'json',
] as const
export type ManifestFieldType = (typeof MANIFEST_FIELD_TYPES)[number]

/**
 * Where a field's value is applied. `global` bakes at serve time; `variant`
 * is substituted per trigger; `both` participates in either scope.
 */
export const MANIFEST_FIELD_SCOPES = ['global', 'variant', 'both'] as const
export type ManifestFieldScope = (typeof MANIFEST_FIELD_SCOPES)[number]

/** A choice for a `select` field. */
export interface ManifestFieldOption {
  label: string
  value: string | number | boolean
}

/**
 * A single configurable field on a widget. Mirrors `ComponentFieldDefinition`.
 */
export interface ManifestField {
  key: string
  label: string
  type: ManifestFieldType
  scope: ManifestFieldScope
  defaultValue?: unknown
  required?: boolean
  min?: number
  max?: number
  step?: number
  options?: ManifestFieldOption[]
  placeholder?: string
  helpText?: string
  category?: string
  /** For image/audio/video fields: MIME prefixes the asset picker restricts to. */
  mimeFilter?: string[]
  /** UI hint for asset-bearing fields. */
  assetDisplay?: 'inline' | 'compact'
}

/**
 * The widget's design surface — the fixed pixel canvas the author works
 * against. Orientation is derived from width vs height (never stored). The
 * runtime bridge pins the widget root to these dimensions and zoom-to-fits it
 * into whatever viewport the iframe is given.
 */
export interface WidgetCanvas {
  /** Design width in CSS px. */
  width: number
  /** Design height in CSS px. */
  height: number
  /** Optional id of the preset the author picked, for UI round-trip. */
  preset?: string
}

/**
 * The full `widget.json` manifest. `globalConfig`/`variantConfig` carry the
 * serve-time default values keyed by field `key`.
 */
export interface WidgetManifest {
  name: string
  componentType: string
  fields: ManifestField[]
  behavior?: Record<string, unknown>
  /**
   * Optional declarative behaviour. Interpreted by the SDK interaction runtime
   * (see `../interactions/types`). Absent on legacy/hand-coded widgets; the
   * runtime no-ops when it isn't present. The authoritative schema validation
   * lives in nexus-api on commit — this is only a structural pre-flight.
   */
  interactions?: WidgetInteractions
  /**
   * Optional design surface (size + orientation). Absent on legacy widgets,
   * which the host treats as a default 1920×1080 landscape canvas.
   */
  canvas?: WidgetCanvas
  globalConfig: Record<string, unknown>
  variantConfig: Record<string, unknown>
}

export type ValidateManifestResult =
  | { ok: true; manifest: WidgetManifest }
  | { ok: false; errors: string[] }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Structurally validate a parsed `widget.json` manifest. Returns the
 * normalized manifest (with `fields`/`globalConfig`/`variantConfig` defaulted
 * to empties) on success, or the full list of problems on failure.
 *
 * This is a fast developer-facing pre-flight; the nexus-api remains the
 * authoritative validator on commit.
 */
export function validateManifest(input: unknown): ValidateManifestResult {
  const errors: string[] = []

  if (!isPlainObject(input)) {
    return { ok: false, errors: ['manifest must be a JSON object'] }
  }

  const name = input.name
  if (typeof name !== 'string' || name.trim() === '') {
    errors.push('`name` is required and must be a non-empty string')
  }

  const componentType = input.componentType
  if (typeof componentType !== 'string' || componentType.trim() === '') {
    errors.push('`componentType` is required and must be a non-empty string')
  }

  const rawFields = input.fields
  const fields: ManifestField[] = []
  if (rawFields !== undefined) {
    if (!Array.isArray(rawFields)) {
      errors.push('`fields` must be an array')
    } else {
      rawFields.forEach((field, i) => {
        if (!isPlainObject(field)) {
          errors.push(`fields[${i}] must be an object`)
          return
        }
        if (typeof field.key !== 'string' || field.key.trim() === '') {
          errors.push(`fields[${i}]: missing or empty "key"`)
        }
        if (typeof field.label !== 'string' || field.label.trim() === '') {
          errors.push(`fields[${i}] (${String(field.key)}): missing or empty "label"`)
        }
        if (!MANIFEST_FIELD_TYPES.includes(field.type as ManifestFieldType)) {
          errors.push(
            `fields[${i}] (${String(field.key)}): unknown type "${String(field.type)}"`
          )
        }
        if (!MANIFEST_FIELD_SCOPES.includes(field.scope as ManifestFieldScope)) {
          errors.push(
            `fields[${i}] (${String(field.key)}): invalid scope "${String(field.scope)}"`
          )
        }
        fields.push(field as unknown as ManifestField)
      })
    }
  }

  const behavior = input.behavior
  if (behavior !== undefined && !isPlainObject(behavior)) {
    errors.push('`behavior` must be an object when present')
  }

  const interactions = input.interactions
  if (interactions !== undefined) {
    if (!isPlainObject(interactions)) {
      errors.push('`interactions` must be an object when present')
    } else if (!isPlainObject(interactions.on)) {
      errors.push('`interactions.on` must be an object mapping events to action lists')
    }
  }

  const rawCanvas = input.canvas
  let canvas: WidgetCanvas | undefined
  if (rawCanvas !== undefined) {
    if (!isPlainObject(rawCanvas)) {
      errors.push('`canvas` must be an object when present')
    } else {
      const width = Number(rawCanvas.width)
      const height = Number(rawCanvas.height)
      if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
        errors.push('`canvas` must have positive numeric `width` and `height`')
      } else {
        canvas = { width: Math.round(width), height: Math.round(height) }
        if (typeof rawCanvas.preset === 'string' && rawCanvas.preset.length > 0) {
          canvas.preset = rawCanvas.preset
        }
      }
    }
  }

  const globalConfig = input.globalConfig
  if (globalConfig !== undefined && !isPlainObject(globalConfig)) {
    errors.push('`globalConfig` must be an object when present')
  }

  const variantConfig = input.variantConfig
  if (variantConfig !== undefined && !isPlainObject(variantConfig)) {
    errors.push('`variantConfig` must be an object when present')
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    manifest: {
      name: name as string,
      componentType: componentType as string,
      fields,
      ...(isPlainObject(behavior) ? { behavior } : {}),
      ...(isPlainObject(interactions)
        ? { interactions: interactions as unknown as WidgetInteractions }
        : {}),
      ...(canvas ? { canvas } : {}),
      globalConfig: isPlainObject(globalConfig) ? globalConfig : {},
      variantConfig: isPlainObject(variantConfig) ? variantConfig : {},
    },
  }
}
