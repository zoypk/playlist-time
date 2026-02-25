import type { PlaylistRow, PlaylistRowErrorType, RangeInfo, RowMetrics } from "./types";

const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9_-]{10,100}$/;

/** Playback speeds shown as fixed columns in the grid. */
export const BUILT_IN_SPEEDS = [1, 1.25, 1.5, 1.75] as const;

/** Clamps a numeric value to an inclusive range. */
export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Parses a positive integer from an input string.
 * Returns `null` for blank/invalid/non-positive values.
 */
export function toNullablePositiveInt(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

/** Splits pasted text into tokens using newline/comma/whitespace delimiters. */
export function parsePlaylistInput(text: string) {
  return text
    .split(/[\n,;\t\s]+/g)
    .map(normalizeInputToken)
    .filter(Boolean);
}

/**
 * Normalizes raw pasted tokens before ID extraction.
 * Handles missing protocols, wrapping punctuation, and encoded values.
 */
function normalizeInputToken(value: string) {
  let token = value.trim();
  if (!token) return "";

  token = token.replace(/^["'`<{(\[\s]+/g, "");
  token = token.replace(/["'`>})\]\s]+$/g, "");
  token = token.replace(/[),;]+$/g, "");
  if (!token) return "";

  if (/^(www\.|m\.youtube\.com|youtube\.com|youtu\.be)/i.test(token)) {
    token = `https://${token}`;
  }

  if (token.includes("%")) {
    try {
      token = decodeURIComponent(token);
    } catch {
      // Keep original token if decoding fails.
    }
  }

  return token.trim();
}

/**
 * Extracts a playlist ID from a YouTube URL or raw ID input.
 */
export function tryExtractPlaylistId(value: string) {
  const raw = normalizeInputToken(value);
  if (!raw) return null;

  const directListMatch = raw.match(/(?:^|[?&])list=([A-Za-z0-9_-]{10,100})(?:$|[&#])/i);
  if (directListMatch?.[1]) return directListMatch[1];

  const prefixedMatch = raw.match(/^list=([A-Za-z0-9_-]{10,100})$/i);
  if (prefixedMatch?.[1]) return prefixedMatch[1];

  try {
    const url = new URL(raw);
    const list = url.searchParams.get("list");
    if (list) return list;
  } catch {
    try {
      const url = new URL(`https://${raw}`);
      const list = url.searchParams.get("list");
      if (list) return list;
    } catch {
      // Non-URL input is treated as raw playlist ID.
    }
  }

  return raw;
}

export function isValidPlaylistId(value: string) {
  return PLAYLIST_ID_PATTERN.test(value);
}

/** Creates a stable row id for client-side playlist entries. */
export function createRowId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Formats seconds into compact watch-time strings used in table cells. */
export function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}h ${String(mins).padStart(2, "0")}m`;
  }

  return `${mins}m ${String(secs).padStart(2, "0")}s`;
}

/**
 * Formats average duration with minute/second precision for short clips
 * and hour/minute precision for long clips.
 */
export function formatAvgDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${h}h ${String(remMins).padStart(2, "0")}m`;
  }
  return `${mins}m ${String(secs).padStart(2, "0")}s`;
}

/** Formats large view totals using compact notation. */
export function formatViews(value: number) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

/** Formats an ISO date as a readable calendar label. */
export function formatDateLabel(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

/** Formats an ISO date into a relative time label, e.g. "2 months ago". */
export function formatRelativeTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diffMs / hour), "hour");
  if (abs < month) return rtf.format(Math.round(diffMs / day), "day");
  if (abs < year) return rtf.format(Math.round(diffMs / month), "month");
  return rtf.format(Math.round(diffMs / year), "year");
}

/**
 * Computes effective range metadata for a row based on current row data
 * and user-selected start/end bounds.
 */
export function getRangeInfo(row: PlaylistRow): RangeInfo {
  if (row.status !== "success" || !row.data || !Array.isArray(row.data.orderedDurationsSec)) {
    return {
      unavailable: true,
      totalVideos: 0,
      start: 1,
      end: 0,
      selectedCount: 0,
      selectedDuration: 0,
      isAll: true
    };
  }

  const totalVideos = row.data.orderedDurationsSec.length;
  if (totalVideos <= 0) {
    return {
      unavailable: false,
      totalVideos,
      start: 1,
      end: 0,
      selectedCount: 0,
      selectedDuration: 0,
      isAll: true
    };
  }

  const requestedStart = row.rangeStart ?? 1;
  const requestedEnd = row.rangeEnd ?? totalVideos;

  const start = clamp(requestedStart, 1, totalVideos);
  const end = clamp(Math.max(requestedEnd, start), start, totalVideos);
  const selectedCount = Math.max(0, end - start + 1);
  
  const selectedDurations = row.data.orderedDurationsSec.slice(start - 1, end);
  const selectedDuration = selectedDurations.reduce((sum, dur) => sum + (dur || 0), 0);

  return {
    unavailable: false,
    totalVideos,
    start,
    end,
    selectedCount,
    selectedDuration,
    isAll: start === 1 && end === totalVideos
  };
}

/**
 * Computes selected duration and average video length for a row's active range.
 */
export function getRowMetrics(row: PlaylistRow): RowMetrics {
  const range = getRangeInfo(row);

  if (range.unavailable || row.status !== "success" || !row.data) {
    return {
      range,
      selectedDurationSec: 0,
      avgLengthSec: 0
    };
  }

  const selected = row.data.orderedDurationsSec.slice(range.start - 1, range.end);
  const selectedDurationSec = selected.reduce((sum, item) => sum + (item || 0), 0);
  const avgLengthSec = range.selectedCount > 0 ? selectedDurationSec / range.selectedCount : 0;

  return {
    range,
    selectedDurationSec,
    avgLengthSec
  };
}

/** Human-friendly label shown in the range pill. */
export function getRangePillLabel(range: RangeInfo) {
  if (range.unavailable) return "Range unavailable";
  if (range.totalVideos === 0) return "All (0)";
  if (range.isAll) return `All (${range.start}-${range.end})`;
  return `${range.start}-${range.end}`;
}

/**
 * Reorders rows by a list of ids while preserving unknown ids at the end.
 */
export function reorderByIds<T extends { id: string }>(items: T[], orderedIds: string[]) {
  if (!orderedIds.length) return items;
  const indexById = new Map(orderedIds.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const ai = indexById.get(a.id);
    const bi = indexById.get(b.id);
    if (ai == null && bi == null) return 0;
    if (ai == null) return 1;
    if (bi == null) return -1;
    return ai - bi;
  });
}

/** Tooltip text for time delta vs 1x playback. */
export function speedCellTooltip(oneXSeconds: number, speedSeconds: number) {
  if (oneXSeconds <= 0) return;
  const delta = oneXSeconds - speedSeconds;
  if (Math.abs(delta) < 1) return;
  if (delta > 0) return `-${formatDuration(delta)}`;
  return `+${formatDuration(Math.abs(delta))} `;
}

/** Maps API/network errors to display-friendly row error categories. */
export function classifyRowError(status: number, message: string): PlaylistRowErrorType {
  const normalized = message.toLowerCase();

  if (status === 400 || normalized.includes("invalid")) return "invalid";
  if (status === 403 || status === 429 || normalized.includes("quota") || normalized.includes("rate")) {
    return "quota";
  }
  if (status === 404 || normalized.includes("private") || normalized.includes("unavailable")) {
    return "unavailable";
  }
  if (status >= 500 || normalized.includes("network")) return "network";
  return "unknown";
}

/**
 * Normalizes optional range bounds against playlist length.
 * Returns null bounds if playlist length is unknown/empty.
 */
export function normalizeRangeForTotal(
  start: number | null,
  end: number | null,
  totalVideos: number
): { rangeStart: number | null; rangeEnd: number | null } {
  if (totalVideos <= 0) {
    return { rangeStart: null, rangeEnd: null };
  }

  const normalizedStart = start == null ? null : clamp(start, 1, totalVideos);
  const normalizedEnd = end == null ? null : clamp(end, 1, totalVideos);

  if (normalizedStart != null && normalizedEnd != null) {
    return {
      rangeStart: Math.min(normalizedStart, normalizedEnd),
      rangeEnd: Math.max(normalizedStart, normalizedEnd)
    };
  }

  return {
    rangeStart: normalizedStart,
    rangeEnd: normalizedEnd
  };
}

/** Mock data for example playlists - realistic tutorial and shorts series. */
const EXAMPLE_DATA_1 = {
  playlistId: "PLexample001",
  title: "Learn React in 100 Videos",
  channelTitle: "Code Academy",
  thumbnailUrl: "https://placehold.co/120x90/ec1313/ffffff?text=React",
  publishedAt: "2023-06-15T10:00:00Z",
  totalVideoViewsSum: 2500000,
  orderedDurationsSec: [
    // 100 videos with realistic durations (mostly 10-20 mins, some longer)
    ...Array(20).fill(600), // 10 min videos
    ...Array(30).fill(900), // 15 min videos
    ...Array(25).fill(1200), // 20 min videos
    ...Array(15).fill(1500), // 25 min videos
    ...Array(10).fill(1800), // 30 min videos
  ],
};

const EXAMPLE_DATA_2 = {
  playlistId: "PLexample002",
  title: "Web Dev Shorts",
  channelTitle: "Quick Code",
  thumbnailUrl: "https://placehold.co/120x90/ec1313/ffffff?text=WebDev",
  publishedAt: "2024-01-20T14:30:00Z",
  totalVideoViewsSum: 1800000,
  orderedDurationsSec: [
    // 50 short videos (mostly 3-8 minutes)
    ...Array(20).fill(180), // 3 min videos
    ...Array(15).fill(300), // 5 min videos
    ...Array(10).fill(420), // 7 min videos
    ...Array(5).fill(480), // 8 min videos
  ],
};

/** Returns example playlist rows with mock data for demonstration. */
export function getExampleRows(): PlaylistRow[] {
  return [
    {
      id: createRowId(),
      input: `list=${EXAMPLE_DATA_1.playlistId}`,
      playlistId: EXAMPLE_DATA_1.playlistId,
      status: "success",
      data: EXAMPLE_DATA_1,
      rangeStart: null,
      rangeEnd: null
    },
    {
      id: createRowId(),
      input: `list=${EXAMPLE_DATA_2.playlistId}`,
      playlistId: EXAMPLE_DATA_2.playlistId,
      status: "success",
      data: EXAMPLE_DATA_2,
      rangeStart: null,
      rangeEnd: null
    }
  ];
}
