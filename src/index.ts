/**
 * @eeko/sdk
 *
 * Official SDK for building Eeko widgets and overlays.
 * This package provides TypeScript types and interfaces for the Eeko SDK.
 *
 * @example
 * ```typescript
 * import type { IEekoSDK, ChatMessagePayload } from '@eeko/sdk';
 *
 * // Subscribe to events with type safety
 * window.eekoSDK.on('chat_message', (msg: ChatMessagePayload) => {
 *   console.log(`${msg.user.displayName}: ${msg.message.text}`);
 * });
 *
 * // Check SDK state
 * const state = window.eekoSDK.getState();
 * console.log('Config:', state.globalConfig);
 * ```
 *
 * @packageDocumentation
 */

// Core types
//
// `IEekoSDKInternal` is intentionally NOT re-exported. The `_emit/_setState/
// _initialize` methods are host-runtime concerns (the overlay adapter uses
// them to drive the SDK from Pusher / postMessage) and must not be part of
// the public surface that widget authors type against. Adapters that need
// the shape should declare it locally.
export type {
  EventType,
  EventHandler,
  EekoSDKState,
  IEekoSDK,
  EekoEventMap,
} from './types'

// Event constants
export { EVENT_TYPES, EEKO_EVENTS, isValidEventType } from './events'

// Payload types
export type {
  // Component payloads
  ComponentTriggerPayload,
  ComponentUpdatePayload,
  ComponentDismissPayload,
  // Chat payloads
  Platform,
  FragmentType,
  EmoteProvider,
  MessageFragment,
  Badge,
  UserStatus,
  ReplyInfo,
  ChatUser,
  ChatContext,
  MessageContent,
  ChatMessagePayload,
  // Lifecycle payloads
  ComponentType,
  ComponentMountPayload,
  ComponentUnmountPayload,
  VariableUpdatedPayload,
} from './payloads'

// Type guards
export { isChatMessagePayload } from './payloads'

// Error classes
export {
  EekoSDKError,
  EekoSDKNotFoundError,
  EekoTimeoutError,
  EekoConnectionError,
  EekoInvalidEventError,
} from './errors'

/**
 * SDK Version. Keep in sync with package.json on each release (ideally inject at
 * build time so it can't drift again).
 */
export const VERSION = '0.7.3'
