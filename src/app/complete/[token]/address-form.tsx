"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AddressFields,
  EMPTY_ADDRESS_VALUES,
  Field,
  type AddressFieldValues,
} from "@/components/address-fields";
import { addressSchema } from "@/lib/validation/address";
import { submitAddress } from "@/features/requests/public-actions";

interface FormValues extends AddressFieldValues {
  recipientName: string;
  consent: boolean;
  /** honeypot */
  company: string;
}

const CONSENT_TEXT =
  "Confirmo que os dados informados estão corretos e autorizo seu uso para fins de envio relacionado a esta parceria.";

export function AddressForm({ token }: { token: string }) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      ...EMPTY_ADDRESS_VALUES,
      recipientName: "",
      consent: false,
      company: "",
    },
  });

  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(raw: FormValues) {
    setFormError(null);
    const parsed = addressSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key) setError(key as keyof FormValues, { message: issue.message });
      }
      return;
    }

    const res = await submitAddress(token, parsed.data, raw.company);
    if (res.ok) {
      setDone(true);
    } else {
      setFormError(res.error ?? "Não foi possível enviar seus dados.");
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto size-8 text-success" />
        <h2 className="mt-3 text-base font-semibold">
          Dados enviados com sucesso.
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Obrigado. A equipe dará continuidade ao processo.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Field
        id="recipientName"
        label="Nome do destinatário"
        autoComplete="name"
        error={errors.recipientName?.message}
        {...register("recipientName")}
      />
      <AddressFields
        prefix=""
        register={register}
        control={control}
        setValue={setValue}
        getValues={getValues}
        errors={errors}
        cpfLabel="CPF do destinatário"
      />

      {/* honeypot — visually hidden, not tab-reachable */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        {...register("company")}
      />

      <Controller
        control={control}
        name="consent"
        render={({ field: f }) => (
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={f.value === true}
              onCheckedChange={(c) => f.onChange(c === true)}
              aria-invalid={errors.consent ? true : undefined}
            />
            <span>{CONSENT_TEXT}</span>
          </label>
        )}
      />
      {errors.consent?.message ? (
        <p className="text-xs text-danger">{errors.consent.message}</p>
      ) : null}

      {formError ? (
        <p
          role="alert"
          className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {formError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Enviando…" : "Enviar dados"}
      </Button>
    </form>
  );
}
