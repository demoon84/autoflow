import type * as React from "react";
import Divider from "@mui/material/Divider";
import { cn } from "@/lib/utils";

export function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <Divider
      role="separator"
      aria-orientation={orientation}
      className={cn("af-separator", orientation === "vertical" ? "af-separator-vertical" : undefined, className)}
      orientation={orientation}
      {...props}
    />
  );
}
