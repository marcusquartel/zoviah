"use client";

import { useMemo, useState } from "react";
import { useForm, type FieldErrors, type Path } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildFieldSchema,
  CONSENT_FIELD_KEY,
  HONEYPOT_FIELD_KEY,
  SIGNUP_ADDRESS_FIELD_KEY,
  defaultFormValues,
  isSupersededByAddress,
  type PublicFieldDef,
} from "@/lib/form-fields";
import { addressFieldsSchema } from "@/lib/validation/address";
import { submitApplication } from "@/features/public/actions";
import { DynamicField } from "@/components/dynamic-field";
import {
  AddressFields,
  EMPTY_ADDRESS_VALUES,
  type AddressFieldValues,
} from "@/components/address-fields";

const CONSENT_TEXT =
  "Autorizo o uso das informações fornecidas para avaliação, contato e envio de produtos relacionados ao programa.";

type Values = Record<string, unknown>;

export function PublicForm({
  orgSlug,
  programSlug,
  fields,
  successMessage,
}: {
  orgSlug: string;
  programSlug: string;
  fields: PublicFieldDef[];
  successMessage: string | null;
}) {
  // Estado / Cidade / CEP builder fields are covered by the address block.
  const visibleFields = useMemo(
    () => fields.filter((f) => !isSupersededByAddress(f)),
    [fields],
  );
  const schema = useMemo(
    () => buildFieldSchema(visibleFields),
    [visibleFields],
  );
  const searchParams = useSearchParams();

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    getValues,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    defaultValues: {
      ...defaultFormValues(visibleFields),
      [SIGNUP_ADDRESS_FIELD_KEY]: EMPTY_ADDRESS_VALUES,
    },
  });

  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function onSubmit(raw: Values) {
    setSubmitError(null);
    clearErrors();

    // Client-side validation for UX; the server re-validates as the real gate.
    const parsed = schema.safeParse(raw);
    const address = addressFieldsSchema.safeParse(
      raw[SIGNUP_ADDRESS_FIELD_KEY],
    );
    if (!parsed.success || !address.success) {
      for (const issue of parsed.error?.issues ?? []) {
        const key = String(issue.path[0] ?? "");
        if (key) setError(key as Path<Values>, { message: issue.message });
      }
      for (const issue of address.error?.issues ?? []) {
        const key = String(issue.path[0] ?? "");
        if (key) {
          setError(`${SIGNUP_ADDRESS_FIELD_KEY}.${key}` as Path<Values>, {
            message: issue.message,
          });
        }
      }
      return;
    }

    const utm = {
      source: searchParams.get("utm_source") ?? undefined,
      medium: searchParams.get("utm_medium") ?? undefined,
      campaign: searchParams.get("utm_campaign") ?? undefined,
      content: searchParams.get("utm_content") ?? undefined,
      term: searchParams.get("utm_term") ?? undefined,
    };
    const referrer =
      typeof document !== "undefined" ? document.referrer : undefined;

    const result = await submitApplication({
      orgSlug,
      programSlug,
      answers: parsed.data,
      address: address.data,
      utm,
      referrer,
    });

    if (result.ok) setDone(true);
    else setSubmitError(result.error ?? "Não foi possível enviar.");
  }

  if (done) {
    return (
      <div
        className="rounded-xl border bg-card p-8 text-center"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <h2 className="mt-4 text-lg font-semibold">Inscrição enviada!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {successMessage ||
            "Recebemos sua inscrição. Em breve entraremos em contato."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* honeypot: off-screen, not announced to assistive tech */}
      <div
        aria-hidden
        className="absolute left-[-9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor={HONEYPOT_FIELD_KEY}>Deixe este campo em branco</label>
        <input
          id={HONEYPOT_FIELD_KEY}
          tabIndex={-1}
          autoComplete="off"
          {...register(HONEYPOT_FIELD_KEY)}
        />
      </div>

      {visibleFields.map((field) => (
        <DynamicField
          key={field.field_key}
          field={field}
          register={register}
          control={control}
          errors={errors}
        />
      ))}

      <div
        role="group"
        aria-labelledby="signup-address-title"
        className="space-y-4 border-t pt-5"
      >
        <div>
          <h2
            id="signup-address-title"
            className="font-heading text-base font-semibold"
          >
            Endereço de entrega
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Para onde enviaremos os produtos caso sua inscrição seja aprovada.
          </p>
        </div>
        <AddressFields
          prefix={`${SIGNUP_ADDRESS_FIELD_KEY}.`}
          register={register}
          control={control}
          setValue={setValue}
          getValues={getValues}
          errors={
            errors[SIGNUP_ADDRESS_FIELD_KEY] as
              | FieldErrors<AddressFieldValues>
              | undefined
          }
        />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-[var(--primary)]"
          {...register(CONSENT_FIELD_KEY)}
        />
        <span>{CONSENT_TEXT}</span>
      </label>
      {errors[CONSENT_FIELD_KEY] ? (
        <p className="text-xs text-danger" role="alert">
          {errors[CONSENT_FIELD_KEY]?.message as string}
        </p>
      ) : null}

      {submitError ? (
        <p
          className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {submitError}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Enviando…" : "Enviar inscrição"}
      </Button>
    </form>
  );
}
