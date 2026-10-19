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
  "flex items-center gap-3 rounded-2xl px-2 py-1.5 text-[0.9375rem] transition-colors";

/** The 30px icon mark: accent disc when active, bare glyph otherwise. */
function NavIcon({
  icon: Icon,
  active,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  active: boolean;
}) {
  return (
    <span
      className={cn(
        "flex size-[30px] shrink-0 items-center justify-center rounded-full transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
      )}
    >
      <Icon className="size-[17px]" strokeWidth={1.6} />
    </span>
  );
}

export function NavList({ onNavigate, isPlatformAdmin }: NavListProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto pb-4">
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
                    ? "bg-sidebar-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <NavIcon icon={item.icon} active={active} />
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>

      {isPlatformAdmin ? (
        <div className="space-y-1.5">
          <p className="eyebrow px-2">Plataforma</p>
          <ul className="space-y-0.5">
            <li>
              <Link
                href="/admin"
                onClick={onNavigate}
                aria-current={pathname.startsWith("/admin") ? "page" : undefined}
                className={cn(
                  linkBase,
                  pathname.startsWith("/admin")
                    ? "bg-sidebar-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <NavIcon
                  icon={ShieldCheck}
                  active={pathname.startsWith("/admin")}
                />
                Admin SaaS
              </Link>
            </li>
          </ul>
        </div>
      ) : null}

      <div className="mt-auto space-y-1.5">
        <p className="eyebrow px-2">Em breve</p>
        <ul className="space-y-0.5">
          {comingSoonNav.map((item) => (
            <li key={item.title}>
              <span
                aria-disabled
                className={cn(
                  linkBase,
                  "cursor-not-allowed text-faint/70 select-none",
                )}
              >
                <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full border-[1.4px] border-dashed border-input">
                  <item.icon className="size-[15px]" />
                </span>
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
