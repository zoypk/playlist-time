## Summary

-

## Verification

- [ ] `bun install --frozen-lockfile`
- [ ] `bun audit`
- [ ] `bun run check`
- [ ] `bun run test`
- [ ] `bun run build`
- [ ] `bun run smoke:demo` if the UI, routing, or demo behavior changed

## Checklist

- [ ] Tests were added or updated for major new behavior and reproducible bug fixes.
- [ ] Documentation or release notes were updated for user-visible changes.
- [ ] No real API keys, tokens, credentials, private playlist data, or generated secrets are included.
- [ ] Server-only secrets remain outside browser code.
