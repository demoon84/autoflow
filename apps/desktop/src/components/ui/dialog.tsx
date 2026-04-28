import * as React from "react";
import MuiDialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DialogContextValue = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue>({});

function Dialog({
  open,
  defaultOpen,
  onOpenChange,
  children
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = React.useState(Boolean(defaultOpen));
  const actualOpen = open ?? internalOpen;
  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (open === undefined) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange, open]
  );

  return <DialogContext.Provider value={{ open: actualOpen, onOpenChange: setOpen }}>{children}</DialogContext.Provider>;
}

function DialogTrigger({
  asChild = false,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const context = React.useContext(DialogContext);
  const triggerProps = {
    ...props,
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      props.onClick?.(event);
      context.onOpenChange?.(true);
    }
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<typeof triggerProps>, triggerProps);
  }

  return <button {...triggerProps}>{children}</button>;
}

function DialogClose({
  asChild = false,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const context = React.useContext(DialogContext);
  const closeProps = {
    ...props,
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      props.onClick?.(event);
      context.onOpenChange?.(false);
    }
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<typeof closeProps>, closeProps);
  }

  return <button {...closeProps}>{children}</button>;
}

const DialogPortal = ({ children }: { children: React.ReactNode }) => <>{children}</>;

const DialogOverlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { dim?: boolean }>(
  ({ className, dim = false, ...props }, ref) => (
    <div ref={ref} className={cn("af-dialog-overlay", dim ? "af-dialog-overlay-dim" : undefined, className)} {...props} />
  )
);
DialogOverlay.displayName = "DialogOverlay";

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    overlayClassName?: string;
    overlayDim?: boolean;
    showClose?: boolean;
  }
>(({ className, children, overlayClassName, overlayDim = false, showClose = false, ...props }, ref) => {
  const context = React.useContext(DialogContext);

  return (
    <MuiDialog
      open={Boolean(context.open)}
      onClose={() => context.onOpenChange?.(false)}
      className={cn("af-dialog-root", overlayClassName, overlayDim ? "af-dialog-root-dim" : undefined)}
      slotProps={{
        paper: {
          className: cn("af-dialog-content", className),
          ref,
          ...props
        }
      }}
    >
      {children}
      {showClose ? (
        <IconButton className="af-dialog-close" aria-label="닫기" onClick={() => context.onOpenChange?.(false)}>
          <X className="h-4 w-4" />
        </IconButton>
      ) : null}
    </MuiDialog>
  );
});
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("af-dialog-header", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement> & { asChild?: boolean }
>(({ className, asChild = false, children, ...props }, ref) => {
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>;
    return React.cloneElement(child, {
      className: cn("af-dialog-title", child.props.className, className)
    });
  }

  return <h2 ref={ref} className={cn("af-dialog-title", className)} {...props}>{children}</h2>;
});
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("af-dialog-description", className)} {...props} />
  )
);
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
};
