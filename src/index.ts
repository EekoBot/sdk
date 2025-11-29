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
export type {
  EventType,
  EventHandler,
  EekoSDKState,
  IEekoSDK,
  IEekoSDKInternal,
  EekoEventMap,
} from './types'

// Event constants
export { EVENT_TYPES, EEKO_EVENTS, isValidEventType } from './events'

// Payload types
export type {
  // Component payloads
  ComponentTriggerPayload,
  ComponentUpdatePayload,
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
 * SDK Version
 */
export const VERSION = '1.0.0'
