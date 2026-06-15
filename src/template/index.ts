/**
 * @eeko/sdk - Template Module (Browser-Safe)
 *
 * This entry point exports only browser-safe utilities.
 * For Node.js-specific utilities (file loading), use '@eeko/sdk/template/node'.
 *
 * @example
 * ```typescript
 * // Browser-safe usage
 * import { TemplateEngine } from '@eeko/sdk/template'
 *
 * const engine = new TemplateEngine({
 *   goalTitle: 'Member Goal',
 *   goalTarget: 100
 * })
 *
 * const html = engine.processHTML('<div>{goalTitle}</div>')
 * // Result: '<div>Member Goal</div>'
 * ```
 */

// Core template engine
export { TemplateEngine } from './engine'

// Validation utilities
export {
  isValidURL,
  isValidTrustedURL,
  isValidColor,
  isValidNumber,
  isValidString,
  sanitizeString,
  coerceNumber,
} from './validation'

// Template engine options
export type { TemplateOptions } from './types'

// Widget manifest schema (widget.json) — the single source of truth for a
// widget's configurable fields, mirrored from the server so a manifest that
// validates here validates on commit.
export { validateManifest, MANIFEST_FIELD_TYPES, MANIFEST_FIELD_SCOPES } from './manifest'
export type {
  ManifestFieldType,
  ManifestFieldScope,
  ManifestFieldOption,
  ManifestField,
  WidgetManifest,
  WidgetCanvas,
  ValidateManifestResult,
} from './manifest'

// Widget linter — static pre-flight over the four widget files.
export { lintWidget } from './lint'
export type { LintFile, LintIssue, LintWidgetInput, LintWidgetResult } from './lint'
