/**
 * Cloudflare Pages Function backend for playlist analytics.
 *
 * @remarks
 * - Keeps YouTube API keys server-side.
 * - Uses round-robin key selection for every outgoing API call.
 * - Retries across keys on quota/rate failures.
 * - Serves moderately fresh cached responses with manual refresh bypass.
 */
import type { PlaylistDto } from "../../src/shared/contracts";

export type { PlaylistDto } from "../../src/shared/contracts";

export interface Env {
  YOUTUBE_KEYS: string;
}

type HandlerContext = {
  request: Request;
  env: Env;
};

type YoutubeErrorPayload = {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{ reason?: string; message?: string }>;
  };
};

type PlaylistMetaResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: {
        default?: { url?: string };
        medium?: { url?: string };
        high?: { url?: string };
      };
    };
    contentDetails?: {
      itemCount?: number;
    };
  }>;
};

type PlaylistItemsResponse = {
  nextPageToken?: string;
  items?: Array<{
    contentDetails?: {
      videoId?: string;
      startAt?: string;
      endAt?: string;
    };
    snippet?: {
      publishedAt?: string;
    };
  }>;
};

type VideosResponse = {
  items?: Array<{
    id?: string;
    contentDetails?: {
      duration?: string;
    };
    statistics?: {
      viewCount?: string;
    };
  }>;
};

type PlaylistVideoEntry = {
  videoId: string | null;
  startAt?: string;
  endAt?: string;
};

type VideoBatchResult =
  | { ok: true; json: VideosResponse }
  | { ok: false; response: Response };

const RETRYABLE_REASONS = new Set([
  "quotaExceeded",
  "dailyLimitExceeded",
  "userRateLimitExceeded",
  "rateLimitExceeded",
  "backendError",
  "keyInvalid",
  "accessNotConfigured",
]);

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 80;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export const FRESH_TTL_SECONDS = 15 * 60;
const VIDEO_BATCH_CONCURRENCY = 4;

export const CACHE_TIMESTAMP_HEADER = "x-playlist-time-cached-at";
export const CACHE_STATUS_HEADER = "x-playlist-time-cache";

let keyCursor = 0;

/** Parses configured YouTube API keys from env string. */
export function parseYoutubeKeys(raw: string) {
  return (raw || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** Builds canonical cache key for a playlist payload. */
export function buildPlaylistCacheKey(request: Request, playlistId: string) {
  const requestUrl = new URL(request.url);
  const cacheUrl = new URL("/api/playlist", requestUrl.origin);
  cacheUrl.search = `list=${encodeURIComponent(playlistId)}`;
  return new Request(cacheUrl.toString(), { method: "GET" });
}

/** Creates a JSON response with standard content-type. */
export function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

/** Adds cache status metadata without mutating the original response. */
export function withCacheStatus(
  response: Response,
  status: "MISS" | "HIT" | "BYPASS",
) {
  const headers = new Headers(response.headers);
  headers.set(CACHE_STATUS_HEADER, status);
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

/** Derives a coarse client key for lightweight in-memory rate limiting. */
export function getClientKey(request: Request) {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "unknown";
  return ip.split(",")[0].trim();
}

/**
 * Fixed-window rate limiter.
 * Returns true when the current client key exceeds request quota.
 */
export function isRateLimited(clientKey: string) {
  const now = Date.now();

  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) {
      rateBuckets.delete(key);
    }
  }

  const bucket = rateBuckets.get(clientKey);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(clientKey, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

/** Basic playlist id format guard to reject obvious invalid input. */
export function isValidPlaylistId(playlistId: string) {
  return /^[A-Za-z0-9_-]{10,100}$/.test(playlistId);
}

/** Parses ISO-8601 duration strings (e.g. PT1H20M10S) into seconds. */
function parseIsoDurationToSeconds(value: string) {
  const match = value.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/,
  );
  if (!match) return 0;

  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);

  return days * 86_400 + hours * 3600 + minutes * 60 + seconds;
}

/**
 * Parses playlist item clip markers (`startAt`/`endAt`) into seconds.
 * Supports plain seconds, ISO durations, and mm:ss / hh:mm:ss formats.
 */
function parseClipTimeToSeconds(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const sec = Number.parseInt(trimmed, 10);
    return Number.isFinite(sec) ? sec : null;
  }

  if (trimmed.includes("T") || trimmed.startsWith("P")) {
    return parseIsoDurationToSeconds(trimmed);
  }

  const parts = trimmed.split(":").map((entry) => Number.parseInt(entry, 10));
  if (parts.some((entry) => !Number.isFinite(entry))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];

  return null;
}

