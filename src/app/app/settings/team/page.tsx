import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { getCurrentUser } from "@/features/organizations/queries";
import { getTeam } from "@/features/team/queries";
import { TeamManager } from "@/features/team/components/team-manager";

export const metadata: Metadata = { title: "Equipe · Creator Hub" };

export default async function TeamPage() {
  const [current, user] = await Promise.all([
    getCurrentOrganization(),
    getCurrentUser(),
  ]);
  if (!current) return null;

  const team = await getTeam(current.organization.id);
  const canManage = current.role === "owner" || current.role === "admin";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipe"
        description="Membros e convites da organização."
      />
      <TeamManager
        members={team.members}
        invites={team.invites}
        currentUserId={user?.id ?? ""}
        canManage={canManage}
      />
    </div>
  );
}
