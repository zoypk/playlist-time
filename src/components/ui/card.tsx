import * as React from "react";

import { cn } from "../../lib/utils";

function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <section className={cn("rounded-lg border border-border-dark bg-surface-dark shadow-soft", className)} {...props} />;
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-border-dark bg-surface-darker/85 p-3", className)} {...props} />;
}

export { Card, CardHeader };