/** Returns the next key index for round-robin usage. */
function getNextKeyStartIndex(keysLength: number) {
  if (keysLength <= 0) return 0;
  const index = keyCursor % keysLength;
  keyCursor = (keyCursor + 1) % keysLength;
  return index;
}

function shouldRotateKey(status: number, reason: string) {
  return status === 403 || status === 429 || RETRYABLE_REASONS.has(reason);
}

async function parseYoutubeError(response: Response) {
  let reason = "";
  let message = "YouTube API error";

  try {
    const payload = (await response.clone().json()) as YoutubeErrorPayload;
    reason = payload.error?.errors?.[0]?.reason || "";
    message =
      payload.error?.errors?.[0]?.message || payload.error?.message || message;
  } catch {
    const text = (await response.clone().text()).trim();
    if (text) message = text;
  }

  return { reason, message };
}

/**
 * Calls a YouTube endpoint and retries in ring-order across keys
 * when the error indicates quota/rate/key rotation is appropriate.
 */
async function youtubeFetchWithRotation(keys: string[], endpoint: string) {
  let last: Response | null = null;
  const startIndex = getNextKeyStartIndex(keys.length);

  for (let attempt = 0; attempt < keys.length; attempt += 1) {
    const keyIndex = (startIndex + attempt) % keys.length;
    const key = keys[keyIndex];
    const url = new URL(endpoint);
    url.searchParams.set("key", key);

    const response = await fetch(url.toString());
    last = response;

    if (response.ok) return response;

    const parsedError = await parseYoutubeError(response);
    if (!shouldRotateKey(response.status, parsedError.reason)) {
      return response;
    }
  }

  return last ?? new Response("No API key available", { status: 500 });
}

/** Maps raw YouTube API failures to frontend-friendly error responses. */
async function toUserFacingError(response: Response) {
  const { reason, message } = await parseYoutubeError(response);
  const status = response.status;
  const normalizedReason = reason.toLowerCase();
  const normalizedMessage = message.toLowerCase();

  if (
    status === 404 ||
    normalizedReason.includes("notfound") ||
    normalizedMessage.includes("not found")
  ) {
    return json({ error: "Playlist is private or unavailable" }, 404);
  }

  if (
    status === 403 ||
    status === 429 ||
    normalizedReason.includes("quota") ||
    normalizedReason.includes("ratelimit") ||
    normalizedMessage.includes("quota")
  ) {
    return json({ error: "YouTube API quota or rate limit exceeded" }, 429);
  }

  return json(
    { error: message || "Unable to fetch playlist" },
    Math.min(Math.max(status, 400), 502),
  );
}

/**
 * Runs async work with a bounded concurrency level.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  if (!items.length) return [] as R[];

  const results = new Array<R>(items.length);
  let index = 0;

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const current = index;
        index += 1;
        if (current >= items.length) break;
        results[current] = await worker(items[current], current);
      }
    },
  );

  await Promise.all(runners);
  return results;
}

/**
 * Fetches and composes the compact playlist DTO used by the frontend table.
 */
