import { afterEach, describe, expect, test } from "bun:test";

import {
  buildPlaylistCacheKey,
  buildPlaylistDto,
  isRateLimited,
  isValidPlaylistId,
  mapWithConcurrency,
  parseYoutubeKeys,
} from "./playlist";

const originalFetch = globalThis.fetch;

function youtubeJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function youtubeError(status, reason, message = "YouTube API error") {
  return youtubeJson(
    {
      error: {
        code: status,
        message,
        errors: [{ reason, message }],
      },
    },
    status,
  );
}

function setFetchSequence(responses) {
  const calls = [];

  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const response = responses.shift();
    if (!response) {
      throw new Error(`Unexpected fetch call: ${url}`);
    }
    return response;
  };

  return calls;
}

function getRequestKey(url) {
  return new URL(url).searchParams.get("key");
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("playlist API helpers", () => {
  test("parses comma-separated YouTube keys and removes blank entries", () => {
    expect(parseYoutubeKeys(" key-one, ,key-two ,, key-three ")).toEqual([
      "key-one",
      "key-two",
      "key-three",
    ]);
  });

  test("validates playlist IDs before hitting the YouTube API", () => {
    expect(isValidPlaylistId("PLabc1234567890")).toBe(true);
    expect(isValidPlaylistId("../not-a-playlist")).toBe(false);
    expect(isValidPlaylistId("short")).toBe(false);
  });

  test("builds canonical cache keys without request-only query params", () => {
    const request = new Request(
      "https://playlist-time.pages.dev/api/playlist?list=PLabc1234567890&refresh=1",
    );
    const cacheKey = buildPlaylistCacheKey(request, "PLabc1234567890");

    expect(cacheKey.url).toBe(
      "https://playlist-time.pages.dev/api/playlist?list=PLabc1234567890",
    );
    expect(cacheKey.method).toBe("GET");
  });

  test("preserves result order while respecting concurrency limit", async () => {
    let active = 0;
    let maxActive = 0;

    const results = await mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return value * 10;
    });

    expect(results).toEqual([10, 20, 30, 40]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  test("rotates YouTube API keys after a retryable quota failure", async () => {
    const calls = setFetchSequence([
      youtubeError(403, "quotaExceeded", "Quota exceeded"),
      youtubeJson({
        items: [
          {
            id: "PLrotation12345",
            snippet: {
              title: "Rotated playlist",
              channelTitle: "Example channel",
              publishedAt: "2024-01-01T00:00:00Z",
            },
          },
        ],
      }),
      youtubeJson({ items: [] }),
    ]);

    const result = await buildPlaylistDto("PLrotation12345", [
      "quota-key",
      "healthy-key",
    ]);

    expect(result).not.toBeInstanceOf(Response);
    expect(result).toMatchObject({
      playlistId: "PLrotation12345",
      title: "Rotated playlist",
      orderedDurationsSec: [],
    });

    const playlistCalls = calls.filter(
      (url) => new URL(url).pathname === "/youtube/v3/playlists",
    );
    expect(playlistCalls).toHaveLength(2);
    expect(new Set(playlistCalls.map(getRequestKey)).size).toBe(2);
  });

  test("maps exhausted YouTube quota failures to a 429 response", async () => {
    setFetchSequence([
      youtubeError(403, "quotaExceeded", "Quota exceeded"),
      youtubeError(403, "quotaExceeded", "Quota exceeded"),
    ]);

    const result = await buildPlaylistDto("PLquota123456", [
      "quota-key-a",
      "quota-key-b",
    ]);

    expect(result).toBeInstanceOf(Response);
    expect(result.status).toBe(429);
    await expect(result.json()).resolves.toEqual({
      error: "YouTube API quota or rate limit exceeded",
    });
  });

  test("maps missing or private playlists to a 404 response", async () => {
    setFetchSequence([
      youtubeError(404, "playlistNotFound", "Playlist not found"),
    ]);

    const result = await buildPlaylistDto("PLmissing12345", ["api-key"]);

    expect(result).toBeInstanceOf(Response);
    expect(result.status).toBe(404);
    await expect(result.json()).resolves.toEqual({
      error: "Playlist is private or unavailable",
    });
  });

  test("rate limits the 81st request from the same client key", () => {
    const clientKey = `reviewer-${crypto.randomUUID()}`;

    for (let i = 0; i < 80; i += 1) {
      expect(isRateLimited(clientKey)).toBe(false);
    }

    expect(isRateLimited(clientKey)).toBe(true);
  });
});
