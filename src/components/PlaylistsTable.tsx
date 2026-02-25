import * as React from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical, Trash2 } from "lucide-react";

import RangePopover from "./RangePopover";
import SpeedControl from "./SpeedControl";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardHeader } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "./ui/table";
import type { PlaylistRow } from "./types";
import {
  BUILT_IN_SPEEDS,
  formatAvgDuration,
  formatDateLabel,
  formatDuration,
  formatRelativeTime,
  formatViews,
  getRowMetrics
} from "./utils";

type PlaylistsTableProps = {
  rows: PlaylistRow[];
  sorting: SortingState;
  customSpeed: number;
  onCustomSpeedCommit: (value: number) => void;
  onSortingChange: (updater: SortingState | ((prev: SortingState) => SortingState)) => void;
  onRangeApply: (rowId: string, start: number | null, end: number | null) => void;
  onRemoveRow: (rowId: string) => void;
  onReorderRows: (sourceId: string, destinationId: string) => void;
  onVisibleOrderChange: (ids: string[]) => void;
};

type SpeedColumn = {
  id: string;
  label: string;
  speed: number;
  primary?: boolean;
};

const SPEED_COLUMNS: SpeedColumn[] = BUILT_IN_SPEEDS.map((speed) => ({
  id: `speed_${String(speed).replace(".", "_")}`,
  label: `${speed}x`,
  speed,
  primary: speed === 1
}));

/** Header label with current sort direction indicator. */
function SortHeader({
  label,
  sorted,
  canSort,
  primary = false,
  title
}: {
  label: React.ReactNode;
  sorted: false | "asc" | "desc";
  canSort: boolean;
  primary?: boolean;
  title?: string;
}) {
  const icon = sorted === "desc" ? <ArrowDown className="size-3.5" /> : sorted === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowUpDown className="size-3.5 opacity-50" />;
  const fullTitle = title;

  return (
    <div className={`flex items-center justify-between gap-2 ${primary ? "font-extrabold text-primary" : ""}`} title={fullTitle}>
      <span className="truncate">{label}</span>
      {canSort && <span className={`${sorted ? "text-primary" : "text-gray-500"}`}>{icon}</span>}
    </div>
  );
}

function formatSignedDurationDelta(oneXSeconds: number, speedSeconds: number) {
  const deltaSeconds = speedSeconds - oneXSeconds;
  const sign = deltaSeconds > 0 ? "+" : "-";
  return `${sign}${formatDuration(Math.abs(deltaSeconds))}`;
}

function getColumnAriaLabel(columnId: string) {
  if (columnId === "playlist") return "Sort by playlist";
  if (columnId === "views") return "Sort by views";
  if (columnId === "avg_length") return "Sort by average length";
  if (columnId === "published") return "Sort by publish date";
  if (columnId.startsWith("speed_")) {
    const speedLabel = columnId.replace("speed_", "").replace("_", ".");
    return `Sort by ${speedLabel}x time`;
  }
  return `Sort by ${columnId}`;
}

/** Renders the standardized row-level error badge. */
function ErrorBadge({ type }: { type: PlaylistRow["errorType"] }) {
  const map: Record<string, string> = {
    invalid: "Invalid URL/ID",
    unavailable: "Private/Unavailable",
    quota: "API quota/rate",
    network: "Network",
    unknown: "Error"
  };

  return <Badge variant="destructive">{map[type ?? "unknown"]}</Badge>;
}

