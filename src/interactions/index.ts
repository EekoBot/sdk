/**
 * @eeko/sdk/interactions — the declarative widget interaction contract.
 *
 * Public surface for the editor, the AI agent, the CLI, and nexus-api Zod
 * mirroring. The runtime that executes this contract ships inside the SDK
 * runtime bridge (`../interaction-runtime`).
 */
export * from './types'
export * from './classify'
export * from './validate'
