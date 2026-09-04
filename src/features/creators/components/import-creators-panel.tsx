"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildCsvTemplate, parseCsvRecords } from "@/lib/csv";
import type { PublicFieldDef } from "@/lib/form-fields";
import { createCreatorManually } from "@/features/creators/actions";

const MAX_ROWS = 500;

interface Failure {
  row: number;
  message: string;
}

interface ImportResult {
  total: number;
  created: number;
  failures: Failure[];
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/**
 * A spreadsheet cell holds the option's human label ("Lash Designer"), not
 * its machine value ("lash-designer") — translate it before validating,
 * same way a select in the UI would. Multi-select cells list labels
 * comma-separated. Unmatched text passes through so the row still fails
 * with a clear "Opção inválida" instead of silently dropping the answer.
 */
function resolveFieldValue(field: PublicFieldDef, raw: string): unknown {
  if (field.field_type === "single_select") {
    const opt = (field.options ?? []).find((o) => norm(o.label) === norm(raw));
    return opt ? opt.value : raw;
  }
  if (field.field_type === "multi_select") {
    if (!raw.trim()) return [];
    return raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => {
        const opt = (field.options ?? []).find((o) => norm(o.label) === norm(t));
        return opt ? opt.value : t;
      });
  }
  if (field.field_type === "checkbox") {
    return ["sim", "s", "true", "1", "yes", "x"].includes(norm(raw));
  }
  return raw;
}

function downloadTextFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ImportCreatorsPanel({
  programId,
  programSlug,
  fields,
  onImported,
}: {
  programId: string;
  programSlug: string;
  fields: PublicFieldDef[];
  onImported: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function downloadTemplate() {
    const csv = buildCsvTemplate(fields.map((f) => f.label));
    downloadTextFile(`modelo-${programSlug}.csv`, csv, "text/csv;charset=utf-8");
  }

  async function runImport(file: File) {
    setError(null);
    setResult(null);
    setRunning(true);
    try {
      const text = await file.text();
      const records = parseCsvRecords(text);

      if (records.length === 0) {
        setError("A planilha está vazia ou não tem linhas de dados.");
        return;
      }
      if (records.length > MAX_ROWS) {
        setError(
          `Máximo de ${MAX_ROWS} linhas por importação. Divida o arquivo em partes menores.`,
        );
        return;
      }

      setProgress({ done: 0, total: records.length });
      const failures: Failure[] = [];
      let created = 0;

      for (let i = 0; i < records.length; i += 1) {
        const record = records[i];
        const values: Record<string, unknown> = {};
        for (const field of fields) {
          values[field.field_key] = resolveFieldValue(field, record[field.label] ?? "");
        }

        // Sequential on purpose: keeps errors attributable to one row and
        // avoids hammering the per-program submission rate limit at once.
        const res = await createCreatorManually(programId, values);
        if (res.ok) {
          created += 1;
        } else {
          failures.push({ row: i + 2, message: res.error ?? "Erro desconhecido." });
        }
        setProgress({ done: i + 1, total: records.length });
      }

      setResult({ total: records.length, created, failures });
      if (created > 0) onImported();
    } catch {
      setError("Não foi possível ler o arquivo. Confira se é um .csv válido.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-dashed bg-surface p-3 text-sm">
        <p className="text-muted-foreground">
          Baixe o modelo com as colunas deste programa, preencha uma linha por
          creator e faça o upload de volta. Aceita arquivos <strong>.csv</strong>{" "}
          (exportados do Excel, Google Sheets ou Numbers). Para campos de
          seleção, use o texto exato da opção (para seleção múltipla, separe
          as opções por vírgula). Até {MAX_ROWS} linhas por importação.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={downloadTemplate}
        >
          <Download className="size-3.5" />
          Baixar modelo (.csv)
        </Button>
      </div>

      <div className="space-y-2">
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            setFileName(file?.name ?? null);
            setResult(null);
            setError(null);
            if (file) void runImport(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={running}
          onClick={() => fileInput.current?.click()}
        >
          <Upload className="size-3.5" />
          {running ? "Importando…" : "Selecionar planilha (.csv)"}
        </Button>
        {fileName ? (
          <p className="text-xs text-muted-foreground">Arquivo: {fileName}</p>
        ) : null}
      </div>

      {running && progress ? (
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {progress.done} de {progress.total} linhas processadas…
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-2 rounded-md border p-3 text-sm">
          <p>
            <strong>{result.created}</strong> de <strong>{result.total}</strong>{" "}
            linhas importadas com sucesso.
          </p>
          {result.failures.length > 0 ? (
            <div className="space-y-1">
              <p className="font-medium text-danger">
                {result.failures.length} linha(s) com erro:
              </p>
              <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                {result.failures.map((f) => (
                  <li key={f.row}>
                    Linha {f.row}: {f.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
