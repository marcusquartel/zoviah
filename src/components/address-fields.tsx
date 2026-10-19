"use client";

import { forwardRef, useState } from "react";
import {
  Controller,
  type Control,
  type FieldErrors,
  type FieldValues,
  type Path,
  type PathValue,
  type UseFormGetValues,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BR_STATES } from "@/lib/br-locations";
import { lookupCep } from "@/lib/viacep";

/** The shipping-address inputs, keyed like `addressFieldsSchema`. */
export const ADDRESS_FIELD_KEYS = [
  "cpf",
  "postalCode",
  "street",
  "number",
  "complement",
  "neighborhood",
  "city",
  "state",
] as const;
export type AddressFieldKey = (typeof ADDRESS_FIELD_KEYS)[number];
export type AddressFieldValues = Record<AddressFieldKey, string>;

export const EMPTY_ADDRESS_VALUES: AddressFieldValues = {
  cpf: "",
  postalCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

const STATE_ITEMS = BR_STATES.map((s) => ({
  value: s.uf,
  label: `${s.uf} — ${s.name}`,
}));

/** Progressive `000.000.000-00` mask while typing. */
function maskCpf(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean);
  let out = parts.join(".");
  if (d.length > 9) out += `-${d.slice(9)}`;
  return out;
}

/**
 * CPF + CEP-driven address inputs, shared by the signup form and the secure
 * address link. The fields live under `prefix` in the host form (e.g.
 * `"address."`, or `""` when the form is the address itself); `errors` is the
 * error subtree for that prefix.
 */
export function AddressFields<T extends FieldValues>({
  prefix,
  register,
  control,
  setValue,
  getValues,
  errors,
  cpfLabel = "CPF",
}: {
  prefix: "" | `${string}.`;
  register: UseFormRegister<T>;
  control: Control<T>;
  setValue: UseFormSetValue<T>;
  getValues: UseFormGetValues<T>;
  errors: FieldErrors<AddressFieldValues> | undefined;
  cpfLabel?: string;
}) {
  const [cepLoading, setCepLoading] = useState(false);
  const [cepFilled, setCepFilled] = useState(false);

  const name = (key: AddressFieldKey) => `${prefix}${key}` as Path<T>;
  const id = (key: AddressFieldKey) =>
    `${prefix.replace(/\./g, "-")}${key}`;
  const set = (key: AddressFieldKey, value: string, validate = false) =>
    setValue(name(key), value as PathValue<T, Path<T>>, {
      shouldValidate: validate,
    });
  const err = (key: AddressFieldKey) => errors?.[key]?.message;

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
    if (!getValues(name("street"))) set("street", found.street);
    if (!getValues(name("neighborhood"))) set("neighborhood", found.neighborhood);
    set("city", found.city, true);
    set("state", found.state, true);
    setCepFilled(true);
  }

  return (
    <div className="space-y-4">
      <Field
        id={id("cpf")}
        label={cpfLabel}
        inputMode="numeric"
        autoComplete="off"
        placeholder="000.000.000-00"
        maxLength={14}
        error={err("cpf")}
        {...register(name("cpf"), {
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
        <Label htmlFor={id("postalCode")}>CEP</Label>
        <div className="relative">
          <Input
            id={id("postalCode")}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            maxLength={9}
            aria-invalid={err("postalCode") ? true : undefined}
            aria-describedby={
              err("postalCode") ? `${id("postalCode")}-error` : undefined
            }
            {...register(name("postalCode"), {
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
        {err("postalCode") ? (
          <p id={`${id("postalCode")}-error`} className="text-xs text-danger">
            {err("postalCode")}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <Field
          id={id("street")}
          label="Rua / Logradouro"
          autoComplete="address-line1"
          error={err("street")}
          {...register(name("street"))}
        />
        <Field
          id={id("number")}
          label="Número"
          error={err("number")}
          {...register(name("number"))}
        />
      </div>
      <Field
        id={id("complement")}
        label="Complemento (opcional)"
        autoComplete="address-line2"
        error={err("complement")}
        {...register(name("complement"))}
      />
      <Field
        id={id("neighborhood")}
        label="Bairro"
        autoComplete="address-level3"
        error={err("neighborhood")}
        {...register(name("neighborhood"))}
      />

      <div className="grid grid-cols-[1fr_9rem] gap-3">
        <Field
          id={id("city")}
          label="Cidade"
          autoComplete="address-level2"
          readOnly={cepFilled}
          className={cepFilled ? "bg-muted/40" : undefined}
          error={err("city")}
          {...register(name("city"))}
        />
        <div className="space-y-1">
          <Label htmlFor={id("state")}>Estado</Label>
          <Controller
            control={control}
            name={name("state")}
            render={({ field: f }) => (
              <Select
                items={STATE_ITEMS}
                value={(f.value as string) || undefined}
                onValueChange={(v) => f.onChange(v ?? "")}
              >
                <SelectTrigger
                  id={id("state")}
                  aria-invalid={err("state") ? true : undefined}
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
          {err("state") ? (
            <p className="text-xs text-danger">{err("state")}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface FieldProps extends React.ComponentProps<"input"> {
  id: string;
  label: string;
  error?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(
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
