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

const linkBase =
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors";

export function NavList({ onNavigate, isPlatformAdmin }: NavListProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      <ul className="space-y-0.5">
        {primaryNav.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  linkBase,
                  active
                    ? "bg-secondary text-secondary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                )}
              >
                <item.icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    active ? "text-foreground" : "text-muted-foreground/80",
                  )}
                />
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>

      {isPlatformAdmin ? (
        <div className="space-y-1.5">
          <p className="eyebrow px-3">Plataforma</p>
          <ul className="space-y-0.5">
            <li>
              <Link
                href="/admin"
                onClick={onNavigate}
                aria-current={pathname.startsWith("/admin") ? "page" : undefined}
                className={cn(
                  linkBase,
                  pathname.startsWith("/admin")
                    ? "bg-secondary text-secondary-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                )}
              >
                <ShieldCheck className="size-4 shrink-0" />
                Admin SaaS
              </Link>
            </li>
          </ul>
        </div>
      ) : null}

      <div className="mt-auto space-y-1.5">
        <p className="eyebrow px-3">Em breve</p>
        <ul className="space-y-0.5">
          {comingSoonNav.map((item) => (
            <li key={item.title}>
              <span
                aria-disabled
                className={cn(
                  linkBase,
                  "cursor-not-allowed text-muted-foreground/45 select-none",
                )}
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
