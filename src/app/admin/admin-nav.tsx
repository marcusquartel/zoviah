"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Organizações", exact: true },
  { href: "/admin/support", label: "Suporte" },
  { href: "/admin/product", label: "Produto" },
  { href: "/admin/audit", label: "Auditoria" },
];

export function AdminNav() {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="mx-auto flex max-w-6xl gap-1 px-6 pt-4">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.href, item.exact) ? "page" : undefined}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            isActive(item.href, item.exact)
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
