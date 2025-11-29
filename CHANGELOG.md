# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.3] - 2025-11-29

### Changed
- Remove release asset upload from publish workflow

## [0.1.2] - 2025-11-29

### Fixed
- Fix release asset upload in publish workflow

## [0.1.1] - 2025-11-29

### Fixed
- Correct pnpm pack command in publish workflow

## [0.1.0] - 2025-11-29

### Added
- Core SDK types and interfaces (`IEekoSDK`, `IEekoSDKInternal`)
- Event system with type-safe handlers
- Component trigger and update payloads
- Chat message payloads with platform support
- Lifecycle event payloads (mount/unmount)
- Variable update payloads
- Error classes for SDK errors
- Event constants (`EEKO_EVENTS`)
- CI/CD workflows for testing and npm publishing

[Unreleased]: https://github.com/EekoBot/sdk/compare/0.1.3...HEAD
[0.1.3]: https://github.com/EekoBot/sdk/compare/0.1.2...0.1.3
[0.1.2]: https://github.com/EekoBot/sdk/compare/0.1.1...0.1.2
[0.1.1]: https://github.com/EekoBot/sdk/compare/0.1.0...0.1.1
[0.1.0]: https://github.com/EekoBot/sdk/releases/tag/0.1.0
