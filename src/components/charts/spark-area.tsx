import { cn } from "@/lib/utils";

/**
 * Dependency-free sparkline. Renders a smoothed area + line for a short series.
 * Colour comes from `currentColor` so callers set it with a text-* class.
 */
export function SparkArea({
  values,
  className,
  height = 40,
}: {
  values: number[];
  className?: string;
  height?: number;
}) {
  const width = 120;
  const n = values.length;
  if (n < 2) {
    return (
      <div
        className={cn("text-muted-foreground/40", className)}
        style={{ height }}
      />
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (n - 1);
  const y = (v: number) => height - ((v - min) / range) * (height - 4) - 2;
  const pts = values.map((v, i) => [i * stepX, y(v)] as const);
  const line = pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = `0,${height} ${line} ${width},${height}`;
  const id = `spark-${values.join("-").length}-${n}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("w-full text-chart-1", className)}
      style={{ height }}
      aria-hidden
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
