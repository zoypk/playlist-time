import type { PlaylistDto } from "../shared/contracts";

export type PlaylistApiDto = PlaylistDto;

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
  loadingLabel?: "Fetching...";
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
  selectedDuration: number;
  isAll: boolean;
};

export type RowMetrics = {
  range: RangeInfo;
  selectedDurationSec: number;
  avgLengthSec: number;
};

export type PersistedState = {
  version: 1;
  sorting: Array<{ id: string; desc: boolean }>;
  defaultRangeStart: number | null;
  defaultRangeEnd: number | null;
  customSpeed: number;
  playlists: Array<{
    playlistId: string;
    input: string;
    rangeStart: number | null;
    rangeEnd: number | null;
  }>;
};

export type BatchPlaylistError = {
  playlistId: string;
  status: number;
  error: string;
};

export type BatchPlaylistResponse = {
  results: PlaylistApiDto[];
  errors: BatchPlaylistError[];
  meta: {
    requested: number;
    processed: number;
    succeeded: number;
    failed: number;
    truncated: boolean;
    limit: number;
    cache: {
      hit: number;
      miss: number;
      bypass: number;
    };
  };
};
