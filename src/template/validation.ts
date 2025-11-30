/**
 * @eeko/sdk - Template Validation Utilities
 *
 * Validation and sanitization functions for secure config handling.
 */

/**
 * Validate that a URL is safe (https only, no javascript:)
 * @param url - URL string to validate
 * @returns true if URL is safe
 */
export function isValidURL(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  try {
    const parsed = new URL(url)
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * Validate that a URL is from a trusted domain
 * @param url - URL string to validate
 * @param trustedDomains - List of trusted domain suffixes
 * @returns true if URL is from a trusted domain
 */
export function isValidTrustedURL(
  url: string,
  trustedDomains: string[]
): boolean {
  if (!isValidURL(url)) {
    return false
  }

  try {
    const parsed = new URL(url)
    return trustedDomains.some(
      (domain) =>
        parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
    )
  } catch {
    return false
  }
}

/**
 * Validate a color value (hex, rgb, rgba, hsl, hsla, or named colors)
 * @param color - Color string to validate
 * @returns true if color is valid
 */
export function isValidColor(color: string): boolean {
  if (!color || typeof color !== 'string') {
    return false
  }

  // Hex colors: #fff, #ffffff, #ffffffff
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color)) {
    return true
  }

  // RGB/RGBA: rgb(0, 0, 0), rgba(0, 0, 0, 0.5)
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)$/.test(color)) {
    return true
  }

  // HSL/HSLA: hsl(0, 0%, 0%), hsla(0, 0%, 0%, 0.5)
  if (/^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(,\s*[\d.]+\s*)?\)$/.test(color)) {
    return true
  }

  // Named colors (basic set)
  const namedColors = [
    'transparent',
    'black',
    'white',
    'red',
    'green',
    'blue',
    'yellow',
    'orange',
    'purple',
    'pink',
    'gray',
    'grey',
    'inherit',
    'currentColor',
  ]

  return namedColors.includes(color.toLowerCase())
}

/**
 * Validate a numeric value is within a range
 * @param value - Value to validate
 * @param min - Minimum allowed value (inclusive)
 * @param max - Maximum allowed value (inclusive)
 * @returns true if value is a number within range
 */
export function isValidNumber(
  value: unknown,
  min?: number,
  max?: number
): boolean {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return false
  }

  if (min !== undefined && value < min) {
    return false
  }

  if (max !== undefined && value > max) {
    return false
  }

  return true
}

/**
 * Validate a string length
 * @param value - Value to validate
 * @param maxLength - Maximum allowed length
 * @param minLength - Minimum allowed length (default: 0)
 * @returns true if value is a string within length bounds
 */
export function isValidString(
  value: unknown,
  maxLength: number,
  minLength: number = 0
): boolean {
  if (typeof value !== 'string') {
    return false
  }

  return value.length >= minLength && value.length <= maxLength
}

/**
 * Sanitize a string to alphanumeric + safe characters only
 * @param str - String to sanitize
 * @param maxLength - Maximum length (default: 1000)
 * @returns Sanitized string
 */
export function sanitizeString(str: string, maxLength: number = 1000): string {
  if (typeof str !== 'string') {
    return ''
  }

  // Remove any characters that aren't alphanumeric, space, or common punctuation
  const sanitized = str.replace(/[^a-zA-Z0-9\s\-_.,!?'"()[\]]/g, '')

  // Truncate to max length
  return sanitized.slice(0, maxLength)
}

/**
 * Coerce a value to a number within bounds
 * @param value - Value to coerce
 * @param defaultValue - Default if coercion fails
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Coerced number
 */
export function coerceNumber(
  value: unknown,
  defaultValue: number,
  min?: number,
  max?: number
): number {
  let num: number

  if (typeof value === 'number') {
    num = value
  } else if (typeof value === 'string') {
    num = parseFloat(value)
  } else {
    return defaultValue
  }

  if (!Number.isFinite(num)) {
    return defaultValue
  }

  if (min !== undefined && num < min) {
    return min
  }

  if (max !== undefined && num > max) {
    return max
  }

  return num
}
