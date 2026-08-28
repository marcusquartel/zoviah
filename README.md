# Creator Hub

Plataforma SaaS da **Quartel** para gestão de creators. Este repositório está na
**Fase 0 — Fundação**: autenticação, shell administrativo, arquitetura
multiempresa no banco (com RLS) e base de tema/white label. Nenhuma
funcionalidade de produto (creators, programas, IA, campanhas, integrações)
está implementada ainda.

## Stack

| Camada        | Tecnologia                                            |
| ------------- | ---------------------------------------------------- |
| Framework     | Next.js 16 (App Router, Turbopack), React 19        |
| Linguagem     | TypeScript `strict`                                  |
| Estilo        | Tailwind CSS v4 + shadcn/ui + Lucide Icons          |
| Banco / Auth  | Supabase (PostgreSQL + Auth), `@supabase/ssr`       |
| Validação     | Zod                                                  |
| Testes        | Runner nativo do Node (`node --test`)               |

Package manager: **npm**.

## Estrutura

```
src/
  app/
    login/                 # tela de login (pública)
    app/                   # shell administrativo (protegido)
      settings/appearance/ # white label — cores da organização
  components/
    ui/                    # shadcn/ui (somente o que é usado)
    app-shell/             # sidebar, topbar, navegação
  features/
    auth/                  # server actions de login/logout
    organizations/         # queries da organização atual
    settings/              # server action de aparência
  lib/
    supabase/              # clients browser / server / proxy + env
    validation/            # schemas Zod
    theme.ts               # geração do CSS de white label
  types/database.ts        # tipos do schema (troque por tipos gerados)
supabase/
  migrations/              # SQL versionado
  bootstrap.sql            # cria a 1ª organização + owner
tests/                     # node --test
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon ou publishable key>
```

