import * as React from "react";
import MuiButton, { type ButtonProps as MuiButtonProps } from "@mui/material/Button";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon";

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  asChild?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

function muiVariant(variant: ButtonVariant): MuiButtonProps["variant"] {
  if (variant === "outline") return "outlined";
  if (variant === "ghost" || variant === "link") return "text";
  return "contained";
}

function muiColor(variant: ButtonVariant): MuiButtonProps["color"] {
  if (variant === "destructive") return "error";
  if (variant === "secondary") return "secondary";
  return "primary";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, children, ...props }, ref) => {
    const buttonClassName = cn("af-button", `af-button-${variant}`, `af-button-${size}`, className);

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        className: cn(buttonClassName, child.props.className)
      });
    }

    return (
      <MuiButton
        ref={ref}
        className={buttonClassName}
        color={muiColor(variant)}
        size={size === "lg" ? "large" : size === "sm" || size === "icon" ? "small" : "medium"}
        variant={muiVariant(variant)}
        {...props}
      >
        {children}
      </MuiButton>
    );
  }
);
Button.displayName = "Button";
