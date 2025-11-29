# @eeko/sdk

TypeScript types for the Eeko widget runtime. This package provides type definitions for `window.eekoSDK`, enabling type-safe development of streaming overlays and widgets.

The SDK runtime is injected automatically by the Eeko overlay system in production or by `@eeko/cli` during local development. This package contains no runtime code.

## Installation

```bash
pnpm add -D @eeko/sdk
```

## Usage

```typescript
import type { IEekoSDK, ComponentTriggerPayload, ChatMessagePayload } from '@eeko/sdk';

declare const eekoSDK: IEekoSDK;

eekoSDK.on('component_trigger', (data: ComponentTriggerPayload) => {
  console.log(`${data.username} triggered with amount: ${data.amount}`);
});

eekoSDK.on('chat_message', (msg: ChatMessagePayload) => {
  console.log(`${msg.user.displayName}: ${msg.message.text}`);
});

const state = eekoSDK.getState();
```

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `component_trigger` | `ComponentTriggerPayload` | Alert activated (donation, follow, subscription) |
| `component_update` | `ComponentUpdatePayload` | State update for persistent widgets |
| `component_sync` | `ComponentUpdatePayload` | Full state synchronization |
| `component_mount` | `ComponentMountPayload` | Widget initialized |
| `component_unmount` | `ComponentUnmountPayload` | Widget destroyed |
| `chat_message` | `ChatMessagePayload` | Chat message from any platform |
| `variable_updated` | `VariableUpdatedPayload` | Configuration changed |

## API

### IEekoSDK

```typescript
interface IEekoSDK {
  on<E extends EventType>(event: E, handler: EventHandler<EekoEventMap[E]>): void;
  off<E extends EventType>(event: E, handler: EventHandler<EekoEventMap[E]>): void;
  getState(): EekoSDKState;
  isReady(): boolean;
}
```

## Local Development

```bash
pnpm add -D @eeko/cli
pnpm eeko dev
pnpm eeko test trigger --username="Test" --amount=5
```

## License

MIT
