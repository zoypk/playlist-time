/**
 * Playlist payload returned by Cloudflare Pages Functions and consumed by the
 * React table.
 *
 * @remarks
 * `orderedDurationsSec` intentionally stays ordered by playlist position so the
 * frontend can calculate partial ranges without asking the API for a second
 * shape.
 */
export type PlaylistDto = {
  /** Stable YouTube playlist identifier from the `list` query parameter. */
  playlistId: string;
  /** Playlist title from the YouTube Data API, or a backend fallback. */
  title: string;
  /** Channel title for the playlist owner. */
  channelTitle: string;
  /** Best available playlist thumbnail URL, or `null` when YouTube omits one. */
  thumbnailUrl: string | null;
  /** Playlist publication timestamp in ISO format, or `null` when unavailable. */
  publishedAt: string | null;
  /** Sum of known video view counts across the playlist. */
  totalVideoViewsSum: number;
  /** Per-video durations in seconds, preserving playlist order. */
  orderedDurationsSec: number[];
};

/** Cache status emitted by API responses and batch result metadata. */
export type PlaylistCacheStatus = "HIT" | "MISS" | "BYPASS";

/** Standard JSON error envelope returned by playlist APIs. */
export type ApiErrorResponse = {
  error: string;
};

/** Per-playlist failure returned by `/api/playlists`. */
export type BatchPlaylistError = {
  playlistId: string;
  status: number;
  error: string;
};

/** Aggregate cache counters returned by `/api/playlists`. */
export type BatchCacheStats = {
  hit: number;
  miss: number;
  bypass: number;
};

/** Successful response body returned by `/api/playlists`. */
export type BatchPlaylistResponse = {
  results: PlaylistDto[];
  errors: BatchPlaylistError[];
  meta: {
    requested: number;
    processed: number;
    succeeded: number;
    failed: number;
    truncated: boolean;
    limit: number;
    cache: BatchCacheStats;
  };
};
