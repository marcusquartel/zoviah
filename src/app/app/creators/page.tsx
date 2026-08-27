import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Creators · Creator Hub" };

export default function CreatorsPage() {
  return (
    <ComingSoon
      title="Creators"
      description="O cadastro e a gestão de creators serão implementados na próxima fase."
    />
  );
}
