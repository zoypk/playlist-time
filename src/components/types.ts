export type OrderMode = "sorted" | "manual";

export type PlaylistApiDto = {
  playlistId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  lastAddedAt: string | null;
  totalVideos: number;
  totalDurationSec: number;
  totalVideoViewsSum: number;
  orderedDurationsSec: number[];
  unavailableVideoCount?: number;
};

export type PlaylistRowStatus = "loading" | "success" | "error";

export type PlaylistRowErrorType =
  | "invalid"
  | "quota"
  | "unavailable"
  | "network"
  | "unknown";

export type PlaylistRow = {
  id: string;
  input: string;
  playlistId: string | null;
  status: PlaylistRowStatus;
  loadingLabel?: "Fetching..." | "Calculating...";
  data?: PlaylistApiDto;
  errorType?: PlaylistRowErrorType;
  errorMessage?: string;
  rangeStart: number | null;
  rangeEnd: number | null;
};

export type RangeInfo = {
  unavailable: boolean;
  totalVideos: number;
  start: number;
  end: number;
  selectedCount: number;
  isAll: boolean;
};

export type RowMetrics = {
  range: RangeInfo;
  selectedDurationSec: number;
  avgLengthSec: number;
};

export type PersistedState = {
  version: 1;
  orderMode: OrderMode;
  sorting: Array<{ id: string; desc: boolean }>;
  defaultRangeStart: number | null;
  defaultRangeEnd: number | null;
  applyToAll: boolean;
  customSpeed: number;
  playlists: Array<{
    playlistId: string;
    input: string;
    rangeStart: number | null;
    rangeEnd: number | null;
  }>;
};
