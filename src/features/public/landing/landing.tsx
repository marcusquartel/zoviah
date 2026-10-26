import { cn } from "@/lib/utils";
import { PortalMock } from "@/features/public/landing/portal-mock";
import { Parallax } from "@/features/public/landing/parallax";
import type { Landing, LandingSection } from "@/features/public/landing/schema";

/**
 * Program landing page. Visual language follows the brand system it is fed
 * (Rare Way: lavender ground, pink / lilac / turquoise accents, Helvetica in
 * caps, simple geometric shapes overlapping photos). Server component; every
 * string is rendered as text. The form lands in #inscricao.
 */

const DISPLAY_FONT = '"Helvetica Now Display", "Helvetica Neue", Helvetica, Arial, sans-serif';

export function LandingPage({
  landing,
  brandName,
  form,
}: {
  landing: Landing;
  brandName: string;
  form: React.ReactNode;
}) {
  const t = landing.theme;
  const vars = {
    "--lp-bg": t.background,
    "--lp-ink": t.ink,
    "--lp-a1": t.accent1,
    "--lp-a2": t.accent2,
    "--lp-a3": t.accent3,
    "--lp-a1-light": t.accent1Light,
    "--lp-a2-light": t.accent2Light,
    "--lp-a3-light": t.accent3Light,
    "--lp-a2-deep": t.accent2Deep,
    fontFamily: DISPLAY_FONT,
  } as React.CSSProperties;

  return (
    <div className="overflow-x-hidden bg-[var(--lp-bg)] text-[var(--lp-ink)]" style={vars}>
      <Hero landing={landing} brandName={brandName} />
      {landing.sections.map((s, i) => (
        <Section key={i} section={s} landing={landing} brandName={brandName} />
      ))}
      <section id="inscricao" className="relative scroll-mt-4 overflow-hidden px-5 py-16 sm:py-24">
        <Shape kind="circle-outline" className="-left-24 top-10 size-64" speed={0.12} />
        <Shape kind="pill" className="-right-32 bottom-10 h-48 w-96 bg-[var(--lp-a3-light)]" speed={-0.1} />
        <div className="relative mx-auto max-w-xl">
          {landing.form.eyebrow ? <Label>{landing.form.eyebrow}</Label> : null}
          <Title className="text-4xl sm:text-6xl">{landing.form.title}</Title>
          {landing.form.intro ? (
            <p className="mt-5 whitespace-pre-line text-base leading-relaxed text-neutral-700">{landing.form.intro}</p>
          ) : null}
          <div className="mt-8 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-7">{form}</div>
        </div>
      </section>
      <footer className="flex flex-wrap items-center justify-between gap-3 bg-[var(--lp-ink)] px-5 py-6 text-[0.7rem] uppercase tracking-wider text-white sm:px-10">
        <Wordmark name={brandName} light />
        <span className="text-white/70">{landing.brand.signature ?? brandName}</span>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------- primitives

function Wordmark({ name, light }: { name: string; light?: boolean }) {
  return (
    <span className={cn("text-lg font-black uppercase tracking-[0.04em]", light ? "text-white" : "text-[var(--lp-ink)]")}>
      {name}
    </span>
  );
}

/** "● SUA BELEZA TEM PODER" */
function Label({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={cn("mb-5 flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-wider", light ? "text-white" : "")}>
      <span aria-hidden className="size-2 rounded-full bg-current" />
      {children}
    </p>
  );
}

function Title({ children, className, light }: { children: React.ReactNode; className?: string; light?: boolean }) {
  return (
    <h2
      className={cn("text-balance font-normal uppercase leading-[0.95] tracking-[-0.01em]", light ? "text-white" : "", className)}
    >
      {children}
    </h2>
  );
}

function Cta({ label, light }: { label: string; light?: boolean }) {
  return (
    <a
      href="#inscricao"
      className={cn(
        "inline-flex items-center gap-3 rounded-full px-7 py-4 text-sm font-medium uppercase tracking-wider transition-transform hover:scale-[1.02]",
        light ? "bg-white text-[var(--lp-ink)]" : "bg-[var(--lp-ink)] text-white",
      )}
    >
      {label}
      <span aria-hidden className="size-2.5 rounded-full bg-current" />
    </a>
  );
}

type ShapeKind = "circle" | "circle-outline" | "pill" | "pill-outline" | "triangle" | "square";

/** Decorative geometric shapes from the brand system (absolutely positioned). */
function Shape({
  kind,
  className,
  style,
  speed,
}: {
  kind: ShapeKind;
  className?: string;
  style?: React.CSSProperties;
  /** Parallax drift (see Parallax). Omit for a static shape. */
  speed?: number;
}) {
  const inner =
    kind === "triangle" ? (
      <svg aria-hidden viewBox="0 0 100 90" className="block size-full">
        <path d="M50 6 Q54 0 58 6 L97 76 Q100 84 92 84 L8 84 Q0 84 3 76 Z" fill="currentColor" />
      </svg>
    ) : null;
  const classes = cn(
    "pointer-events-none absolute",
    kind === "circle" && "rounded-full bg-[var(--lp-ink)]",
    kind === "circle-outline" && "rounded-full border-[1.5px] border-[var(--lp-ink)]",
    kind === "pill" && "rounded-full",
    kind === "pill-outline" && "rounded-full border-[1.5px] border-[var(--lp-ink)]",
    kind === "square" && "rounded-[1.25rem]",
    kind === "triangle" && "aspect-[10/9]",
    className,
  );
  if (speed) {
    return (
      <Parallax speed={speed} className={classes} style={style}>
        {inner}
      </Parallax>
    );
  }
  return (
    <span aria-hidden style={style} className={classes}>
      {inner}
    </span>
  );
}

function Photo({
  src,
  className,
  imgClassName,
  speed,
}: {
  src: string;
  className?: string;
  imgClassName?: string;
  /** The image drifts inside its crop (it is oversized to never show edges). */
  speed?: number;
}) {
  return (
    <div className={cn("overflow-hidden", className)}>
      {speed ? (
        <Parallax speed={speed} className="relative -inset-y-[12%] h-[124%]">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote brand photo */}
          <img src={src} alt="" className={cn("size-full object-cover", imgClassName)} loading="lazy" />
        </Parallax>
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element -- remote brand photo */
        <img src={src} alt="" className={cn("size-full object-cover", imgClassName)} loading="lazy" />
      )}
    </div>
  );
}

// -------------------------------------------------------------------- hero

function Hero({ landing, brandName }: { landing: Landing; brandName: string }) {
  const h = landing.hero;
  return (
    // Full-bleed: the brand panel runs to the viewport's right edge and the
    // full hero height; the copy stays aligned with the page container.
    <section className="relative overflow-hidden lg:min-h-svh">
      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-12 px-5 pb-12 pt-8 sm:px-10 lg:min-h-svh lg:w-[52%] lg:pb-10">
          <Wordmark name={brandName} />
          <div>
            {h.eyebrow ? <Label>{h.eyebrow}</Label> : null}
            <h1 className="font-normal uppercase leading-[0.9] tracking-[-0.02em]">
              <span className="block text-[3.6rem] sm:text-8xl lg:text-[7.5rem]">{h.title}</span>
            </h1>
            {h.subtitle ? <p className="mt-6 max-w-md text-xl leading-snug">{h.subtitle}</p> : null}
            {h.body ? <p className="mt-4 max-w-md leading-relaxed text-neutral-600">{h.body}</p> : null}
            <div className="mt-8">
              <Cta label={h.cta} />
            </div>
          </div>
          <div className="hidden gap-10 text-[0.7rem] font-medium uppercase tracking-wider lg:flex">
            {landing.brand.tagline ? (
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-current" /> {landing.brand.tagline}
              </span>
            ) : null}
            {landing.brand.signature ? <span>{landing.brand.signature}</span> : null}
          </div>
        </div>
      </div>

      <div className="relative h-[540px] overflow-hidden bg-[var(--lp-a2)] sm:h-[640px] lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-[46%]">
        {h.image ? (
          <Photo
            src={h.image}
            className="absolute bottom-[12%] left-[10%] right-0 top-[8%] rounded-l-full"
            imgClassName="object-[50%_35%]"
            speed={0.06}
          />
        ) : null}
        <Shape kind="circle" className="bottom-[5%] left-[5%] size-24 sm:size-36" speed={0.1} />
        <Shape kind="circle-outline" className="bottom-[5%] left-[24%] size-24 sm:size-36" speed={0.05} />
        <Shape kind="pill-outline" className="-top-24 right-[12%] h-72 w-44 border-white/80" speed={-0.1} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- sections

function Section({ section, landing, brandName }: { section: LandingSection; landing: Landing; brandName: string }) {
  switch (section.type) {
    case "text":
      return <TextSection s={section} />;
    case "list":
      return <ListSection s={section} />;
    case "tiers":
      return <TiersSection s={section} />;
    case "steps":
      return <StepsSection s={section} />;
    case "portal":
      return <PortalSection s={section} />;
    case "closing":
      return <ClosingSection s={section} landing={landing} brandName={brandName} />;
  }
}

function TextSection({ s }: { s: Extract<LandingSection, { type: "text" }> }) {
  return (
    <section className="relative overflow-hidden px-5 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2">
        {s.image ? (
          <div className={cn("relative mx-auto aspect-square w-full max-w-[520px]", s.imageSide !== "right" && "lg:order-first")}>
            <Shape kind="triangle" className="-left-[12%] -top-[8%] w-[85%] text-[var(--lp-a3)]" speed={0.14} />
            <Photo src={s.image} className="absolute inset-[8%] rounded-full bg-[var(--lp-a2)]" speed={0.06} />
            <Shape kind="circle-outline" className="-bottom-2 left-[2%] size-24" speed={-0.12} />
            <Shape kind="circle" className="bottom-[18%] right-0 size-16" speed={0.25} />
          </div>
        ) : null}
        <div>
          {s.eyebrow ? <Label>{s.eyebrow}</Label> : null}
          <Title className="text-4xl sm:text-6xl">{s.title}</Title>
          <p className="mt-7 whitespace-pre-line text-lg leading-relaxed text-neutral-700">{s.body}</p>
          {s.quote ? (
            <p className="mt-8 rounded-[1.5rem] bg-[var(--lp-a2-light)] p-6 text-lg leading-relaxed">“{s.quote}”</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ListSection({ s }: { s: Extract<LandingSection, { type: "list" }> }) {
  return (
    <section className="relative overflow-hidden bg-[var(--lp-ink)] px-5 py-20 text-white sm:px-10 sm:py-28">
      <Shape kind="pill-outline" className="-right-40 -top-28 h-56 w-[28rem] border-white/40" speed={-0.12} />
      <Shape kind="circle" className="-bottom-20 -left-20 size-64 bg-[var(--lp-a2)]" style={{ opacity: 0.35 }} speed={0.18} />
      <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_1.2fr]">
        <div>
          {s.eyebrow ? <Label light>{s.eyebrow}</Label> : null}
          <Title light className="text-5xl sm:text-7xl">
            {s.title}
          </Title>
          {s.intro ? <p className="mt-6 max-w-md text-lg leading-relaxed text-white/75">{s.intro}</p> : null}
        </div>
        <ul className="divide-y divide-white/15 border-y border-white/15">
          {s.items.map((item, i) => (
            <li key={i} className="flex items-baseline gap-5 py-5">
              <span className="text-sm tabular-nums text-[var(--lp-a3)]">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-lg leading-snug sm:text-xl">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PortalSection({ s }: { s: Extract<LandingSection, { type: "portal" }> }) {
  return (
    <section className="relative overflow-hidden bg-[var(--lp-a2)] px-5 py-20 sm:px-10 sm:py-28">
      <Shape kind="circle-outline" className="-left-32 -top-24 size-56" speed={0.15} />
      <Shape kind="square" className="-bottom-10 -right-10 hidden size-40 bg-[var(--lp-a1)] lg:block" style={{ opacity: 0.8 }} speed={-0.15} />
      <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2">
        <div>
          {s.eyebrow ? <Label>{s.eyebrow}</Label> : null}
          <Title className="text-5xl sm:text-7xl">{s.title}</Title>
          {s.body ? <p className="mt-6 max-w-md text-lg leading-relaxed">{s.body}</p> : null}
          {s.bullets.length ? (
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {s.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 rounded-2xl bg-white/45 p-4 text-sm font-medium leading-snug backdrop-blur-sm">
                  <span aria-hidden className="mt-1 size-2.5 shrink-0 rounded-full bg-[var(--lp-ink)]" />
                  {b}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-6 text-[0.7rem] uppercase tracking-wider text-[var(--lp-a2-deep)]">Imagens ilustrativas</p>
        </div>
        <PortalMock name={s.sample.name} coupon={s.sample.coupon} tier={s.sample.tier} photo={s.sample.photo} />
      </div>
    </section>
  );
}

const TIER_COLORS = ["var(--lp-a3)", "var(--lp-a1)", "var(--lp-a2)"];
const TIER_LIGHT = ["var(--lp-a3-light)", "var(--lp-a1-light)", "var(--lp-a2-light)"];

function TiersSection({ s }: { s: Extract<LandingSection, { type: "tiers" }> }) {
  return (
    <section className="relative px-5 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          {s.eyebrow ? <Label>{s.eyebrow}</Label> : null}
          <Title className="text-5xl sm:text-7xl">{s.title}</Title>
          {s.intro ? <p className="mt-6 text-lg leading-relaxed text-neutral-700">{s.intro}</p> : null}
        </div>
        <div className={cn("mt-14 grid items-start gap-6", s.tiers.length >= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
          {s.tiers.map((t, i) => {
            const last = i === s.tiers.length - 1;
            return (
              <article
                key={t.name}
                className={cn("overflow-hidden rounded-[2rem]", last ? "bg-[var(--lp-ink)] text-white" : "bg-white")}
              >
                {/* Same 4:5 arch on every card; photos are pre-cropped to one framing. */}
                <div className="relative px-[14%] pt-12" style={{ background: TIER_COLORS[i % 3] }}>
                  {t.image ? (
                    <Photo src={t.image} className="aspect-[4/5] w-full rounded-t-full" imgClassName="object-center" />
                  ) : (
                    <div className="aspect-[4/5] w-full" />
                  )}
                  <span className="absolute left-5 top-5 rounded-full bg-white px-3 py-1 text-[0.7rem] font-medium uppercase tracking-wider text-[var(--lp-ink)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="p-6">
                  <h3 className="text-4xl font-normal uppercase leading-none">{t.name}</h3>
                  {t.tagline ? <p className={cn("mt-2 text-sm", last ? "text-white/70" : "text-neutral-600")}>{t.tagline}</p> : null}
                  <ul className="mt-5 space-y-2.5">
                    {t.benefits.map((b, j) => (
                      <li key={j} className="flex gap-3 text-sm leading-relaxed">
                        <span
                          aria-hidden
                          className="mt-1.5 size-2 shrink-0 rounded-full"
                          style={{ background: last ? TIER_COLORS[i % 3] : "var(--lp-ink)" }}
                        />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="h-2" style={{ background: last ? TIER_COLORS[i % 3] : TIER_LIGHT[i % 3] }} />
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function StepsSection({ s }: { s: Extract<LandingSection, { type: "steps" }> }) {
  const fills = ["var(--lp-a3)", "var(--lp-a1)", "var(--lp-a2)", "var(--lp-ink)"];
  return (
    <section className="relative overflow-hidden bg-white px-5 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto max-w-7xl">
        {s.eyebrow ? <Label>{s.eyebrow}</Label> : null}
        <Title className="text-5xl sm:text-7xl">{s.title}</Title>
        <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {s.steps.map((step, i) => (
            <li key={i}>
              <div className="relative size-24">
                <span className="absolute inset-0 rounded-full" style={{ background: fills[i % 4] }} />
                <span className="absolute left-8 top-4 size-24 rounded-full border-[1.5px] border-[var(--lp-ink)]" />
                <span
                  className={cn("absolute inset-0 flex items-center justify-center text-3xl", i % 4 === 3 ? "text-white" : "")}
                >
                  {i + 1}
                </span>
              </div>
              <p className="mt-6 text-xl uppercase leading-tight">{step.title}</p>
              <p className="mt-2 leading-relaxed text-neutral-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ClosingSection({
  s,
  landing,
  brandName,
}: {
  s: Extract<LandingSection, { type: "closing" }>;
  landing: Landing;
  brandName: string;
}) {
  return (
    <section className="relative overflow-hidden bg-[var(--lp-a3)] px-5 py-20 sm:px-10 sm:py-28">
      <Shape kind="triangle" className="-right-16 -top-10 w-[420px] text-[var(--lp-a3-light)]" speed={0.16} />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
        <div>
          <Label>{landing.brand.tagline ?? brandName}</Label>
          <Title className="text-5xl sm:text-8xl">{s.title}</Title>
          {s.body ? <p className="mt-6 max-w-md text-lg leading-relaxed">{s.body}</p> : null}
          <div className="mt-8">
            <Cta label={landing.hero.cta} />
          </div>
        </div>
        {s.image ? (
          <div className="relative mx-auto aspect-square w-full max-w-[480px]">
            <Photo src={s.image} className="absolute inset-0 rounded-full" speed={0.06} />
            <Shape kind="circle" className="-bottom-2 -left-2 size-24" speed={0.22} />
            <Shape kind="circle-outline" className="-bottom-2 left-20 size-24" speed={0.12} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
