/**
 * @eeko/sdk - Core Type Definitions
 *
 * These types define the public API contract for the Eeko SDK.
 * Both production (Pusher) and development (WebSocket) adapters implement this interface.
 *
 * Wire format: every event handler receives a `{type, context, payload}`
 * envelope — symmetric with the inbound TriggerCandidate that publishers
 * upstream consume. The canonical schemas live in @eeko/event-contracts;
 * the type definitions below are kept in lockstep with the OUTBOUND_EVENTS
 * registry there. When @eeko/event-contracts is published to npm, these
 * inline types should become a direct import:
 *
 *   import type { OutboundEventMap } from '@eeko/event-contracts/outbound'
 *   export type EekoEventMap = OutboundEventMap & {
 *     // SDK-only iframe lifecycle events stay here
 *     component_mount: ComponentMountPayload
 *     component_unmount: ComponentUnmountPayload
 *   }
 */

/**
 * All supported event types in the Eeko SDK.
 *
 *   - component_trigger / component_update / component_dismiss / component_sync —
 *     interactive component lifecycle events from the dispatcher.
 *   - chat_message — unified chat / monetary / subscription / engagement event
 *     from chat-relay (the discriminator is in `payload.type`).
 *   - variable_updated — user variable mutation.
 *   - component_mount / component_unmount — SDK-internal iframe lifecycle
 *     events (NOT delivered over the Pusher wire).
 */
export type EventType =
  | 'component_trigger'
  | 'component_update'
  | 'component_dismiss'
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
 * @example
 * ```typescript
 * window.eekoSDK.on('component_trigger', (envelope) => {
 *   const { componentId } = envelope.context
 *   const { data } = envelope.payload
 *   console.log('Triggered', componentId, data)
 * });
 * ```
 */
export interface IEekoSDK {
  on<E extends EventType>(event: E, handler: EventHandler<EekoEventMap[E]>): void
  off<E extends EventType>(event: E, handler: EventHandler<EekoEventMap[E]>): void
  getState(): EekoSDKState
  isReady(): boolean
}

/** @internal */
export interface IEekoSDKInternal extends IEekoSDK {
  _emit<E extends EventType>(event: E, data: EekoEventMap[E]): void
  _setState(state: Partial<EekoSDKState>): void
  _initialize(state: Partial<EekoSDKState>): void
}

import type { ComponentMountPayload, ComponentUnmountPayload } from './payloads'

// ── Wire envelopes (mirror @eeko/event-contracts/outbound) ───────────────

interface BaseEnvelope<T extends string, Context, Payload> {
  type: T
  context: Context
  payload: Payload
}

interface ComponentEnvelopeContext {
  userId: string
  componentId: string
  instanceId?: string
}

export type ComponentTriggerEnvelope = BaseEnvelope<
  'component_trigger',
  ComponentEnvelopeContext,
  { data: Record<string, unknown> }
>

export type ComponentUpdateEnvelope = BaseEnvelope<
  'component_update',
  ComponentEnvelopeContext,
  { data: Record<string, unknown> }
>

export type ComponentDismissEnvelope = BaseEnvelope<
  'component_dismiss',
  Required<ComponentEnvelopeContext>,
  Record<string, unknown>
>

export type ComponentSyncEnvelope = BaseEnvelope<
  'component_sync',
  ComponentEnvelopeContext,
  { data: Record<string, unknown> }
>

export type ChatMessageEnvelope = BaseEnvelope<
  'chat_message',
  { userId: string; platform?: string; channelId?: string },
  { type: string; [key: string]: unknown }
>

export type VariableUpdatedEnvelope = BaseEnvelope<
  'variable_updated',
  { userId: string; variableId?: string; source?: string },
  { variable: unknown }
>

/**
 * Map of event types to their envelope types. Iframe lifecycle events
 * (`component_mount`, `component_unmount`) keep their flat payload shape
 * — they're SDK-internal, not wire events.
 */
export interface EekoEventMap {
  component_trigger: ComponentTriggerEnvelope
  component_update: ComponentUpdateEnvelope
  component_dismiss: ComponentDismissEnvelope
  component_sync: ComponentSyncEnvelope
  component_mount: ComponentMountPayload
  component_unmount: ComponentUnmountPayload
  chat_message: ChatMessageEnvelope
  variable_updated: VariableUpdatedEnvelope
}

/**
 * Type-safe window.eekoSDK declaration
 */
declare global {
  interface Window {
    eekoSDK?: IEekoSDK
  }
}
