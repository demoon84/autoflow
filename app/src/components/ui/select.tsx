import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SelectItemRecord = {
  value: string;
  children: React.ReactNode;
  disabled?: boolean;
};

type SelectContextValue = {
  value?: string;
  disabled?: boolean;
  placeholder?: React.ReactNode;
  setPlaceholder: (placeholder: React.ReactNode) => void;
  onValueChange?: (value: string) => void;
  registerItem: (item: SelectItemRecord) => void;
  unregisterItem: (value: string) => void;
  items: SelectItemRecord[];
};

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext(component: string) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error(`${component} must be used inside Select`);
  return context;
}

function Select({
  value,
  defaultValue,
  disabled = false,
  onValueChange,
  children
}: {
  value?: string;
  defaultValue?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
  const [placeholder, setPlaceholder] = React.useState<React.ReactNode>(undefined);
  const [items, setItems] = React.useState<SelectItemRecord[]>([]);
  const actualValue = value ?? internalValue;

  const registerItem = React.useCallback((item: SelectItemRecord) => {
    setItems((current) => {
      const existingIndex = current.findIndex((candidate) => candidate.value === item.value);
      if (existingIndex === -1) return [...current, item];
      const next = current.slice();
      next[existingIndex] = item;
      return next;
    });
  }, []);

  const unregisterItem = React.useCallback((itemValue: string) => {
    setItems((current) => current.filter((item) => item.value !== itemValue));
  }, []);

  const handleValueChange = React.useCallback(
    (nextValue: string) => {
      if (value === undefined) setInternalValue(nextValue);
      onValueChange?.(nextValue);
    },
    [onValueChange, value]
  );

  const contextValue = React.useMemo(
    () => ({
      value: actualValue,
      disabled,
      placeholder,
      setPlaceholder,
      onValueChange: handleValueChange,
      registerItem,
      unregisterItem,
      items
    }),
    [actualValue, disabled, handleValueChange, items, placeholder, registerItem, unregisterItem]
  );

  return <SelectContext.Provider value={contextValue}>{children}</SelectContext.Provider>;
}

const SelectGroup = ({ children }: { children: React.ReactNode }) => <>{children}</>;

function SelectValue({ placeholder }: { placeholder?: React.ReactNode }) {
  const { setPlaceholder } = useSelectContext("SelectValue");

  React.useEffect(() => {
    setPlaceholder(placeholder);
  }, [placeholder, setPlaceholder]);

  return null;
}

type SelectTriggerProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value" | "defaultValue">;

const SelectTrigger = React.forwardRef<HTMLSelectElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const context = useSelectContext("SelectTrigger");

    return (
      <span className={cn("af-select-trigger", className)}>
        {children}
        <select
          ref={ref}
          className="af-select-control"
          disabled={context.disabled}
          value={context.value ?? ""}
          onChange={(event) => context.onValueChange?.(event.target.value)}
          aria-label={props["aria-label"]}
        >
          {context.placeholder && !context.items.some((item) => item.value === "") ? (
            <option value="" disabled>
              {context.placeholder}
            </option>
          ) : null}
          {context.items.map((item) => (
            <option key={item.value} value={item.value} disabled={item.disabled}>
              {item.children}
            </option>
          ))}
        </select>
        <ChevronDown className="af-select-chevron" aria-hidden="true" />
      </span>
    );
  }
);
SelectTrigger.displayName = "SelectTrigger";

const SelectContent = ({ children }: { children: React.ReactNode }) => <>{children}</>;

const SelectItem = React.forwardRef<HTMLSpanElement, { value: string; disabled?: boolean; children: React.ReactNode }>(
  ({ value, disabled, children }, ref) => {
    const { registerItem, unregisterItem } = useSelectContext("SelectItem");

    React.useEffect(() => {
      registerItem({ value, disabled, children });
      return () => unregisterItem(value);
    }, [children, disabled, registerItem, unregisterItem, value]);

    return <span ref={ref} hidden />;
  }
);
SelectItem.displayName = "SelectItem";

const SelectLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("af-select-label", className)} {...props} />
);
SelectLabel.displayName = "SelectLabel";

const SelectSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("af-select-separator", className)} {...props} />
);
SelectSeparator.displayName = "SelectSeparator";

const SelectScrollUpButton = () => null;
const SelectScrollDownButton = () => null;

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue
};
