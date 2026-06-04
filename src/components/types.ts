import type {
  BatchPlaylistResponse as SharedBatchPlaylistResponse,
  PlaylistDto
} from "../shared/contracts";

export type PlaylistApiDto = PlaylistDto;

/** Lifecycle state for a playlist row in the analyzer table. */
type PlaylistRowStatus = "loading" | "success" | "error";

/** Error categories displayed by row badges and toast messages. */
export type PlaylistRowErrorType =
  | "invalid"
  | "quota"
  | "unavailable"
  | "network"
  | "unknown";

/** Client-side row model for a single submitted playlist. */
export type PlaylistRow = {
  /** Local-only row identifier used for rendering, ordering, and updates. */
  id: string;
  /** Original token supplied by the user. */
  input: string;
  /** Parsed YouTube playlist id, or `null` while invalid/unavailable. */
  playlistId: string | null;
  /** Current load state for the row. */
  status: PlaylistRowStatus;
  /** Optional short loading copy for in-table placeholders. */
  loadingLabel?: "Fetching...";
  /** Successful backend payload for the row. */
  data?: PlaylistApiDto;
  /** Display category derived from API or network failures. */
  errorType?: PlaylistRowErrorType;
  /** Human-readable error copy for UI surfaces. */
  errorMessage?: string;
  /** 1-based inclusive range start, or `null` for all videos. */
  rangeStart: number | null;
  /** 1-based inclusive range end, or `null` for all videos. */
  rangeEnd: number | null;
};

/** Normalized range details used for rendering and summary calculations. */
export type RangeInfo = {
  unavailable: boolean;
  totalVideos: number;
  start: number;
  end: number;
  selectedCount: number;
  selectedDuration: number;
  isAll: boolean;
};

/** Derived metrics for a row's active playlist range. */
export type RowMetrics = {
  range: RangeInfo;
  selectedDurationSec: number;
  avgLengthSec: number;
};

/** Session-persisted UI state stored in `sessionStorage`. */
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

/** Batch API response consumed by the client fetcher. */
export type BatchPlaylistResponse = SharedBatchPlaylistResponse;
