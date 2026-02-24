import type { PlaylistApiDto, PlaylistRow } from "./types";
import { createRowId, normalizeRangeForTotal } from "./utils";

const DEMO_INPUTS = [
  "https://www.youtube.com/playlist?list=DEMO_PLAYLIST_01&demo=1",
  "https://www.youtube.com/playlist?list=DEMO_PLAYLIST_02&demo=1"
];

const DEMO_PLAYLISTS: PlaylistApiDto[] = [
  {
    playlistId: "DEMO_PLAYLIST_01",
    title: "Design Systems Deep Dive",
    channelTitle: "Atlas Studio",
    thumbnailUrl: null,
    publishedAt: "2023-08-14T12:00:00Z",
    totalVideoViewsSum: 1284500,
    orderedDurationsSec: [
      540,
      810,
      620,
      900,
      760,
      580,
      1020,
      450,
      860,
      700,
      530,
      940
    ]
  },
  {
    playlistId: "DEMO_PLAYLIST_02",
    title: "Frontend Performance Sprint",
    channelTitle: "Velocity Labs",
    thumbnailUrl: null,
    publishedAt: "2022-11-02T09:30:00Z",
    totalVideoViewsSum: 965000,
    orderedDurationsSec: [
      480,
      560,
      720,
      640,
      830,
      910,
      600,
      750,
      890,
      510
    ]
  }
];

export function getDemoInputText() {
  return DEMO_INPUTS.join("\n");
}

export function buildDemoRows(options: { defaultRangeStart: number | null; defaultRangeEnd: number | null }) {
  return DEMO_PLAYLISTS.map((playlist, index): PlaylistRow => {
    const normalizedRange = normalizeRangeForTotal(
      options.defaultRangeStart,
      options.defaultRangeEnd,
      playlist.orderedDurationsSec.length
    );

    return {
      id: createRowId(),
      input: DEMO_INPUTS[index] ?? playlist.playlistId,
      playlistId: playlist.playlistId,
      status: "success",
      data: playlist,
      rangeStart: normalizedRange.rangeStart,
      rangeEnd: normalizedRange.rangeEnd
    };
  });
}
