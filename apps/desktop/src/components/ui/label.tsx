import * as React from "react";
import InputLabel from "@mui/material/InputLabel";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, color: _color, ...props }, ref) => <InputLabel ref={ref} className={cn("af-label", className)} {...props} />
);
Label.displayName = "Label";
