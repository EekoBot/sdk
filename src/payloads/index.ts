/**
 * @eeko/sdk - Event Payload Types
 *
 * Type definitions for all SDK event payloads
 */

// Component events
export type {
  ComponentTriggerPayload,
  ComponentUpdatePayload,
} from './component'

// Chat events
export type {
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
} from './chat'
export { isChatMessagePayload } from './chat'

// Lifecycle events
export type {
  ComponentType,
  ComponentMountPayload,
  ComponentUnmountPayload,
  VariableUpdatedPayload,
} from './lifecycle'
