"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface ComboboxOption {
  value: string;
  label: string;
  keywords?: string;
}

interface ComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyText?: string;
  className?: string;
}

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "Search...",
  emptyText = "No results found.",
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [highlighted, setHighlighted] = React.useState(0);

  const selected = options.find((o) => o.value === value);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.keywords || "").toLowerCase().includes(q)
    );
  }, [options, query]);

  React.useEffect(() => {
    setHighlighted(0);
  }, [query, open]);

  const select = (v: string) => {
    onValueChange(v);
    setOpen(false);
    setQuery("");
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-left shadow-sm ring-offset-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-gray-950",
            className
          )}
        >
          <span
            className={cn(
              "truncate",
              !selected && "text-gray-400 dark:text-gray-500"
            )}
          >
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          side="bottom"
          sideOffset={4}
          className="z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-lg border border-gray-200 bg-white text-gray-950 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50"
        >
          <div className="flex items-center gap-2 border-b border-gray-200 px-3 dark:border-gray-800">
            <Search className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlighted((i) => Math.min(i + 1, filtered.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlighted((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter" && filtered[highlighted]) {
                  e.preventDefault();
                  select(filtered[highlighted].value);
                }
              }}
              placeholder={placeholder}
              className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
              autoFocus
            />
          </div>
          <ScrollArea className="max-h-60">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-gray-500">
                {emptyText}
              </p>
            ) : (
              <div className="p-1">
                {filtered.map((option, index) => (
                  <button
                    key={option.value}
                    type="button"
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => select(option.value)}
                    className={cn(
                      "relative flex w-full cursor-default select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none",
                      index === highlighted
                        ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50"
                        : "text-gray-900 dark:text-gray-50"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute left-2 flex h-3.5 w-3.5 items-center justify-center",
                        option.value === value
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </span>
                    <span className="truncate">{option.label}</span>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
