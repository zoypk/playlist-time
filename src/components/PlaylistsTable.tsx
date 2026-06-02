import * as React from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, Copy, Download, ExternalLink, GripVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";

import RangePopover from "./RangePopover";
import SpeedControl from "./SpeedControl";
import "../styles/table.css";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Skeleton } from "./ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "./ui/table";
import type { PlaylistRow, RowMetrics } from "./types";
import { BUILT_IN_SPEEDS } from "../config/constants";
import {
  formatAvgDuration,
  formatDateLabel,
  formatDuration,
  formatRelativeTime,
  formatViews,
  getRangePillLabel,
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
      {canSort && <span className={`${sorted ? "text-primary" : "text-warm-muted/70"}`}>{icon}</span>}
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

function buildPlaylistUrl(playlistId: string | null) {
  return playlistId
    ? `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`
    : null;
}

function MobileSpeedTile({
  label,
  value,
  delta,
  isSaving,
  primary = false
}: {
  label: string;
  value: string;
  delta?: string;
  isSaving?: boolean;
  primary?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-md border p-3 ${
        primary
          ? "border-primary/45 bg-primary/15"
          : "border-border-dark bg-background-dark/90"
      }`}
    >
      <div className={`text-xs font-bold ${primary ? "text-primary" : "text-warm-muted"}`}>{label}</div>
      <div className={`mt-1 font-mono text-lg font-extrabold leading-tight ${primary ? "text-primary" : "text-gray-100"}`}>
        {value}
      </div>
      {delta && (
        <div className={`mt-1 font-mono text-xs font-semibold ${isSaving ? "text-emerald-400" : "text-amber-300"}`}>
          {delta}
        </div>
      )}
    </div>
  );
}

function MobilePlaylistCard({
  row,
  metrics,
  speedColumns,
  customSpeed,
  isRangeOpen,
  onRangeOpenChange,
  onRangeApply,
  onRemoveRow,
  onCustomSpeedCommit
}: {
  row: PlaylistRow;
  metrics: RowMetrics | undefined;
  speedColumns: SpeedColumn[];
  customSpeed: number;
  isRangeOpen: boolean;
  onRangeOpenChange: (open: boolean) => void;
  onRangeApply: (start: number | null, end: number | null) => void;
  onRemoveRow: () => void;
  onCustomSpeedCommit: (value: number) => void;
}) {
  const playlistTitle = row.data?.title?.trim() || row.playlistId || "Playlist";
  const playlistUrl = buildPlaylistUrl(row.playlistId);

  if (row.status === "loading") {
    return (
      <article className="overflow-hidden rounded-lg border border-border-dark bg-surface-dark/90 shadow-soft">
        <div className="flex items-center gap-3 p-4">
          <Skeleton className="h-14 w-24 shrink-0 border border-border-dark" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-full max-w-56" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 text-gray-500 hover:bg-red-500/10 hover:text-red-300"
            onClick={onRemoveRow}
            aria-label="Remove playlist"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-border-dark p-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </article>
    );
  }

  if (row.status === "error") {
    return (
      <article className="overflow-hidden rounded-lg border border-red-900/60 bg-surface-dark/90 shadow-soft">
        <div className="flex items-start gap-3 p-4">
          <div className="min-w-0 flex-1 space-y-2">
            <ErrorBadge type={row.errorType} />
            <p className="break-words text-sm font-semibold text-gray-200">{row.input}</p>
            <p className="text-sm leading-5 text-red-300/85">{row.errorMessage ?? "Unable to load playlist."}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 text-gray-500 hover:bg-red-500/10 hover:text-red-300"
            onClick={onRemoveRow}
            aria-label="Remove playlist"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </article>
    );
  }

  if (!metrics) {
    return null;
  }

  const selected = metrics.selectedDurationSec;
  const primarySpeed = speedColumns.find((speedColumn) => speedColumn.primary) ?? speedColumns[0];
  const secondarySpeeds = speedColumns.filter((speedColumn) => speedColumn.id !== primarySpeed.id);

  return (
    <article className="overflow-hidden rounded-lg border border-border-dark bg-surface-dark/90 shadow-soft">
      <div className="flex items-start gap-3 p-4">
        <div className="h-14 w-24 shrink-0 overflow-hidden rounded-md border border-border-dark bg-surface-raised">
          {row.data?.thumbnailUrl ? (
            <img
              src={row.data.thumbnailUrl}
              alt={`${playlistTitle} thumbnail`}
              className="h-full w-full object-cover opacity-90"
              width={96}
              height={56}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
            />
          ) : (
            <div className="h-full w-full bg-linear-to-br from-surface-darker via-surface-dark to-surface-raised" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {playlistUrl ? (
            <a
              href={playlistUrl}
              target="_blank"
              rel="noreferrer"
              className="group/link inline-flex min-h-11 max-w-full items-center gap-1.5 py-1 text-base font-bold leading-snug text-gray-100 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              aria-label={`Open playlist: ${playlistTitle}`}
            >
              <span className="min-w-0 break-words">{playlistTitle}</span>
              <ExternalLink className="size-3.5 shrink-0 text-gray-500 group-hover/link:text-primary" aria-hidden="true" />
              <span className="shrink-0 text-xs font-semibold text-gray-500 group-hover/link:text-primary">Open</span>
            </a>
          ) : (
            <h3 className="text-base font-bold leading-snug text-gray-100">{playlistTitle}</h3>
          )}
          <p className="mt-1 truncate text-sm text-warm-muted">{row.data?.channelTitle || "Unknown channel"}</p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 text-gray-500 hover:bg-red-500/10 hover:text-red-300"
          onClick={onRemoveRow}
          aria-label="Remove playlist"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid grid-cols-3 border-y border-border-dark bg-background-dark/70">
        <div className="border-r border-border-dark p-3">
          <div className="text-[11px] font-semibold text-warm-muted">Videos</div>
          <div className="mt-1 font-mono text-sm font-bold text-gray-100">
            {metrics.range.selectedCount}/{metrics.range.totalVideos}
          </div>
        </div>
        <div className="border-r border-border-dark p-3">
          <div className="text-[11px] font-semibold text-warm-muted">Views</div>
          <div className="mt-1 font-mono text-sm font-bold text-gray-100">{formatViews(row.data?.totalVideoViewsSum ?? 0)}</div>
        </div>
        <div className="p-3">
          <div className="text-[11px] font-semibold text-warm-muted">Avg</div>
          <div className="mt-1 font-mono text-sm font-bold text-gray-100">{formatAvgDuration(metrics.avgLengthSec)}</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-border-dark px-4 py-3">
        <RangePopover
          disabled={false}
          range={metrics.range}
          isOpen={isRangeOpen}
          triggerClassName="min-h-11 px-4 py-2 text-sm"
          onOpenChange={onRangeOpenChange}
          onApply={onRangeApply}
        />
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-semibold text-warm-muted">Custom</span>
          <SpeedControl value={customSpeed} onCommit={onCustomSpeedCommit} />
        </div>
      </div>

      <div className="p-4">
        <MobileSpeedTile
          label={primarySpeed.label}
          value={formatDuration(selected / primarySpeed.speed)}
          primary
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          {secondarySpeeds.map((speedColumn) => {
            const atSpeed = selected / speedColumn.speed;
            const isSaving = selected - atSpeed > 0;

            return (
              <MobileSpeedTile
                key={speedColumn.id}
                label={speedColumn.id === "speed_custom" ? `${speedColumn.speed.toFixed(2)}x` : speedColumn.label}
                value={formatDuration(atSpeed)}
                delta={formatSignedDurationDelta(selected, atSpeed)}
                isSaving={isSaving}
              />
            );
          })}
        </div>
      </div>
    </article>
  );
}

type TotalsSummary = {
  totalSelectedDuration: number;
  totalSelectedVideos: number;
  totalViews: number;
  avgLength: number;
  successfulRows: number;
};

function MobileTotalsCard({
  totals,
  speedColumns
}: {
  totals: TotalsSummary;
  speedColumns: SpeedColumn[];
}) {
  const primarySpeed = speedColumns.find((speedColumn) => speedColumn.primary) ?? speedColumns[0];
  const secondarySpeeds = speedColumns.filter((speedColumn) => speedColumn.id !== primarySpeed.id);
  const selected = totals.totalSelectedDuration;

  return (
    <article className="overflow-hidden rounded-lg border border-primary/35 bg-surface-dark/90 shadow-soft">
      <div className="flex items-center justify-between gap-3 border-b border-border-dark px-4 py-3">
        <div>
          <h3 className="text-base font-extrabold text-gray-100">Total watch time</h3>
          <p className="mt-1 text-sm text-warm-muted">Average video {formatAvgDuration(totals.avgLength)}</p>
        </div>
      </div>
      <div className="p-4">
        <MobileSpeedTile
          label={primarySpeed.label}
          value={formatDuration(selected / primarySpeed.speed)}
          primary
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          {secondarySpeeds.map((speedColumn) => {
            const atSpeed = selected / speedColumn.speed;
            const isSaving = selected - atSpeed > 0;

            return (
              <MobileSpeedTile
                key={speedColumn.id}
                label={speedColumn.id === "speed_custom" ? `${speedColumn.speed.toFixed(2)}x` : speedColumn.label}
                value={formatDuration(atSpeed)}
                delta={formatSignedDurationDelta(selected, atSpeed)}
                isSaving={isSaving}
              />
            );
          })}
        </div>
      </div>
    </article>
  );
}

function formatCalendarDate(offsetDays: number) {
  if (!Number.isFinite(offsetDays) || offsetDays <= 0) return "-";
  const date = new Date();
  date.setDate(date.getDate() + Math.max(0, offsetDays - 1));
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function escapeCsvValue(value: string | number) {
  const raw = String(value);
  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

function getPlaylistExportRows(
  rows: PlaylistRow[],
  metricsById: Map<string, RowMetrics>,
  customSpeed: number
) {
  return rows
    .filter((row) => row.status === "success")
    .map((row) => {
      const metrics = metricsById.get(row.id);
      const selectedSeconds = metrics?.selectedDurationSec ?? 0;
      const playlistTitle = row.data?.title?.trim() || row.playlistId || "Playlist";
      const playlistUrl = buildPlaylistUrl(row.playlistId) ?? "";
      const range = metrics?.range;

      return {
        playlistTitle,
        channelTitle: row.data?.channelTitle || "Unknown channel",
        playlistId: row.playlistId ?? "",
        selectedVideos: range?.selectedCount ?? 0,
        totalVideos: range?.totalVideos ?? 0,
        rangeLabel: range ? getRangePillLabel(range) : "-",
        duration1x: formatDuration(selectedSeconds),
        durationCustom: formatDuration(selectedSeconds / customSpeed),
        customSpeed: customSpeed.toFixed(2),
        views: row.data?.totalVideoViewsSum ?? 0,
        published: formatDateLabel(row.data?.publishedAt ?? null),
        playlistUrl
      };
    });
}

function buildCopySummary(
  rows: PlaylistRow[],
  metricsById: Map<string, RowMetrics>,
  customSpeed: number,
  totals: TotalsSummary,
  dailyMinutes: number,
  planDays: number
) {
  const adjustedTotal = totals.totalSelectedDuration / customSpeed;
  const lines = [
    "playlist-time watch-time summary",
    `Playlists: ${totals.successfulRows}`,
    `Videos selected: ${totals.totalSelectedVideos}`,
    `Views: ${formatViews(totals.totalViews)}`,
    `Total at 1x: ${formatDuration(totals.totalSelectedDuration)}`,
    `Total at ${customSpeed.toFixed(2)}x: ${formatDuration(adjustedTotal)}`,
    `Daily plan: ${dailyMinutes} min/day for ${planDays} day${planDays === 1 ? "" : "s"}`,
    "",
    ...getPlaylistExportRows(rows, metricsById, customSpeed).map(
      (entry) =>
        `- ${entry.playlistTitle}: ${entry.selectedVideos}/${entry.totalVideos} videos, ${entry.duration1x} at 1x, ${entry.durationCustom} at ${entry.customSpeed}x`
    )
  ];

  return lines.join("\n");
}

function buildCsvSummary(
  rows: PlaylistRow[],
  metricsById: Map<string, RowMetrics>,
  customSpeed: number
) {
  const header = [
    "Playlist",
    "Channel",
    "Playlist ID",
    "Selected videos",
    "Total videos",
    "Range",
    "Duration at 1x",
    `Duration at ${customSpeed.toFixed(2)}x`,
    "Views",
    "Published",
    "YouTube URL"
  ];
  const body = getPlaylistExportRows(rows, metricsById, customSpeed).map((entry) => [
    entry.playlistTitle,
    entry.channelTitle,
    entry.playlistId,
    entry.selectedVideos,
    entry.totalVideos,
    entry.rangeLabel,
    entry.duration1x,
    entry.durationCustom,
    entry.views,
    entry.published,
    entry.playlistUrl
  ]);

  return [header, ...body]
    .map((line) => line.map((cell) => escapeCsvValue(cell)).join(","))
    .join("\n");
}

function WatchPlanPanel({
  rows,
  metricsById,
  totals,
  customSpeed
}: {
  rows: PlaylistRow[];
  metricsById: Map<string, RowMetrics>;
  totals: TotalsSummary;
  customSpeed: number;
}) {
  const [dailyMinutes, setDailyMinutes] = React.useState(60);
  const safeDailyMinutes = Math.max(1, dailyMinutes || 1);
  const adjustedTotalSeconds = totals.totalSelectedDuration / customSpeed;
  const planDays = adjustedTotalSeconds > 0 ? Math.ceil(adjustedTotalSeconds / (safeDailyMinutes * 60)) : 0;
  const finishDate = formatCalendarDate(planDays);
  const videosPerDay = planDays > 0 ? Math.ceil(totals.totalSelectedVideos / planDays) : 0;

  const copySummary = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        buildCopySummary(rows, metricsById, customSpeed, totals, safeDailyMinutes, planDays)
      );
      toast.success("Summary copied");
    } catch {
      toast.error("Could not copy summary");
    }
  }, [customSpeed, metricsById, planDays, rows, safeDailyMinutes, totals]);

  const downloadCsv = React.useCallback(() => {
    const csv = buildCsvSummary(rows, metricsById, customSpeed);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "playlist-time-summary.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  }, [customSpeed, metricsById, rows]);

  if (totals.successfulRows === 0) return null;

  return (
    <section className="grid gap-4 rounded-lg border border-border-dark bg-surface-dark/92 p-4 shadow-soft lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.75fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-extrabold text-gray-100">
          <CalendarDays className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-extrabold">Daily watch planner</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-warm-muted">
          At <span className="font-mono text-gray-200">{customSpeed.toFixed(2)}x</span>, this selection takes{" "}
          <span className="font-mono font-semibold text-gray-100">{formatDuration(adjustedTotalSeconds)}</span>. Use a daily goal to estimate a realistic finish date.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="rounded-md border border-border-dark bg-background-dark/82 p-3 shadow-inset">
          <span className="block text-[11px] font-semibold text-warm-muted">Min/day</span>
          <Input
            type="number"
            min={1}
            step={5}
            value={dailyMinutes}
            inputMode="numeric"
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              setDailyMinutes(Number.isFinite(next) && next > 0 ? next : 1);
            }}
            className="mt-1 h-8 border-none bg-transparent p-0 font-mono text-lg font-bold text-white focus-visible:ring-0"
            aria-label="Daily watch minutes"
          />
        </label>
        <div className="rounded-md border border-border-dark bg-background-dark/82 p-3 shadow-inset">
          <div className="text-[11px] font-semibold text-warm-muted">Days</div>
          <div className="mt-1 font-mono text-lg font-bold text-white">{planDays}</div>
        </div>
        <div className="rounded-md border border-border-dark bg-background-dark/82 p-3 shadow-inset">
          <div className="text-[11px] font-semibold text-warm-muted">Videos/day</div>
          <div className="mt-1 font-mono text-lg font-bold text-white">{videosPerDay}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <div className="mr-1 min-w-0 text-sm">
          <div className="text-[11px] font-semibold text-warm-muted">Finish by</div>
          <div className="font-mono font-bold text-gray-100">{finishDate}</div>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={copySummary}>
          <Copy className="size-3.5" aria-hidden="true" />
          Copy
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={downloadCsv}>
          <Download className="size-3.5" aria-hidden="true" />
          CSV
        </Button>
      </div>
    </section>
  );
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
  const [isMobileLayout, setIsMobileLayout] = React.useState(false);

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
                      <div className="flex items-center justify-center gap-1 text-[10px] text-warm-muted">
                        <kbd className="rounded border border-border-dark bg-surface-raised px-1 py-0.5 font-mono text-[9px]">Up</kbd>
                        <kbd className="rounded border border-border-dark bg-surface-raised px-1 py-0.5 font-mono text-[9px]">Down</kbd>
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
              <Popover>
                <PopoverTrigger asChild>
                  <div className="hidden h-10 w-16 shrink-0 cursor-pointer overflow-hidden rounded border border-border-dark bg-surface-raised md:block">
                    {item.data?.thumbnailUrl ? (
                      <img
                        src={item.data.thumbnailUrl}
                        alt={`${playlistTitle} thumbnail`}
                        className="h-full w-full object-cover opacity-85 transition group-hover:opacity-100"
                        width={64}
                        height={40}
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                      />
                    ) : (
                      <div className="h-full w-full bg-linear-to-br from-surface-darker via-surface-dark to-surface-raised" />
                    )}
                  </div>
                </PopoverTrigger>
                {item.data?.thumbnailUrl && (
                  <PopoverContent side="right" className="w-fit border-border-dark bg-surface-darker p-0">
                    <img
                      src={item.data.thumbnailUrl}
                      alt={`${playlistTitle} thumbnail`}
                      className="rounded object-cover"
                      width={320}
                      height={200}
                      loading="lazy"
                      decoding="async"
                      fetchPriority="low"
                    />
                  </PopoverContent>
                )}
              </Popover>

              <div className="min-w-0 flex-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <h3
                      className="truncate text-sm font-semibold text-gray-100 transition group-hover:text-primary"
                      aria-label={playlistTitle}
                    >
                      {playlistUrl ? (
                        <a
                          href={playlistUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="group/link inline-flex max-w-full cursor-pointer items-center gap-1.5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                          aria-label={`Open playlist: ${playlistTitle}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <span className="truncate">{playlistTitle}</span>
                          <ExternalLink className="size-3 shrink-0 text-gray-500 group-hover/link:text-primary" aria-hidden="true" />
                          <span className="shrink-0 text-[11px] font-semibold text-gray-500 group-hover/link:text-primary">Open</span>
                        </a>
                      ) : (
                        <span>{playlistTitle}</span>
                      )}
                    </h3>
                  </TooltipTrigger>
                  <TooltipContent>{playlistTitle}</TooltipContent>
                </Tooltip>
                <p className="truncate text-xs text-gray-500">{item.data?.channelTitle || "Unknown channel"}</p>
                <p className="mt-1 text-[11px] text-gray-400">{item.loadingLabel ?? ""}</p>
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
              <span className="block cursor-help">
                <SortHeader
                  label="Views"
                  canSort={column.getCanSort()}
                  sorted={column.getIsSorted()}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>Sum of individual video view counts</TooltipContent>
          </Tooltip>
        ),
        accessorFn: (row) => row.data?.totalVideoViewsSum ?? 0,
        cell: ({ row }) => {
          if (row.original.status === "loading") return <Skeleton className="h-4 w-14" />;
          if (row.original.status === "error") return <span className="text-xs text-gray-400">-</span>;
          return <span className="font-mono text-sm text-gray-300">{formatViews(row.original.data?.totalVideoViewsSum ?? 0)}</span>;
        }
      },
      {
        id: "avg_length",
        header: ({ column }) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block cursor-help">
                <SortHeader
                  label="Avg length"
                  canSort={column.getCanSort()}
                  sorted={column.getIsSorted()}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>Average video duration (click to sort)</TooltipContent>
          </Tooltip>
        ),
        accessorFn: (row) => metricsById.get(row.id)?.avgLengthSec ?? 0,
        cell: ({ row }) => {
          if (row.original.status === "loading") return <Skeleton className="h-4 w-14" />;
          if (row.original.status === "error") return <span className="text-xs text-gray-400">-</span>;
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
                <div className="text-[10px] font-bold text-gray-300">{speedColumn.label}</div>
                <SpeedControl value={customSpeed} onCommit={onCustomSpeedCommit} compact />
              </div>
            )
            : ({ column }) => (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block cursor-help">
                    <SortHeader
                      label={speedColumn.label}
                      canSort={column.getCanSort()}
                      sorted={column.getIsSorted()}
                      primary={speedColumn.primary}
                    />
                  </span>
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
          if (row.original.status === "error") return <span className="text-xs text-gray-400">-</span>;

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
            <span className="block cursor-help">
              <SortHeader label="Published" canSort={column.getCanSort()} sorted={column.getIsSorted()} />
            </span>
          </TooltipTrigger>
          <TooltipContent>Latest upload date (click to sort)</TooltipContent>
        </Tooltip>
      ),
      accessorFn: (row) => (row.data?.publishedAt ? new Date(row.data.publishedAt).getTime() : 0),
      cell: ({ row }) => {
        if (row.original.status === "loading") return <Skeleton className="h-4 w-20" />;
        if (row.original.status === "error") return <span className="text-xs text-gray-400">-</span>;
        return (
          <div className="leading-tight">
            <div className="font-mono text-sm text-gray-300">{formatDateLabel(row.original.data?.publishedAt ?? null)}</div>
            <div className="text-[11px] text-gray-400">{formatRelativeTime(row.original.data?.publishedAt ?? null)}</div>
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

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncLayout = () => setIsMobileLayout(mediaQuery.matches);

    syncLayout();
    mediaQuery.addEventListener("change", syncLayout);
    return () => mediaQuery.removeEventListener("change", syncLayout);
  }, []);

  const totals = React.useMemo(() => {
    let totalSelectedDuration = 0;
    let totalSelectedVideos = 0;
    let totalViews = 0;
    let successfulRows = 0;

    for (const row of rows) {
      if (row.status !== "success") continue;
      const metrics = metricsById.get(row.id);
      if (!metrics) continue;
      successfulRows += 1;
      totalSelectedDuration += metrics.selectedDurationSec;
      totalSelectedVideos += metrics.range.selectedCount;
      totalViews += row.data?.totalVideoViewsSum ?? 0;
    }

    const avgLength = totalSelectedVideos > 0 ? totalSelectedDuration / totalSelectedVideos : 0;
    return {
      totalSelectedDuration,
      totalSelectedVideos,
      totalViews,
      successfulRows,
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

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <WatchPlanPanel
          rows={rows}
          metricsById={metricsById}
          totals={totals}
          customSpeed={customSpeed}
        />

        {isMobileLayout ? (
        <div className="space-y-3">
          {table.getRowModel().rows.map((row) => (
            <MobilePlaylistCard
              key={row.original.id}
              row={row.original}
              metrics={metricsById.get(row.original.id)}
              speedColumns={speedColumns}
              customSpeed={customSpeed}
              isRangeOpen={openRangeId === row.original.id}
              onRangeOpenChange={(open) => setOpenRangeId(open ? row.original.id : null)}
              onRangeApply={(start, end) => {
                onRangeApply(row.original.id, start, end);
                setOpenRangeId(null);
              }}
              onRemoveRow={() => onRemoveRow(row.original.id)}
              onCustomSpeedCommit={onCustomSpeedCommit}
            />
          ))}

          {rows.length > 1 && <MobileTotalsCard totals={totals} speedColumns={speedColumns} />}
        </div>
      ) : (
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
                              header.column.getToggleSortingHandler()?.(event);
                            }
                          }}
                          className="w-full cursor-pointer rounded px-1 text-left hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
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
            {table.getRowModel().rows.map((row) => {
              const draggable = true;
              const isSelected = selectedRowId === row.original.id;
              return (
                <TableRow
                  key={row.id}
                  draggable={draggable}
                  tabIndex={0}
                  aria-selected={isSelected}
                  onClick={() => setSelectedRowId(row.original.id)}
                  onKeyDown={(event) => handleRowKeyDown(event, row.original.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-primary/15 focus:outline-none focus:ring-2 focus:ring-primary ring-inset"
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
                      className={`${cell.column.id === "playlist" ? "drag-handle" : ""}`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>

          {rows.length > 1 && (
            <TableFooter>
              <TableRow role="row">
                <TableCell role="cell" />
                <TableCell role="cell" className="text-sm font-medium text-gray-300">
                  Total watch time
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
          )}
        </Table>
      )}

      <div className="sr-only" aria-live="polite">
        {statusMessage}
      </div>
      </div>
    </TooltipProvider>
  );
}
