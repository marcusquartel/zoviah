"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavList } from "@/components/app-shell/nav-list";
import { BrandLogo } from "@/components/brand-logo";

interface MobileNavProps {
  orgName: string;
  logoUrl?: string | null;
}

export function MobileNav({ orgName, logoUrl }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label="Abrir menu"
          />
        }
      >
        <Menu />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {logoUrl ? <BrandLogo src={logoUrl} alt={orgName} size="xs" /> : null}
            <span className={logoUrl ? "sr-only" : undefined}>{orgName}</span>
          </SheetTitle>
        </SheetHeader>
        <NavList onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
