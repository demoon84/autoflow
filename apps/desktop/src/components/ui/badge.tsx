import * as React from "react";
import Chip from "@mui/material/Chip";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  return (
    <Chip
      className={cn("af-badge", `af-badge-${variant}`, className)}
      label={children}
      size="small"
      variant={variant === "outline" ? "outlined" : "filled"}
      {...(props as Omit<typeof props, "color">)}
    />
  );
}
