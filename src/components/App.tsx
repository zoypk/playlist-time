import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import { WandSparkles } from "lucide-react";
import { toast } from "sonner";

import PlaylistsTable from "./PlaylistsTable";
import type {
  BatchPlaylistResponse,
  PersistedState,
  PlaylistRow,
  PlaylistApiDto,
} from "./types";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Toaster } from "./ui/sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import {
  createRowId,
  getExampleRows,
  parsePlaylistInput,
  reorderByIds,
  toNullablePositiveInt,
  tryExtractPlaylistId,
  isValidPlaylistId,
  classifyRowError,
  normalizeRangeForTotal,
  readSessionStorageItem,
  shouldSubmitPlaylistInputKey,
  writeSessionStorageJson,
} from "./utils";
import {
  STORAGE_KEY,
  PLAYLIST_CACHE_KEY,
  CLIENT_CACHE_MAX_AGE_MS,
  QUERY_STALE_TIME_MS,
  QUERY_CACHE_TIME_MS,
  DEFAULT_SORTING
} from "../config/constants";
import { getFriendlyError } from "../lib/ErrorHandler";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: QUERY_STALE_TIME_MS, gcTime: QUERY_CACHE_TIME_MS }
  }
});

/** Client-side cache entry for one playlist DTO. */
type PlaylistCacheEntry = {
  data: PlaylistApiDto;
  fetchedAt: number;
};

/** Session-scoped cache keyed by YouTube playlist id. */
type PlaylistCacheMap = Record<string, PlaylistCacheEntry>;

type FetchPlaylistsBatchOptions = {
  refresh?: boolean;
};

/** Reads the session-scoped playlist cache, returning an empty map on invalid data. */
function readPlaylistCache(): PlaylistCacheMap {
  const stored = readSessionStorageItem(PLAYLIST_CACHE_KEY);
  if (!stored) return {};

  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

/** Writes the playlist cache to session storage. */
function writePlaylistCache(cache: PlaylistCacheMap): void {
  writeSessionStorageJson(PLAYLIST_CACHE_KEY, cache);
}

/** Returns a fresh cached playlist DTO, or `null` when missing/stale. */
function getFreshCachedPlaylist(cache: PlaylistCacheMap, id: string): PlaylistApiDto | null {
  const entry = cache[id];
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CLIENT_CACHE_MAX_AGE_MS) return null;
  return entry.data;
}

