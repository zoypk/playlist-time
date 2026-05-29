import * as React from "react";

import { cn } from "../../lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded bg-gradient-to-r from-white/[0.08] via-white/[0.13] to-white/[0.08]", className)} {...props} />;
}

export { Skeleton };
