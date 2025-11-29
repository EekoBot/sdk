/**
 * @eeko/sdk - Core Type Definitions
 *
 * These types define the public API contract for the Eeko SDK.
 * Both production (Pusher) and development (WebSocket) adapters implement this interface.
 */

/**
 * All supported event types in the Eeko SDK
 */
export type EventType =
  | 'component_trigger'
  | 'component_update'
  | 'component_sync'
  | 'component_mount'
  | 'component_unmount'
  | 'chat_message'
  | 'variable_updated'

/**
 * Event handler function signature
 */
export type EventHandler<T = unknown> = (data: T) => void

/**
 * SDK State object containing component and user information
 */
export interface EekoSDKState {
  /** Current component ID */
  componentId?: string
  /** User ID of the overlay owner */
  userId?: string
  /** Global configuration applied to all triggers */
  globalConfig: Record<string, unknown>
  /** Variant-specific configuration */
  variantConfig: Record<string, unknown>
  /** Additional state properties */
  [key: string]: unknown
}

/**
 * Main SDK interface that widget developers interact with
 *
 * This interface is implemented by:
 * - ProductionAdapter (uses Pusher, internal to overlay-react-app)
 * - LocalDevAdapter (uses WebSocket, provided by @eeko/cli)
 *
 * @example
 * ```typescript
 * // Subscribe to events with type safety
 * window.eekoSDK.on('component_trigger', (data) => {
 *   console.log('Triggered with:', data);
 * });
 *
 * // Check SDK state
 * const state = window.eekoSDK.getState();
 * console.log('Config:', state.globalConfig);
 * ```
 */
export interface IEekoSDK {
  /**
   * Subscribe to an event
   * @param event - Event type to listen for
   * @param handler - Callback function when event fires
   */
  on<E extends EventType>(event: E, handler: EventHandler<EekoEventMap[E]>): void

  /**
   * Unsubscribe from an event
   * @param event - Event type to stop listening for
   * @param handler - The handler function to remove
   */
  off<E extends EventType>(event: E, handler: EventHandler<EekoEventMap[E]>): void

  /**
   * Get the current SDK state
   * @returns Current state object with component config
   */
  getState(): EekoSDKState

  /**
   * Check if SDK is initialized and ready
   * @returns True if SDK is ready to receive events
   */
  isReady(): boolean
}

/**
 * Internal SDK interface with additional methods for adapters
 * @internal
 */
export interface IEekoSDKInternal extends IEekoSDK {
  /** Emit an event to all subscribers */
  _emit<E extends EventType>(event: E, data: EekoEventMap[E]): void
  /** Update SDK state */
  _setState(state: Partial<EekoSDKState>): void
  /** Initialize SDK with initial state */
  _initialize(state: Partial<EekoSDKState>): void
}

// Re-export payload types for the event map
import type {
  ComponentTriggerPayload,
  ComponentUpdatePayload,
  ComponentMountPayload,
  ComponentUnmountPayload,
  ChatMessagePayload,
  VariableUpdatedPayload,
} from './payloads'

/**
 * Map of event types to their payload types
 * Enables type-safe event handlers
 */
export interface EekoEventMap {
  component_trigger: ComponentTriggerPayload
  component_update: ComponentUpdatePayload
  component_sync: ComponentUpdatePayload
  component_mount: ComponentMountPayload
  component_unmount: ComponentUnmountPayload
  chat_message: ChatMessagePayload
  variable_updated: VariableUpdatedPayload
}

/**
 * Type-safe window.eekoSDK declaration
 */
declare global {
  interface Window {
    eekoSDK?: IEekoSDK
  }
}
