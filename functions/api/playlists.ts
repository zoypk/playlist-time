import {
  buildPlaylistCacheKey,
  buildPlaylistDto,
  CACHE_STATUS_HEADER,
  CACHE_TIMESTAMP_HEADER,
  FRESH_TTL_SECONDS,
  getClientKey,
  getDefaultCache,
  isRateLimited,
  isValidPlaylistId,
  json,
  mapWithConcurrency,
  parseYoutubeKeys,
  type Env,
  type PlaylistDto,
} from "./playlist";
import type {
  BatchCacheStats,
  BatchPlaylistError,
  PlaylistCacheStatus,
} from "../../src/shared/contracts";

/** Minimal Pages Function invocation context used by the batch GET handler. */
type HandlerContext = {
  request: Request;
  env: Env;
};

type BatchError = BatchPlaylistError;

type BatchSuccess = {
  playlistId: string;
  data: PlaylistDto;
  cacheStatus: PlaylistCacheStatus;
};

const MAX_BATCH_IDS = 50;
const PLAYLIST_BUILD_CONCURRENCY = 6;

/** Extracts a YouTube playlist id from a raw id, URL, or `list=` token. */
function extractPlaylistId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const listMatch = trimmed.match(
    /(?:^|[?&])list=([A-Za-z0-9_-]{10,100})(?:$|[&#])/i,
  );
  if (listMatch?.[1]) return listMatch[1];

  try {
    const url = new URL(trimmed);
    return url.searchParams.get("list")?.trim() || trimmed;
  } catch {
    return trimmed;
  }
}

/** Reads a user-facing error message from a JSON or text response body. */
async function parseResponseError(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.clone().json()) as { error?: string };
      return payload.error || "Request failed";
    } catch {
      return "Request failed";
    }
  }

  const text = (await response.clone().text()).trim();
  return text || "Request failed";
}

async function resolvePlaylistInBatch(
  request: Request,
  cache: Cache,
  playlistId: string,
  keys: string[],
  forceRefresh: boolean,
): Promise<BatchSuccess | BatchError> {
  const cacheKey = buildPlaylistCacheKey(request, playlistId);

  if (!forceRefresh) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      try {
        const payload = (await cached.clone().json()) as PlaylistDto;
        return {
          playlistId,
          data: payload,
          cacheStatus: "HIT",
        };
      } catch {
        // Corrupt cache entry, fall through to fresh build.
      }
    }
  }

  const dtoOrError = await buildPlaylistDto(playlistId, keys);
  if (dtoOrError instanceof Response) {
    return {
      playlistId,
      status: dtoOrError.status,
      error: await parseResponseError(dtoOrError),
    };
  }

  const fresh = json(dtoOrError, 200, {
    "cache-control": `public, max-age=0, s-maxage=${FRESH_TTL_SECONDS}`,
    [CACHE_TIMESTAMP_HEADER]: String(Date.now()),
    [CACHE_STATUS_HEADER]: forceRefresh ? "BYPASS" : "MISS",
  });
  await cache.put(cacheKey, fresh.clone());

  return {
    playlistId,
    data: dtoOrError,
    cacheStatus: forceRefresh ? "BYPASS" : "MISS",
  };
}

/**
 * GET /api/playlists?lists=ID1,ID2
 *
 * Resolves multiple playlists with dedupe, validation, shared cache lookup, and
 * bounded backend concurrency. Partial failures are returned in `errors` while
 * successful DTOs remain available in `results`.
 */
export const onRequestGet = async ({ request, env }: HandlerContext): Promise<Response> => {
  const requestUrl = new URL(request.url);
  const forceRefresh = requestUrl.searchParams.get("refresh") === "1";
  const listsParam =
    requestUrl.searchParams.get("lists") ||
    requestUrl.searchParams.get("list") ||
    "";

  if (!listsParam.trim()) {
    return json({ error: "Missing query param: lists=ID1,ID2,..." }, 400);
  }

  const tokens = listsParam
    .split(/[\s,;]+/g)
    .map((entry) => extractPlaylistId(entry))
    .filter(Boolean);

  const uniqueIds: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    uniqueIds.push(token);
  }

  const invalidErrors: BatchError[] = uniqueIds
    .filter((id) => !isValidPlaylistId(id))
    .map((playlistId) => ({
      playlistId,
      status: 400,
      error: "Invalid playlist ID format",
    }));

  const validIds = uniqueIds.filter((id) => isValidPlaylistId(id));
  const limitedIds = validIds.slice(0, MAX_BATCH_IDS);
  const truncatedCount = Math.max(0, validIds.length - limitedIds.length);

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

  const cache = getDefaultCache();

  const resolved = await mapWithConcurrency(
    limitedIds,
    PLAYLIST_BUILD_CONCURRENCY,
    (playlistId) =>
      resolvePlaylistInBatch(request, cache, playlistId, keys, forceRefresh),
  );

  const results: PlaylistDto[] = [];
  const errors: BatchError[] = [...invalidErrors];
  const cacheMeta: BatchCacheStats = { hit: 0, miss: 0, bypass: 0 };

  for (const entry of resolved) {
    if ("data" in entry) {
      results.push(entry.data);
      if (entry.cacheStatus === "HIT") cacheMeta.hit += 1;
      if (entry.cacheStatus === "MISS") cacheMeta.miss += 1;
      if (entry.cacheStatus === "BYPASS") cacheMeta.bypass += 1;
    } else {
      errors.push(entry);
    }
  }

  if (truncatedCount > 0) {
    errors.push({
      playlistId: "batch",
      status: 413,
      error: `Batch limit exceeded: processed first ${MAX_BATCH_IDS} valid playlist IDs.`,
    });
  }

  return json(
    {
      results,
      errors,
      meta: {
        requested: uniqueIds.length,
        processed: limitedIds.length,
        succeeded: results.length,
        failed: errors.length,
        truncated: truncatedCount > 0,
        limit: MAX_BATCH_IDS,
        cache: cacheMeta,
      },
    },
    200,
  );
};
