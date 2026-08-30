"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Copy } from "lucide-react";
import { PLAN_CODES, PLAN_LABELS } from "@/features/platform/plans";
import { createOrganization } from "@/features/platform/actions";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);

const PLAN_ITEMS = PLAN_CODES.map((p) => ({ value: p, label: PLAN_LABELS[p] }));
const STATUS_ITEMS = [
  { value: "active", label: "Ativa" },
  { value: "suspended", label: "Suspensa" },
];

export function NewOrgDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [planCode, setPlanCode] = useState("founding");
  const [status, setStatus] = useState("active");
  const [pending, startTransition] = useTransition();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [seen, setSeen] = useState(false);
  if (open && !seen) {
    setSeen(true);
    setName("");
    setSlug("");
    setSlugEdited(false);
    setOwnerEmail("");
    setPlanCode("founding");
    setStatus("active");
    setInviteUrl(null);
  }
  if (!open && seen) setSeen(false);

  function submit() {
    startTransition(async () => {
      const res = await createOrganization({
        name,
        slug: slug || slugify(name),
        ownerEmail,
        planCode,
        status,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Não foi possível criar a organização.");
        return;
      }
      toast.success("Organização criada.");
      onCreated();
      if (res.ownerInviteUrl) {
        setInviteUrl(res.ownerInviteUrl);
      } else {
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova organização</DialogTitle>
        </DialogHeader>

        {inviteUrl ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              A conta do owner ainda não existe. Envie o link abaixo para ele
              criar a conta e assumir a organização (expira em 14 dias).
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={inviteUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-md border bg-muted/40 px-2 py-1.5 font-mono text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(inviteUrl)
                    .then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    })
                    .catch(() => toast.error("Não foi possível copiar."));
                }}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
              Este link é exibido só agora. Se precisar, gere um novo convite na
              tela de detalhe da organização.
            </p>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="space-y-1">
              <Label htmlFor="org-name">Nome</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugEdited) setSlug(slugify(e.target.value));
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="org-slug">Slug</Label>
              <Input
                id="org-slug"
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="minha-empresa"
              />
              <p className="text-xs text-muted-foreground">
                Usado nas URLs públicas dos formulários.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="org-owner">E-mail do owner</Label>
              <Input
                id="org-owner"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Plano</Label>
                <Select
                  items={PLAN_ITEMS}
                  value={planCode}
                  onValueChange={(v) => v && setPlanCode(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_ITEMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select
                  items={STATUS_ITEMS}
                  value={status}
                  onValueChange={(v) => v && setStatus(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_ITEMS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {inviteUrl ? (
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button onClick={submit} disabled={pending}>
                {pending ? "Criando…" : "Criar organização"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
