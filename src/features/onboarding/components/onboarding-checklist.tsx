"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Circle } from "lucide-react";
import type { OnboardingState } from "@/features/onboarding/state";

const HIDE_KEY = "creator-hub:onboarding-hidden";

export function OnboardingChecklist({ state }: { state: OnboardingState }) {
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Sync once with localStorage (an external system) on mount.
    let stored = false;
    try {
      stored = localStorage.getItem(HIDE_KEY) === "1";
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHidden(stored);
    setReady(true);
  }, []);

  if (!ready || hidden || state.complete) return null;

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Primeiros passos</h2>
          <p className="text-xs text-muted-foreground">
            {state.doneCount} de {state.total} concluídos
          </p>
        </div>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => {
            try {
              localStorage.setItem(HIDE_KEY, "1");
            } catch {
              /* ignore */
            }
            setHidden(true);
          }}
        >
          Ocultar
        </button>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${(state.doneCount / state.total) * 100}%` }}
        />
      </div>

      <ul className="mt-3 space-y-1.5">
        {state.steps.map((step) => (
          <li key={step.key}>
            <Link
              href={step.href}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
            >
              {step.done ? (
                <Check className="size-4 text-success" />
              ) : (
                <Circle className="size-4 text-muted-foreground/50" />
              )}
              <span
                className={step.done ? "text-muted-foreground line-through" : ""}
              >
                {step.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
