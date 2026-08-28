import { FieldRow } from "@/features/creators/components/drawer/field-row";
import { formatDate } from "@/features/creators/format";
import type { Creator } from "@/types/database";

export function RegistrationTab({ creator }: { creator: Creator }) {
  return (
    <dl className="divide-y">
      <FieldRow label="Nome completo" value={creator.full_name} />
      <FieldRow label="Nome preferido" value={creator.preferred_name} />
      <FieldRow
        label="Nascimento"
        value={creator.birth_date ? formatDate(creator.birth_date) : null}
      />
      <FieldRow label="E-mail" value={creator.email} />
      <FieldRow label="Telefone" value={creator.phone_e164} />
      <FieldRow label="Cidade" value={creator.city} />
      <FieldRow label="Estado" value={creator.state} />
      <FieldRow label="CEP" value={creator.postal_code} />
    </dl>
  );
}