/** Table renderer for playlist metrics. */
export default function PlaylistsTable({
  rows,
  sorting,
  customSpeed,
  onCustomSpeedCommit,
  onSortingChange,
  onRangeApply,
  onRemoveRow,
  onReorderRows,
  onVisibleOrderChange
}: PlaylistsTableProps) {
  const [openRangeId, setOpenRangeId] = React.useState<string | null>(null);
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = React.useState<string | null>(null);

  const metricsById = React.useMemo(() => {
    const map = new Map<string, ReturnType<typeof getRowMetrics>>();
    for (const row of rows) {
      map.set(row.id, getRowMetrics(row));
    }
    return map;
  }, [rows]);

  const speedColumns = React.useMemo<SpeedColumn[]>(() => {
    return [
      ...SPEED_COLUMNS,
      {
        id: "speed_custom",
        label: `Custom`,
        speed: customSpeed
      }
    ];
  }, [customSpeed]);

  const columns = React.useMemo<ColumnDef<PlaylistRow>[]>(() => {
    const baseColumns: ColumnDef<PlaylistRow>[] = [
      {
        id: "drag",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          return (
            <div className="flex items-center justify-center text-gray-500">
              <div className="flex flex-col items-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="hidden md:flex md:flex-col md:items-center">
                      <GripVertical className="size-4 drag-handle text-gray-300" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="flex flex-col gap-1 text-center">
                      <span>Drag to reorder</span>
                      <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400">
                        <kbd className="rounded border border-border-dark bg-black px-1 py-0.5 font-mono text-[9px]">↑</kbd>
                        <kbd className="rounded border border-border-dark bg-black px-1 py-0.5 font-mono text-[9px]">↓</kbd>
                        <span>to move</span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 text-gray-500 hover:bg-red-500/10 hover:text-red-300 md:mt-1"
                      onClick={() => onRemoveRow(row.original.id)}
                      aria-label="Remove playlist"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Remove playlist</TooltipContent>
                </Tooltip>
              </div>
            </div>
          );
        }
      },
      {
        id: "playlist",
        header: ({ column }) => (
          <SortHeader label="Playlist" canSort={column.getCanSort()} sorted={column.getIsSorted()} title="Sort by playlist title" />
        ),
        accessorFn: (row) => row.data?.title ?? row.input,
        cell: ({ row }) => {
          const item = row.original;
          const metrics = metricsById.get(item.id);
          const playlistTitle = item.data?.title?.trim() || item.playlistId || "Playlist";
          const playlistUrl = item.playlistId
            ? `https://www.youtube.com/playlist?list=${encodeURIComponent(item.playlistId)}`
            : null;

          if (item.status === "loading") {
            return (
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-16 border border-border-dark" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            );
          }

          if (item.status === "error") {
            return (
              <div className="w-full min-w-0">
                <div className="min-w-0 space-y-1">
                  <ErrorBadge type={item.errorType} />
                  <p className="truncate text-sm text-gray-200">{item.input}</p>
                  <p className="text-xs text-red-300/80">{item.errorMessage ?? "Unable to load playlist."}</p>
                </div>
              </div>
            );
          }

          return (
            <div className="flex w-full min-w-0 items-center gap-4 select-none">
              <div className="hidden h-10 w-16 shrink-0 overflow-hidden rounded border border-border-dark bg-black/60 md:block">
                {item.data?.thumbnailUrl ? (
                  <img
                    src={item.data.thumbnailUrl}
                    alt={`${playlistTitle} thumbnail`}
                    className="h-full w-full object-cover opacity-85 transition group-hover:opacity-100"
                    width={64}
                    height={40}
                    loading={row.index < 4 ? "eager" : "lazy"}
                    decoding="async"
                    fetchPriority={row.index === 0 ? "high" : "auto"}
                  />
                ) : (
                    <div className="h-full w-full bg-linear-to-br from-black via-zinc-900 to-zinc-800" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h3
                  className="truncate text-sm font-semibold text-gray-100 transition group-hover:text-primary"
                  aria-label={playlistTitle}
                >
                  {playlistUrl ? (
                    <a
                      href={playlistUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-primary"
                      aria-label={`Open playlist: ${playlistTitle}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {playlistTitle}
                    </a>
                  ) : (
                    <span>{playlistTitle}</span>
                  )}
                </h3>
                <p className="truncate text-xs text-gray-500">{item.data?.channelTitle || "Unknown channel"}</p>
                <p className="mt-1 text-[11px] text-gray-600">{item.loadingLabel ?? ""}</p>
                {metrics && item.status === "success" && (
                  <div className="mt-2">
                    <RangePopover
                      disabled={item.status !== "success"}
                      range={metrics.range}
                      isOpen={openRangeId === item.id}
                      onOpenChange={(open) => setOpenRangeId(open ? item.id : null)}
                      onApply={(start, end) => {
                        onRangeApply(item.id, start, end);
                        setOpenRangeId(null);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        }
      },
      {
        id: "views",
        header: ({ column }) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="cursor-help">
                <SortHeader
                  label="Views"
                  canSort={column.getCanSort()}
                  sorted={column.getIsSorted()}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent>Sum of individual video view counts</TooltipContent>
          </Tooltip>
        ),
        accessorFn: (row) => row.data?.totalVideoViewsSum ?? 0,
        cell: ({ row }) => {
          if (row.original.status === "loading") return <Skeleton className="h-4 w-14" />;
          if (row.original.status === "error") return <span className="text-xs text-gray-600">-</span>;
          return <span className="font-mono text-sm text-gray-300">{formatViews(row.original.data?.totalVideoViewsSum ?? 0)}</span>;
        }
      },
      {
        id: "avg_length",
        header: ({ column }) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="cursor-help">
                <SortHeader
                  label="Avg length"
                  canSort={column.getCanSort()}
                  sorted={column.getIsSorted()}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent>Average video duration (click to sort)</TooltipContent>
          </Tooltip>
        ),
        accessorFn: (row) => metricsById.get(row.id)?.avgLengthSec ?? 0,
        cell: ({ row }) => {
          if (row.original.status === "loading") return <Skeleton className="h-4 w-14" />;
          if (row.original.status === "error") return <span className="text-xs text-gray-600">-</span>;
          const metrics = metricsById.get(row.original.id);
          return <span className="font-mono text-sm text-gray-200">{formatAvgDuration(metrics?.avgLengthSec ?? 0)}</span>;
        }
      }
    ];

    for (const speedColumn of speedColumns) {
      baseColumns.push({
        id: speedColumn.id,
        header:
          speedColumn.id === "speed_custom"
            ? () => (
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-300">{speedColumn.label}</div>
                <SpeedControl value={customSpeed} onCommit={onCustomSpeedCommit} compact />
              </div>
            )
            : ({ column }) => (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="cursor-help">
                    <SortHeader
                      label={speedColumn.label}
                      canSort={column.getCanSort()}
                      sorted={column.getIsSorted()}
                      primary={speedColumn.primary}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{speedColumn.speed === 1 ? "Baseline: watch time at 1x speed" : `Time duration at ${speedColumn.label}`}</TooltipContent>
              </Tooltip>
            ),
        enableSorting: speedColumn.id === "speed_1",
        accessorFn: (row) => {
          const metrics = metricsById.get(row.id);
          const selected = metrics?.selectedDurationSec ?? 0;
          return selected / speedColumn.speed;
        },
        cell: ({ row }) => {
          if (row.original.status === "loading") return <Skeleton className="h-4 w-16" />;
          if (row.original.status === "error") return <span className="text-xs text-gray-600">-</span>;

          const metrics = metricsById.get(row.original.id);
          const selected = metrics?.selectedDurationSec ?? 0;
          const atSpeed = selected / speedColumn.speed;
          const atOneX = selected;
          const deltaSeconds = atOneX - atSpeed;
          const isSaving = deltaSeconds > 0;
          const deltaLabel = formatSignedDurationDelta(atOneX, atSpeed);

          return (
            <div className="leading-tight">
              <div className={`font-mono text-sm ${speedColumn.primary ? "font-semibold text-primary" : "text-gray-300"}`}>
                {formatDuration(atSpeed)}
              </div>
              {!speedColumn.primary && (
                <div className={`font-mono text-[10px] ${isSaving ? "text-emerald-400/90" : "text-amber-300/85"}`}>
                  {deltaLabel}
                </div>
              )}
            </div>
          );
        }
      });
    }

    baseColumns.push({
      id: "published",
      header: ({ column }) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="cursor-help">
              <SortHeader label="Published" canSort={column.getCanSort()} sorted={column.getIsSorted()} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Latest upload date (click to sort)</TooltipContent>
        </Tooltip>
      ),
      accessorFn: (row) => (row.data?.publishedAt ? new Date(row.data.publishedAt).getTime() : 0),
      cell: ({ row }) => {
        if (row.original.status === "loading") return <Skeleton className="h-4 w-20" />;
        if (row.original.status === "error") return <span className="text-xs text-gray-600">-</span>;
        return (
          <div className="leading-tight">
            <div className="font-mono text-sm text-gray-300">{formatDateLabel(row.original.data?.publishedAt ?? null)}</div>
            <div className="text-[11px] text-gray-600">{formatRelativeTime(row.original.data?.publishedAt ?? null)}</div>
          </div>
        );
      }
    });

    return baseColumns;
  }, [customSpeed, metricsById, onCustomSpeedCommit, onRangeApply, onRemoveRow, openRangeId, speedColumns]);

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting
    },
    enableSorting: true,
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  const handleRowKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTableRowElement>, rowId: string) => {
      const visibleRows = table.getRowModel().rows;
      const currentRowIndex = visibleRows.findIndex((r) => r.original.id === rowId);

      if (event.key === "ArrowUp" && currentRowIndex > 0) {
        event.preventDefault();
        const targetRow = visibleRows[currentRowIndex - 1];
        onReorderRows(rowId, targetRow.original.id);
        if (sorting.length) {
          onSortingChange([]);
        }
        setSelectedRowId(targetRow.original.id);
      } else if (event.key === "ArrowDown" && currentRowIndex < visibleRows.length - 1) {
        event.preventDefault();
        const targetRow = visibleRows[currentRowIndex + 1];
        onReorderRows(rowId, targetRow.original.id);
        if (sorting.length) {
          onSortingChange([]);
        }
        setSelectedRowId(targetRow.original.id);
      }
    },
    [table, onReorderRows, onSortingChange, sorting.length]
  );

  const visibleIds = React.useMemo(() => table.getRowModel().rows.map((entry) => entry.original.id), [table, rows, sorting]);

  React.useEffect(() => {
    onVisibleOrderChange(visibleIds);
  }, [onVisibleOrderChange, visibleIds]);

  const totals = React.useMemo(() => {
    let totalSelectedDuration = 0;
    let totalSelectedVideos = 0;

    for (const row of rows) {
      if (row.status !== "success") continue;
      const metrics = metricsById.get(row.id);
      if (!metrics) continue;
      totalSelectedDuration += metrics.selectedDurationSec;
      totalSelectedVideos += metrics.range.selectedCount;
    }

    const avgLength = totalSelectedVideos > 0 ? totalSelectedDuration / totalSelectedVideos : 0;
    return {
      totalSelectedDuration,
      avgLength
    };
  }, [metricsById, rows]);

  const statusMessage = React.useMemo(() => {
    const counts = rows.reduce(
      (acc, row) => {
        if (row.status === "loading") acc.loading += 1;
        if (row.status === "success") acc.success += 1;
        if (row.status === "error") acc.error += 1;
        return acc;
      },
      { loading: 0, success: 0, error: 0 }
    );

    if (!rows.length) return "No playlists loaded.";
    if (counts.loading > 0) {
      return `Loading ${counts.loading} playlist${counts.loading === 1 ? "" : "s"}. ${counts.success} ready, ${counts.error} with errors.`;
    }
    return `${counts.success} playlist${counts.success === 1 ? "" : "s"} ready. ${counts.error} with errors.`;
  }, [rows]);

  if (!rows.length) {
    return null;
  }

  // Single playlist: show card instead of table
  if (rows.length === 1) {
    const item = rows[0];
    const metrics = metricsById.get(item.id);
    const playlistTitle = item.data?.title?.trim() || item.playlistId || "Playlist";
    const playlistUrl = item.playlistId
      ? `https://www.youtube.com/playlist?list=${encodeURIComponent(item.playlistId)}`
      : null;

    return (
      <TooltipProvider>
        <Card className="overflow-hidden max-w-md">
          <CardHeader className="flex flex-row items-center justify-between gap-2 py-2">
            <div className="flex min-w-0 items-center gap-2.5">
              {item.data?.thumbnailUrl && (
                <div className="h-12 w-20 shrink-0 overflow-hidden rounded border border-border-dark bg-black/60">
                  <img
                    src={item.data.thumbnailUrl}
                    alt={`${playlistTitle} thumbnail`}
                    className="h-full w-full object-cover opacity-90"
                    width={80}
                    height={48}
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {item.status === "loading" && (
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-2 w-32" />
                  </div>
                )}
                {item.status === "error" && (
                  <div className="space-y-1">
                    <ErrorBadge type={item.errorType} />
                    <p className="text-xs text-gray-300">{item.input}</p>
                    <p className="text-xs text-red-300/80">{item.errorMessage ?? "Unable to load playlist."}</p>
                  </div>
                )}
                {item.status === "success" && (
                  <>
                    <h2 className="text-sm font-semibold text-gray-100">
                      {playlistUrl ? (
                        <a
                          href={playlistUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-primary"
                          aria-label={`Open playlist: ${playlistTitle}`}
                        >
                          {playlistTitle}
                        </a>
                      ) : (
                        <span>{playlistTitle}</span>
                      )}
                    </h2>
                    <p className="text-[11px] text-gray-500">{item.data?.channelTitle || "Unknown channel"}</p>
                  </>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-gray-500 hover:bg-red-500/10 hover:text-red-300"
              onClick={() => onRemoveRow(item.id)}
              aria-label="Remove playlist"
              title="Remove playlist"
            >
              <Trash2 className="size-4" />
            </Button>
          </CardHeader>

          {item.status === "success" && metrics && (
            <div className="space-y-2 p-3">
              {/* Quick Stats */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div>
                  <span className="text-gray-500">Views:</span>
                  <span className="ml-1 font-mono font-semibold text-gray-200">{formatViews(item.data?.totalVideoViewsSum ?? 0)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Avg:</span>
                  <span className="ml-1 font-mono font-semibold text-gray-200">{formatAvgDuration(metrics.avgLengthSec)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Published:</span>
                  <span className="ml-1 text-gray-400">{formatRelativeTime(item.data?.publishedAt ?? null)}</span>
                </div>
                <div className="ml-auto">
                  <RangePopover
                    disabled={false}
                    range={metrics.range}
                    isOpen={openRangeId === item.id}
                    onOpenChange={(open) => setOpenRangeId(open ? item.id : null)}
                    onApply={(start, end) => {
                      onRangeApply(item.id, start, end);
                      setOpenRangeId(null);
                    }}
                  />
                </div>
              </div>

              {/* Speed Times - Vertical Comparison slow to fast */}
              <div className="space-y-2 border-t border-border-dark pt-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Watch times</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-500">Custom:</span>
                    <SpeedControl value={customSpeed} onCommit={onCustomSpeedCommit} compact />
                  </div>
                </div>
                <div className="space-y-1">
                  {/* Custom if slower than 1x */}
                  {customSpeed < 1 && (
                    <div className="flex items-center gap-2 rounded border border-border-dark bg-surface-darker px-2 py-1.5 transition hover:border-primary/20">
                      <span className="min-w-12 text-xs font-bold text-gray-400">{customSpeed.toFixed(2)}x</span>
                      <span className="flex-1 text-right text-lg font-bold text-gray-100">{formatDuration(metrics.selectedDurationSec / customSpeed)}</span>
                      <span className="min-w-12 text-right text-[10px] font-semibold text-amber-300">
                        {formatSignedDurationDelta(metrics.selectedDurationSec, metrics.selectedDurationSec / customSpeed)}
                      </span>
                    </div>
                  )}
                  
                  {/* 1x first */}
                  {speedColumns.filter((sc) => sc.primary).map((speedColumn) => {
                    const selected = metrics.selectedDurationSec;
                    const atSpeed = selected / speedColumn.speed;

                    return (
                      <div key={speedColumn.id} className="flex items-center gap-2 rounded border border-primary/40 bg-primary/10 px-2 py-1.5 transition">
                        <span className="min-w-8 text-xs font-bold text-primary">{speedColumn.label}</span>
                        <span className="flex-1 text-right text-lg font-bold text-primary">
                          {formatDuration(atSpeed)}
                        </span>
                      </div>
                    );
                  })}

                  {/* Then 1.25x - 1.5x */}
                  {speedColumns.filter((sc) => sc.speed > 1 && sc.speed <= 1.5 && sc.id !== "speed_custom").map((speedColumn) => {
                    const selected = metrics.selectedDurationSec;
                    const atSpeed = selected / speedColumn.speed;
                    const atOneX = selected;
                    const deltaLabel = formatSignedDurationDelta(atOneX, atSpeed);
                    const isSaving = atOneX - atSpeed > 0;

                    return (
                      <div key={speedColumn.id} className="flex items-center gap-2 rounded border border-border-dark bg-surface-darker px-2 py-1.5 transition hover:border-primary/20">
                        <span className="min-w-8 text-xs font-bold text-gray-400">{speedColumn.label}</span>
                        <span className="flex-1 text-right text-lg font-bold text-gray-100">
                          {formatDuration(atSpeed)}
                        </span>
                        <span className={`min-w-12 text-right text-[10px] font-semibold ${isSaving ? "text-emerald-400" : "text-amber-300"}`}>
                          {deltaLabel}
                        </span>
                      </div>
                    );
                  })}

                  {/* Then faster speeds 1.75x+ */}
                  {speedColumns.filter((sc) => sc.speed > 1.5 && !sc.primary && sc.id !== "speed_custom").map((speedColumn) => {
                    const selected = metrics.selectedDurationSec;
                    const atSpeed = selected / speedColumn.speed;
                    const atOneX = selected;
                    const deltaLabel = formatSignedDurationDelta(atOneX, atSpeed);
                    const isSaving = atOneX - atSpeed > 0;

                    return (
                      <div key={speedColumn.id} className="flex items-center gap-2 rounded border border-border-dark bg-surface-darker px-2 py-1.5 transition hover:border-primary/20">
                        <span className="min-w-8 text-xs font-bold text-gray-400">{speedColumn.label}</span>
                        <span className="flex-1 text-right text-lg font-bold text-gray-100">
                          {formatDuration(atSpeed)}
                        </span>
                        <span className={`min-w-12 text-right text-[10px] font-semibold ${isSaving ? "text-emerald-400" : "text-amber-300"}`}>
                          {deltaLabel}
                        </span>
                      </div>
                    );
                  })}

                  {/* Custom if faster than 1x */}
                  {customSpeed >= 1 && (
                    <div className="flex items-center gap-2 rounded border border-border-dark bg-surface-darker px-2 py-1.5 transition hover:border-primary/20">
                      <span className="min-w-12 text-xs font-bold text-gray-400">{customSpeed.toFixed(2)}x</span>
                      <span className="flex-1 text-right text-lg font-bold text-gray-100">{formatDuration(metrics.selectedDurationSec / customSpeed)}</span>
                      <span className="min-w-12 text-right text-[10px] font-semibold text-emerald-400">
                        {formatSignedDurationDelta(metrics.selectedDurationSec, metrics.selectedDurationSec / customSpeed)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {item.status === "loading" && (
            <div className="space-y-1 p-3">
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          )}
        </Card>

        <div className="sr-only" aria-live="polite">
          {statusMessage}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Table role="table" aria-label="Playlist comparison table" aria-colcount={table.getAllColumns().length}>
        <TableHeader>
          <TableRow role="row">
            {table.getHeaderGroups().map((headerGroup) =>
              headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                const ariaSort = canSort
                  ? sorted === "asc"
                    ? "ascending"
                    : sorted === "desc"
                      ? "descending"
                      : "none"
                  : undefined;

                return (
                  <TableHead
                    key={header.id}
                    role="columnheader"
                    aria-sort={ariaSort}
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            header.column.getToggleSortingHandler()?.({} as any);
                          }
                        }}
                        className="w-full cursor-pointer text-left hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded px-1"
                        aria-label={getColumnAriaLabel(header.column.id)}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                );
              })
            )}
          </TableRow>
        </TableHeader>

        <TableBody role="rowgroup">
          {table.getRowModel().rows.map((row, rowIndex) => {
            const draggable = true;
            const isSelected = selectedRowId === row.original.id;
            return (
              <TableRow
                key={row.id}
                role="row"
                draggable={draggable}
                onClick={() => setSelectedRowId(row.original.id)}
                onKeyDown={(event) => handleRowKeyDown(event, row.original.id)}
                tabIndex={0}
                className={`cursor-pointer transition-colors ${isSelected
                  ? "bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary ring-inset"
                  : "focus:outline-none focus:ring-2 focus:ring-primary/30 ring-inset"
                  }`}
                title="Click to select row, use arrow keys to move up/down"
                onDragStart={() => {
                  if (!draggable) return;
                  setDraggedId(row.original.id);
                  setSelectedRowId(row.original.id);
                }}
                onDragOver={(event) => {
                  if (!draggable || !draggedId || draggedId === row.original.id) return;
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  if (!draggable || !draggedId) return;
                  event.preventDefault();
                  if (draggedId !== row.original.id) {
                    onReorderRows(draggedId, row.original.id);
                  }
                  setDraggedId(null);
                }}
                onDragEnd={() => setDraggedId(null)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    role="cell"
                    className={`${cell.column.id === "playlist" ? "drag-handle" : ""
                      }`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>

        <TableFooter>
          <TableRow role="row">
            <TableCell role="cell" />
            <TableCell role="cell" className="text-sm font-medium uppercase tracking-wider text-gray-300">
              Total
            </TableCell>
            <TableCell role="cell" />
            <TableCell role="cell" className="font-mono text-sm text-gray-300">
              {formatAvgDuration(totals.avgLength)}
            </TableCell>
            {speedColumns.map((speedColumn) => {
              const value = totals.totalSelectedDuration / speedColumn.speed;
              const sharedClass = "font-mono text-sm font-medium text-gray-300";

              return (
                <TableCell key={speedColumn.id} role="cell" className={sharedClass}>
                  {formatDuration(value)}
                </TableCell>
              );
            })}
            <TableCell role="cell" />
          </TableRow>
        </TableFooter>
      </Table>

      <div className="mt-2 hidden items-center gap-3 text-[10px] text-gray-500 md:flex">
        <span className="font-medium text-gray-400">Keyboard shortcuts:</span>
        <div className="flex items-center gap-1">
          <kbd className="rounded border border-border-dark bg-black px-1 py-0.5 font-mono text-[9px] text-gray-400">↑</kbd>
          <kbd className="rounded border border-border-dark bg-black px-1 py-0.5 font-mono text-[9px] text-gray-400">↓</kbd>
          <span>move rows</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="rounded border border-border-dark bg-black px-1 py-0.5 font-mono text-[9px] text-gray-400">↵</kbd>
          <span>sort columns</span>
        </div>
      </div>

      <div className="sr-only" aria-live="polite">
        {statusMessage}
      </div>
    </TooltipProvider>
  );
}
