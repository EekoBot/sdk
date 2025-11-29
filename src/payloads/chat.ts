/**
 * Chat Message Payload
 *
 * Unified chat message format supporting all platforms
 * (Twitch, Kick, YouTube, TikTok, Rumble)
 */

/**
 * Supported streaming platforms
 */
export type Platform = 'twitch' | 'kick' | 'youtube' | 'tiktok' | 'rumble'

/**
 * Message fragment types for rich text
 */
export type FragmentType = 'text' | 'emote' | 'mention' | 'cheermote' | 'link'

/**
 * Emote provider for third-party emote services
 */
export type EmoteProvider = 'native' | 'bttv' | 'ffz' | '7tv'

/**
 * Message fragment for rich text content
 */
export interface MessageFragment {
  /** Fragment type */
  type: FragmentType

  /** Text content of this fragment */
  text: string

  /** Emote name (for emote type) */
  emoteName?: string

  /** URL to emote image */
  emoteUrl?: string

  /** Platform-specific emote ID */
  emoteId?: string

  /** Emote provider (native platform or third-party) */
  emoteProvider?: EmoteProvider

  /** User ID being mentioned (for mention type) */
  mentionUserId?: string

  /** Username being mentioned */
  mentionUsername?: string

  /** Number of bits (for cheermote type) */
  bits?: number

  /** URL (for link type) */
  url?: string
}

/**
 * Badge information for user status display
 */
export interface Badge {
  /** Badge identifier */
  id: string

  /** Human-readable badge name */
  name: string

  /** URL to badge image */
  imageUrl?: string

  /** Count for multi-level badges (e.g., months subscribed) */
  count?: number
}

/**
 * User status/roles in chat
 */
export interface UserStatus {
  /** User is verified on the platform */
  isVerified?: boolean

  /** User is a channel moderator */
  isModerator?: boolean

  /** User is a subscriber/member */
  isSubscriber?: boolean

  /** User is a VIP */
  isVip?: boolean

  /** User is the channel broadcaster */
  isBroadcaster?: boolean

  /** Message is from an anonymous user */
  isAnonymous?: boolean

  /** User's badges */
  badges?: Badge[]
}

/**
 * Reply/thread information
 */
export interface ReplyInfo {
  /** ID of the message being replied to */
  messageId: string

  /** Text of the original message */
  text: string

  /** User ID of original message author */
  userId: string

  /** Username of original message author */
  username: string

  /** Display name of original message author */
  displayName?: string
}

/**
 * User information in chat message
 */
export interface ChatUser {
  /** Platform-specific user ID */
  id: string

  /** Username (login name) */
  username: string

  /** Display name (may differ from username) */
  displayName?: string

  /** URL to user's profile picture */
  profilePictureUrl?: string

  /** User's chat color (hex code) */
  color?: string
}

/**
 * Chat message context
 */
export interface ChatContext {
  /** Source platform */
  platform: Platform

  /** Channel/room ID */
  channelId: string

  /** Channel/room name */
  channelName?: string

  /** Unique message ID */
  messageId: string

  /** ISO 8601 timestamp */
  timestamp: string
}

/**
 * Message content
 */
export interface MessageContent {
  /** Plain text content */
  text: string

  /** Rich text fragments (emotes, mentions, etc.) */
  fragments?: MessageFragment[]
}

/**
 * Unified chat message payload
 *
 * This is the primary format for all chat messages across platforms
 *
 * @example
 * ```typescript
 * window.eekoSDK.on('chat_message', (message) => {
 *   console.log(`${message.user.displayName}: ${message.message.text}`);
 *
 *   if (message.userStatus?.isModerator) {
 *     console.log('Message from a mod!');
 *   }
 * });
 * ```
 */
export interface ChatMessagePayload {
  /** Message type identifier */
  type: 'chat_message'

  /** Context information */
  context: ChatContext

  /** User who sent the message */
  user: ChatUser

  /** Message content */
  message: MessageContent

  /** User status/badges */
  userStatus?: UserStatus

  /** Reply information (if this is a reply) */
  replyTo?: ReplyInfo

  /** Platform-specific data */
  platformData?: Record<string, unknown>
}

/**
 * Type guard for ChatMessagePayload
 */
export function isChatMessagePayload(msg: unknown): msg is ChatMessagePayload {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    (msg as { type: unknown }).type === 'chat_message'
  )
}
