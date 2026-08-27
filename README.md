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
