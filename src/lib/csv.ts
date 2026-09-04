/**
 * Minimal RFC4180-ish CSV codec (no external dependency — see the security
 * review that ruled out the `xlsx` package: its npm-published build carries
 * an unpatched high-severity prototype-pollution CVE, exactly on the
 * untrusted-file-parsing path this module exists for).
 */

/** Splits raw CSV text into rows of raw string cells. Strips a leading BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = src.length;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < len) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += c;
        i += 1;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
    } else if (c === ",") {
      pushField();
      i += 1;
    } else if (c === "\r") {
      i += 1;
    } else if (c === "\n") {
      pushRow();
      i += 1;
    } else {
      field += c;
      i += 1;
    }
  }
  if (field.length > 0 || row.length > 0) pushRow();

  // Drop rows that are only an artifact of a trailing newline.
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** CSV rows as objects keyed by the trimmed header row (row 1). */
export function parseCsvRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  const keys = header.map((h) => h.trim());
  return body.map((r) => {
    const rec: Record<string, string> = {};
    keys.forEach((key, idx) => {
      rec[key] = (r[idx] ?? "").trim();
    });
    return rec;
  });
}

function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** A one-row CSV template: just the header line. */
export function buildCsvTemplate(headers: string[]): string {
  return `${headers.map(csvEscape).join(",")}\r\n`;
}
