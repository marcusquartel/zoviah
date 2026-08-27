"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { cn } from "@/lib/utils";

interface Tab {
  segment: string;
  label: string;
}

const TABS: Tab[] = [
  { segment: "general", label: "Geral" },
  { segment: "form", label: "Formulário" },
  { segment: "applications", label: "Inscrições" },
];

export function ProgramTabNav({ programId }: { programId: string }) {
  const active = useSelectedLayoutSegment();

  return (
    <nav className="flex gap-1 border-b">
      {TABS.map((tab) => {
        const isActive = active === tab.segment;
        return (
          <Link
            key={tab.segment}
            href={`/app/programs/${programId}/${tab.segment}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
