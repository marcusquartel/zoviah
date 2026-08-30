"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { comingSoonNav, primaryNav } from "@/components/app-shell/nav";

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface NavListProps {
  onNavigate?: () => void;
  isPlatformAdmin?: boolean;
}

export function NavList({ onNavigate, isPlatformAdmin }: NavListProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-6 px-3 py-4">
      <ul className="space-y-1">
        {primaryNav.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>

      {isPlatformAdmin ? (
        <ul className="space-y-1 border-t pt-4">
          <li>
            <Link
              href="/admin"
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            >
              <ShieldCheck className="size-4 shrink-0" />
              Admin SaaS
            </Link>
          </li>
        </ul>
      ) : null}

      <div className="space-y-2">
        <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
          Em breve
        </p>
        <ul className="space-y-1">
          {comingSoonNav.map((item) => (
            <li key={item.title}>
              <span
                aria-disabled
                className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/50 select-none"
              >
                <item.icon className="size-4 shrink-0" />
                <span className="flex-1">{item.title}</span>
                <Lock className="size-3" />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
