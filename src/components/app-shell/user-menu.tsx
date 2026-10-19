"use client";

import { useTransition } from "react";
import Link from "next/link";
import { ChevronRight, ChevronsUpDown, LogOut, ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/features/auth/actions";
import { buildUserMenuItems } from "@/components/app-shell/user-menu-items";

interface UserMenuProps {
  /** `sidebar`: the white account card at the foot of the sidebar. */
  variant?: "topbar" | "sidebar";
  email: string;
  role: string;
  orgName?: string;
  isPlatformAdmin?: boolean;
}

function initials(email: string): string {
  return email.slice(0, 2).toUpperCase();
}

export function UserMenu({
  variant = "topbar",
  email,
  role,
  orgName,
  isPlatformAdmin,
}: UserMenuProps) {
  const [pending, startTransition] = useTransition();
  const items = buildUserMenuItems({ isPlatformAdmin });

  // `logout` is a Server Action (signOut + redirect("/login")). Invoked
  // imperatively via startTransition — the same pattern the CRM status menus
  // use — so the item stays a plain DropdownMenuItem.
  function handleLogout() {
    startTransition(async () => {
      await logout();
    });
  }

  return (
    <DropdownMenu>
      {variant === "sidebar" ? (
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl bg-card px-3 py-2.5 text-left transition-shadow outline-none hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:ring-[1.5px] aria-expanded:ring-input"
            />
          }
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-[0.75rem] font-medium tracking-[0.03em] text-primary-foreground">
            {initials(email)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{email}</span>
            <span className="block truncate text-[0.75rem] text-muted-foreground capitalize">
              {role}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="sm" className="h-9 gap-2 px-2" />}
        >
          <Avatar className="size-6">
            <AvatarFallback className="text-[0.65rem]">
              {initials(email)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[12rem] truncate text-sm sm:inline">
            {email}
          </span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent
        align={variant === "sidebar" ? "start" : "end"}
        side={variant === "sidebar" ? "top" : "bottom"}
        sideOffset={variant === "sidebar" ? 8 : 4}
        className={variant === "sidebar" ? "w-(--anchor-width) min-w-60" : "w-56"}
      >
        {/* Base UI's Menu.GroupLabel (= DropdownMenuLabel) throws
            "MenuGroupContext is missing" unless it is inside a Menu.Group. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate font-medium text-foreground">
              {email}
            </span>
            <span className="text-xs text-muted-foreground">
              {orgName ? `${orgName} · ` : ""}
              <span className="capitalize">{role}</span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        {items.map((item) =>
          item.key === "admin" ? (
            <DropdownMenuItem key="admin" render={<Link href={item.href!} />}>
              <ShieldCheck />
              {item.label}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              key="logout"
              variant="destructive"
              disabled={pending}
              onClick={handleLogout}
            >
              <LogOut />
              {pending ? "Saindo…" : item.label}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
