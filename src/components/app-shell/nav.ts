import {
  BarChart3,
  BadgeDollarSign,
  FolderKanban,
  LayoutDashboard,
  Megaphone,
  Music2,
  Send,
  Settings,
  ShoppingBag,
  Sparkles,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

/** Live sections. Only "Visão Geral" and "Configurações" have real content in Phase 0. */
export const primaryNav: NavItem[] = [
  { title: "Visão Geral", href: "/app", icon: LayoutDashboard },
  { title: "Creators", href: "/app/creators", icon: Users },
  { title: "Programas", href: "/app/programs", icon: FolderKanban },
  { title: "IA", href: "/app/ai", icon: Sparkles },
  { title: "Configurações", href: "/app/settings/appearance", icon: Settings },
];

export interface ComingSoonItem {
  title: string;
  icon: LucideIcon;
}

/** Roadmap only — no routes, no tables, no APIs. */
export const comingSoonNav: ComingSoonItem[] = [
  { title: "Campanhas", icon: Megaphone },
  { title: "Envios", icon: Send },
  { title: "Performance", icon: BarChart3 },
  { title: "Comissões", icon: BadgeDollarSign },
  { title: "Portal Creator", icon: UserRound },
  { title: "Shopify", icon: ShoppingBag },
  { title: "TikTok Shop", icon: Music2 },
];
