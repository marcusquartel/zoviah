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
  Sparkle,
  UserRound,
  Users,
  UsersRound,
  type LucideIcon,
  Clapperboard,
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
  { title: "Envios", href: "/app/shipments", icon: Send },
  { title: "Conteúdos", href: "/app/content", icon: Clapperboard },
  { title: "Comissões", href: "/app/commissions", icon: BadgeDollarSign },
  { title: "Shopify", href: "/app/shopify", icon: ShoppingBag },
  { title: "Equipe", href: "/app/team", icon: UsersRound },
  { title: "Novidades", href: "/app/changelog", icon: Sparkle },
  { title: "Configurações", href: "/app/settings/appearance", icon: Settings },
];

export interface ComingSoonItem {
  title: string;
  icon: LucideIcon;
}

/** Roadmap only — no routes, no tables, no APIs. */
export const comingSoonNav: ComingSoonItem[] = [
  { title: "Campanhas", icon: Megaphone },
  { title: "Performance", icon: BarChart3 },
  { title: "Portal Creator", icon: UserRound },
  { title: "TikTok Shop", icon: Music2 },
];
