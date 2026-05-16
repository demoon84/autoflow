import * as React from "react";
import { cn } from "@/lib/utils";

type InputSize = "default" | "xs" | "sm";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: InputSize;
}

const resolveInputSize = (size: InputSize): "xs" => {
  if (size === "default" || size === "sm") return "xs";
  return "xs";
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", size = "xs", ...props }, ref) => {
    const resolvedSize = resolveInputSize(size);
    return <input ref={ref} type={type} className={cn("af-input", `af-input-${resolvedSize}`, className)} {...props} />;
  }
);
Input.displayName = "Input";
