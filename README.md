# @eeko/sdk

Official TypeScript SDK for building Eeko widgets and overlays.

## Installation

```bash
pnpm add @eeko/sdk
```

## Usage

This package provides TypeScript types for the Eeko SDK. The actual SDK implementation (`window.eekoSDK`) is provided by either:

- **Production**: The Eeko overlay system (automatically injected)
- **Development**: The `@eeko/cli` dev server

### Basic Example

```typescript
import type { IEekoSDK, ChatMessagePayload, ComponentTriggerPayload } from '@eeko/sdk';

// TypeScript will recognize window.eekoSDK
declare const eekoSDK: IEekoSDK;

// Subscribe to chat messages
eekoSDK.on('chat_message', (message: ChatMessagePayload) => {
  console.log(`${message.user.displayName}: ${message.message.text}`);

  if (message.userStatus?.isModerator) {
    console.log('Message from a mod!');
  }
});

// Subscribe to triggers (donations, follows, etc.)
eekoSDK.on('component_trigger', (data: ComponentTriggerPayload) => {
  console.log(`${data.username} triggered with amount: ${data.amount}`);
});

// Get current state
const state = eekoSDK.getState();
console.log('Global config:', state.globalConfig);

// Check if SDK is ready
if (eekoSDK.isReady()) {
  console.log('SDK is ready!');
}
```

### Event Types

| Event | Description |
|-------|-------------|
| `component_trigger` | Alert/widget activated (donation, follow, etc.) |
| `component_update` | State update for interactive widgets |
| `component_sync` | Full state synchronization |
| `component_mount` | Component initialized |
| `component_unmount` | Component being destroyed |
| `chat_message` | Chat message from any platform |
| `variable_updated` | Configuration value changed |

### Type-Safe Event Handlers

```typescript
import { EEKO_EVENTS } from '@eeko/sdk';

// Use constants for event names
eekoSDK.on(EEKO_EVENTS.CHAT_MESSAGE, (msg) => {
  // msg is typed as ChatMessagePayload
});

eekoSDK.on(EEKO_EVENTS.COMPONENT_TRIGGER, (data) => {
  // data is typed as ComponentTriggerPayload
});
```

## Local Development

For local widget development, use `@eeko/cli`:

```bash
pnpm add -D @eeko/cli

# Start dev server
pnpm eeko dev

# Send test events
pnpm eeko test trigger --username="TestUser" --amount=5
pnpm eeko test chat --message="Hello world!"
```

## API Reference

### `IEekoSDK`

The main SDK interface available on `window.eekoSDK`.

#### Methods

- `on(event, handler)` - Subscribe to an event
- `off(event, handler)` - Unsubscribe from an event
- `getState()` - Get current SDK state
- `isReady()` - Check if SDK is initialized

### Payload Types

- `ComponentTriggerPayload` - Trigger event data
- `ComponentUpdatePayload` - State update data
- `ChatMessagePayload` - Chat message data
- `ComponentMountPayload` - Mount lifecycle data
- `ComponentUnmountPayload` - Unmount lifecycle data
- `VariableUpdatedPayload` - Variable change data

## License

MIT
