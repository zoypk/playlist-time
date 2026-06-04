import * as React from "react";

import { Input } from "./ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { clamp } from "./utils";

type SpeedControlProps = {
  /** Current playback speed multiplier. */
  value: number;
  /** Called with a clamped speed when the user commits the draft value. */
  onCommit: (value: number) => void;
  /** Uses tighter spacing when rendered inside compact surfaces. */
  compact?: boolean;
};

/**
 * Custom speed editor with native up/down arrows and commit-on-blur/enter behavior.
 */
function SpeedControl({ value, onCommit, compact = false }: SpeedControlProps): React.ReactElement {
  const [draft, setDraft] = React.useState(value.toFixed(2));

  React.useEffect(() => {
    setDraft(value.toFixed(2));
  }, [value]);

  const commit = React.useCallback(
    (next: number) => {
      const clamped = clamp(Number.isFinite(next) ? next : value, 0.1, 3);
      onCommit(Number(clamped.toFixed(2)));
    },
    [onCommit, value]
  );

  return (
    <TooltipProvider>
      <div
        className={
          compact
            ? "flex min-h-10 items-center gap-1"
            : "flex min-h-11 items-center rounded-md border border-border-dark bg-background-dark/70 px-2 py-1 shadow-inset"
        }
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex min-h-10 items-center gap-1 rounded border border-border-dark bg-surface-darker/90 px-2 py-1">
              <Input
                type="number"
                step={0.05}
                min={0.1}
                max={3}
                className={`${compact ? "w-16" : "w-20"} h-9 border-none bg-transparent p-0 text-center font-mono text-sm font-semibold text-white focus-visible:ring-0`}
                value={draft}
                inputMode="decimal"
                aria-label="Custom playback speed"
                onChange={(event) => {
                  setDraft(event.target.value);
                }}
                onBlur={() => {
                  const parsed = Number.parseFloat(draft);
                  commit(parsed);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />
              <span className="text-[11px] text-gray-500">x</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>Playback speed (0.1x - 3.0x)</TooltipContent>
        </Tooltip>

      </div>
    </TooltipProvider>
  );
}

export default React.memo(SpeedControl);
