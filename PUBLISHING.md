# Publishing

## Prerequisites

- npm account with publish access to `@eeko` scope
- `NPM_TOKEN` GitHub secret configured

## Automated Publishing (Recommended)

1. Update version:
   ```bash
   pnpm version patch  # or minor, or major
   ```

2. Update CHANGELOG.md

3. Commit and push:
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "release: v1.0.1"
   git push origin main
   ```

4. Create GitHub Release with tag `v1.0.1`

GitHub Actions will publish automatically.

## Manual Publishing

```bash
npm login
pnpm build
pnpm publish --access public
```

## Beta Releases

```bash
pnpm version prerelease --preid=beta
pnpm publish --tag beta --access public
```

Install beta: `pnpm add @eeko/sdk@beta`

## Version Guidelines

- **patch**: Bug fixes, docs
- **minor**: New features, backward compatible
- **major**: Breaking changes

## Checklist

Before:
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` succeeds
- [ ] CHANGELOG.md updated
- [ ] `pnpm pack --dry-run` looks correct

After:
- [ ] Verify on npmjs.com
- [ ] Test install: `pnpm add @eeko/sdk`

## GitHub Secrets

Add `NPM_TOKEN` at: Repository > Settings > Secrets > Actions

Generate token at: npmjs.com > Settings > Access Tokens
