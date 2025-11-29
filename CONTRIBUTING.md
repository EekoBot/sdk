# Contributing

## Setup

```bash
git clone https://github.com/EekoBot/sdk.git
cd sdk
pnpm install
```

## Development

```bash
pnpm dev        # Watch mode
pnpm typecheck  # Type checking
pnpm build      # Production build
```

## Project Structure

```
src/
├── index.ts       # Main exports
├── types.ts       # Core SDK types
├── events.ts      # Event constants
├── errors.ts      # Error classes
└── payloads/      # Event payload types
```

## Adding New Events

1. Add constant to `src/events.ts`
2. Add payload type to `src/payloads/`
3. Update `EekoEventMap` in `src/types.ts`
4. Export from `src/index.ts`
5. Update CHANGELOG.md

## Code Style

- TypeScript strict mode
- JSDoc comments for public APIs
- Types: `PascalCase`, Constants: `UPPER_SNAKE_CASE`

## Pull Requests

1. Fork and create branch from `main`
2. Make changes, run `pnpm typecheck && pnpm build`
3. Update CHANGELOG.md
4. Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`
5. Submit PR

## Testing

```bash
pnpm typecheck
pnpm build
pnpm pack --dry-run
```

For local testing:
```bash
pnpm link --global
cd ../your-project && pnpm link --global @eeko/sdk
```

## License

Contributions are licensed under MIT.
