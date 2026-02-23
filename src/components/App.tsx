import * as React from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import { BarChart3, WandSparkles } from "lucide-react";

import PlaylistsTable, { reorderRowsByKeyboard } from "./PlaylistsTable";
import SpeedControl from "./SpeedControl";
import type { OrderMode, PersistedState, PlaylistApiDto, PlaylistRow } from "./types";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
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
const DEFAULT_SORTING: SortingState = [{ id: "speed_1", desc: true }];

class PlaylistApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PlaylistApiError";
    this.status = status;
  }
}

const API_BASE = (import.meta.env.PUBLIC_API_BASE ?? "").replace(/\/$/, "");

/**
 * Fetches playlist analysis payload from the backend proxy endpoint.
 * Throws a typed error so row-level error mapping can use HTTP status.
 */
async function fetchPlaylist(playlistId: string): Promise<PlaylistApiDto> {
  const response = await fetch(`${API_BASE}/api/playlist?list=${encodeURIComponent(playlistId)}`);

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

    throw new PlaylistApiError(message, response.status);
  }

  return (await response.json()) as PlaylistApiDto;
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

  const [inputText, setInputText] = React.useState("");
  const [rows, setRows] = React.useState<PlaylistRow[]>([]);
  const [defaultRangeStart, setDefaultRangeStart] = React.useState<number | null>(null);
  const [defaultRangeEnd, setDefaultRangeEnd] = React.useState<number | null>(null);
  const [applyToAll, setApplyToAll] = React.useState(true);
  const [customSpeed, setCustomSpeed] = React.useState(2.5);
  const [orderMode, setOrderMode] = React.useState<OrderMode>("sorted");
  const [sorting, setSorting] = React.useState<SortingState>(DEFAULT_SORTING);

  const visibleOrderRef = React.useRef<string[]>([]);

  /** Fetches and hydrates a single row from loading to success/error state. */
  const hydrateRow = React.useCallback(
    async (rowId: string, playlistId: string) => {
      setRows((prev) =>
        prev.map((entry) =>
          entry.id === rowId ? { ...entry, status: "loading", loadingLabel: "Fetching..." } : entry
        )
      );

      try {
        const data = await queryClient.fetchQuery({
          queryKey: ["playlist", playlistId],
          queryFn: () => fetchPlaylist(playlistId),
          staleTime: 1000 * 60 * 60 * 6,
          gcTime: 1000 * 60 * 60 * 12
        });

        setRows((prev) =>
          prev.map((entry) =>
            entry.id === rowId ? { ...entry, status: "loading", loadingLabel: "Calculating..." } : entry
          )
        );

        await Promise.resolve();

        setRows((prev) =>
          prev.map((entry) => {
            if (entry.id !== rowId) return entry;
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
          })
        );
      } catch (error) {
        const status = error instanceof PlaylistApiError ? error.status : 0;
        const message = error instanceof Error ? error.message : "Unknown error";
        const errorType = classifyRowError(status, message);

        setRows((prev) =>
          prev.map((entry) =>
            entry.id === rowId
              ? {
                  ...entry,
                  status: "error",
                  loadingLabel: undefined,
                  data: undefined,
                  errorType,
                  errorMessage: getFriendlyError(errorType, message)
                }
              : entry
          )
        );
      }
    },
    [queryClient]
  );

  /** Restores persisted rows/settings on first mount. */
  React.useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed.version !== 1) return;

      setOrderMode(parsed.orderMode ?? "sorted");
      setSorting(parsed.sorting?.length ? parsed.sorting : DEFAULT_SORTING);
      setDefaultRangeStart(parsed.defaultRangeStart ?? null);
      setDefaultRangeEnd(parsed.defaultRangeEnd ?? null);
      setApplyToAll(parsed.applyToAll ?? true);
      setCustomSpeed(typeof parsed.customSpeed === "number" ? parsed.customSpeed : 2.5);

      if (!Array.isArray(parsed.playlists) || !parsed.playlists.length) {
        return;
      }

      const restoredRows: PlaylistRow[] = parsed.playlists.map((entry) => ({
        id: createRowId(),
        input: entry.input || entry.playlistId,
        playlistId: entry.playlistId,
        status: "loading",
        loadingLabel: "Fetching...",
        rangeStart: entry.rangeStart,
        rangeEnd: entry.rangeEnd
      }));

      setRows(restoredRows);
      for (const row of restoredRows) {
        void hydrateRow(row.id, row.playlistId as string);
      }
    } catch {
      // Ignore invalid persisted state.
    }
  }, [hydrateRow]);

  /** Persists relevant UI state to localStorage after each change. */
  React.useEffect(() => {
    const payload: PersistedState = {
      version: 1,
      orderMode,
      sorting,
      defaultRangeStart,
      defaultRangeEnd,
      applyToAll,
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
  }, [applyToAll, customSpeed, defaultRangeEnd, defaultRangeStart, orderMode, rows, sorting]);

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

      newRows.push({
        id: rowId,
        input: token,
        playlistId: maybeId,
        status: "loading",
        loadingLabel: "Fetching...",
        rangeStart: applyToAll ? defaultRangeStart : null,
        rangeEnd: applyToAll ? defaultRangeEnd : null
      });

      validRows.push({ rowId, playlistId: maybeId });
    }

    setRows((prev) => [...prev, ...newRows]);
    setInputText("");

    for (const row of validRows) {
      void hydrateRow(row.rowId, row.playlistId);
    }
  }, [applyToAll, defaultRangeEnd, defaultRangeStart, hydrateRow, inputText, rows]);

  /** Switches between sortable mode and manual (drag/keyboard) ordering mode. */
  const toggleOrderMode = (nextMode: OrderMode) => {
    if (nextMode === orderMode) return;

    if (nextMode === "manual") {
      setRows((prev) => reorderByIds(prev, visibleOrderRef.current));
      setSorting([]);
      setOrderMode("manual");
      return;
    }

    setOrderMode("sorted");
    setSorting((prev) => (prev.length ? prev : DEFAULT_SORTING));
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardHeader>
          <Textarea
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            placeholder="Paste YouTube playlist URLs or IDs (newline, comma, or space separated)..."
            className="h-24 resize-none font-mono leading-relaxed"
          />
        </CardHeader>

        <CardContent className="flex flex-wrap items-center justify-between gap-4 bg-surface-dark p-3">
          <div className="flex flex-wrap items-center gap-4 px-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Default range</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  placeholder="Start"
                  value={defaultRangeStart ?? ""}
                  onChange={(event) => setDefaultRangeStart(toNullablePositiveInt(event.target.value))}
                  className="h-7 w-16 px-2 py-1 text-center text-xs"
                />
                <span className="text-gray-600">-</span>
                <Input
                  type="number"
                  min={1}
                  placeholder="End"
                  value={defaultRangeEnd ?? ""}
                  onChange={(event) => setDefaultRangeEnd(toNullablePositiveInt(event.target.value))}
                  className="h-7 w-16 px-2 py-1 text-center text-xs"
                />
              </div>
            </div>

            <Separator orientation="vertical" className="mx-1" />

            <label className="group flex cursor-pointer items-center gap-2">
              <Checkbox checked={applyToAll} onCheckedChange={(checked) => setApplyToAll(Boolean(checked))} />
              <span className="text-sm text-gray-400 transition group-hover:text-gray-200">Apply to all</span>
            </label>
          </div>

          <Button type="button" onClick={analyzeInput} size="lg" className="gap-2 text-sm font-bold uppercase tracking-wide active:scale-[0.98]">
            <BarChart3 className="size-4" />
            Analyze
          </Button>
        </CardContent>
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center rounded-lg border border-border-dark bg-surface-darker p-1 text-xs font-semibold uppercase tracking-wide">
              <Button
                type="button"
                variant={orderMode === "sorted" ? "default" : "ghost"}
                size="sm"
                className="h-8 rounded px-3 py-1.5"
                onClick={() => toggleOrderMode("sorted")}
              >
                Sorted
              </Button>
              <Button
                type="button"
                variant={orderMode === "manual" ? "default" : "ghost"}
                size="sm"
                className="h-8 rounded px-3 py-1.5"
                onClick={() => toggleOrderMode("manual")}
              >
                Manual
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs uppercase tracking-wide text-gray-500">Custom speed</span>
              <SpeedControl value={customSpeed} onCommit={setCustomSpeed} />
            </div>
          </div>

          <PlaylistsTable
            rows={rows}
            orderMode={orderMode}
            sorting={sorting}
            customSpeed={customSpeed}
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
                const sourceIndex = prev.findIndex((entry) => entry.id === sourceId);
                const destinationIndex = prev.findIndex((entry) => entry.id === destinationId);
                if (sourceIndex < 0 || destinationIndex < 0) return prev;

                const next = [...prev];
                const [item] = next.splice(sourceIndex, 1);
                next.splice(destinationIndex, 0, item);
                return next;
              });
            }}
            onMoveRow={(rowId, direction) => {
              setRows((prev) => reorderRowsByKeyboard(prev, rowId, direction));
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
      staleTime: 1000 * 60 * 60,
      gcTime: 1000 * 60 * 60 * 6,
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
