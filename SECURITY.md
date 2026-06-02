# Security Policy

playlist-time is a personal open-source portfolio project. It uses Cloudflare Pages Functions to keep YouTube Data API keys on the server side and out of browser code.

## Supported Version

Security fixes apply to the current `master` branch.

## Reporting Security Issues

Please do not post real API keys, tokens, or private request data in public issues.

If you find a vulnerability, open a GitHub security advisory for this repository if available. If private advisories are not available, open a minimal public issue that describes the affected area without including secrets, credentials, or exploitable private data.

Useful reports include:

- exposed or committed secrets;
- browser exposure of `YOUTUBE_KEYS`;
- API paths that bypass input limits, cache behavior, or rate limiting;
- dependency vulnerabilities that affect the production Cloudflare Pages build.

## Secret Handling

- Local API keys belong in `.dev.vars`, which is ignored by Git.
- Production API keys belong in Cloudflare Pages environment variables.
- `.dev.vars.example` must contain placeholders only.
- If a real key is committed or pasted into a public issue, revoke or rotate it before continuing development.

## Out Of Scope

The demo does not handle user accounts, payments, or private user records. Traffic, quota, and abuse controls are lightweight and are not a substitute for a production-grade abuse-prevention system.
