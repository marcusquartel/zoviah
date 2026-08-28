/** "Label / value" row. Omits the row entirely when the value is empty. */
export function FieldRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (value == null || value === "" || value === false) return null;
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}
