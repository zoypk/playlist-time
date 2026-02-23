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
import { Skeleton } from "./ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import type { PlaylistRow } from "./types";
import {
  BUILT_IN_SPEEDS,
  formatAvgDuration,
  formatDateLabel,
  formatDuration,
  formatRelativeTime,
  formatViews,
  getRowMetrics,
  speedCellTooltip
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

  return (
    <div className={`flex items-center justify-between gap-2 ${primary ? "font-extrabold text-primary" : ""}`} title={title}>
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
                <GripVertical className="hidden size-4 drag-handle text-gray-300 md:block" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 text-gray-500 hover:bg-red-500/10 hover:text-red-300 md:mt-1"
                  onClick={() => onRemoveRow(row.original.id)}
                  aria-label="Remove playlist"
                  title="Remove playlist"
                >
                  <Trash2 className="size-3.5" />
                </Button>
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
                    loading={row.index < 4 ? "eager" : "lazy"}
                    fetchPriority={row.index === 0 ? "high" : row.index < 4 ? "low" : "auto"}
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-black via-zinc-900 to-zinc-800" />
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
          <SortHeader
            label={
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">Views</span>
                </TooltipTrigger>
                <TooltipContent>Sum of views across videos (not YouTube playlist views)</TooltipContent>
              </Tooltip>
            }
            canSort={column.getCanSort()}
            sorted={column.getIsSorted()}
          />
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
          <SortHeader
            label={
              <span className="inline-flex items-center gap-1">
                Avg length
              </span>
            }
            canSort={column.getCanSort()}
            sorted={column.getIsSorted()}
          />
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
              <div className="flex flex-col gap-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-300">{speedColumn.label}</div>
                <SpeedControl value={customSpeed} onCommit={onCustomSpeedCommit} compact />
              </div>
            )
            : ({ column }) => (
              <SortHeader
                label={speedColumn.label}
                canSort={column.getCanSort()}
                sorted={column.getIsSorted()}
                primary={speedColumn.primary}
                title={speedColumn.speed === 1 ? "Baseline watch time" : "Time at this speed"}
              />
            ),
        enableSorting: speedColumn.id !== "speed_custom",
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
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent>{speedCellTooltip(atOneX, atSpeed)}</TooltipContent>
            </Tooltip>
          );
        }
      });
    }

    baseColumns.push({
      id: "published",
      header: ({ column }) => (
        <SortHeader label="Published" canSort={column.getCanSort()} sorted={column.getIsSorted()} title="Playlist publish date" />
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

  if (!rows.length) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="relative overflow-auto rounded-lg border border-border-dark bg-black shadow-2xl">
        <div className="playlist-grid sticky top-0 z-20 min-w-[1020px] border-b border-border-dark bg-[#0a0a0a] text-[11px] font-bold uppercase tracking-wider text-gray-400">
          {table.getHeaderGroups().map((headerGroup) =>
            headerGroup.headers.map((header) => {
              const canSort = header.column.getCanSort();
              return (
                <div
                  key={header.id}
                  className={`header-cell ${canSort ? "cursor-pointer hover:bg-white/5" : ""} ${header.column.id === "speed_1" ? "bg-primary/5" : ""}`}
                  onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </div>
              );
            })
          )}
        </div>

        <div className="min-w-[1020px] divide-y divide-border-dark bg-black">
          {table.getRowModel().rows.map((row) => {
            const draggable = true;
            return (
              <div
                key={row.id}
                className="playlist-grid group transition-colors hover:bg-[#0a0a0a]"
                draggable={draggable}
                onDragStart={() => {
                  if (!draggable) return;
                  setDraggedId(row.original.id);
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
                  <div
                    key={cell.id}
                    className={`body-cell ${cell.column.id === "speed_1" ? "bg-primary/5" : ""} ${
                      cell.column.id === "playlist" ? "drag-handle" : ""
                    }`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="playlist-grid glass-footer sticky bottom-0 z-10 min-w-[1020px]">
          <div className="footer-cell" />
          <div className="footer-cell text-sm font-medium uppercase tracking-wider text-gray-300">Total</div>
          <div className="footer-cell" />
          <div className="footer-cell font-mono text-sm text-gray-300">{formatAvgDuration(totals.avgLength)}</div>
          {speedColumns.map((speedColumn) => {
            const value = totals.totalSelectedDuration / speedColumn.speed;
            const sharedClass = "footer-cell font-mono text-sm font-medium text-gray-300";

            return (
              <Tooltip key={speedColumn.id}>
                <TooltipTrigger asChild>
                  <div className={sharedClass}>{formatDuration(value)}</div>
                </TooltipTrigger>
                <TooltipContent>{speedCellTooltip(totals.totalSelectedDuration, value)}</TooltipContent>
              </Tooltip>
            );
          })}
          <div className="footer-cell" />
        </div>
      </div>
    </TooltipProvider>
  );
}
