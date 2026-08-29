"use client";

import { forwardRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { addressSchema } from "@/lib/validation/address";
import { submitAddress } from "@/features/requests/public-actions";

interface FormValues {
  recipientName: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
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
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      recipientName: "",
      postalCode: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
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
      <Field
        id="postalCode"
        label="CEP"
        inputMode="numeric"
        autoComplete="postal-code"
        placeholder="00000-000"
        error={errors.postalCode?.message}
        {...register("postalCode")}
      />
      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <Field
          id="street"
          label="Rua / Logradouro"
          autoComplete="address-line1"
          error={errors.street?.message}
          {...register("street")}
        />
        <Field
          id="number"
          label="Número"
          error={errors.number?.message}
          {...register("number")}
        />
      </div>
      <Field
        id="complement"
        label="Complemento (opcional)"
        autoComplete="address-line2"
        error={errors.complement?.message}
        {...register("complement")}
      />
      <Field
        id="neighborhood"
        label="Bairro"
        autoComplete="address-level3"
        error={errors.neighborhood?.message}
        {...register("neighborhood")}
      />
      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <Field
          id="city"
          label="Cidade"
          autoComplete="address-level2"
          error={errors.city?.message}
          {...register("city")}
        />
        <Field
          id="state"
          label="Estado"
          autoComplete="address-level1"
          placeholder="UF"
          maxLength={2}
          error={errors.state?.message}
          {...register("state")}
        />
      </div>

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

interface FieldProps extends React.ComponentProps<"input"> {
  id: string;
  label: string;
  error?: string;
}

const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ id, label, error, ...props }, ref) => (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  ),
);
Field.displayName = "Field";