export async function buildPlaylistDto(
  playlistId: string,
  keys: string[],
): Promise<PlaylistDto | Response> {
  const playlistMetaEndpoint =
    "https://www.googleapis.com/youtube/v3/playlists" +
    `?part=snippet,contentDetails,status&id=${encodeURIComponent(playlistId)}` +
    "&fields=items(id,snippet(title,channelTitle,publishedAt,thumbnails(default(url),medium(url),high(url))),contentDetails(itemCount),status(privacyStatus))";

  const metaResponse = await youtubeFetchWithRotation(
    keys,
    playlistMetaEndpoint,
  );
  if (!metaResponse.ok) return toUserFacingError(metaResponse);

  const metaJson = (await metaResponse.json()) as PlaylistMetaResponse;
  const playlistMeta = metaJson.items?.[0];

  if (!playlistMeta?.id) {
    return json({ error: "Playlist is private or unavailable" }, 404);
  }

  const playlistTitle = playlistMeta.snippet?.title || "Untitled playlist";
  const channelTitle = playlistMeta.snippet?.channelTitle || "Unknown channel";
  const thumbnailUrl =
    playlistMeta.snippet?.thumbnails?.high?.url ||
    playlistMeta.snippet?.thumbnails?.medium?.url ||
    playlistMeta.snippet?.thumbnails?.default?.url ||
    null;
  const publishedAt = playlistMeta.snippet?.publishedAt || null;

  let pageToken = "";
  let hasNextPage = true;
  let lastAddedAt: string | null = null;
  const orderedItems: PlaylistVideoEntry[] = [];

  while (hasNextPage) {
    const playlistItemsEndpoint =
      "https://www.googleapis.com/youtube/v3/playlistItems" +
      `?part=contentDetails,snippet&playlistId=${encodeURIComponent(playlistId)}&maxResults=50` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "") +
      "&fields=nextPageToken,items(contentDetails(videoId,startAt,endAt),snippet(publishedAt))";

    const playlistItemsResponse = await youtubeFetchWithRotation(
      keys,
      playlistItemsEndpoint,
    );
    if (!playlistItemsResponse.ok)
      return toUserFacingError(playlistItemsResponse);

    const itemsJson =
      (await playlistItemsResponse.json()) as PlaylistItemsResponse;
    const items = itemsJson.items || [];

    for (const item of items) {
      orderedItems.push({
        videoId: item.contentDetails?.videoId || null,
        startAt: item.contentDetails?.startAt,
        endAt: item.contentDetails?.endAt,
      });

      const addedAt = item.snippet?.publishedAt || null;
      if (!addedAt) continue;
      if (
        !lastAddedAt ||
        new Date(addedAt).getTime() > new Date(lastAddedAt).getTime()
      ) {
        lastAddedAt = addedAt;
      }
    }

    pageToken = itemsJson.nextPageToken || "";
    hasNextPage = Boolean(pageToken);
  }

  const uniqueVideoIds = Array.from(
    new Set(
      orderedItems
        .map((entry) => entry.videoId)
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );

  const videoMeta = new Map<string, { durationSec: number; views: number }>();
  const batches: string[] = [];

  for (let i = 0; i < uniqueVideoIds.length; i += 50) {
    batches.push(uniqueVideoIds.slice(i, i + 50).join(","));
  }

  const batchResults = await mapWithConcurrency<string, VideoBatchResult>(
    batches,
    VIDEO_BATCH_CONCURRENCY,
    async (batchIds) => {
      const videosEndpoint =
        "https://www.googleapis.com/youtube/v3/videos" +
        `?part=contentDetails,statistics,snippet&id=${encodeURIComponent(batchIds)}` +
        "&fields=items(id,contentDetails(duration),statistics(viewCount),snippet(publishedAt))";

      const response = await youtubeFetchWithRotation(keys, videosEndpoint);
      if (!response.ok) return { ok: false, response };

      const jsonPayload = (await response.json()) as VideosResponse;
      return { ok: true, json: jsonPayload };
    },
  );

  const failedBatch = batchResults.find((entry) => !entry.ok);
  if (failedBatch && !failedBatch.ok) {
    return toUserFacingError(failedBatch.response);
  }

  for (const batch of batchResults) {
    if (!batch.ok) continue;
    for (const item of batch.json.items || []) {
      if (!item.id) continue;
      const durationSec = parseIsoDurationToSeconds(
        item.contentDetails?.duration || "PT0S",
      );
      const viewCount = Number.parseInt(item.statistics?.viewCount || "0", 10);
      videoMeta.set(item.id, {
        durationSec,
        views: Number.isFinite(viewCount) ? viewCount : 0,
      });
    }
  }

  const orderedDurationsSec: number[] = [];
  let totalVideoViewsSum = 0;
  let unavailableVideoCount = 0;

  for (const item of orderedItems) {
    const videoId = item.videoId;
    if (!videoId) {
      orderedDurationsSec.push(0);
      unavailableVideoCount += 1;
      continue;
    }

    const metadata = videoMeta.get(videoId);
    if (!metadata) {
      orderedDurationsSec.push(0);
      unavailableVideoCount += 1;
      continue;
    }

    const startSec = parseClipTimeToSeconds(item.startAt);
    const endSec = parseClipTimeToSeconds(item.endAt);

    let effectiveDuration = metadata.durationSec;
    if (startSec != null && endSec != null && endSec > startSec) {
      const boundedStart = Math.min(
        Math.max(0, startSec),
        metadata.durationSec,
      );
      const boundedEnd = Math.min(Math.max(0, endSec), metadata.durationSec);
      effectiveDuration = Math.max(0, boundedEnd - boundedStart);
    } else if (startSec != null) {
      const boundedStart = Math.min(
        Math.max(0, startSec),
        metadata.durationSec,
      );
      effectiveDuration = Math.max(0, metadata.durationSec - boundedStart);
    } else if (endSec != null) {
      const boundedEnd = Math.min(Math.max(0, endSec), metadata.durationSec);
      effectiveDuration = Math.max(0, boundedEnd);
    }

    orderedDurationsSec.push(effectiveDuration);
    totalVideoViewsSum += metadata.views;
  }

  const totalDurationSec = orderedDurationsSec.reduce(
    (sum, value) => sum + value,
    0,
  );

  return {
    playlistId,
    title: playlistTitle,
    channelTitle,
    thumbnailUrl,
    publishedAt,
    lastAddedAt,
    totalVideos:
      orderedItems.length || playlistMeta.contentDetails?.itemCount || 0,
    totalDurationSec,
    totalVideoViewsSum,
    orderedDurationsSec,
    unavailableVideoCount,
  };
}

