"use client";

import { ChevronsUpDown, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/features/auth/actions";

interface UserMenuProps {
  email: string;
  role: string;
}

function initials(email: string): string {
  return email.slice(0, 2).toUpperCase();
}

export function UserMenu({ email, role }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="h-9 gap-2 px-2" />
        }
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
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <span className="block truncate font-medium text-foreground">
            {email}
          </span>
          <span className="text-xs capitalize text-muted-foreground">
            {role}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action={logout}>
          <DropdownMenuItem
            variant="destructive"
            closeOnClick={false}
            render={<button type="submit" className="w-full" />}
          >
            <LogOut />
            Sair
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
