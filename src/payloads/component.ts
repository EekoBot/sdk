/**
 * Component Event Payloads
 *
 * Types for component_trigger and component_update events
 */

/**
 * Component trigger payload - sent when an alert/widget should activate
 *
 * Contains variant data that gets injected into template variables
 *
 * @example
 * ```typescript
 * window.eekoSDK.on('component_trigger', (payload) => {
 *   console.log('Username:', payload.username);
 *   console.log('Amount:', payload.amount);
 * });
 * ```
 */
export interface ComponentTriggerPayload {
  /** Event category (donation, follow, subscription, bits, raid, custom) */
  type?: string

  /** Username who triggered the event */
  username?: string

  /** Display name (may differ from username) */
  displayName?: string

  /** Profile picture URL */
  profilePictureUrl?: string

  /** Message content (for donations, cheers, etc.) */
  message?: string

  /** Amount for monetary events */
  amount?: number

  /** Currency code (USD, EUR, etc.) or platform currency type */
  currency?: string

  /** Pre-formatted amount string (e.g., "$5.00", "100 bits") */
  formattedAmount?: string

  /** Source platform */
  platform?: 'twitch' | 'kick' | 'youtube' | 'tiktok' | 'rumble'

  /** Subscription tier (1, 2, or 3) */
  tier?: number

  /** Number of months subscribed */
  months?: number

  /** Number of gifted subs */
  giftCount?: number

  /** Whether this is anonymous */
  isAnonymous?: boolean

  /** Any additional custom data */
  [key: string]: unknown
}

/**
 * Component update payload - sent for state updates to widgets
 *
 * Used for interactive widgets that maintain state
 *
 * @example
 * ```typescript
 * window.eekoSDK.on('component_update', (payload) => {
 *   console.log('Updated data:', payload.data);
 * });
 * ```
 */
export interface ComponentUpdatePayload {
  /** Target component ID */
  component_id?: string

  /** Update data to apply */
  data: Record<string, unknown>

  /** State changes */
  state_update?: Record<string, unknown>

  /** Event timestamp */
  timestamp?: number
}
