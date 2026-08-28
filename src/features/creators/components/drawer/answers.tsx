import type { Application } from "@/types/database";

function renderValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}

/**
 * Renders the application's original answers using the field snapshot captured
 * at submission time — so it stays correct even if the program's form changed
 * afterwards. Falls back to any answer keys not present in the snapshot.
 */
export function AnswersTab({ application }: { application: Application }) {
  const snapshot = application.field_snapshot ?? [];
  const answers = application.answers ?? {};
  const seen = new Set(snapshot.map((f) => f.field_key));
  const extraKeys = Object.keys(answers).filter((k) => !seen.has(k));

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Formulário v{application.form_version}, como enviado em{" "}
        {new Date(application.submitted_at).toLocaleDateString("pt-BR")}.
      </p>

      <dl className="divide-y">
        {snapshot.map((field) => (
          <div key={field.field_key} className="py-2 text-sm">
            <dt className="text-muted-foreground">{field.label}</dt>
            <dd className="mt-0.5 break-words">
              {renderValue(answers[field.field_key])}
            </dd>
          </div>
        ))}

        {extraKeys.map((key) => (
          <div key={key} className="py-2 text-sm">
            <dt className="text-muted-foreground">{key}</dt>
            <dd className="mt-0.5 break-words">{renderValue(answers[key])}</dd>
          </div>
        ))}
      </dl>

      {snapshot.length === 0 && extraKeys.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Sem respostas registradas.
        </p>
      ) : null}
    </div>
  );
}
