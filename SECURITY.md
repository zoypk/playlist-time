# Security Policy

playlist-time is a personal open-source project. It uses Cloudflare Pages Functions to keep YouTube Data API keys on the server side and out of browser code.

## Supported Version

Security fixes apply to the current `main` branch.

## Reporting Security Issues

Please do not post real API keys, tokens, or private request data in public issues.

If GitHub private vulnerability reporting is enabled for this repository, use the private advisory form. If a private advisory form is not available, open a minimal public issue that describes the affected area without including secrets, credentials, or exploitable private data.

Useful reports include:

- impact and affected route, component, or workflow;
- steps to reproduce using public data or the demo route when possible;
- whether a secret, token, API key, or private playlist may have been exposed;
- exposed or committed secrets;
- browser exposure of `YOUTUBE_KEYS`;
- API paths that bypass input limits, cache behavior, or rate limiting;
- dependency vulnerabilities that affect the production Cloudflare Pages build.

## Response Targets

- Initial response for vulnerability reports: within 14 days.
- Public medium-or-higher severity vulnerabilities affecting this project: fix within 60 days after confirmation.
- Critical vulnerabilities: prioritize immediate investigation and release a fix as quickly as practical.
- Confirmed medium-or-higher exploitable findings from CodeQL, OWASP ZAP, dependency audit, or other static/dynamic analysis are treated as security work.

Release notes must identify fixed publicly known runtime vulnerabilities when they already have a CVE or similar public identifier at release time.

## Secret Handling

- Local API keys belong in `.dev.vars`, which is ignored by Git.
- Production API keys belong in Cloudflare Pages environment variables.
- `.dev.vars.example` must contain placeholders only.
- If a real key is committed or pasted into a public issue, revoke or rotate it before continuing development.

## Out Of Scope

The app does not handle user accounts, payments, private user records, or password storage. Traffic, quota, and abuse controls are lightweight and are not a substitute for a production-grade abuse-prevention system.
