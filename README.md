# Playlist Time

YouTube playlist calculator for answering the question most people actually have: "how long will this playlist take?"

It works with playlist URLs or raw playlist IDs. You can see the full playlist length, compare watch times at different speeds, limit the calculation to a video range, plan a daily pace, and export the result.

[![CI](https://img.shields.io/github/actions/workflow/status/zoypk/playlist-time/ci.yml?branch=main&label=CI&logo=github&style=flat-square)](https://github.com/zoypk/playlist-time/actions/workflows/ci.yml)
[![License: AGPL-3.0-only](https://img.shields.io/badge/license-AGPL--3.0--only-2563eb?style=flat-square)](LICENSE)

![Astro](https://img.shields.io/badge/-Astro-24292f?logo=astro&logoColor=ff5d01&style=flat-square)
![React](https://img.shields.io/badge/-React-24292f?logo=react&logoColor=61dafb&style=flat-square)
![TypeScript](https://img.shields.io/badge/-TypeScript-24292f?logo=typescript&logoColor=3178c6&style=flat-square)
![Tailwind CSS](https://img.shields.io/badge/-Tailwind%20CSS-24292f?logo=tailwindcss&logoColor=06b6d4&style=flat-square)
![Bun](https://img.shields.io/badge/-Bun-24292f?logo=bun&logoColor=fbf0df&style=flat-square)
![Cloudflare Pages](https://img.shields.io/badge/-Cloudflare%20Pages-24292f?logo=cloudflare&logoColor=f38020&style=flat-square)

[Live app](https://playlist-time.pages.dev) | [Sample data](https://playlist-time.pages.dev/?demo=1)

![playlist-time first viewport with demo playlist results](docs/playlist-time-first-viewport.png)

## Why It Exists

This is useful for courses, tutorials, and long study playlists where the first question is usually the total time commitment. After that, the planning questions get more specific:

- How long is the whole playlist?
- How much time is left if playback starts from video 12?
- What does the total look like at 1.5x or 1.75x?
- Can this be finished before a certain date?
- Which playlist in a queue is going to take the most time?

The app keeps that workflow simple, while the YouTube API key stays on the server side instead of being shipped to the browser.

## What It Does

- Accepts one playlist or a batch of playlists.
- Parses normal YouTube playlist URLs and raw playlist IDs.
- Shows totals at common speeds and a custom speed.
- Lets you calculate only a selected video range.
- Sorts playlist results with thumbnails, channel names, publish dates, views, and durations.
- Estimates daily pace from a target finish date.
- Copies a text summary or downloads CSV results.
- Includes a deterministic demo mode, so the UI can be checked without API keys.

## How It Works

The frontend is an Astro page with a React calculator mounted inside it. The API runs as Cloudflare Pages Functions and calls the YouTube Data API from there.

```text
Browser
  -> Astro page + React calculator
  -> Cloudflare Pages Functions (/api/playlist, /api/playlists)
  -> YouTube Data API v3
```

Some details that matter:

- `YOUTUBE_KEYS` is only read by the Functions runtime.
- Batch requests de-duplicate playlist IDs and limit concurrency.
- Multiple YouTube keys can be configured so the API can rotate on quota or rate-limit failures.
- Successful responses use a short edge cache.
- The browser keeps UI state only for the current session.

## Code Map

- `src/pages/index.astro` mounts the page shell.
- `src/components/App.tsx` owns the calculator flow.
- `src/components/PlaylistsTable.tsx` renders playlist results.
- `src/components/ContentAccordion.tsx` and `src/components/FAQAccordion.tsx` render the lower guide/FAQ section. Keep this content useful for real planning questions; the `FAQPage` structured data should mirror visible support copy rather than exist as standalone SEO filler.
- `functions/api/playlist.ts` handles the single-playlist route.
- `functions/api/playlists.ts` handles batch playlist analysis.
- `src/shared/contracts.ts` keeps frontend and backend response shapes aligned.

## Run Locally

Install dependencies:

```bash
bun install
cp .dev.vars.example .dev.vars
```

Add one or more YouTube Data API keys to `.dev.vars`:

```env
YOUTUBE_KEYS=YOUR_YOUTUBE_DATA_API_KEY,YOUR_OPTIONAL_FALLBACK_YOUTUBE_DATA_API_KEY
```

Start the Astro app:

```bash
bun run dev
```

In another terminal, start the local Pages Functions runtime:

```bash
bun run worker:dev
```

The frontend proxies `/api/*` to `http://127.0.0.1:8788`, so both processes are needed for real API calls. The sample route works without keys:

```text
http://localhost:4321/?demo=1
```

## Environment

| Name | Required | Where | Purpose |
| --- | --- | --- | --- |
| `YOUTUBE_KEYS` | Yes for real API calls | `.dev.vars` locally; Cloudflare Pages env vars in production | Comma-separated YouTube Data API keys. |

Do not commit `.dev.vars`. If a real key is ever committed, revoke or rotate it before publishing.

For reporting security issues or accidental key exposure, see [SECURITY.md](SECURITY.md).

## Contributing and Reports

Bug reports and feature requests are tracked in [GitHub Issues](https://github.com/zoypk/playlist-time/issues). Pull request expectations, test policy, and acceptable contribution requirements are documented in [CONTRIBUTING.md](CONTRIBUTING.md).

Security issues should follow [SECURITY.md](SECURITY.md), not a detailed public issue.

## Checks

```bash
bun run check
bun run test
bun run build
```

Current tests cover playlist input parsing, range normalization, API key parsing, cache-key generation, and bounded concurrency helpers. There is also a demo smoke test, but fuller E2E coverage is still a good next step.

Static and dynamic analysis evidence for release readiness lives in GitHub Actions: CI, CodeQL, post-deploy smoke, release, and OWASP ZAP baseline workflows. The OpenSSF badge evidence map is in [docs/openssf-badge-evidence.md](docs/openssf-badge-evidence.md).

## API

- `GET /api/playlist?list=PLAYLIST_ID`
- `GET /api/playlist?list=PLAYLIST_ID&refresh=1`
- `GET /api/playlists?lists=ID1,ID2,ID3`
- `GET /api/playlists?lists=ID1,ID2,ID3&refresh=1`

The single-playlist route returns playlist metadata and ordered video durations. The batch route accepts up to 50 valid playlist IDs and returns separate `results`, `errors`, and `meta` fields.

## Deployment

The production app runs on Cloudflare Pages with Pages Functions.

Cloudflare Pages settings:

- Project name: `playlist-time`
- Build command: `bun run build`
- Build output directory: `dist`
- Functions directory: `functions`
- Production variable: `YOUTUBE_KEYS`

Manual deploy:

```bash
bun run build
bun run deploy:pages
```

Production secrets should be configured in Cloudflare Pages, not committed to the repository.

## Releases

Release notes are tracked in [CHANGELOG.md](CHANGELOG.md). GitHub Releases are created automatically for new semantic version tags:

```bash
git tag v1.1.0
git push origin v1.1.0
```

Update [CHANGELOG.md](CHANGELOG.md) before tagging user-visible changes. The release workflow runs install, audit, checks, tests, and build before creating the GitHub Release. The release title is generated by `scripts/release-title.mjs`; `v1.0.0` becomes `Public Launch: Playlist Watch-Time Calculator`, and later tags are named from the changed areas since the previous tag.

For major production releases, run the Dynamic analysis workflow first so OWASP ZAP scans the public demo route before the tag is pushed.

Preview a title locally:

```bash
bun run release:title v1.1.0
```

## Known Limits

- Results depend on YouTube Data API availability, quota, and playlist visibility.
- Private, deleted, unavailable, or region-blocked videos can affect totals.
- The rate limiter is lightweight and per-runtime; it is not durable abuse protection.

## License

GNU Affero General Public License v3.0 only (`AGPL-3.0-only`). See [LICENSE](LICENSE).
