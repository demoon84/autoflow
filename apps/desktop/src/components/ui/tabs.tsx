import * as React from "react";
import Box from "@mui/material/Box";
import MuiTab from "@mui/material/Tab";
import MuiTabs from "@mui/material/Tabs";
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
      <Box className={cn("tabs-root", className)}>{children}</Box>
    </TabsContext.Provider>
  );
}

type TabsListProps = Omit<React.HTMLAttributes<HTMLDivElement>, "onChange">;

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, children, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    return (
      <MuiTabs
        ref={ref}
        className={cn("tabs-list", className)}
        value={context.value ?? false}
        onChange={(_, nextValue) => context.onValueChange?.(String(nextValue))}
        {...props}
      >
        {children}
      </MuiTabs>
    );
  }
);
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value: string }>(
  ({ className, children, value, ...props }, ref) => (
    <MuiTab ref={ref} className={cn("tabs-trigger", className)} value={value} label={children} {...props} />
  )
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
