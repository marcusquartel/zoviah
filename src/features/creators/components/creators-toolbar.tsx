"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, List, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  CREATOR_SORTS,
  SORT_LABELS,
  serializeCreatorQuery,
  hasActiveFilters,
  type CreatorQuery,
  type CreatorView,
} from "@/lib/query-state";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
} from "@/features/applications/status";

const VIEW_STORAGE_KEY = "creator-hub:creators-view";
const ALL = "__all__";

/** Base UI's <Select.Value> renders the raw value unless Root gets `items`. */
type SelectItems = { value: string; label: string }[];

const SORT_ITEMS: SelectItems = CREATOR_SORTS.map((s) => ({
  value: s,
  label: SORT_LABELS[s],
}));
const STATUS_ITEMS: SelectItems = [
  { value: ALL, label: "Todos os status" },
  ...APPLICATION_STATUSES.map((s) => ({
    value: s,
    label: APPLICATION_STATUS_LABELS[s],
  })),
];
interface ToolbarProps {
  query: CreatorQuery;
  programs: { id: string; name: string }[];
  tiers: { id: string; name: string }[];
}

const NO_TIER = "none";

export function CreatorsToolbar({ query, programs, tiers }: ToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [term, setTerm] = useState(query.q);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function apply(patch: Partial<CreatorQuery>) {
    const qs = serializeCreatorQuery({ ...query, ...patch, page: 1 });
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Remember the last chosen view when arriving without an explicit ?view.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("view")) {
        const stored = localStorage.getItem(VIEW_STORAGE_KEY) as CreatorView | null;
        if (stored === "kanban") apply({ view: "kanban" });
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setView(view: CreatorView) {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      /* ignore */
    }
    apply({ view });
  }

  function onSearchChange(value: string) {
    setTerm(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => apply({ q: value }), 350);
  }

  const filtersActive = hasActiveFilters(query);

  const programItems: SelectItems = [
    { value: ALL, label: "Todos os programas" },
    ...programs.map((p) => ({ value: p.id, label: p.name })),
  ];

  const tierItems: SelectItems = [
    { value: ALL, label: "Todas as categorias" },
    ...tiers.map((t) => ({ value: t.id, label: t.name })),
    { value: NO_TIER, label: "Sem categoria" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5">
          <Button
            type="button"
            size="sm"
            variant={query.view === "list" ? "secondary" : "ghost"}
            onClick={() => setView("list")}
            aria-pressed={query.view === "list"}
          >
            <List className="size-4" /> Lista
          </Button>
          <Button
            type="button"
            size="sm"
            variant={query.view === "kanban" ? "secondary" : "ghost"}
            onClick={() => setView("kanban")}
            aria-pressed={query.view === "kanban"}
          >
            <LayoutGrid className="size-4" /> Kanban
          </Button>
        </div>

        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar nome, e-mail, telefone, @handle…"
            className="pl-8"
            aria-label="Buscar creators"
          />
        </div>

        <Select
          items={SORT_ITEMS}
          value={query.sort}
          onValueChange={(v) => v && apply({ sort: v as CreatorQuery["sort"] })}
        >
          <SelectTrigger className="w-44" aria-label="Ordenar">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CREATOR_SORTS.map((s) => (
              <SelectItem key={s} value={s}>
                {SORT_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={programItems}
          value={query.program ?? ALL}
          onValueChange={(v) => apply({ program: v === ALL ? null : v })}
        >
          <SelectTrigger className="w-48" aria-label="Programa">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os programas</SelectItem>
            {programs.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={STATUS_ITEMS}
          value={query.status ?? ALL}
          onValueChange={(v) =>
            apply({ status: v === ALL ? null : (v as CreatorQuery["status"]) })
          }
        >
          <SelectTrigger className="w-48" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os status</SelectItem>
            {APPLICATION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {APPLICATION_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {tiers.length > 0 ? (
          <Select
            items={tierItems}
            value={query.tier ?? ALL}
            onValueChange={(v) => apply({ tier: v === ALL ? null : (v as string) })}
          >
            <SelectTrigger className="w-44" aria-label="Categoria">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tierItems.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <DebouncedInput
          key={`city:${query.city ?? ""}`}
          value={query.city ?? ""}
          onCommit={(v) => apply({ city: v || null })}
          placeholder="Cidade"
          className="w-32"
        />
        <DebouncedInput
          key={`state:${query.state ?? ""}`}
          value={query.state ?? ""}
          onCommit={(v) => apply({ state: v || null })}
          placeholder="Estado"
          className="w-28"
        />

        <ToggleChip
          active={query.hasInstagram}
          onClick={() => apply({ hasInstagram: !query.hasInstagram })}
        >
          Tem Instagram
        </ToggleChip>
        <ToggleChip
          active={query.hasTiktok}
          onClick={() => apply({ hasTiktok: !query.hasTiktok })}
        >
          Tem TikTok
        </ToggleChip>
        <ToggleChip
          active={query.noAddress}
          onClick={() => apply({ noAddress: !query.noAddress })}
        >
          Sem endereço
        </ToggleChip>

        {filtersActive ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setTerm("");
              router.replace(pathname, { scroll: false });
            }}
          >
            <X className="size-3.5" /> Limpar
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function DebouncedInput({
  value,
  onCommit,
  placeholder,
  className,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  // Remounted via `key` by the parent when the committed value changes.
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <Input
      value={local}
      placeholder={placeholder}
      aria-label={placeholder}
      className={className}
      onChange={(e) => {
        setLocal(e.target.value);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => onCommit(e.target.value.trim()), 400);
      }}
    />
  );
}
