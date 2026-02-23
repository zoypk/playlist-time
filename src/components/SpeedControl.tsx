import * as React from "react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { clamp } from "./utils";

type SpeedControlProps = {
  value: number;
  onCommit: (value: number) => void;
};

/**
 * Custom speed editor with step buttons and commit-on-blur/enter behavior.
 */
export default function SpeedControl({ value, onCommit }: SpeedControlProps) {
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
    <div className="flex items-center gap-2 rounded-md border border-border-dark bg-surface-darker/90 px-2 py-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="Decrease custom speed"
        className="h-7 px-2 text-[11px]"
        onClick={() => commit(value - 0.05)}
      >
        -0.05
      </Button>

      <div className="flex items-center gap-1 rounded border border-border-dark bg-black px-2 py-1">
        <Input
          type="number"
          step={0.05}
          className="h-auto w-14 border-none bg-transparent p-0 text-center font-mono text-xs font-semibold text-white focus-visible:ring-0"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
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

      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="Increase custom speed"
        className="h-7 px-2 text-[11px]"
        onClick={() => commit(value + 0.05)}
      >
        +0.05
      </Button>

      <span className="hidden text-[10px] uppercase tracking-wide text-gray-500 lg:inline">0.1x-3.0x</span>
    </div>
  );
}
