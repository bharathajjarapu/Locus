import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxContent, ComboboxItem, ComboboxList, ComboboxTrigger } from "@/components/ui/combobox";

type Item<T> = { value: T; label: string };

type Props<T> = {
  items: readonly Item<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  compact?: boolean;
  disabled?: boolean;
  restart?: boolean;
  children?: ReactNode;
};

// Dropdown for choosing one of a few fixed options; children replace the trigger text, restart offers a reload
export function Pick<T extends string | number>({ items, value, onChange, label, compact, disabled, restart, children }: Props<T>) {
  const item = items.find((entry) => entry.value === value) ?? items[0];
  return (
    <>
      {restart && (
        <Button variant="outline" size="sm" onClick={() => location.reload()}>
          Reload
        </Button>
      )}
      <Combobox
        items={items}
        value={item}
        disabled={disabled}
        itemToStringLabel={(entry) => entry.label}
        isItemEqualToValue={(a, b) => a.value === b.value}
        onValueChange={(next) => next && next.value !== value && onChange(next.value)}
      >
        <ComboboxTrigger render={<Button variant={compact ? "ghost" : "outline"} size={compact ? "sm" : "default"} aria-label={label} className="disabled:opacity-100" />}>
          {children ?? item.label}
        </ComboboxTrigger>
        <ComboboxContent side={compact ? "top" : "bottom"} align="end" className="w-auto min-w-0">
          <ComboboxList>
            {(entry: Item<T>) => (
              <ComboboxItem key={entry.value} value={entry}>
                {entry.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </>
  );
}
