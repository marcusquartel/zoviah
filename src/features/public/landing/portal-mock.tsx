import { Parallax } from "@/features/public/landing/parallax";

/**
 * Illustrative mock-ups of the creator portal for landing pages — static
 * markup with fictional data (never real creators). Colors come from the
 * landing theme CSS variables (--lp-*).
 */

const BADGES = [
  { emoji: "🌱", title: "Primeira venda", on: true },
  { emoji: "🔥", title: "Em alta", on: true },
  { emoji: "📸", title: "Conteúdo", on: true },
  { emoji: "👑", title: "Campeã", on: false },
];

export function PortalMock({ name, coupon, tier }: { name: string; coupon: string; tier: string }) {
  return (
    <div className="relative mx-auto w-full max-w-[560px] pb-20 pt-10" aria-label="Ilustração do portal da embaixadora">
      {/* phone */}
      <div className="relative z-10 mx-auto w-[270px] rounded-[2.6rem] border-[7px] border-[var(--lp-ink)] bg-[var(--lp-bg)] shadow-2xl sm:w-[290px]">
        <div className="absolute left-1/2 top-2 z-20 h-4 w-20 -translate-x-1/2 rounded-full bg-[var(--lp-ink)]" />
        <div className="overflow-hidden rounded-[2.1rem] pb-4">
          {/* hero */}
          <div
            className="px-4 pb-4 pt-8 text-white"
            style={{ background: "linear-gradient(rgba(0,0,0,.18),rgba(0,0,0,.18)), linear-gradient(135deg, var(--lp-a2) 0%, var(--lp-a1) 100%)" }}
          >
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-white/25 text-base font-semibold ring-2 ring-white/70">
                {name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-[0.6rem] uppercase tracking-wider text-white/85">Rare Way</p>
                <p className="text-base font-bold leading-tight">Oi, {name}!</p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1 text-[0.55rem] font-medium">
              <span className="rounded-full bg-white/25 px-2 py-0.5">⭐ {tier.toUpperCase()}</span>
              <span className="rounded-full bg-white/25 px-2 py-0.5">🏆 2º no ranking</span>
              <span className="rounded-full bg-white/25 px-2 py-0.5">🔥 3 meses</span>
            </div>
            <p className="mt-3 text-[0.6rem] text-white/85">Vendido no mês</p>
            <p className="text-2xl font-bold">R$ 2.480,00</p>
            <div className="mt-2 rounded-lg bg-white/20 p-2">
              <div className="flex justify-between text-[0.55rem]">
                <span>Próxima conquista: 🚀 Imparável</span>
                <span>faltam 2 vendas</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-white/30">
                <div className="h-full w-4/5 rounded-full bg-white" />
              </div>
            </div>
          </div>
          {/* stats */}
          <div className="grid grid-cols-2 gap-2 px-3 pt-3">
            <MiniCard label="Vendas no mês" value="8" />
            <MiniCard label="Sua comissão" value="R$ 248,00" />
          </div>
          {/* coupon */}
          <div className="mx-3 mt-2 flex items-center justify-between rounded-xl border-2 border-dashed border-[var(--lp-a2)] bg-white px-3 py-2">
            <div>
              <p className="text-[0.5rem] font-medium text-[var(--lp-a2-deep)]">PARA DIVULGAR · 10% OFF</p>
              <p className="font-mono text-xs font-bold">{coupon}</p>
            </div>
            <span className="rounded-full border px-2 py-0.5 text-[0.55rem]">Copiar</span>
          </div>
          {/* badges */}
          <div className="mx-3 mt-2 rounded-xl bg-white p-2.5">
            <p className="text-[0.6rem] font-semibold">Conquistas · 6 de 10</p>
            <div className="mt-1.5 grid grid-cols-4 gap-1.5">
              {BADGES.map((b) => (
                <div
                  key={b.title}
                  className="flex flex-col items-center rounded-lg px-1 py-1.5 text-center"
                  style={
                    b.on
                      ? { background: "linear-gradient(rgba(0,0,0,.18),rgba(0,0,0,.18)), linear-gradient(135deg, var(--lp-a2), var(--lp-a1))", color: "white" }
                      : { background: "#f1f1f1", color: "#9a9a9a" }
                  }
                >
                  <span className={b.on ? "text-base" : "text-base opacity-40 grayscale"}>{b.emoji}</span>
                  <span className="text-[0.45rem] font-semibold leading-tight">{b.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* floating: sale notice */}
      <Parallax speed={0.1} className="absolute bottom-6 left-0 z-20 w-[210px] rotate-[-4deg] rounded-2xl bg-white p-3 shadow-xl sm:-left-4">
        <p className="text-[0.55rem] font-semibold uppercase tracking-wider text-neutral-500">Novo e-mail · agora</p>
        <p className="mt-1 text-xs font-bold leading-snug">Nova venda com o seu cupom {coupon}! 🎉</p>
        <p className="mt-1 text-[0.65rem] text-neutral-600">Pedido #2041 · R$ 289,90 · sua comissão R$ 28,99</p>
      </Parallax>

      {/* floating: podium */}
      <Parallax speed={-0.08} className="absolute right-0 top-[44%] z-20 w-[180px] rotate-[3deg] rounded-2xl bg-white p-3 shadow-xl sm:-right-4">
        <p className="text-[0.6rem] font-semibold">Pódio do mês</p>
        <div className="mt-2 grid grid-cols-3 items-end gap-1 text-center">
          <PodiumStep place="2º" medal="🥈" label="Você!" height="h-9" highlight />
          <PodiumStep place="1º" medal="🥇" label="Bia" height="h-12" />
          <PodiumStep place="3º" medal="🥉" label="Carol" height="h-6" />
        </div>
      </Parallax>

      {/* floating: content approved */}
      <Parallax speed={0.05} className="absolute left-0 top-6 z-20 hidden w-[160px] rotate-[-5deg] rounded-2xl bg-[var(--lp-ink)] p-3 text-white shadow-xl sm:-left-2 sm:block">
        <p className="text-[0.55rem] uppercase tracking-wider text-white/60">Seus conteúdos</p>
        <p className="mt-1 text-xs font-semibold">Story · Instagram</p>
        <span className="mt-2 inline-block rounded-full bg-[var(--lp-a3)] px-2 py-0.5 text-[0.55rem] font-semibold text-[var(--lp-ink)]">
          Aprovado ✓
        </span>
      </Parallax>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-2">
      <p className="text-[0.5rem] text-neutral-500">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

function PodiumStep({
  place,
  medal,
  label,
  height,
  highlight,
}: {
  place: string;
  medal: string;
  label: string;
  height: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-sm">{medal}</span>
      <span className={highlight ? "text-[0.55rem] font-bold text-[var(--lp-a2-deep)]" : "text-[0.55rem]"}>{label}</span>
      <div
        className={`flex w-full items-start justify-center rounded-t-md pt-0.5 text-[0.55rem] font-bold text-white ${height}`}
        style={{ background: "linear-gradient(180deg, var(--lp-a2), var(--lp-a1))" }}
      >
        {place}
      </div>
    </div>
  );
}
