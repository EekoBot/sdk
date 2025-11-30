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

// Type definitions
export type {
  FieldType,
  FieldScope,
  SelectOption,
  FieldValidation,
  FieldDefinition,
  FieldCategory,
  FieldConfig,
  TemplateOptions,
} from './types'
