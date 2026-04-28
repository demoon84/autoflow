import * as React from "react";
import TextField from "@mui/material/TextField";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, value, defaultValue, onChange, placeholder, disabled, ...props }, ref) => (
    <TextField
      className={cn("af-input", className)}
      disabled={disabled}
      fullWidth
      inputRef={ref}
      placeholder={placeholder}
      size="small"
      type={type}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      slotProps={{
        htmlInput: props
      }}
    />
  )
);
Input.displayName = "Input";
