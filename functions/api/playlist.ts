/**
 * Cloudflare Pages Function backend for playlist analytics.
 *
 * @remarks
 * - Keeps YouTube API keys server-side.
 * - Rotates keys on quota/rate errors.
 * - Caches successful responses in edge cache.
 */
interface Env {
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
      description?: string;
      thumbnails?: {
        default?: { url?: string };
      };
    };
    contentDetails?: {
      itemCount?: number;
    };
    // player?: {
    //   embedHtml?: string;
    // };
    // status?: {
    //   privacyStatus?: string;
    // };
  }>;
};

type PlaylistItemsResponse = {
  nextPageToken?: string;
  items?: Array<{
    contentDetails?: {
      videoId?: string;
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

/** Creates a JSON response with standard content-type. */
function json(
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

/** Derives a coarse client key for lightweight in-memory rate limiting. */
function getClientKey(request: Request) {
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
function isRateLimited(clientKey: string) {
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
  if (bucket.count > RATE_LIMIT_MAX) {
    return true;
  }

  return false;
}

/** Basic playlist id format guard to reject obvious invalid input. */
function isValidPlaylistId(playlistId: string) {
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
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return null;
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

function shouldRotateKey(status: number, reason: string) {
  return status === 403 || status === 429 || RETRYABLE_REASONS.has(reason);
}

/**
 * Calls a YouTube endpoint and retries with the next API key
 * when the error indicates quota/rate/key rotation is appropriate.
 */
async function youtubeFetchWithRotation(keys: string[], endpoint: string) {
  let last: Response | null = null;

  for (const key of keys) {
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

  if (!last) {
    return new Response("No API key available", { status: 500 });
  }

  return last;
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
 * GET /api/playlist?list=PLAYLIST_ID
 *
 * Returns a compact DTO optimized for range-based frontend calculations.
 */
export const onRequestGet = async ({ request, env }: HandlerContext) => {
  const requestUrl = new URL(request.url);
  const playlistId = requestUrl.searchParams.get("list")?.trim() || "";

  if (!playlistId) {
    return json({ error: "Missing query param: list=PLAYLIST_ID" }, 400);
  }

  if (!isValidPlaylistId(playlistId)) {
    return json({ error: "Invalid playlist ID format" }, 400);
  }

  const cache = (caches as unknown as { default: Cache }).default;
  const cacheUrl = new URL(request.url);
  cacheUrl.search = `list=${encodeURIComponent(playlistId)}`;
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) {
    return new Response(cached.body, cached);
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

  const keys = (env.YOUTUBE_KEYS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!keys.length) {
    return json({ error: "Server misconfigured: YOUTUBE_KEYS is empty" }, 500);
  }

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
    playlistMeta.snippet?.thumbnails?.default?.url ||
    null;
  const publishedAt = playlistMeta.snippet?.publishedAt || null;

  let pageToken = "";
  let hasNextPage = true;
  const orderedItems: Array<{
    videoId: string | null;
    startAt?: string;
    endAt?: string;
  }> = [];
  let lastAddedAt: string | null = null;

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

  for (let i = 0; i < uniqueVideoIds.length; i += 50) {
    const batch = uniqueVideoIds.slice(i, i + 50).join(",");
    const videosEndpoint =
      "https://www.googleapis.com/youtube/v3/videos" +
      `?part=contentDetails,statistics,snippet&id=${encodeURIComponent(batch)}` +
      "&fields=items(id,contentDetails(duration),statistics(viewCount),snippet(publishedAt))";

    const videosResponse = await youtubeFetchWithRotation(keys, videosEndpoint);
    if (!videosResponse.ok) return toUserFacingError(videosResponse);

    const videosJson = (await videosResponse.json()) as VideosResponse;
    for (const item of videosJson.items || []) {
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

    const video = videoMeta.get(videoId);
    if (!video) {
      orderedDurationsSec.push(0);
      unavailableVideoCount += 1;
      continue;
    }

    const startSec = parseClipTimeToSeconds(item.startAt);
    const endSec = parseClipTimeToSeconds(item.endAt);

    let effectiveDuration = video.durationSec;
    if (startSec != null && endSec != null && endSec > startSec) {
      effectiveDuration = Math.max(
        0,
        Math.min(video.durationSec, endSec) - startSec,
      );
    } else if (startSec != null) {
      effectiveDuration = Math.max(0, video.durationSec - startSec);
    } else if (endSec != null) {
      effectiveDuration = Math.max(0, Math.min(video.durationSec, endSec));
    }

    orderedDurationsSec.push(effectiveDuration);
    totalVideoViewsSum += video.views;
  }

  const totalDurationSec = orderedDurationsSec.reduce(
    (sum, value) => sum + value,
    0,
  );

  const body = {
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

  const response = json(body, 200, {
    "cache-control": "public, max-age=0, s-maxage=21600",
  });

  await cache.put(cacheKey, response.clone());
  return response;
};
