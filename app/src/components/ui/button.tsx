import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
type ButtonSize = "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const resolveButtonSize = (size: ButtonSize): ButtonSize => {
  if (size === "sm") return "xs";
  if (size === "icon-sm" || size === "icon") return "icon-xs";
  return size;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "xs", asChild = false, children, type = "button", ...props }, ref) => {
    const resolvedSize = resolveButtonSize(size);
    const buttonClassName = cn("af-button", `af-button-${variant}`, `af-button-${resolvedSize}`, className);

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        className: cn(buttonClassName, child.props.className)
      });
    }

    return (
      <button ref={ref} type={type} className={buttonClassName} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
