import * as React from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import { BarChart3, WandSparkles } from "lucide-react";

import PlaylistsTable from "./PlaylistsTable";
import type {
  BatchPlaylistResponse,
  PersistedState,
  PlaylistApiDto,
  PlaylistRow,
} from "./types";
import { Button } from "./ui/button";
import { Card, CardHeader } from "./ui/card";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  classifyRowError,
  createRowId,
  isValidPlaylistId,
  normalizeRangeForTotal,
  parsePlaylistInput,
  reorderByIds,
  toNullablePositiveInt,
  tryExtractPlaylistId
} from "./utils";

const STORAGE_KEY = "playlist-time:v1";
const PLAYLIST_CACHE_KEY = "playlist-time:playlist-cache:v1";
const CLIENT_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const DEFAULT_SORTING: SortingState = [{ id: "speed_1", desc: true }];

type PlaylistCacheEntry = {
  data: PlaylistApiDto;
  fetchedAt: number;
};

type PlaylistCacheMap = Record<string, PlaylistCacheEntry>;

const API_BASE = (import.meta.env.PUBLIC_API_BASE ?? "").replace(/\/$/, "");

function readPlaylistCache(): PlaylistCacheMap {
  try {
    const raw = localStorage.getItem(PLAYLIST_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PlaylistCacheMap;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function writePlaylistCache(cache: PlaylistCacheMap) {
  try {
    localStorage.setItem(PLAYLIST_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage write failures.
  }
}

function getFreshCachedPlaylist(cache: PlaylistCacheMap, playlistId: string) {
  const entry = cache[playlistId];
  if (!entry) return null;
  if (!entry.data || !Number.isFinite(entry.fetchedAt)) return null;
  if (Date.now() - entry.fetchedAt > CLIENT_CACHE_MAX_AGE_MS) return null;
  return entry.data;
}

/**
 * Fetches multiple playlists in one request to reduce Worker invocations.
 */
async function fetchPlaylistsBatch(
  playlistIds: string[],
  options?: { refresh?: boolean }
): Promise<BatchPlaylistResponse> {
  const requestUrl = new URL(`${API_BASE}/api/playlists`, window.location.origin);
  requestUrl.searchParams.set("lists", playlistIds.join(","));
  if (options?.refresh) {
    requestUrl.searchParams.set("refresh", "1");
  }

  const response = await fetch(requestUrl.toString());

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    let message = "Failed to fetch playlist";
    if (contentType.includes("application/json")) {
      try {
        const json = (await response.json()) as { error?: string };
        message = json.error ?? message;
      } catch {
        // Ignore JSON parse failures.
      }
    } else {
      const text = (await response.text()).trim();
      if (text) message = text;
    }

    throw new Error(message);
  }

  return (await response.json()) as BatchPlaylistResponse;
}

/** Maps row error categories to user-facing copy. */
function getFriendlyError(type: PlaylistRow["errorType"], fallback?: string) {
  if (type === "invalid") return "Invalid playlist URL or ID.";
  if (type === "unavailable") return "Playlist is private, deleted, or unavailable.";
  if (type === "quota") return "YouTube API quota exceeded. Try again in a bit.";
  if (type === "network") return "Network/server error while fetching playlist.";
  return fallback || "Unexpected error while loading this playlist.";
}

/**
 * Main analyzer container: input parsing, fetch orchestration,
 * local persistence, ordering mode, and table wiring.
 */
function AppInner() {
  const queryClient = useQueryClient();
  const playlistCacheRef = React.useRef<PlaylistCacheMap>({});

  const [inputText, setInputText] = React.useState("");
  const [rows, setRows] = React.useState<PlaylistRow[]>([]);
  const [defaultRangeStart, setDefaultRangeStart] = React.useState<number | null>(null);
  const [defaultRangeEnd, setDefaultRangeEnd] = React.useState<number | null>(null);
  const [customSpeed, setCustomSpeed] = React.useState(2);
  const [sorting, setSorting] = React.useState<SortingState>(DEFAULT_SORTING);

  const visibleOrderRef = React.useRef<string[]>([]);

  /** Fetches and hydrates multiple rows in one backend batch call. */
  const hydrateRowsBatch = React.useCallback(
    async (targets: Array<{ rowId: string; playlistId: string }>, options?: { forceRefresh?: boolean }) => {
      if (!targets.length) return;
      const forceRefresh = options?.forceRefresh ?? false;

      const targetByRowId = new Map(targets.map((item) => [item.rowId, item]));
      const rowIdsByPlaylistId = new Map<string, string[]>();

      if (!forceRefresh) {
        for (const target of targets) {
          const cached = getFreshCachedPlaylist(playlistCacheRef.current, target.playlistId);
          if (!cached) {
            const ids = rowIdsByPlaylistId.get(target.playlistId) ?? [];
            ids.push(target.rowId);
            rowIdsByPlaylistId.set(target.playlistId, ids);
          }
        }
      } else {
        for (const target of targets) {
          const ids = rowIdsByPlaylistId.get(target.playlistId) ?? [];
          ids.push(target.rowId);
          rowIdsByPlaylistId.set(target.playlistId, ids);
        }
      }

      setRows((prev) =>
        prev.map((entry) => {
          const target = targetByRowId.get(entry.id);
          if (!target) return entry;

          if (!forceRefresh) {
            const cached = getFreshCachedPlaylist(playlistCacheRef.current, target.playlistId);
            if (cached) {
              const normalizedRange = normalizeRangeForTotal(
                entry.rangeStart,
                entry.rangeEnd,
                cached.orderedDurationsSec.length
              );
              return {
                ...entry,
                status: "success",
                loadingLabel: undefined,
                data: cached,
                errorType: undefined,
                errorMessage: undefined,
                rangeStart: normalizedRange.rangeStart,
                rangeEnd: normalizedRange.rangeEnd
              };
            }
          }

          return {
            ...entry,
            status: "loading",
            loadingLabel: "Fetching..."
          };
        })
      );

      const playlistIds = [...rowIdsByPlaylistId.keys()];
      if (!playlistIds.length) return;

      try {
        const sortedIds = [...playlistIds].sort();
        const batch = await queryClient.fetchQuery({
          queryKey: ["playlists-batch", forceRefresh ? "refresh" : "normal", ...sortedIds],
          queryFn: () => fetchPlaylistsBatch(sortedIds, { refresh: forceRefresh }),
          staleTime: forceRefresh ? 0 : 1000 * 60 * 5,
          gcTime: 1000 * 60 * 60
        });

        const now = Date.now();
        for (const dto of batch.results) {
          playlistCacheRef.current[dto.playlistId] = {
            data: dto,
            fetchedAt: now
          };
        }
        writePlaylistCache(playlistCacheRef.current);

        const resultById = new Map(batch.results.map((entry) => [entry.playlistId, entry]));
        const errorById = new Map(batch.errors.map((entry) => [entry.playlistId, entry]));

        setRows((prev) =>
          prev.map((entry) => {
            const target = targetByRowId.get(entry.id);
            if (!target) return entry;

            const data = resultById.get(target.playlistId);
            if (data) {
              const normalizedRange = normalizeRangeForTotal(
                entry.rangeStart,
                entry.rangeEnd,
                data.orderedDurationsSec.length
              );

              return {
                ...entry,
                status: "success",
                loadingLabel: undefined,
                data,
                errorType: undefined,
                errorMessage: undefined,
                rangeStart: normalizedRange.rangeStart,
                rangeEnd: normalizedRange.rangeEnd
              };
            }

            const rowError = errorById.get(target.playlistId);
            if (rowError) {
              const errorType = classifyRowError(rowError.status, rowError.error);
              return {
                ...entry,
                status: "error",
                loadingLabel: undefined,
                data: undefined,
                errorType,
                errorMessage: getFriendlyError(errorType, rowError.error)
              };
            }

            return {
              ...entry,
              status: "error",
              loadingLabel: undefined,
              data: undefined,
              errorType: "unknown",
              errorMessage: "Unexpected batch response for this playlist."
            };
          })
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        const errorType = classifyRowError(500, message);

        setRows((prev) =>
          prev.map((entry) => {
            const target = targetByRowId.get(entry.id);
            if (!target) return entry;
            return {
              ...entry,
              status: "error",
              loadingLabel: undefined,
              data: undefined,
              errorType,
              errorMessage: getFriendlyError(errorType, message)
            };
          })
        );
      }
    },
    [queryClient]
  );

  /** Restores persisted rows/settings on first mount. */
  React.useEffect(() => {
    playlistCacheRef.current = readPlaylistCache();

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed.version !== 1) return;

      setSorting(parsed.sorting?.length ? parsed.sorting : DEFAULT_SORTING);
      setDefaultRangeStart(parsed.defaultRangeStart ?? null);
      setDefaultRangeEnd(parsed.defaultRangeEnd ?? null);
      setCustomSpeed(
        typeof parsed.customSpeed === "number" && parsed.customSpeed >= 0.1 && parsed.customSpeed <= 3
          ? parsed.customSpeed
          : 2
      );

      if (!Array.isArray(parsed.playlists) || !parsed.playlists.length) {
        return;
      }

      const restoredRows: PlaylistRow[] = parsed.playlists.map((entry) => {
        const cached = getFreshCachedPlaylist(playlistCacheRef.current, entry.playlistId);
        if (cached) {
          const normalizedRange = normalizeRangeForTotal(
            entry.rangeStart,
            entry.rangeEnd,
            cached.orderedDurationsSec.length
          );

          return {
            id: createRowId(),
            input: entry.input || entry.playlistId,
            playlistId: entry.playlistId,
            status: "success",
            data: cached,
            rangeStart: normalizedRange.rangeStart,
            rangeEnd: normalizedRange.rangeEnd
          };
        }

        return {
          id: createRowId(),
          input: entry.input || entry.playlistId,
          playlistId: entry.playlistId,
          status: "loading",
          loadingLabel: "Fetching...",
          rangeStart: entry.rangeStart,
          rangeEnd: entry.rangeEnd
        };
      });

      setRows(restoredRows);
      const pending = restoredRows
        .filter((row) => row.status !== "success" && row.playlistId)
        .map((row) => ({ rowId: row.id, playlistId: row.playlistId as string }));
      void hydrateRowsBatch(pending);
    } catch {
      // Ignore invalid persisted state.
    }
  }, [hydrateRowsBatch]);

  /** Persists relevant UI state to localStorage after each change. */
  React.useEffect(() => {
    const payload: PersistedState = {
      version: 1,
      sorting,
      defaultRangeStart,
      defaultRangeEnd,
      customSpeed,
      playlists: rows
        .filter((row) => Boolean(row.playlistId))
        .map((row) => ({
          playlistId: row.playlistId as string,
          input: row.input,
          rangeStart: row.rangeStart,
          rangeEnd: row.rangeEnd
        }))
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [customSpeed, defaultRangeEnd, defaultRangeStart, rows, sorting]);

  /** Parses pasted input, appends rows, and starts fetches for valid playlist IDs. */
  const analyzeInput = React.useCallback(() => {
    const tokens = parsePlaylistInput(inputText);
    if (!tokens.length) return;

    const newRows: PlaylistRow[] = [];
    const validRows: Array<{ rowId: string; playlistId: string }> = [];
    const existingIds = new Set(
      rows
        .map((entry) => entry.playlistId)
        .filter((entry): entry is string => Boolean(entry))
    );
    const pendingIds = new Set<string>();

    for (const token of tokens) {
      const maybeId = tryExtractPlaylistId(token);
      const rowId = createRowId();

      if (!maybeId || !isValidPlaylistId(maybeId)) {
        newRows.push({
          id: rowId,
          input: token,
          playlistId: null,
          status: "error",
          errorType: "invalid",
          errorMessage: "Invalid playlist URL or ID.",
          rangeStart: null,
          rangeEnd: null
        });
        continue;
      }

      if (existingIds.has(maybeId) || pendingIds.has(maybeId)) {
        continue;
      }

      pendingIds.add(maybeId);

      const baseRangeStart = defaultRangeStart;
      const baseRangeEnd = defaultRangeEnd;
      const cached = getFreshCachedPlaylist(playlistCacheRef.current, maybeId);

      if (cached) {
        const normalizedRange = normalizeRangeForTotal(baseRangeStart, baseRangeEnd, cached.orderedDurationsSec.length);
        newRows.push({
          id: rowId,
          input: token,
          playlistId: maybeId,
          status: "success",
          data: cached,
          rangeStart: normalizedRange.rangeStart,
          rangeEnd: normalizedRange.rangeEnd
        });
        continue;
      }

      newRows.push({
        id: rowId,
        input: token,
        playlistId: maybeId,
        status: "loading",
        loadingLabel: "Fetching...",
        rangeStart: baseRangeStart,
        rangeEnd: baseRangeEnd
      });

      validRows.push({ rowId, playlistId: maybeId });
    }

    setRows((prev) => [...prev, ...newRows]);
    setInputText("");

    void hydrateRowsBatch(validRows);
  }, [defaultRangeEnd, defaultRangeStart, hydrateRowsBatch, inputText, rows]);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
            <div className="min-w-0 flex-1">
              <Textarea
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                placeholder="Paste YouTube playlist URLs or IDs (newline, comma, or space separated)..."
                className="h-24 resize-none font-mono leading-relaxed"
              />
            </div>

            <div className="w-full rounded-lg border border-border-dark bg-surface-dark p-3 lg:w-[300px]">
              <div className="mb-3">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Default range</span>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    placeholder="Start"
                    value={defaultRangeStart ?? ""}
                    onChange={(event) => setDefaultRangeStart(toNullablePositiveInt(event.target.value))}
                    className="h-8 w-20 px-2 py-1 text-center text-xs"
                  />
                  <span className="text-gray-600">-</span>
                  <Input
                    type="number"
                    min={1}
                    placeholder="End"
                    value={defaultRangeEnd ?? ""}
                    onChange={(event) => setDefaultRangeEnd(toNullablePositiveInt(event.target.value))}
                    className="h-8 w-20 px-2 py-1 text-center text-xs"
                  />
                </div>
              </div>

              <Button
                type="button"
                onClick={analyzeInput}
                size="lg"
                className="w-full gap-2 text-sm font-bold tracking-wide active:scale-[0.98]"
              >
                <BarChart3 className="size-4" />
                Analyze
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {rows.length === 0 && (
        <section className="rounded-xl border border-border-dark bg-black/60 p-8 text-center">
          <p className="text-lg font-semibold text-gray-100">Compare playlist time at every speed in one table.</p>
          <p className="mt-2 text-sm text-gray-400">
            Paste one or more playlist URLs/IDs above, then adjust custom speed and per-playlist ranges.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4 text-xs font-semibold uppercase tracking-wide"
            onClick={() =>
              setInputText(
                [
                  "https://www.youtube.com/playlist?list=PL590L5WQmH8fJ54F1f9FBM1v4M6V6Ak3M",
                  "PLRqwX-V7Uu6Y7MDQ8xqNf4j2FfN6Q4jzP"
                ].join("\n")
              )
            }
          >
            <WandSparkles className="mr-2 size-3.5" />
            Example
          </Button>
        </section>
      )}

      {rows.length > 0 && (
        <section className="space-y-3">
          <PlaylistsTable
            rows={rows}
            sorting={sorting}
            customSpeed={customSpeed}
            onCustomSpeedCommit={setCustomSpeed}
            onSortingChange={setSorting}
            onRangeApply={(rowId, start, end) => {
              setRows((prev) =>
                prev.map((entry) =>
                  entry.id === rowId
                    ? {
                        ...entry,
                        rangeStart: start,
                        rangeEnd: end
                      }
                    : entry
                )
              );
            }}
            onRemoveRow={(rowId) => {
              setRows((prev) => prev.filter((entry) => entry.id !== rowId));
            }}
            onReorderRows={(sourceId, destinationId) => {
              setRows((prev) => {
                const base = sorting.length ? reorderByIds(prev, visibleOrderRef.current) : prev;
                const sourceIndex = base.findIndex((entry) => entry.id === sourceId);
                const destinationIndex = base.findIndex((entry) => entry.id === destinationId);
                if (sourceIndex < 0 || destinationIndex < 0) return prev;

                const next = [...base];
                const [item] = next.splice(sourceIndex, 1);
                next.splice(destinationIndex, 0, item);
                if (sorting.length) {
                  setSorting([]);
                }
                return next;
              });
            }}
            onVisibleOrderChange={(ids) => {
              visibleOrderRef.current = ids;
            }}
          />
        </section>
      )}
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60,
      retry: 1
    }
  }
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  );
}
