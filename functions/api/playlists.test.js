import { afterEach, describe, expect, test } from "bun:test";

import { onRequestGet } from "./playlists";

const originalCachesDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "caches",
);

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function playlistDto(playlistId) {
  return {
    playlistId,
    title: `Playlist ${playlistId}`,
    channelTitle: "Example channel",
    thumbnailUrl: null,
    publishedAt: "2024-01-01T00:00:00Z",
    totalVideoViewsSum: 100,
    orderedDurationsSec: [60, 120],
  };
}

function setMockCaches(cache) {
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: { default: cache },
  });
}

function restoreCaches() {
  if (originalCachesDescriptor) {
    Object.defineProperty(globalThis, "caches", originalCachesDescriptor);
    return;
  }

  delete globalThis.caches;
}

function requestFor(query, clientKey) {
  return new Request(`https://playlist-time.pages.dev/api/playlists?${query}`, {
    headers: { "cf-connecting-ip": clientKey },
  });
}

afterEach(() => {
  restoreCaches();
});

describe("batch playlist API", () => {
  test("rejects requests without a lists query param", async () => {
    const response = await onRequestGet({
      request: requestFor("", "batch-missing"),
      env: { YOUTUBE_KEYS: "api-key" },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing query param: lists=ID1,ID2,...",
    });
  });

  test("deduplicates playlist inputs and keeps invalid IDs as per-row errors", async () => {
    const validId = "PLabc1234567890";
    const cacheCalls = [];
    setMockCaches({
      async match(request) {
        cacheCalls.push(request.url);
        const playlistId = new URL(request.url).searchParams.get("list");
        return jsonResponse(playlistDto(playlistId));
      },
      async put() {
        throw new Error("cache put should not run for hits");
      },
    });

    const lists = encodeURIComponent(
      `https://youtube.com/playlist?list=${validId},${validId},bad-id!`,
    );
    const response = await onRequestGet({
      request: requestFor(`lists=${lists}`, "batch-dedupe"),
      env: { YOUTUBE_KEYS: "api-key" },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(cacheCalls).toHaveLength(1);
    expect(payload.results.map((entry) => entry.playlistId)).toEqual([
      validId,
    ]);
    expect(payload.errors).toEqual([
      {
        playlistId: "bad-id!",
        status: 400,
        error: "Invalid playlist ID format",
      },
    ]);
    expect(payload.meta).toMatchObject({
      requested: 2,
      processed: 1,
      succeeded: 1,
      failed: 1,
      truncated: false,
      cache: { hit: 1, miss: 0, bypass: 0 },
    });
  });

  test("truncates valid batches after the first 50 playlist IDs", async () => {
    const ids = Array.from({ length: 51 }, (_, index) =>
      `PL${String(index).padStart(10, "0")}`,
    );
    setMockCaches({
      async match(request) {
        const playlistId = new URL(request.url).searchParams.get("list");
        return jsonResponse(playlistDto(playlistId));
      },
      async put() {
        throw new Error("cache put should not run for hits");
      },
    });

    const response = await onRequestGet({
      request: requestFor(`lists=${ids.join(",")}`, "batch-truncate"),
      env: { YOUTUBE_KEYS: "api-key" },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.results).toHaveLength(50);
    expect(payload.errors).toEqual([
      {
        playlistId: "batch",
        status: 413,
        error: "Batch limit exceeded: processed first 50 valid playlist IDs.",
      },
    ]);
    expect(payload.meta).toMatchObject({
      requested: 51,
      processed: 50,
      succeeded: 50,
      failed: 1,
      truncated: true,
      limit: 50,
      cache: { hit: 50, miss: 0, bypass: 0 },
    });
  });
});