/**
 * GET /api/playlist?list=PLAYLIST_ID
 *
 * Returns a compact DTO optimized for range-based frontend calculations.
 */
export const onRequestGet = async ({ request, env }: HandlerContext) => {
  const requestUrl = new URL(request.url);
  const playlistId = requestUrl.searchParams.get("list")?.trim() || "";
  const forceRefresh = requestUrl.searchParams.get("refresh") === "1";

  if (!playlistId) {
    return json({ error: "Missing query param: list=PLAYLIST_ID" }, 400);
  }

  if (!isValidPlaylistId(playlistId)) {
    return json({ error: "Invalid playlist ID format" }, 400);
  }

  const clientKey = getClientKey(request);
  if (isRateLimited(clientKey)) {
    return json(
      { error: "Rate limit exceeded. Please try again shortly." },
      429,
      {
        "retry-after": "60",
      },
    );
  }

  const keys = parseYoutubeKeys(env.YOUTUBE_KEYS);

  if (!keys.length) {
    return json({ error: "Server misconfigured: YOUTUBE_KEYS is empty" }, 500);
  }

  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = buildPlaylistCacheKey(request, playlistId);

  const buildAndStoreResponse = async () => {
    const dtoOrError = await buildPlaylistDto(playlistId, keys);
    if (dtoOrError instanceof Response) return dtoOrError;

    const response = json(dtoOrError, 200, {
      "cache-control": `public, max-age=0, s-maxage=${FRESH_TTL_SECONDS}`,
      [CACHE_TIMESTAMP_HEADER]: String(Date.now()),
    });

    await cache.put(cacheKey, response.clone());
    return response;
  };

  if (!forceRefresh) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      return withCacheStatus(cached, "HIT");
    }
  }

  const response = await buildAndStoreResponse();
  return withCacheStatus(response, forceRefresh ? "BYPASS" : "MISS");
};
