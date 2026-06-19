# Contributing

playlist-time is a small Astro, React, TypeScript, Bun, and Cloudflare Pages Functions project. Contributions are welcome through GitHub issues and pull requests.

## Before Opening Work

- Search existing issues and pull requests first.
- Use a bug report for broken behavior and a feature request for new workflow ideas.
- Do not include real YouTube API keys, tokens, private playlist data, or other secrets in issues, pull requests, screenshots, logs, or tests.
- For security issues, follow [SECURITY.md](SECURITY.md) instead of opening a detailed public issue.

## Pull Request Process

1. Fork or branch from `main`.
2. Keep changes focused on one bug, feature, or documentation update.
3. Add or update automated tests for new behavior and bug fixes.
4. Run the local checks before requesting review:

   ```bash
   bun install --frozen-lockfile
   bun audit
   bun run check
   bun run test
   bun run build
   ```

5. For user-visible UI changes, also run the demo smoke test:

   ```bash
   bun run smoke:demo
   ```

6. Explain the user-facing change, relevant tradeoffs, and verification in the pull request body.

## Acceptable Contributions

- Code should follow the existing TypeScript, React, and Astro style in the surrounding files.
- Prefer small, named helpers when they make input validation, API behavior, or UI state easier to test.
- Keep API keys and production configuration in environment variables. `.dev.vars` is local-only and must not be committed.
- Validate untrusted input at the Cloudflare Function boundary before calling the YouTube API.
- Keep browser code free of server-only secrets.
- Preserve accessible labels, keyboard behavior, and visible focus states when changing controls.
- Update README or docs when commands, environment variables, API behavior, or release behavior changes.

## Testing Policy

Major new functionality should include automated tests. Bug fixes should include a regression test when the behavior can be reproduced without live YouTube API calls.

Current coverage areas include playlist input parsing, range normalization, API key parsing, cache-key generation, bounded concurrency, and API error handling. The demo route is also covered by a Playwright smoke test.

## Release Notes

User-facing changes should be reflected in GitHub release notes when a semantic version tag is released. Publicly known runtime vulnerabilities fixed by a release must be called out in those release notes when they have a CVE or similar public identifier at release time.
