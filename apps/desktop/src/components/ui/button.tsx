import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
type ButtonSize = "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, children, type = "button", ...props }, ref) => {
    const buttonClassName = cn("af-button", `af-button-${variant}`, `af-button-${size}`, className);

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
