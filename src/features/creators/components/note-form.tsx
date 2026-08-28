"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addCreatorNote } from "@/features/creators/actions";

export function NoteForm({
  creatorId,
  applicationId,
  onAdded,
}: {
  creatorId: string;
  applicationId?: string;
  onAdded: () => void;
}) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const value = text.trim();
    if (!value) return;
    startTransition(async () => {
      const res = await addCreatorNote({
        creatorId,
        applicationId,
        text: value,
      });
      if (res.ok) {
        setText("");
        onAdded();
      } else {
        toast.error(res.error ?? "Não foi possível salvar a nota.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Nota interna (não aparece no formulário público)…"
        rows={2}
        maxLength={4000}
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={submit}
          disabled={pending || text.trim().length === 0}
        >
          {pending ? "Salvando…" : "Adicionar nota"}
        </Button>
      </div>
    </div>
  );
}
