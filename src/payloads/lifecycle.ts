/**
 * Component Lifecycle Payloads
 *
 * Types for mount/unmount lifecycle events
 */

/**
 * Component types in the Eeko system
 */
export type ComponentType = 'alert' | 'widget' | 'overlay'

/**
 * Component mount payload - emitted when a component initializes
 *
 * @example
 * ```typescript
 * window.eekoSDK.on('component_mount', (payload) => {
 *   console.log('Component mounted:', payload.componentId);
 *   // Initialize your widget here
 * });
 * ```
 */
export interface ComponentMountPayload {
  /** Unique component identifier */
  componentId: string

  /** Type of component */
  type: ComponentType

  /** Mount timestamp */
  timestamp?: number
}

/**
 * Component unmount payload - emitted when a component is destroyed
 *
 * @example
 * ```typescript
 * window.eekoSDK.on('component_unmount', (payload) => {
 *   console.log('Component unmounting:', payload.componentId);
 *   // Cleanup resources here
 * });
 * ```
 */
export interface ComponentUnmountPayload {
  /** Unique component identifier */
  componentId: string

  /** Type of component */
  type: ComponentType

  /** Unmount timestamp */
  timestamp?: number
}

/**
 * Variable type discriminator — mirrors the server's variable types.
 */
export type VariableType = 'string' | 'number' | 'boolean' | 'date' | 'json'

/**
 * A variable record, as delivered to `variable_updated` handlers.
 *
 * `value` is the NEW value, ALREADY PARSED to its JS type by the server —
 * use it directly. Do NOT `JSON.parse` it (that throws for string variables).
 */
export interface VariableRecord {
  /** Variable name. */
  name: string

  /** Declared type of the variable. */
  type: VariableType

  /** New value, already parsed to its JS type (string / number / boolean / object). */
  value: unknown

  /** Additional server bookkeeping fields (id, timestamps, version, …). */
  [key: string]: unknown
}

/**
 * Variable updated payload — the handler argument for the `variable_updated`
 * event. The runtime bridge unwraps the wire envelope, so handlers receive
 * this shape directly.
 *
 * @example
 * ```typescript
 * window.eekoSDK.on('variable_updated', (payload) => {
 *   // payload.variable.value is already parsed — use it directly.
 *   console.log(`${payload.variable.name} =`, payload.variable.value);
 * });
 * ```
 */
export interface VariableUpdatedPayload {
  /** The variable that changed. */
  variable: VariableRecord
}
