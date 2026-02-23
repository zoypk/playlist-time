# Playlist Time

Production-ready Astro + React app for comparing total YouTube playlist watch time at multiple playback speeds, with per-playlist range selection.

## Stack

- Bun
- Astro (SSG) + React island (TypeScript)
- Tailwind CSS (compiled with PostCSS build pipeline)
- TanStack Query + TanStack Table
- Cloudflare Pages Functions for `/api/playlist`

## Project structure

```text
.
├── functions/
│   └── api/
│       └── playlist.ts
├── src/
│   ├── components/
│   │   ├── App.tsx
│   │   ├── PlaylistsTable.tsx
│   │   ├── RangePopover.tsx
│   │   ├── SpeedControl.tsx
│   │   ├── types.ts
│   │   └── utils.ts
│   ├── pages/
│   │   └── index.astro
│   └── styles/
│       └── global.css
├── .dev.vars.example
├── astro.config.mjs
├── postcss.config.mjs
└── tailwind.config.mjs
```

## Environment variables

Create `.dev.vars` from `.dev.vars.example`:

```bash
cp .dev.vars.example .dev.vars
```

Set your YouTube API keys (comma-separated):

```env
YOUTUBE_KEYS=<key1>,<key2>
```

## Local development

Install dependencies:

```bash
bun install
```

Run Astro app:

```bash
bun run dev
```

Run Cloudflare Functions API locally (separate terminal):

```bash
bun run worker:dev
```

Astro dev proxies `/api/*` to `http://127.0.0.1:8788`, so run both commands above for end-to-end local testing.

## Build and preview

```bash
bun run build
bun run preview
```

Preview built output with Pages Functions:

```bash
bun run pages:dev
```

## Deploy to Cloudflare Pages

### Option A: Cloudflare dashboard (recommended)

1. Connect repository to Cloudflare Pages.
2. Build command: `bun run build`
3. Build output directory: `dist`
4. Set environment variable `YOUTUBE_KEYS` in Pages project settings.
5. Keep `functions/` directory in repo so `/api/playlist` is deployed automatically.

### Option B: Wrangler CLI

```bash
bun run build
bun run deploy:pages -- --project-name <your-pages-project-name>
```

`functions/` is auto-detected by Wrangler Pages commands.

## API notes

- Endpoint: `GET /api/playlist?list=PLAYLIST_ID`
- Uses YouTube Data API v3 (`playlists.list`, `playlistItems.list`, `videos.list`)
- Supports API key rotation via `YOUTUBE_KEYS`
- Caches successful responses in Cloudflare cache for 6 hours
- Includes lightweight request rate limiting and playlist ID validation
