"use client";

import { forwardRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addressSchema } from "@/lib/validation/address";
import { BR_STATES } from "@/lib/br-locations";

/** Progressive `000.000.000-00` mask while typing. */
function maskCpf(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean);
  let out = parts.join(".");
  if (d.length > 9) out += `-${d.slice(9)}`;
  return out;
}
import { lookupCep } from "@/lib/viacep";
import { submitAddress } from "@/features/requests/public-actions";

interface FormValues {
  recipientName: string;
  cpf: string;
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

const STATE_ITEMS = BR_STATES.map((s) => ({
  value: s.uf,
  label: `${s.uf} — ${s.name}`,
}));

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
      recipientName: "",
      cpf: "",
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
  const [cepLoading, setCepLoading] = useState(false);
  const [cepFilled, setCepFilled] = useState(false);

  async function resolveCep(value: string) {
    const digits = value.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    const found = await lookupCep(digits);
    setCepLoading(false);
    if (!found) {
      setCepFilled(false);
      return;
    }
    if (!getValues("street")) setValue("street", found.street);
    if (!getValues("neighborhood")) setValue("neighborhood", found.neighborhood);
    setValue("city", found.city, { shouldValidate: true });
    setValue("state", found.state, { shouldValidate: true });
    setCepFilled(true);
  }

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
        id="cpf"
        label="CPF do destinatário"
        inputMode="numeric"
        autoComplete="off"
        placeholder="000.000.000-00"
        maxLength={14}
        error={errors.cpf?.message}
        {...register("cpf", {
          onChange: (e) => {
            e.target.value = maskCpf(e.target.value);
          },
        })}
      />
      <p className="-mt-2 text-xs text-muted-foreground">
        Os Correios exigem o CPF do destinatário para emitir a etiqueta de
        envio.
      </p>
      <div className="space-y-1">
        <Label htmlFor="postalCode">CEP</Label>
        <div className="relative">
          <Input
            id="postalCode"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            maxLength={9}
            aria-invalid={errors.postalCode ? true : undefined}
            aria-describedby={errors.postalCode ? "postalCode-error" : undefined}
            {...register("postalCode", {
              onBlur: (e) => void resolveCep(e.target.value),
            })}
          />
          {cepLoading ? (
            <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Preenchemos cidade e estado pelo CEP — confira abaixo.
        </p>
        {errors.postalCode?.message ? (
          <p id="postalCode-error" className="text-xs text-danger">
            {errors.postalCode.message}
          </p>
        ) : null}
      </div>

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

      <div className="grid grid-cols-[1fr_9rem] gap-3">
        <Field
          id="city"
          label="Cidade"
          autoComplete="address-level2"
          readOnly={cepFilled}
          className={cepFilled ? "bg-muted/40" : undefined}
          error={errors.city?.message}
          {...register("city")}
        />
        <div className="space-y-1">
          <Label htmlFor="state">Estado</Label>
          <Controller
            control={control}
            name="state"
            render={({ field: f }) => (
              <Select
                items={STATE_ITEMS}
                value={f.value || undefined}
                onValueChange={(v) => f.onChange(v ?? "")}
              >
                <SelectTrigger
                  id="state"
                  aria-invalid={errors.state ? true : undefined}
                >
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {STATE_ITEMS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.state?.message ? (
            <p className="text-xs text-danger">{errors.state.message}</p>
          ) : null}
        </div>
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
