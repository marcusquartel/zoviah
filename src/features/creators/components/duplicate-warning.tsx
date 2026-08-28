import { AlertTriangle } from "lucide-react";

/** Prominent notice shown on the drawer of a flagged application. */
export function DuplicateWarning() {
  return (
    <div className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
      <p className="text-warning-foreground">
        Esta inscrição possui indícios de conflito de identidade e deve ser
        revisada antes de qualquer ação.
      </p>
    </div>
  );
}
