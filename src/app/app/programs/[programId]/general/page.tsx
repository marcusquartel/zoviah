import { notFound } from "next/navigation";
import { GeneralForm } from "@/features/programs/components/general-form";
import { getProgram } from "@/features/programs/queries";

export default async function ProgramGeneralPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  const program = await getProgram(programId);
  if (!program) notFound();

  return <GeneralForm program={program} />;
}
