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
    <section className="grid gap-6 rounded-[28px] bg-card p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[1.375rem] leading-tight">Primeiros passos</h2>
          <button
            type="button"
            className="text-[0.8125rem] text-muted-foreground hover:text-foreground"
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
        <div className="mt-auto flex items-end gap-3 pt-6">
          <span className="figure text-[3.5rem]">
            {Math.round((state.doneCount / state.total) * 100)}
            <span className="ml-0.5 text-[0.5em] tracking-normal">%</span>
          </span>
          <span className="pb-1.5 text-sm leading-tight text-muted-foreground">
            {state.doneCount} de {state.total}
            <br />
            concluídos
          </span>
        </div>
        {/* Progress bar with the accent fill and a knob at the edge. */}
        <div className="relative mt-5 mr-2 h-2.5 rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all"
            style={{ width: `${(state.doneCount / state.total) * 100}%` }}
          />
          <span
            className="absolute top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-ink bg-card"
            style={{ left: `${(state.doneCount / state.total) * 100}%` }}
          />
        </div>
      </div>

      <ul>
        {state.steps.map((step, i) => (
          <li key={step.key} className={i > 0 ? "border-t border-border" : ""}>
            <Link
              href={step.href}
              className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-2.5 text-[0.9375rem] transition-colors hover:bg-accent"
            >
              {step.done ? (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-ink-foreground">
                  <Check className="size-4" strokeWidth={2} />
                </span>
              ) : (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink">
                  <Circle className="size-2 fill-current" />
                </span>
              )}
              <span
                className={
                  step.done ? "flex-1 text-muted-foreground line-through" : "flex-1"
                }
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
