import * as React from "react";
import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string;
  onValueChange: (value: string) => void;
  baseId: string;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within <Tabs />.");
  }

  return context;
}

type TabsProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, value, defaultValue = "", onValueChange, children, ...props }, ref) => {
    const generatedId = React.useId();
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const currentValue = value ?? internalValue;

    const handleValueChange = React.useCallback(
      (nextValue: string) => {
        if (value === undefined) {
          setInternalValue(nextValue);
        }
        onValueChange?.(nextValue);
      },
      [onValueChange, value]
    );

    return (
      <TabsContext.Provider value={{ value: currentValue, onValueChange: handleValueChange, baseId: generatedId }}>
        <div ref={ref} className={cn("tabs-root", className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);
Tabs.displayName = "Tabs";

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="tablist"
    className={cn(
      "tabs-list inline-flex h-auto items-center gap-1 rounded-xl border border-border bg-card p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

type TabsTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
};

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, disabled, onClick, children, ...props }, ref) => {
    const context = useTabsContext();
    const selected = context.value === value;
    const triggerId = `${context.baseId}-${value}-trigger`;
    const contentId = `${context.baseId}-${value}-content`;

    return (
      <button
        ref={ref}
        id={triggerId}
        type="button"
        role="tab"
        aria-selected={selected}
        aria-controls={contentId}
        data-state={selected ? "active" : "inactive"}
        disabled={disabled}
        tabIndex={selected ? 0 : -1}
        className={cn(
          "tabs-trigger inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
          selected
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          className
        )}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented && !disabled) {
            context.onValueChange(value);
          }
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
);
TabsTrigger.displayName = "TabsTrigger";

type TabsContentProps = React.HTMLAttributes<HTMLDivElement> & {
  value: string;
};

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(({ className, value, children, ...props }, ref) => {
  const context = useTabsContext();
  const selected = context.value === value;
  const triggerId = `${context.baseId}-${value}-trigger`;
  const contentId = `${context.baseId}-${value}-content`;

  if (!selected) {
    return null;
  }

  return (
    <div
      ref={ref}
      id={contentId}
      role="tabpanel"
      aria-labelledby={triggerId}
      tabIndex={0}
      className={cn("tabs-content outline-none", className)}
      {...props}
    >
      {children}
    </div>
  );
});
TabsContent.displayName = "TabsContent";

export { Tabs, TabsContent, TabsList, TabsTrigger };
