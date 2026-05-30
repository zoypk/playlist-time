# yttime

YouTube playlist watch-time calculator for planning courses, study queues, and long playlists. Paste playlist URLs or IDs, compare totals at different playback speeds, and narrow the calculation to a video range.

[Live demo](https://playlist-time.pages.dev) | [Sample data view](https://playlist-time.pages.dev/?demo=1)

Built with Astro, React, TypeScript, Bun, and Cloudflare Pages Functions.

![yttime calculator with sample playlist rows](docs/yttime-sample-rows.png)

## Why This Exists

YouTube shows playlist contents, but not the real time commitment for "videos 12-48 at 1.5x." yttime answers that question quickly while keeping YouTube API keys server-side.

## Features

- Analyze one or many playlists from pasted URLs or raw playlist IDs.
- Compare totals at 1x, 1.25x, 1.5x, 1.75x, or a custom speed.
- Apply a default video range, then adjust individual rows when needed.
- Sort playlist totals with thumbnails, channel names, views, publish dates, and durations.
- Load deterministic sample rows without calling the YouTube API.

## Implementation Notes

- Astro serves the static shell; a React/TypeScript island owns the calculator state.
- Cloudflare Pages Functions proxy the YouTube Data API so `YOUTUBE_KEYS` never reaches the browser.
- The batch API de-duplicates playlist IDs, bounds concurrency, rotates API keys on quota/rate failures, and returns per-playlist errors.
- Successful API responses use a short Cloudflare edge cache; the browser keeps only session-level UI state.
- CI runs install, Astro/TypeScript checks, unit tests, and production build on pushes and pull requests.

## Architecture

```text
Browser
  -> Astro page + React calculator
  -> Cloudflare Pages Functions (/api/playlist, /api/playlists)
  -> YouTube Data API v3
```

## Run Locally

```bash
bun install
cp .dev.vars.example .dev.vars
```

Set local function variables in `.dev.vars`:

```env
YOUTUBE_KEYS=your_youtube_api_key_here,your_fallback_youtube_api_key_here
```

Start the frontend and local Pages Functions API:

```bash
bun run dev
bun run worker:dev
```

Astro proxies `/api/*` to `http://127.0.0.1:8788`, so both processes are needed for real API calls.

## Verification

These checks pass locally:

```bash
bun run check
bun run test
bun run build
```

Current tests cover playlist input parsing, range normalization, API key parsing, cache-key generation, and bounded concurrency helpers. There is no browser end-to-end suite yet; that would be the next useful test layer.

## API

- `GET /api/playlist?list=PLAYLIST_ID`
- `GET /api/playlist?list=PLAYLIST_ID&refresh=1`
- `GET /api/playlists?lists=ID1,ID2,ID3`
- `GET /api/playlists?lists=ID1,ID2,ID3&refresh=1`

The single-playlist route returns playlist metadata plus ordered video durations. The batch route accepts up to 50 valid playlist IDs and returns separate `results`, `errors`, and `meta` fields.

## Deployment

Cloudflare Pages configuration:

- Project name: `playlist-time`
- Build command: `bun run build`
- Build output directory: `dist`
- Functions directory: `functions`
- Production variable: `YOUTUBE_KEYS`

Keep real keys in `.dev.vars` locally and Cloudflare Pages environment variables in production. Do not commit `.dev.vars`; if a real key is ever committed, revoke or rotate it before publishing.

## Limitations

- Results depend on YouTube Data API availability, quota, and playlist visibility.
- Private, deleted, unavailable, or region-blocked videos can affect totals.
- The rate limiter is lightweight and per-runtime; it is not a durable abuse-prevention system.

## Ownership

Personal project. I built the product scope, UI, serverless API, YouTube integration, caching behavior, deployment setup, tests, and CI.
