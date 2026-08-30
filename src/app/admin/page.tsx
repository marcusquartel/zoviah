import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { listOrganizations } from "@/features/platform/queries";
import { AdminOrgs } from "@/features/platform/components/admin-orgs";

export const metadata: Metadata = { title: "Admin SaaS · Organizações" };

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const search = typeof sp.q === "string" ? sp.q : "";
  const firstPage = await listOrganizations(search, 1);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Organizações"
        description="Provisionamento e gestão comercial dos tenants do Creator Hub."
      />
      <AdminOrgs search={search} firstPage={firstPage} />
    </div>
  );
}
