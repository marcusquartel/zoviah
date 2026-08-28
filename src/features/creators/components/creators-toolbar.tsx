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
  CONFIDENCE_VALUES,
  CREATOR_SORTS,
  SORT_LABELS,
  TIER_VALUES,
  ANALYSIS_STATUS_VALUES,
  serializeCreatorQuery,
  hasActiveFilters,
  type CreatorQuery,
  type CreatorView,
} from "@/lib/query-state";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
} from "@/features/applications/status";
import {
  ANALYSIS_STATUS_LABELS,
  CONFIDENCE_LABELS,
  TIER_LABELS,
} from "@/features/analysis/labels";

const VIEW_STORAGE_KEY = "creator-hub:creators-view";
const ALL = "__all__";

interface ToolbarProps {
  query: CreatorQuery;
  programs: { id: string; name: string }[];
}

export function CreatorsToolbar({ query, programs }: ToolbarProps) {
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
          value={query.program ?? ALL}
          onValueChange={(v) => apply({ program: v === ALL ? null : v })}
        >
          <SelectTrigger className="w-48" aria-label="Programa">
            <SelectValue placeholder="Programa" />
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
          value={query.status ?? ALL}
          onValueChange={(v) =>
            apply({ status: v === ALL ? null : (v as CreatorQuery["status"]) })
          }
        >
          <SelectTrigger className="w-48" aria-label="Status">
            <SelectValue placeholder="Status" />
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
          active={query.duplicate}
          onClick={() => apply({ duplicate: !query.duplicate })}
        >
          Possível duplicidade
        </ToggleChip>
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

        <Select
          value={query.analysisStatus ?? ALL}
          onValueChange={(v) =>
            apply({
              analysisStatus:
                v === ALL ? null : (v as CreatorQuery["analysisStatus"]),
            })
          }
        >
          <SelectTrigger className="w-40" aria-label="Análise IA">
            <SelectValue placeholder="Análise" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Qualquer análise</SelectItem>
            {ANALYSIS_STATUS_VALUES.map((s) => (
              <SelectItem key={s} value={s}>
                {ANALYSIS_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={query.tier ?? ALL}
          onValueChange={(v) =>
            apply({ tier: v === ALL ? null : (v as CreatorQuery["tier"]) })
          }
        >
          <SelectTrigger className="w-32" aria-label="Tier">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Qualquer tier</SelectItem>
            {TIER_VALUES.map((t) => (
              <SelectItem key={t} value={t}>
                {TIER_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={query.confidence ?? ALL}
          onValueChange={(v) =>
            apply({
              confidence:
                v === ALL ? null : (v as CreatorQuery["confidence"]),
            })
          }
        >
          <SelectTrigger className="w-36" aria-label="Confidence">
            <SelectValue placeholder="Confidence" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Qualquer confiança</SelectItem>
            {CONFIDENCE_VALUES.map((c) => (
              <SelectItem key={c} value={c}>
                {CONFIDENCE_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DebouncedInput
          key={`min_score:${query.minScore ?? ""}`}
          value={query.minScore != null ? String(query.minScore) : ""}
          onCommit={(v) => {
            const n = Number.parseInt(v, 10);
            apply({ minScore: Number.isFinite(n) && n > 0 ? n : null });
          }}
          placeholder="Score mín."
          className="w-24"
        />

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
