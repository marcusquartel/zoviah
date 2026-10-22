import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { getMonthSummary, listOrgContent } from "@/features/content/queries";
import { ContentReviewList } from "@/features/content/components/review-list";
import type { ContentStatus } from "@/types/database";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Conteúdos" };

const TABS: { status: ContentStatus; label: string }[] = [
  { status: "pending", label: "Em análise" },
  { status: "approved", label: "Aprovados" },
  { status: "rejected", label: "Recusados" },
];

function monthStart(): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return `${today.slice(0, 7)}-01`;
}

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const current = await getCurrentOrganization();
  if (!current) return null;
  const orgId = current.organization.id;
  const canReview = current.role === "owner" || current.role === "admin";

  const sp = await searchParams;
  const status = (TABS.find((t) => t.status === sp.status)?.status ?? "pending") as ContentStatus;
  const from = monthStart();

  const [rows, summary, pendingCount] = await Promise.all([
    listOrgContent(orgId, { status, limit: 200 }),
    getMonthSummary(orgId, from),
    listOrgContent(orgId, { status: "pending", limit: 500 }).then((r) => r.length),
  ]);
  const totals = summary.reduce(
    (t, r) => ({ post: t.post + r.post, reel: t.reel + r.reel, story: t.story + r.story, video: t.video + r.video, total: t.total + r.total }),
    { post: 0, reel: 0, story: 0, video: 0, total: 0 },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conteúdos"
        description="Publicações das creators com a marca. Elas registram pelo portal; a equipe aprova."
      />

      <section className="rounded-xl border bg-card p-4">
        <p className="text-sm font-medium">Aprovados neste mês</p>
        {summary.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma publicação aprovada neste mês ainda.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-normal">Creator</th>
                  <th className="py-2 pr-3 text-right font-normal">Posts</th>
                  <th className="py-2 pr-3 text-right font-normal">Reels</th>
                  <th className="py-2 pr-3 text-right font-normal">Stories</th>
                  <th className="py-2 pr-3 text-right font-normal">Vídeos TikTok</th>
                  <th className="py-2 text-right font-normal">Total</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((r) => (
                  <tr key={r.creator_id} className="border-t">
                    <td className="py-2 pr-3 font-medium">{r.creator_name}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.post}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.reel}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.story}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.video}</td>
                    <td className="py-2 text-right font-semibold tabular-nums">{r.total}</td>
                  </tr>
                ))}
                <tr className="border-t text-muted-foreground">
                  <td className="py-2 pr-3">Total</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{totals.post}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{totals.reel}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{totals.story}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{totals.video}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-foreground">{totals.total}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4">
        <nav className="flex gap-1 border-b">
          {TABS.map((t) => (
            <Link
              key={t.status}
              href={t.status === "pending" ? "/app/content" : `/app/content?status=${t.status}`}
              aria-current={status === t.status ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                status === t.status ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {t.status === "pending" && pendingCount > 0 ? (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{pendingCount}</span>
              ) : null}
            </Link>
          ))}
        </nav>
        <ContentReviewList rows={rows} canReview={canReview} />
      </section>
    </div>
  );
}
