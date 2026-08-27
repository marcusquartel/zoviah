import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "IA · Creator Hub" };

export default function AiPage() {
  return (
    <ComingSoon
      title="IA"
      description="A análise assistida por IA será implementada em uma fase futura."
    />
  );
}
