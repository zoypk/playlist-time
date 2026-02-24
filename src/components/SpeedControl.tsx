import * as React from "react";

import { Input } from "./ui/input";
import { clamp } from "./utils";

type SpeedControlProps = {
  value: number;
  onCommit: (value: number) => void;
  compact?: boolean;
};

/**
 * Custom speed editor with native up/down arrows and commit-on-blur/enter behavior.
 */
export default function SpeedControl({ value, onCommit, compact = false }: SpeedControlProps) {
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
    <div
      className={
        compact
          ? "flex items-center gap-1"
          : "flex items-center gap-2 rounded-md border border-border-dark bg-surface-darker/90 px-2 py-1"
      }
    >
      <div className="flex items-center gap-1 rounded border border-border-dark bg-black px-2 py-1">
        <Input
          type="number"
          step={0.05}
          min={0.1}
          max={3}
          className="h-auto w-16 border-none bg-transparent p-0 text-center font-mono text-xs font-semibold text-white focus-visible:ring-0"
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

      {!compact && <span className="hidden text-[10px] uppercase tracking-wide text-gray-500 lg:inline">0.1x-3.0x</span>}
    </div>
  );
}
