/**
 * @eeko/sdk - Template Types
 *
 * Type definitions for field configuration and template processing.
 */

/**
 * Supported field types in field.json
 */
export type FieldType =
  | 'text'
  | 'number'
  | 'range'
  | 'select'
  | 'color'
  | 'checkbox'
  | 'url'
  | 'textarea'

/**
 * Scope determines when the field value is applied
 */
export type FieldScope = 'global' | 'variant'

/**
 * Select option for dropdown fields
 */
export interface SelectOption {
  value: string
  label: string
}

/**
 * Validation rules for a field
 */
export interface FieldValidation {
  min?: number
  max?: number
  pattern?: string
  options?: SelectOption[]
}

/**
 * Field definition from field.json
 */
export interface FieldDefinition {
  /** Unique field identifier */
  id: string
  /** Field input type */
  type: FieldType
  /** When the field value is applied */
  scope: FieldScope
  /** Display label */
  label: string
  /** Default value */
  defaultValue?: unknown
  /** Placeholder text */
  placeholder?: string
  /** Whether field is required */
  required?: boolean
  /** Category for UI grouping */
  category?: string
  /** Display order within category */
  order?: number
  /** Validation rules */
  validation?: FieldValidation
}

/**
 * Field category for UI grouping
 */
export interface FieldCategory {
  /** Category identifier */
  id: string
  /** Display label */
  label: string
  /** Display order */
  order: number
}

/**
 * Complete field.json structure
 */
export interface FieldConfig {
  /** Field definitions */
  fields: FieldDefinition[]
  /** Category definitions for UI */
  fieldCategories?: FieldCategory[]
  /** Global configuration values */
  globalConfig: Record<string, unknown>
  /** Variant-specific configuration values */
  variantConfig: Record<string, unknown>
}

/**
 * Template processing options
 */
export interface TemplateOptions {
  /** Whether to escape HTML entities (default: true) */
  escapeHTML?: boolean
  /** Whether to escape CSS values (default: true) */
  escapeCSS?: boolean
  /** Whether to escape JS strings (default: true) */
  escapeJS?: boolean
}
