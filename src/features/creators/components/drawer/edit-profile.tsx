"use client";

import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/address-fields";
import { BR_STATES } from "@/lib/br-locations";
import {
  updateCreatorProfile,
  type CreatorProfileInput,
} from "@/features/creators/edit-actions";
import type { Creator, CreatorSocialProfile } from "@/types/database";

type FormValues = Omit<CreatorProfileInput, "creatorId">;

const STATE_ITEMS = BR_STATES.map((s) => ({
  value: s.uf,
  label: `${s.uf} — ${s.name}`,
}));

/** "+5511988887777" → "11988887777" (the action re-normalizes either form). */
function phoneForInput(e164: string | null): string {
  if (!e164) return "";
  return e164.startsWith("+55") ? e164.slice(3) : e164;
}

function firstSocial(socials: CreatorSocialProfile[], platform: string) {
  return socials.find((s) => s.platform === platform) ?? null;
}

/**
 * Cadastro + Redes edit form. Saves through `update_creator_profile`, which
 * writes a "dados atualizados" event naming the changed fields.
 */
export function EditProfileForm({
  creator,
  socials,
  onSaved,
  onCancel,
}: {
  creator: Creator;
  socials: CreatorSocialProfile[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const ig = firstSocial(socials, "instagram");
  const tt = firstSocial(socials, "tiktok");

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      fullName: creator.full_name,
      preferredName: creator.preferred_name ?? "",
      email: creator.email ?? "",
      phone: phoneForInput(creator.phone_e164),
      birthDate: creator.birth_date ?? "",
      city: creator.city ?? "",
      state: creator.state ?? "",
      postalCode: creator.postal_code ?? "",
      instagram: ig ? `@${ig.handle_normalized}` : "",
      instagramFollowers:
        ig?.followers_declared != null ? String(ig.followers_declared) : "",
      tiktok: tt ? `@${tt.handle_normalized}` : "",
      tiktokFollowers:
        tt?.followers_declared != null ? String(tt.followers_declared) : "",
    },
  });

  async function onSubmit(values: FormValues) {
    const res = await updateCreatorProfile({ creatorId: creator.id, ...values });
    if (res.ok) {
      toast.success("Dados atualizados.");
      onSaved();
    } else {
      toast.error(res.error ?? "Não foi possível salvar.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <Section title="Cadastro">
        <Field
          id="edit-full-name"
          label="Nome completo"
          error={errors.fullName?.message}
          {...register("fullName", { required: "Informe o nome completo." })}
        />
        <Field
          id="edit-preferred-name"
          label="Nome preferido"
          {...register("preferredName")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="edit-email"
            label="E-mail"
            type="email"
            autoComplete="off"
            {...register("email")}
          />
          <Field
            id="edit-phone"
            label="WhatsApp"
            inputMode="tel"
            placeholder="(11) 90000-0000"
            {...register("phone")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="edit-birth-date"
            label="Data de nascimento"
            type="date"
            {...register("birthDate")}
          />
          <Field
            id="edit-postal-code"
            label="CEP"
            inputMode="numeric"
            placeholder="00000-000"
            maxLength={9}
            {...register("postalCode")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <Field id="edit-city" label="Cidade" {...register("city")} />
          <div className="space-y-1">
            <Label htmlFor="edit-state">Estado</Label>
            <Controller
              control={control}
              name="state"
              render={({ field: f }) => (
                <Select
                  items={STATE_ITEMS}
                  value={f.value || undefined}
                  onValueChange={(v) => f.onChange(v ?? "")}
                >
                  <SelectTrigger id="edit-state">
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
          </div>
        </div>
      </Section>

      <Section title="Redes">
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <Field
            id="edit-instagram"
            label="Instagram"
            placeholder="@usuario"
            autoComplete="off"
            {...register("instagram")}
          />
          <Field
            id="edit-instagram-followers"
            label="Seguidores"
            inputMode="numeric"
            {...register("instagramFollowers")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <Field
            id="edit-tiktok"
            label="TikTok"
            placeholder="@usuario"
            autoComplete="off"
            {...register("tiktok")}
          />
          <Field
            id="edit-tiktok-followers"
            label="Seguidores"
            inputMode="numeric"
            {...register("tiktokFollowers")}
          />
        </div>
      </Section>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}
