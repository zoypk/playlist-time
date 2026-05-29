import { describe, expect, test } from "bun:test";

import {
  buildPlaylistCacheKey,
  isValidPlaylistId,
  mapWithConcurrency,
  parseYoutubeKeys,
} from "./playlist";

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
      "https://yttime.pages.dev/api/playlist?list=PLabc1234567890&refresh=1",
    );
    const cacheKey = buildPlaylistCacheKey(request, "PLabc1234567890");

    expect(cacheKey.url).toBe(
      "https://yttime.pages.dev/api/playlist?list=PLabc1234567890",
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
});
