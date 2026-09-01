/**
 * Onboarding checklist — every step is DERIVED from real tenant state (§26),
 * never a manual checkbox. Pure: takes the facts, returns the checklist.
 */
export interface OnboardingFacts {
  hasBrand: boolean;
  hasProgram: boolean;
  hasPublishedProgram: boolean;
  teamInvited: boolean;
  hasApplication: boolean;
}

export interface OnboardingStep {
  key: keyof OnboardingFacts;
  label: string;
  href: string;
  done: boolean;
}

export interface OnboardingState {
  steps: OnboardingStep[];
  doneCount: number;
  total: number;
  complete: boolean;
}

const STEPS: { key: keyof OnboardingFacts; label: string; href: string }[] = [
  { key: "hasBrand", label: "Configure sua marca", href: "/app/settings/appearance" },
  { key: "hasProgram", label: "Crie seu primeiro programa", href: "/app/programs" },
  { key: "hasPublishedProgram", label: "Publique seu formulário", href: "/app/programs" },
  { key: "teamInvited", label: "Convide sua equipe", href: "/app/team" },
  { key: "hasApplication", label: "Receba sua primeira creator", href: "/app/creators" },
];

export function deriveOnboardingState(facts: OnboardingFacts): OnboardingState {
  const steps: OnboardingStep[] = STEPS.map((s) => ({
    ...s,
    done: facts[s.key],
  }));
  const doneCount = steps.filter((s) => s.done).length;
  return {
    steps,
    doneCount,
    total: steps.length,
    complete: doneCount === steps.length,
  };
}
