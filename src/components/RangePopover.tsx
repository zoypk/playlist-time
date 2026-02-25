import * as React from "react";
import { X } from "lucide-react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import type { RangeInfo } from "./types";
import { clamp, getRangePillLabel } from "./utils";

type RangePopoverProps = {
  range: RangeInfo;
  isOpen: boolean;
  disabled: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (start: number | null, end: number | null) => void;
};

/**
 * Range editor popover for per-playlist start/end selection and presets.
 */
export default function RangePopover({ range, isOpen, disabled, onOpenChange, onApply }: RangePopoverProps) {
  const [start, setStart] = React.useState<string>(range.start > 0 ? String(range.start) : "");
  const [end, setEnd] = React.useState<string>(range.end > 0 ? String(range.end) : "");
  const [presetCount, setPresetCount] = React.useState<string>("10");

  React.useEffect(() => {
    setStart(range.start > 0 ? String(range.start) : "");
    setEnd(range.end > 0 ? String(range.end) : "");
  }, [range.start, range.end, isOpen]);

  const total = range.totalVideos;

  const applyCurrent = () => {
    if (total <= 0) {
      onApply(null, null);
      return;
    }

    const parsedStart = Number.parseInt(start, 10);
    const parsedEnd = Number.parseInt(end, 10);
    const normalizedStart = Number.isFinite(parsedStart) ? clamp(parsedStart, 1, total) : 1;
    const normalizedEnd = Number.isFinite(parsedEnd) ? clamp(parsedEnd, 1, total) : total;

    onApply(Math.min(normalizedStart, normalizedEnd), Math.max(normalizedStart, normalizedEnd));
  };

  const applyFirstLast = (mode: "first" | "last") => {
    if (total <= 0) return;
    const nRaw = Number.parseInt(presetCount, 10);
    const n = clamp(Number.isFinite(nRaw) ? nRaw : 10, 1, total);
    if (mode === "first") {
      onApply(1, n);
      return;
    }
    onApply(total - n + 1, total);
  };

  return (
    <Popover open={isOpen && !disabled && !range.unavailable} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-auto rounded-full border-primary/40 bg-black/50 px-3 py-1 font-mono text-xs text-gray-300 hover:border-primary hover:bg-black hover:text-white"
          disabled={disabled}
          title={
            range.unavailable
              ? "Range unavailable because ordered durations are missing"
              : `Selected ${range.selectedCount} of ${range.totalVideos} videos`
          }
        >
          {getRangePillLabel(range)}
        </Button>
      </PopoverTrigger>

      {!disabled && !range.unavailable && (
        <PopoverContent align="start" sideOffset={8} className="w-64">
          <TooltipProvider>
            <div className="mb-2 flex items-center justify-between border-b border-border-dark pb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Edit range</span>
              <Button type="button" variant="ghost" size="icon" className="size-6" aria-label="Close range editor" onClick={() => onOpenChange(false)}>
                <X className="size-3.5" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-gray-500">
              Start
              <Input
                type="number"
                min={1}
                max={Math.max(total, 1)}
                value={start}
                inputMode="numeric"
                onChange={(event) => setStart(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyCurrent();
                  }
                }}
                className="h-8 px-2 py-1 text-xs"
                title="Press Enter to apply"
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-gray-500">
              End
              <Input
                type="number"
                min={1}
                max={Math.max(total, 1)}
                value={end}
                inputMode="numeric"
                onChange={(event) => setEnd(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyCurrent();
                  }
                }}
                className="h-8 px-2 py-1 text-xs"
                title="Press Enter to apply"
              />
            </label>
          </div>

          <div className="mt-3 flex items-center gap-1">
            <Input
              type="number"
              min={1}
              max={Math.max(total, 1)}
              value={presetCount}
              inputMode="numeric"
              onChange={(event) => setPresetCount(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyCurrent();
                }
              }}
              className="h-8 w-14 px-2 py-1 text-xs"
              aria-label="Preset range count"
              title="Press Enter to apply"
            />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-[10px]" onClick={() => applyFirstLast("first")}>
                    First N
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Apply to first N videos</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-[10px]" onClick={() => applyFirstLast("last")}>
                    Last N
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Apply to last N videos</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-[10px]" onClick={() => onApply(null, null)}>
                    All
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Include all videos</TooltipContent>
              </Tooltip>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStart(range.start > 0 ? String(range.start) : "");
                      setEnd(range.end > 0 ? String(range.end) : "");
                    }}
                  >
                    Reset
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Revert to previous range</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" size="sm" onClick={applyCurrent} className="gap-2">
                    Apply
                    <kbd className="hidden rounded border border-primary-foreground/20 bg-primary-foreground/10 px-1 py-0.5 font-mono text-[9px] font-semibold md:inline">
                      ↵
                    </kbd>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save and apply this range</TooltipContent>
              </Tooltip>
          </div>
          </TooltipProvider>
        </PopoverContent>
      )}
    </Popover>
  );
}
