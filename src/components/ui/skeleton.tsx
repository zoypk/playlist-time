import * as React from "react";

import { cn } from "../../lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded bg-gradient-to-r from-white/[0.06] via-accent/15 to-white/[0.06]", className)} {...props} />;
}

export { Skeleton };
