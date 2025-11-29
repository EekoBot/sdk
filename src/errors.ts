/**
 * @eeko/sdk - Custom Error Types
 */

/**
 * Base error class for all SDK errors
 */
export class EekoSDKError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EekoSDKError'
  }
}

/**
 * Thrown when window.eekoSDK is not found
 */
export class EekoSDKNotFoundError extends EekoSDKError {
  constructor(message = 'Eeko SDK not found. Ensure you are running in an Eeko environment.') {
    super(message)
    this.name = 'EekoSDKNotFoundError'
  }
}

/**
 * Thrown when SDK initialization times out
 */
export class EekoTimeoutError extends EekoSDKError {
  constructor(timeout: number) {
    super(`SDK ready timeout after ${timeout}ms`)
    this.name = 'EekoTimeoutError'
  }
}

/**
 * Thrown when connecting to dev server fails
 */
export class EekoConnectionError extends EekoSDKError {
  constructor(message: string) {
    super(message)
    this.name = 'EekoConnectionError'
  }
}

/**
 * Thrown when an invalid event type is used
 */
export class EekoInvalidEventError extends EekoSDKError {
  constructor(event: string) {
    super(`Invalid event type: ${event}`)
    this.name = 'EekoInvalidEventError'
  }
}
