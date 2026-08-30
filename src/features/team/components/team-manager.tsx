"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Copy, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/features/creators/format";
import { INVITE_STATUS_LABELS } from "@/features/platform/plans";
import {
  changeMemberRole,
  inviteMember,
  removeMember,
  revokeInvite,
} from "@/features/team/actions";
import type { TeamInvite, TeamMember } from "@/features/team/queries";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  analyst: "Analyst",
};
const ROLE_ITEMS = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "analyst", label: "Analyst" },
];

export function TeamManager({
  members,
  invites,
  currentUserId,
  canManage,
}: {
  members: TeamMember[];
  invites: TeamInvite[];
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("analyst");
  const [pending, startTransition] = useTransition();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const ownerCount = members.filter((m) => m.role === "owner").length;
  const pendingInvites = invites.filter((i) => i.status === "pending");

  function invite() {
    startTransition(async () => {
      const res = await inviteMember({ email, role });
      if (res.ok && res.url) {
        setInviteUrl(res.url);
        setEmail("");
        toast.success("Convite criado.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Não foi possível convidar.");
      }
    });
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(okMsg);
        router.refresh();
      } else {
        toast.error(res.error ?? "Não foi possível concluir.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {canManage ? (
        <div className="rounded-lg border p-4">
          <p className="mb-3 text-sm font-medium">Convidar membro</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[16rem] flex-1 space-y-1">
              <Label htmlFor="inv-email">E-mail</Label>
              <Input
                id="inv-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pessoa@empresa.com"
              />
            </div>
            <div className="w-32 space-y-1">
              <Label>Papel</Label>
              <Select items={ROLE_ITEMS} value={role} onValueChange={(v) => v && setRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_ITEMS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={invite} disabled={pending || !email.trim()}>
              <UserPlus className="size-4" /> Convidar
            </Button>
          </div>

          {inviteUrl ? (
            <div className="mt-3 space-y-2">
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
              <p className="text-xs text-muted-foreground">
                Envie este link para a pessoa. Ele é exibido só agora.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Membro</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const isLastOwner = m.role === "owner" && ownerCount <= 1;
              return (
                <TableRow key={m.user_id}>
                  <TableCell className="text-sm">
                    {m.email ?? m.user_id}
                    {m.user_id === currentUserId ? (
                      <span className="text-muted-foreground"> (você)</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {canManage && !isLastOwner ? (
                      <Select
                        items={ROLE_ITEMS}
                        value={m.role}
                        onValueChange={(v) =>
                          v &&
                          v !== m.role &&
                          run(
                            () => changeMemberRole({ userId: m.user_id, role: v }),
                            "Papel atualizado.",
                          )
                        }
                      >
                        <SelectTrigger className="w-28" disabled={pending}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_ITEMS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm">{ROLE_LABELS[m.role]}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && !isLastOwner && m.user_id !== currentUserId ? (
                      <Button
                        size="xs"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => {
                          if (!window.confirm("Remover este membro?")) return;
                          run(() => removeMember(m.user_id), "Membro removido.");
                        }}
                      >
                        Remover
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {pendingInvites.length > 0 || invites.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Convites
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-sm">{i.email}</TableCell>
                    <TableCell className="text-sm">{ROLE_LABELS[i.role]}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {INVITE_STATUS_LABELS[i.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(i.expires_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && i.status === "pending" ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          disabled={pending}
                          onClick={() =>
                            run(() => revokeInvite(i.id), "Convite revogado.")
                          }
                        >
                          <X className="size-3.5" /> Revogar
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
