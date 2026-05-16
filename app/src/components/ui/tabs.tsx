import * as React from "react";
import { cn } from "@/lib/utils";

type TabsContextValue = {
  value?: string;
  onValueChange?: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue>({});

function Tabs({
  value,
  defaultValue,
  onValueChange,
  children,
  className
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const actualValue = value ?? internalValue;
  const handleValueChange = React.useCallback(
    (nextValue: string) => {
      if (value === undefined) setInternalValue(nextValue);
      onValueChange?.(nextValue);
    },
    [onValueChange, value]
  );

  return (
    <TabsContext.Provider value={{ value: actualValue, onValueChange: handleValueChange }}>
      <div className={cn("tabs-root", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} role="tablist" className={cn("tabs-list", className)} {...props} />
);
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }>(
  ({ className, children, value, type = "button", ...props }, ref) => {
    const context = React.useContext(TabsContext);
    const selected = context.value === value;
    return (
      <button
        ref={ref}
        type={type}
        role="tab"
        aria-selected={selected}
        className={cn("tabs-trigger", selected ? "tabs-trigger-active" : undefined, className)}
        onClick={(event) => {
          props.onClick?.(event);
          context.onValueChange?.(value);
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
);
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value: string }>(
  ({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    return context.value === value ? <div ref={ref} className={cn("tabs-content", className)} {...props} /> : null;
  }
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsContent, TabsList, TabsTrigger };
