import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/features/creators/format";
import type { Creator } from "@/types/database";

/** Every row is shown — an empty one reads "Não informado" so gaps are visible. */
export function RegistrationTab({
  creator,
  onEdit,
}: {
  creator: Creator;
  onEdit: () => void;
}) {
  const rows: [string, string | null][] = [
    ["Nome completo", creator.full_name],
    ["Nome preferido", creator.preferred_name],
    ["Nascimento", creator.birth_date ? formatDate(creator.birth_date) : null],
    ["E-mail", creator.email],
    ["WhatsApp", creator.phone_e164],
    ["Cidade", creator.city],
    ["Estado", creator.state],
    [
      "CEP",
      creator.postal_code
        ? creator.postal_code.replace(/^(\d{5})(\d{3})$/, "$1-$2")
        : null,
    ],
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="size-4" /> Editar dados
        </Button>
      </div>
      <dl className="divide-y">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[9rem_1fr] gap-3 py-1.5 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words">
              {value || (
                <span className="text-muted-foreground/70">Não informado</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
