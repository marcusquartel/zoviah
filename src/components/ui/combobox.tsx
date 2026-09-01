"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * A minimal typeahead combobox for picking one value from a long list
 * (used by the public form's Cidade field — thousands of options). Self
 * contained on purpose: no portal, no external primitive, works inside an RHF
 * `Controller`. Filters case/accent-insensitively and caps the rendered rows.
 */

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export interface ComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly string[];
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Shown as the empty state when nothing matches the query. */
  emptyLabel?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  maxRows?: number;
}

export function Combobox({
  value,
  onValueChange,
  options,
  id,
  placeholder = "Digite para buscar…",
  disabled,
  emptyLabel = "Nada encontrado.",
  maxRows = 50,
  ...aria
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const matches = React.useMemo(() => {
    const q = norm(query);
    const list = q
      ? options.filter((o) => norm(o).includes(q))
      : (options as string[]);
    return list.slice(0, maxRows);
  }, [options, query, maxRows]);

  const commit = (v: string) => {
    onValueChange(v);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={id ? `${id}-listbox` : undefined}
          autoComplete="off"
          disabled={disabled}
          value={open ? query : value}
          placeholder={value && !open ? value : placeholder}
          aria-invalid={aria["aria-invalid"]}
          aria-describedby={aria["aria-describedby"]}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            if (!open) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, matches.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && open && matches[active]) {
              e.preventDefault();
              commit(matches[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="pr-8"
        />
        <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>

      {open ? (
        <ul
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 text-sm shadow-md"
        >
          {matches.length === 0 ? (
            <li className="px-2 py-1.5 text-muted-foreground">{emptyLabel}</li>
          ) : (
            matches.map((o, i) => (
              <li
                key={o}
                role="option"
                aria-selected={o === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(o);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5",
                  i === active
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground",
                )}
              >
                <span className="truncate">{o}</span>
                {o === value ? <Check className="size-4 shrink-0" /> : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
