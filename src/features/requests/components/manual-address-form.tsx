"use client";

import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AddressFields,
  EMPTY_ADDRESS_VALUES,
  type AddressFieldValues,
} from "@/components/address-fields";
import { addressFieldsSchema } from "@/lib/validation/address";
import { formatCpf } from "@/lib/validation/cpf";
import { setCreatorAddressManual } from "@/features/creators/edit-actions";
import type { CreatorAddress } from "@/types/database";

function initialValues(address: CreatorAddress | null): AddressFieldValues {
  if (!address) return EMPTY_ADDRESS_VALUES;
  return {
    cpf: address.cpf ? formatCpf(address.cpf) : "",
    postalCode: address.postal_code,
    street: address.street,
    number: address.number,
    complement: address.complement ?? "",
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
  };
}

/**
 * Staff-entered shipping address (received by WhatsApp, a spreadsheet…). The
 * saved one becomes the creator's current address; earlier ones stay in the
 * history, as with the secure link.
 */
export function ManualAddressForm({
  creatorId,
  current,
  onSaved,
  onCancel,
}: {
  creatorId: string;
  current: CreatorAddress | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<AddressFieldValues>({ defaultValues: initialValues(current) });

  async function onSubmit(raw: AddressFieldValues) {
    const parsed = addressFieldsSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key) setError(key as keyof AddressFieldValues, { message: issue.message });
      }
      return;
    }
    const res = await setCreatorAddressManual({ creatorId, address: parsed.data });
    if (res.ok) {
      toast.success("Endereço salvo.");
      onSaved();
    } else {
      toast.error(res.error ?? "Não foi possível salvar o endereço.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-4 rounded-lg border p-4"
    >
      <p className="text-sm font-medium">
        {current ? "Editar endereço de entrega" : "Preencher endereço de entrega"}
      </p>
      <AddressFields
        prefix=""
        register={register}
        control={control}
        setValue={setValue}
        getValues={getValues}
        errors={errors}
      />
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
          {isSubmitting ? "Salvando…" : "Salvar endereço"}
        </Button>
      </div>
    </form>
  );
}
