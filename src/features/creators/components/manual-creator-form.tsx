"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch, type Path } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DynamicField } from "@/components/dynamic-field";
import {
  brLocationKind,
  buildFieldSchema,
  defaultFormValues,
  type PublicFieldDef,
} from "@/lib/form-fields";
import { createCreatorManually } from "@/features/creators/actions";

type Values = Record<string, unknown>;

export function ManualCreatorForm({
  programId,
  fields,
  onCreated,
}: {
  programId: string;
  fields: PublicFieldDef[];
  onCreated: () => void;
}) {
  const schema = useMemo(() => buildFieldSchema(fields, { consent: false }), [fields]);
  const stateFieldKey = useMemo(
    () => fields.find((f) => brLocationKind(f) === "state")?.field_key,
    [fields],
  );

  const {
    register,
    control,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ defaultValues: defaultFormValues(fields) });

  const stateValue = useWatch({
    control,
    name: (stateFieldKey ?? "__no_state__") as Path<Values>,
  }) as string | undefined;

  const [submitError, setSubmitError] = useState<string | null>(null);

  async function onSubmit(raw: Values) {
    setSubmitError(null);
    clearErrors();

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key) setError(key as Path<Values>, { message: issue.message });
      }
      return;
    }

    const result = await createCreatorManually(programId, parsed.data);
    if (!result.ok) {
      setSubmitError(result.error ?? "Não foi possível criar a inscrição.");
      return;
    }

    toast.success(
      result.possibleDuplicate
        ? "Creator adicionado — pode ser um possível duplicado."
        : "Creator adicionado.",
    );
    reset(defaultFormValues(fields));
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {fields.map((field) => (
        <DynamicField
          key={field.field_key}
          field={field}
          register={register}
          control={control}
          errors={errors}
          stateValue={brLocationKind(field) === "city" ? stateValue : undefined}
        />
      ))}

      {submitError ? (
        <p
          className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {submitError}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Adicionando…" : "Adicionar creator"}
      </Button>
    </form>
  );
}
