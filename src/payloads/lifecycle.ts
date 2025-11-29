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
 * Variable updated payload - emitted when SDK variables change
 *
 * @example
 * ```typescript
 * window.eekoSDK.on('variable_updated', (payload) => {
 *   console.log(`${payload.name} changed to ${payload.value}`);
 *   // React to config changes
 * });
 * ```
 */
export interface VariableUpdatedPayload {
  /** Variable name that changed */
  name: string

  /** New value */
  value: unknown

  /** Previous value */
  previousValue?: unknown

  /** Source of the change */
  source?: 'user' | 'system' | 'api'

  /** Timestamp of the change */
  timestamp?: number
}
