import { notFound } from "next/navigation";
import { FormBuilder } from "@/features/programs/components/form-builder";
import { getFormFields, getProgram } from "@/features/programs/queries";

export default async function ProgramFormPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  const [program, fields] = await Promise.all([
    getProgram(programId),
    getFormFields(programId),
  ]);
  if (!program) notFound();

  return (
    <FormBuilder
      programId={programId}
      formVersion={program.form_version}
      fields={fields}
    />
  );
}
