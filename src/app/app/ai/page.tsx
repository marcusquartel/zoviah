import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import {
  getAnthropicModelName,
  isAnthropicConfigured,
} from "@/lib/anthropic/env";
import {
  CRITERIA,
  CRITERION_IDS,
  PROMPT_VERSION,
  SCORING_VERSION,
  TOTAL_WEIGHT,
} from "@/features/analysis/criteria";
import { getAnalysisStats } from "@/features/analysis/queries";
import { getEvidenceStats } from "@/features/evidence/queries";
import { getCurrentOrganization } from "@/features/organizations/queries";

export const metadata: Metadata = { title: "IA · Creator Hub" };

export default async function AiPage() {
  const current = await getCurrentOrganization();
  if (!current) return null;

  const configured = isAnthropicConfigured();
  const model = getAnthropicModelName();
  const stats = await getAnalysisStats();
  const evidence = await getEvidenceStats();

  return (
    <div className="space-y-6">
      <PageHeader
        title="IA"
        description="Motor de análise de creators. O score é calculado pelo backend de forma determinística — a IA só produz avaliação qualitativa onde há evidência."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Integração</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              {configured ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <XCircle className="size-4 text-muted-foreground" />
              )}
              <span>{configured ? "Configurada" : "Não configurada"}</span>
            </p>
            <p className="text-muted-foreground">
              Modelo:{" "}
              <code className="text-foreground">{model ?? "—"}</code>
            </p>
            <p className="text-muted-foreground">
              Scoring version:{" "}
              <code className="text-foreground">{SCORING_VERSION}</code>
            </p>
            <p className="text-muted-foreground">
              Prompt version:{" "}
              <code className="text-foreground">{PROMPT_VERSION}</code>
            </p>
            {!configured ? (
              <p className="text-xs text-muted-foreground">
                Defina <code>ANTHROPIC_API_KEY</code> e{" "}
                <code>ANTHROPIC_MODEL</code> no servidor. O CRM funciona
                normalmente sem elas.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Análises</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Concluídas" value={stats.completed} />
              <Stat label="Falhas" value={stats.failed} />
              <Stat
                label="Score médio"
                value={stats.avg_score ?? "—"}
              />
              <Stat
                label="Coverage médio"
                value={
                  stats.avg_coverage != null
                    ? `${Math.round(stats.avg_coverage * 100)}%`
                    : "—"
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Evidence Layer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Stat label="Snapshots" value={evidence.snapshots} />
            <Stat
              label="Creators com snapshot"
              value={evidence.creators_with_snapshot}
            />
            <Stat
              label="Perfis com 2+ snapshots"
              value={evidence.profiles_multi_snapshot}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Métricas observadas de redes sociais (seguidores, views, alcance,
            engajamento) com proveniência e histórico. Nesta fase são apenas
            evidência — <strong>não alteram o Creator Score</strong>. O conjunto
            de dados servirá para calibrar o <code>creator-score-v2</code> (fase
            própria: percentis e benchmarks).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Pesos do Creator Score ({TOTAL_WEIGHT} pontos)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Table>
            <TableBody>
              {CRITERION_IDS.map((id) => (
                <TableRow key={id}>
                  <TableCell>{CRITERIA[id].label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {CRITERIA[id].weight}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">
                      {CRITERIA[id].source === "ai"
                        ? "qualitativo"
                        : "objetivo"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-sm text-muted-foreground">
            60% estrutura objetiva · 40% avaliação qualitativa. Critérios sem
            evidência não recebem nota (ficam <code>null</code>, nunca 0). O
            score preliminar considera só os critérios efetivamente avaliados e
            vem sempre acompanhado de <strong>coverage</strong> e{" "}
            <strong>confidence</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
