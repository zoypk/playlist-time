import { describe, expect, test } from "bun:test";

import {
  formatDuration,
  getRangeInfo,
  normalizeRangeForTotal,
  parsePlaylistInput,
  tryExtractPlaylistId,
} from "./utils";

function playlistRow(overrides = {}) {
  return {
    id: "row-1",
    input: "list=PLabc1234567890",
    playlistId: "PLabc1234567890",
    status: "success",
    data: {
      playlistId: "PLabc1234567890",
      title: "Example playlist",
      channelTitle: "Example channel",
      thumbnailUrl: null,
      publishedAt: "2024-01-01T00:00:00Z",
      totalVideoViewsSum: 1000,
      orderedDurationsSec: [60, 120, 180, 240],
    },
    rangeStart: null,
    rangeEnd: null,
    ...overrides,
  };
}

describe("playlist input parsing", () => {
  test("extracts playlist IDs from common pasted URL shapes", () => {
    expect(
      tryExtractPlaylistId(
        "https://www.youtube.com/playlist?list=PLabc1234567890&si=share",
      ),
    ).toBe("PLabc1234567890");

    expect(
      tryExtractPlaylistId("www.youtube.com/playlist?list=PLxyz9876543210"),
    ).toBe("PLxyz9876543210");

    expect(tryExtractPlaylistId("list=PLraw1234567890")).toBe(
      "PLraw1234567890",
    );
  });

  test("splits mixed pasted input while stripping wrapping punctuation", () => {
    expect(
      parsePlaylistInput(
        ' "https://youtube.com/playlist?list=PLabc1234567890",\n<PLxyz9876543210> ',
      ),
    ).toEqual([
      "https://youtube.com/playlist?list=PLabc1234567890",
      "PLxyz9876543210",
    ]);
  });
});

describe("range and duration helpers", () => {
  test("orders and clamps range bounds against playlist length", () => {
    expect(normalizeRangeForTotal(90, 20, 50)).toEqual({
      rangeStart: 20,
      rangeEnd: 50,
    });
  });

  test("computes selected duration for a partial playlist range", () => {
    const range = getRangeInfo(playlistRow({ rangeStart: 2, rangeEnd: 3 }));

    expect(range).toMatchObject({
      unavailable: false,
      totalVideos: 4,
      start: 2,
      end: 3,
      selectedCount: 2,
      selectedDuration: 300,
      isAll: false,
    });
  });

  test("formats long watch time compactly", () => {
    expect(formatDuration(3661)).toBe("1h 01m");
  });
});
