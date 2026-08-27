import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Programas · Creator Hub" };

export default function ProgramsPage() {
  return (
    <ComingSoon
      title="Programas"
      description="Programas, Kanban e fluxo de aprovação chegam nas próximas fases."
    />
  );
}
