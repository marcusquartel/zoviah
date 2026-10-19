interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="space-y-1.5">
      <h1 className="font-heading text-[1.75rem] leading-tight font-medium tracking-[-0.014em]">
        {title}
      </h1>
      {description ? (
        <p className="text-[0.875rem] text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
