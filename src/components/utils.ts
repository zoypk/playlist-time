import type { PlaylistRow, PlaylistRowErrorType, RangeInfo, RowMetrics } from "./types";

const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9_-]{10,100}$/;

export const BUILT_IN_SPEEDS = [0.5, 1, 1.25, 1.5, 2] as const;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function toNullablePositiveInt(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function parsePlaylistInput(text: string) {
  return text
    .split(/[\n,\s]+/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function tryExtractPlaylistId(value: string) {
  const raw = value.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    const list = url.searchParams.get("list");
    if (list) return list;
  } catch {
    // Non-URL input is treated as raw playlist ID.
  }

  return raw;
}

export function isValidPlaylistId(value: string) {
  return PLAYLIST_ID_PATTERN.test(value);
}

export function createRowId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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

export function formatViews(value: number) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

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

export function getRangeInfo(row: PlaylistRow): RangeInfo {
  if (row.status !== "success" || !row.data || !Array.isArray(row.data.orderedDurationsSec)) {
    return {
      unavailable: true,
      totalVideos: 0,
      start: 1,
      end: 0,
      selectedCount: 0,
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
      isAll: true
    };
  }

  const requestedStart = row.rangeStart ?? 1;
  const requestedEnd = row.rangeEnd ?? totalVideos;

  const start = clamp(requestedStart, 1, totalVideos);
  const end = clamp(Math.max(requestedEnd, start), start, totalVideos);
  const selectedCount = Math.max(0, end - start + 1);

  return {
    unavailable: false,
    totalVideos,
    start,
    end,
    selectedCount,
    isAll: start === 1 && end === totalVideos
  };
}

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

export function getRangePillLabel(range: RangeInfo) {
  if (range.unavailable) return "Range unavailable";
  if (range.totalVideos === 0) return "All (0)";
  if (range.isAll) return `All (${range.start}-${range.end})`;
  return `${range.start}-${range.end}`;
}

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

export function moveArrayItem<T>(items: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [entry] = next.splice(from, 1);
  next.splice(to, 0, entry);
  return next;
}

export function speedCellTooltip(oneXSeconds: number, speedSeconds: number) {
  const delta = oneXSeconds - speedSeconds;
  if (Math.abs(delta) < 1) return "Same as 1x";
  if (delta > 0) return `Save ${formatDuration(delta)} vs 1x`;
  return `Adds ${formatDuration(Math.abs(delta))} vs 1x`;
}

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
