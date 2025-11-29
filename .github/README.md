# GitHub Workflows

## CI (`ci.yml`)

Runs on push/PR to `main` or `develop`:
- Type checking
- Build verification
- Tests on Node 18.x, 20.x, 22.x

## Publish (`publish.yml`)

Runs on GitHub Release or manual dispatch:
- Builds and publishes to npm
- Uses npm provenance

**Required secret:** `NPM_TOKEN`

Setup: Repository > Settings > Secrets > Actions > New secret

## Maintenance

Update Node versions in `ci.yml`:
```yaml
matrix:
  node-version: [18.x, 20.x, 22.x]
```

## Troubleshooting

**CI failing:** Check type errors, build issues in Actions logs

**Publish failing:** Verify NPM_TOKEN is valid, version is unique
