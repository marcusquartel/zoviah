export function formatFollowers(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k % 1 === 0 ? k : k.toFixed(1).replace(".", ",")} mil`;
  }
  const m = n / 1_000_000;
  return `${m % 1 === 0 ? m : m.toFixed(1).replace(".", ",")} mi`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const dt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const dtLong = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export const formatDate = (iso: string) => dt.format(new Date(iso));
export const formatDateTime = (iso: string) => dtLong.format(new Date(iso));
