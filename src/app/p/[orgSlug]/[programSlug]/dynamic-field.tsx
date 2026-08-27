"use client";

import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PublicFieldDef } from "@/lib/form-fields";

type Values = Record<string, unknown>;

export function DynamicField({
  field,
  register,
  control,
  errors,
}: {
  field: PublicFieldDef;
  register: UseFormRegister<Values>;
  control: Control<Values>;
  errors: FieldErrors<Values>;
}) {
  const key = field.field_key;
  const error = errors[key]?.message as string | undefined;
  const describedBy = field.help_text ? `${key}-help` : undefined;
  const inputProps = {
    id: key,
    placeholder: field.placeholder ?? undefined,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  };

  return (
    <div className="space-y-1.5">
      {field.field_type !== "checkbox" ? (
        <Label htmlFor={key}>
          {field.label}
          {field.required ? <span className="text-danger"> *</span> : null}
        </Label>
      ) : null}

      {renderControl()}

      {field.help_text ? (
        <p id={`${key}-help`} className="text-xs text-muted-foreground">
          {field.help_text}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );

  function renderControl() {
    switch (field.field_type) {
      case "textarea":
        return <Textarea rows={4} {...inputProps} {...register(key)} />;

      case "email":
        return <Input type="email" {...inputProps} {...register(key)} />;

      case "url":
        return (
          <Input
            type="url"
            inputMode="url"
            {...inputProps}
            {...register(key)}
          />
        );

      case "phone":
        return (
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            {...inputProps}
            {...register(key)}
          />
        );

      case "number":
        return (
          <Input inputMode="numeric" {...inputProps} {...register(key)} />
        );

      case "date":
        return <Input type="date" {...inputProps} {...register(key)} />;

      case "instagram":
      case "tiktok":
        return (
          <Input
            autoCapitalize="none"
            autoCorrect="off"
            placeholder={field.placeholder ?? "@seu.usuario"}
            id={key}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            {...register(key)}
          />
        );

      case "checkbox":
        return (
          <Controller
            control={control}
            name={key}
            render={({ field: f }) => (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={f.value === true}
                  onCheckedChange={(c) => f.onChange(c === true)}
                  aria-invalid={error ? true : undefined}
                />
                <span>
                  {field.label}
                  {field.required ? (
                    <span className="text-danger"> *</span>
                  ) : null}
                </span>
              </label>
            )}
          />
        );

      case "single_select":
        return (
          <Controller
            control={control}
            name={key}
            render={({ field: f }) => (
              <Select
                value={(f.value as string) || ""}
                onValueChange={f.onChange}
              >
                <SelectTrigger id={key} className="w-full">
                  <SelectValue placeholder={field.placeholder ?? "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  {(field.options ?? []).map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        );

      case "multi_select":
        return (
          <Controller
            control={control}
            name={key}
            render={({ field: f }) => {
              const selected = Array.isArray(f.value)
                ? (f.value as string[])
                : [];
              return (
                <div className="space-y-2 rounded-md border p-3">
                  {(field.options ?? []).map((o) => (
                    <label
                      key={o.value}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={selected.includes(o.value)}
                        onCheckedChange={(c) =>
                          f.onChange(
                            c === true
                              ? [...selected, o.value]
                              : selected.filter((v) => v !== o.value),
                          )
                        }
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              );
            }}
          />
        );

      default:
        return <Input {...inputProps} {...register(key)} />;
    }
  }
}
