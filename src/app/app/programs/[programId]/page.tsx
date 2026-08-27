import { redirect } from "next/navigation";

export default async function ProgramIndexPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  redirect(`/app/programs/${programId}/general`);
}
