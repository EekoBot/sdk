/**
 * @eeko/sdk - Event Constants
 *
 * Constants and utilities for SDK events
 */

import type { EventType } from './types'

/**
 * All available event types as an array (useful for iteration)
 */
export const EVENT_TYPES: readonly EventType[] = [
  'component_trigger',
  'component_update',
  'component_sync',
  'component_mount',
  'component_unmount',
  'chat_message',
  'variable_updated',
] as const

/**
 * Event type constants for use in code
 */
export const EEKO_EVENTS = {
  /** Alert/widget trigger event */
  COMPONENT_TRIGGER: 'component_trigger',
  /** State update for widgets */
  COMPONENT_UPDATE: 'component_update',
  /** Full state sync */
  COMPONENT_SYNC: 'component_sync',
  /** Component mounted */
  COMPONENT_MOUNT: 'component_mount',
  /** Component unmounting */
  COMPONENT_UNMOUNT: 'component_unmount',
  /** Chat message received */
  CHAT_MESSAGE: 'chat_message',
  /** Variable/config changed */
  VARIABLE_UPDATED: 'variable_updated',
} as const

/**
 * Check if a string is a valid event type
 */
export function isValidEventType(event: string): event is EventType {
  return EVENT_TYPES.includes(event as EventType)
}