async function fetchPlaylistsBatch(
  playlistIds: string[],
  options?: FetchPlaylistsBatchOptions
): Promise<BatchPlaylistResponse> {
  const requestUrl = new URL("/api/playlists", window.location.origin);
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
/**
 * Main analyzer container: input parsing, fetch orchestration,
 * local persistence, ordering mode, and table wiring.
 */
function AppInner(): React.ReactElement {
  const playlistCacheRef = React.useRef<PlaylistCacheMap>({});
  const isDemoModeRef = React.useRef(false);

  const [inputText, setInputText] = React.useState("");
  const [rows, setRows] = React.useState<PlaylistRow[]>([]);
  const [defaultRangeStart, setDefaultRangeStart] = React.useState<number | null>(null);
  const [defaultRangeEnd, setDefaultRangeEnd] = React.useState<number | null>(null);
  const [customSpeed, setCustomSpeed] = React.useState(2.25);
  const [sorting, setSorting] = React.useState<SortingState>(DEFAULT_SORTING);

  const visibleOrderRef = React.useRef<string[]>([]);

  /** Fetches and hydrates multiple rows in one backend batch call. */
  const hydrateRowsBatch = React.useCallback(
    async (
      targets: Array<{ rowId: string; playlistId: string }>,
      options?: { forceRefresh?: boolean }
    ): Promise<void> => {
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
          staleTime: forceRefresh ? 0 : QUERY_STALE_TIME_MS,
          gcTime: QUERY_CACHE_TIME_MS
        });

        const now = Date.now();
        for (const dto of batch.results) {
          playlistCacheRef.current[dto.playlistId] = { data: dto, fetchedAt: now };
        }
        writePlaylistCache(playlistCacheRef.current);

        const resultById = new Map(batch.results.map((entry) => [entry.playlistId, entry]));
        const errorById = new Map(batch.errors.map((entry) => [entry.playlistId, entry]));

        // Show toasts for each failed playlist
        for (const rowError of errorById.values()) {
          const errorType = classifyRowError(rowError.status, rowError.error);
          const errorMessage = getFriendlyError(errorType, rowError.error);
          toast.error("Failed to fetch playlist", {
            description: errorMessage
          });
        }

        setRows((prev) =>
          prev
            .map((entry) => {
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

              // If there's an error, return null to filter out this row
              if (errorById.has(target.playlistId)) {
                return null;
              }

              // This shouldn't happen but handle unexpected batch response
              toast.error("Failed to fetch playlist", {
                description: "Unexpected batch response for this playlist."
              });
              return null;
            })
            .filter((entry): entry is PlaylistRow => entry !== null)
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        const errorType = classifyRowError(500, message);
        const errorMessage = getFriendlyError(errorType, message);

        // Show a single toast for the batch error
        toast.error("Failed to fetch playlists", {
          description: errorMessage
        });

        setRows((prev) =>
          prev.filter((entry) => !targetByRowId.has(entry.id))
        );
      }
    },
    []
  );

  /** Restores persisted rows/settings on first mount. */
  React.useEffect(() => {
    playlistCacheRef.current = readPlaylistCache();

    const isDemoMode = new URLSearchParams(window.location.search).get("demo") === "1";
    isDemoModeRef.current = isDemoMode;

    if (isDemoMode) {
      setRows(getExampleRows());
      return;
    }

    const raw = readSessionStorageItem(STORAGE_KEY);
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
          : 2.25
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

  /** Persists relevant UI state to sessionStorage after each change. */
  React.useEffect(() => {
    if (isDemoModeRef.current) return;

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

    writeSessionStorageJson(STORAGE_KEY, payload);
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
    let invalidCount = 0;

    for (const token of tokens) {
      const maybeId = tryExtractPlaylistId(token);
      const rowId = createRowId();

      if (!maybeId || !isValidPlaylistId(maybeId)) {
        invalidCount++;
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

    if (invalidCount > 0) {
      toast.error(
        invalidCount === 1
          ? "Invalid playlist URL or ID"
          : `${invalidCount} invalid playlist URLs or IDs`,
        {
          description: "Please check your input and try again."
        }
      );
    }

    setRows((prev) => [...prev, ...newRows]);
    setInputText("");

    void hydrateRowsBatch(validRows);
  }, [defaultRangeEnd, defaultRangeStart, hydrateRowsBatch, inputText, rows]);

  return (
    <div className="space-y-4">
      <Card className="motion-panel-in overflow-hidden border-border-contrast/70 bg-surface-dark/90 shadow-lift">
        <div className="bg-[linear-gradient(180deg,rgba(26,36,40,0.94),rgba(8,12,14,0.92))] p-4 md:p-5">
          <div className="mb-4">
            <div>
              <p className="text-sm font-semibold text-white">Add playlists to compare</p>
              <p className="mt-1 text-xs text-warm-muted">Paste one per line, comma-separated links, or raw playlist IDs.</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
            <div className="flex min-w-0 flex-1 flex-col">
              <label className="mb-2 text-xs font-semibold text-warm-muted" htmlFor="playlist-input">
                Playlist URLs or IDs
              </label>
              <Textarea
                id="playlist-input"
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                onKeyDown={(event) => {
                  if (shouldSubmitPlaylistInputKey(event)) {
                    if (inputText.trim()) {
                      event.preventDefault();
                      analyzeInput();
                    }
                  }
                }}
                placeholder="Paste YouTube playlist URLs or IDs..."
                className="min-h-32 flex-1 resize-none border-border-contrast/60 bg-background-dark/80 font-mono leading-relaxed focus-visible:border-accent/45 lg:h-auto"
                aria-describedby="playlist-input-hint"
              />
              <p id="playlist-input-hint" className="sr-only">
                Paste one or more YouTube playlist URLs or IDs separated by spaces, commas, or new lines. Press Ctrl+Enter or use the Analyze button to submit.
              </p>
            </div>

            <div className="flex w-full min-h-32 flex-col justify-between gap-3 rounded-lg border border-border-dark bg-background-dark/70 p-3 shadow-inset transition-colors duration-200 hover:border-border-contrast/70 focus-within:border-accent/45 lg:w-[25rem]">
              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help text-xs font-semibold text-warm-muted">Default range</span>
                  </TooltipTrigger>
                  <TooltipContent>Automatically apply this range to newly added playlists</TooltipContent>
                </Tooltip>
                <div className="mt-2 flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Start"
                        value={defaultRangeStart ?? ""}
                        onChange={(event) => setDefaultRangeStart(toNullablePositiveInt(event.target.value))}
                        className="h-11 w-28 px-2 py-1 text-center text-sm"
                        inputMode="numeric"
                        aria-label="Default range start"
                      />
                    </TooltipTrigger>
                    <TooltipContent>First video index (1-based)</TooltipContent>
                  </Tooltip>
                  <span className="text-warm-muted">-</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Input
                        type="number"
                        min={1}
                        placeholder="End"
                        value={defaultRangeEnd ?? ""}
                        onChange={(event) => setDefaultRangeEnd(toNullablePositiveInt(event.target.value))}
                        className="h-11 w-28 px-2 py-1 text-center text-sm"
                        inputMode="numeric"
                        aria-label="Default range end"
                      />
                    </TooltipTrigger>
                    <TooltipContent>Last video index (1-based)</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={analyzeInput}
                    size="lg"
                    className="h-12 w-full gap-2 text-sm font-bold"
                    disabled={!inputText.trim()}
                  >
                    <WandSparkles className="size-4" aria-hidden="true" />
                    Analyze
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Parse playlist links/IDs and fetch duration data</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </Card>

      {rows.length === 0 && (
        <section className="grid gap-4 rounded-lg border border-border-dark bg-[linear-gradient(135deg,rgba(26,36,40,0.86),rgba(8,12,14,0.82))] p-5 text-left shadow-soft md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <p className="text-base font-semibold text-gray-100">Ready for playlist data</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-warm-muted">
              Use sample rows to inspect the comparison table before adding live YouTube playlists.
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="h-10 w-fit border-accent/35 text-xs font-semibold text-accent hover:border-accent hover:bg-accent-soft/70 hover:text-white"
                onClick={() => setRows(getExampleRows())}
              >
                <WandSparkles className="mr-2 size-3.5" />
                Load sample rows
              </Button>
            </TooltipTrigger>
            <TooltipContent>Load sample playlists to explore features</TooltipContent>
          </Tooltip>
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
      <Toaster position="bottom-right" richColors />
    </div>
  );
}

export default function App(): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppInner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
