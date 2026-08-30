import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";

interface ComingSoonProps {
  title: string;
  description?: string;
}

/** Placeholder for sections that will be built in later phases. */
export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <PageHeader title={title} />
        <Badge variant="secondary" className="gap-1">
          <Lock className="size-3" />
          Em breve
        </Badge>
      </div>
      <div className="rounded-lg border border-dashed bg-surface p-10 text-center">
        <p className="text-sm text-muted-foreground">
          {description ??
            "Esta área será implementada nas próximas fases da Zoviah."}
        </p>
      </div>
    </div>
  );
}