- `.env.local` é ignorado pelo Git. Apenas `.env.example` é versionado.
- Em projetos Supabase mais novos a chave pública é chamada de **publishable
  key** (`sb_publishable_...`). O código aceita tanto
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` quanto
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **Nunca** coloque a `service_role` / secret key em variável `NEXT_PUBLIC_*`
  nem a importe em `src/`. Ela só é usada por scripts e pelo teste de RLS
  (`SUPABASE_SERVICE_ROLE_KEY`, opcional).

Sem essas variáveis o app inicia e mostra uma tela de "Configuração pendente"
em vez de quebrar.

## Como rodar

```bash
npm install
npm run dev          # http://localhost:3001 (3000 fica livre para outro projeto)
```

Outros comandos:

```bash
npm run build        # build de produção
npm run start        # servir o build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # node --test (o teste de RLS é pulado sem credenciais)
```

## Migrations

As migrations ficam em `supabase/migrations/` no formato do Supabase CLI
(`<timestamp>_nome.sql`). Duas formas de aplicar:

**A) Supabase CLI (recomendado)**

```bash
npm i -g supabase           # ou use npx
supabase link --project-ref <ref>
supabase db push
```

**B) SQL Editor do Supabase**

Abra o **SQL Editor** no dashboard e cole o conteúdo de cada arquivo em
`supabase/migrations/`, na ordem:

1. `20260827000001_foundation.sql` — tabelas, constraints, índices, triggers
2. `20260827000002_rls.sql` — funções de membership, RLS e policies
3. `20260827000003_programs_and_forms.sql` — programs, form_fields, creators,
   creator_social_profiles, applications, creator_events
4. `20260827000004_programs_forms_rls.sql` — RLS + policies das tabelas acima
5. `20260827000005_public_submission.sql` — RPCs públicas
   `get_public_program` e `submit_application` (SECURITY DEFINER, escopo mínimo)
6. `20260828000001_crm.sql` — máquina de estados da `applications`, view
   `application_list_items`, RPCs `crm_counts` / `transition_application_status`
   / `add_creator_note`, índices de busca (`pg_trgm`)
7. `20260828000002_approved_at_semantics.sql` — `create or replace` da função
   de transição: `approved_at` passa a refletir só a aprovação atual
8. `20260828000003_creator_analysis.sql` — tabela `creator_analyses`
   (histórico de análises), colunas de cache em `applications`, RPCs
   `start`/`complete`/`fail_creator_analysis` + `analysis_stats`

## IA / Creator Score (Fase 3A)

`/app/creators` → abrir uma creator → aba **Inteligência** → **Analisar
creator**. O score (0–100), tier, confidence e evidence coverage aparecem no
drawer, na coluna **IA** da lista e no card do Kanban. Filtros por análise /
tier / confidence / score mínimo.

- O **score é calculado pelo backend** de forma determinística
  (`src/features/analysis/score-engine.ts`). A IA só produz avaliação
  qualitativa de 3 critérios — nunca uma nota geral. Critério sem evidência =
  `null` (desconhecido), nunca 0.
- **Score não aprova ninguém.** Aprovar / arquivar / solicitar informações
  continua sendo decisão humana, na aba Resumo.
- Requer `ANTHROPIC_API_KEY` e `ANTHROPIC_MODEL` no servidor (ver
  `.env.example`). Sem elas o CRM funciona igual e a aba mostra "IA não
  configurada".
- Nenhuma submissão pública dispara IA — só o clique da equipe.

Página **`/app/ai`**: status da integração, modelo, versões de prompt/scoring,
pesos e estatísticas.

## Criar o primeiro usuário e a organização

RLS impede a criação da primeira organização pela API (não há policy de
INSERT em `organizations`, e adicionar um membro exige já ser admin). O
primeiro `owner` é criado por um operador:

1. **Crie o usuário** em *Authentication → Users → Add user* (ou envie um
   convite). Use um e-mail real.
2. Abra o **SQL Editor** (executa como `postgres`, ignora RLS).
3. Cole `supabase/bootstrap.sql`, troque `REPLACE_WITH_USER_EMAIL` pelo e-mail
   do passo 1 e execute. Isso cria a organização **Rare Way**
   (`slug: rare-way`, `status: active`) e vincula o usuário como `owner`.

Depois é só acessar `/login` e entrar com esse usuário.

Não existe — e não deve existir — endpoint público que promova um usuário a
`owner`.

## Programas e formulário público (Fase 1)

Fluxo: **criar programa → montar formulário → ativar → captar candidaturas**.

- Admin em `/app/programs`: lista, aba **Geral** (nome, slug, conteúdo público,
  status) e aba **Formulário** (form builder — adicionar/editar/reordenar/
  desativar campos, opções de select, campo obrigatório, e o *mapeamento* de
  cada campo para colunas estruturadas). Aba **Inscrições** mostra o contador e
  as inscrições recentes (a gestão completa é da Fase 2).
- URL pública: **`/p/{orgSlug}/{programSlug}`** (ex.: `/p/rare-way/creators`).
  Sem UUID na URL. Só aceita envio quando `status = active`.
- Ativar um programa exige ao menos um campo ativo mapeado para **Nome completo**.

### Seed de desenvolvimento

Com a org Rare Way já criada, rode `supabase/seed_rare_creators.sql` no SQL
Editor para criar o programa **Rare Creators** (`slug: creators`, em `draft`)
com todos os campos do briefing. Ative pelo `/app/programs`. Não rode em
produção.

## CRM de creators (Fase 2)

`/app/creators` é a tela operacional. Cada linha é uma **inscrição**
(`application`) com a **creator** dela — a mesma creator pode ter várias
inscrições em programas diferentes.

- **Lista** e **Kanban** (por status), alternados no topo; a preferência de
  view fica em `localStorage` + na URL.
- Busca no servidor (nome, nome preferido, e-mail, telefone, @Instagram,
  @TikTok) com debounce; filtros por programa, status, possível duplicidade,
  cidade, estado, "tem Instagram", "tem TikTok"; ordenação; paginação
  "Carregar mais" (50/página). Filtros e busca ficam na URL
  (`/app/creators?program=…&status=new&q=…`).
- Clicar numa linha/card abre um **Drawer** com abas Resumo / Cadastro / Redes
  / Respostas / Histórico. As respostas são renderizadas a partir do snapshot
  do formulário salvo na inscrição.
- Ações de status (Aprovar / Solicitar informações / Arquivar / Reabrir) —
  qualquer papel (owner, admin, analyst) pode operar. Toda mudança passa pela
  RPC `transition_application_status` (atômica, valida a transição, grava
  evento na timeline).
- Notas internas na aba Histórico (nunca aparecem no formulário público).

Script de checagem de performance (cria um tenant descartável, não toca nos
dados reais):

```bash
node scripts/perf-check.mjs 1000
```

### Teste manual ponta a ponta

1. `/app/programs` → **Novo programa** → aba Formulário: adicione campos
   (mapeie um `text` para *Nome completo* e um `email` para *E-mail*).
2. Aba Geral → status **Ativo** → salvar. Copie a URL pública.
3. Abra a URL (anônimo, de preferência no celular) com
   `?utm_source=instagram&utm_campaign=teste` na query.
4. Preencha, marque o consentimento, envie → deve aparecer a mensagem de
   sucesso do programa.
5. Volte ao admin → aba **Inscrições**: o contador subiu; UTMs e dedup ficam
   registrados no banco.

## Decisões importantes

- **Fronteira de tenant = `organization_id`.** Toda tabela futura com dados de
  cliente carrega essa coluna e uma policy baseada em
  `is_organization_member()`.
- **RLS é a autorização real.** O frontend nunca trata `organization_id` do
  cliente como fonte de verdade; o banco revalida a cada query.
- **MVP de organização única.** Após o login, a primeira (única) organização do
  usuário é selecionada automaticamente. O ponto de extensão para um seletor
  multi-org está isolado em `features/organizations/queries.ts`.
- **White label por tokens.** As cores da organização sobrescrevem os tokens
  semânticos `--primary` / `--secondary` via `<ThemeStyle>`; nenhum hexadecimal
  de cliente é espalhado pelos componentes.
- **Next.js "proxy".** O antigo `middleware` foi renomeado para `proxy` no
  Next 16 (`src/proxy.ts`). Ele faz apenas o redirecionamento otimista e o
  refresh de sessão — não é a barreira de segurança.
- **Poucas dependências.** Sem Prisma, sem estado global, sem framework de
  testes externo. O runner nativo do Node roda os `.ts` diretamente
  (type stripping do Node 24).

Detalhes em [`docs/architecture.md`](docs/architecture.md).

## Comandos de validação da Fase 0

```bash
npm run lint         # PASS
npm run typecheck    # PASS
npm test             # PASS (RLS pulado sem credenciais; com credenciais, valida isolamento)
npm run build        # PASS
```
