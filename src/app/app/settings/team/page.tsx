import { redirect } from "next/navigation";

/** Equipe moved to the top-level sidebar. Keep old links working. */
export default function LegacyTeamSettingsPage() {
  redirect("/app/team");
}
