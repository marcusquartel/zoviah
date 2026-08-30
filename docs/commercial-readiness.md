# Commercial readiness — o que falta para o primeiro cliente pagante

Estado após a Fase 6A e o que ainda é decisão de negócio ou fase futura.
Estamos entrando em **Founding Customers**, provisionamento controlado — não em
lançamento PLG.

## Pronto agora (Fase 6A)

- Operador cria/lista organizações em `/admin` (busca + paginação).
- Plano comercial por organização (`founding | starter | pro | agency |
  enterprise`) — código, não preço.
- Convite de owner e de equipe por link seguro hash-only (copiar e enviar à
  mão).
- Gestão de equipe pelo tenant (`Configurações → Equipe`): convidar, revogar,
  remover, trocar role; invariante do último owner.
- Suspender / reativar organização (dados preservados; painel congelado).
- Auditoria da plataforma (`/admin/audit`): criação, suspensão, mudança de
  plano.
- Onboarding derivado do estado real na Visão Geral.
- Isolamento multi-tenant e RLS inalterados.

## Decisão de negócio (não é engenharia)

- **Tabela de preços** por plano. `plan_code` é o gancho; o valor R$ vive fora
  do core.
- **Condições Founding**: o que "founding" garante (desconto vitalício? limites
  ampliados? acesso antecipado?).
- Termos de Serviço e Política de Privacidade (redação + revisão jurídica).
- Processo de cobrança manual (nota, boleto/PIX/cartão fora do app) enquanto não
  há billing.

## Fase comercial posterior (fora de escopo agora)

- Billing automático (Stripe / Mercado Pago), checkout, invoice, NFe.
- Signup público self-service / free plan / trial automático.
- Usage billing e carteira de créditos. Fonte de dados já existe:
  `creator_analyses` grava `input_tokens` / `output_tokens` por análise —
  isso vira usage events / consumo de crédito numa fase própria.
- Enforcement de limites por plano (creators / usuários / análises). Hoje só se
  observa o uso; nenhum bloqueio.
- Custom domain por tenant; white-label total condicionado a plano.
- "Entrar como cliente" (impersonation) com auditoria — poderoso e arriscado,
  fica para depois.
- Suporte com acesso profundo a dados de tenant, com trilha de auditoria.
- Exclusão de organização (exige política de retenção / LGPD — projeto próprio;
  hoje só suspensão).
- E-mail transacional (Resend / Postmark) para convites e notificações de
  envio. Hoje todo link é "copiar e enviar".

## Pré-lançamento técnico

Ver `docs/production-readiness.md` (envs, migrations, `platform_admins`,
backups, error monitoring, DNS, legal).
