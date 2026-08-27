# Arquitetura — multiempresa e tema

Documento curto. Cobre só o que existe na Fase 0.

## Modelo de dados

```
organizations 1───∞ organization_members ∞───1 auth.users
      │
      └────1───1 organization_settings
```

- **`organizations`** — o tenant. `slug` único (regex `^[a-z0-9]+(-[a-z0-9]+)*$`),
  `status ∈ {active, inactive}`, timestamps UTC (`now()`), `id` UUID
  (`gen_random_uuid()`). Trigger `set_updated_at` mantém `updated_at`.
- **`organization_members`** — vínculo usuário↔organização com `role ∈
  {owner, admin, analyst}`. `unique (organization_id, user_id)` impede vínculo
  duplicado. Índices em `organization_id` e em `user_id`. FKs com
  `on delete cascade`.
- **`organization_settings`** — 1 linha por organização (`organization_id` é PK e
  FK). Guarda `logo_url`, `favicon_url`, `primary_color`, `secondary_color`.
  Um trigger `after insert` em `organizations` cria a linha automaticamente.

## Isolamento entre tenants (RLS)

RLS está **habilitado** nas três tabelas. Com RLS ligado e sem policy que
corresponda, o acesso é negado — ou seja, o default é fechado.

### Função central de membership

```sql
public.is_organization_member(org_id uuid) returns boolean
  language sql stable security definer set search_path = ''
```

- **`security definer`**: roda com privilégios do dono (postgres). Isso é o que
  permite que uma policy *sobre* `organization_members` chame uma função que
  faz `select` *em* `organization_members` sem cair em recursão infinita de
  policy ("infinite recursion detected in policy").
- **`set search_path = ''`**: todo objeto no corpo é qualificado com schema
  (`public.organization_members`, `auth.uid()`), então um chamador não
  consegue "sequestrar" um nome não qualificado com uma tabela temporária ou
  outro schema. É a mitigação padrão para funções `security definer`.
- **`stable`** + `(select auth.uid())`: o planejador avalia uma vez por
  statement.
- Execução revogada de `public`, concedida só a `authenticated`.

`is_organization_admin(org_id)` é igual, mas também exige
`role in ('owner','admin')`.

### Policies

| Tabela                  | SELECT            | INSERT           | UPDATE            | DELETE           |
| ----------------------- | ----------------- | ---------------- | ----------------- | ---------------- |
| `organizations`         | membro            | — (operador)     | owner/admin       | — (operador)     |
| `organization_members`  | membro            | owner/admin      | owner/admin       | owner/admin      |
| `organization_settings` | membro            | trigger (definer)| owner/admin       | — (cascade)      |

"— (operador)" = sem policy ⇒ bloqueado pelas chaves `anon` / `authenticated`.
Só a `service_role` ou SQL direto no dashboard (roda como `postgres`) contorna
a RLS. É por aí que passa o [bootstrap](../supabase/bootstrap.sql).

Resultado: um usuário autenticado da Empresa A nunca lê nem escreve linhas da
Empresa B pela API. O teste `tests/rls.test.ts` prova isso ponta a ponta
quando há credenciais.

## Sessão e proteção de rotas

Três clients Supabase, conforme o padrão oficial `@supabase/ssr`:

- `lib/supabase/client.ts` — browser (Client Components).
- `lib/supabase/server.ts` — request-scoped, lê/escreve cookies via
  `next/headers`. Usa `getUser()` (revalida o token no servidor de Auth), não
  `getSession()`.
- `lib/supabase/proxy.ts` — usado pelo `src/proxy.ts` (o antigo *middleware*).

Camadas de proteção, da mais fraca para a mais forte:

1. **`src/proxy.ts`** — redirecionamento otimista só pelo cookie: sem sessão em
   `/app/*` → `/login`; com sessão em `/login` → `/app`. Também faz o refresh
   dos cookies de auth. **Não** é barreira de segurança (roda em rotas
   pré-carregadas; só olha o cookie).
2. **`src/app/app/layout.tsx`** — Server Component: `getCurrentUser()` real; sem
   usuário → `redirect('/login')`; sem organização → tela informativa.
3. **RLS no banco** — a autorização que de fato conta. Mesmo que 1 e 2 falhem,
   o Postgres não devolve dados de outro tenant.

## Organização atual

`features/organizations/queries.ts::getCurrentOrganization()` traz, em uma
query, o `organization_members` do usuário com `organizations` e
`organization_settings` embutidos pelas FKs. MVP: pega o vínculo mais antigo
(espera-se exatamente um). Um seletor multi-org no futuro se resolve nesse
único ponto. O `organization_id` nunca é persistido no cliente como fonte de
verdade.

## Tema / white label

`globals.css` define **tokens semânticos** (`--primary`, `--secondary`,
`--background`, `--foreground`, `--surface`, `--border`, `--muted`,
`--success`, `--warning`, `--danger`, …) em OKLCH, com variante `.dark`. Os
componentes shadcn/ui leem esses tokens — nenhum hexadecimal de cliente
aparece nos componentes.

Para white label, `lib/theme.ts::buildThemeCss()` transforma
`organization_settings.primary_color` / `secondary_color` (aceita só `#rgb` /
`#rrggbb`) num pequeno bloco `:root{ --primary: …; --secondary: … }` que o
Server Component `<ThemeStyle>` injeta no `/app`. Valores inválidos ou ausentes
⇒ tema neutro padrão.

Limitações conhecidas da Fase 0: as cores de contraste (`--primary-foreground`
etc.) não são recalculadas a partir da cor do cliente; upload de logo/favicon
não está implementado (só a URL é persistida). A página
`/app/settings/appearance` persiste as cores (owner/admin; `analyst` é
somente leitura, reforçado por RLS).

---

# Fase 1 — Programas, Form Builder e captação pública

## Modelo

```
organizations 1──∞ programs 1──∞ form_fields
                     │
                     └──∞ applications ∞──1 creators 1──∞ creator_social_profiles
                                                        └──∞ creator_events
```

- **`programs`** — `status ∈ {draft, active, paused, archived}`, `slug` único
  *por organização* (`unique (organization_id, slug)`), `form_version` (inteiro,
  ≥ 1). Índice `(organization_id, status)`.
- **`form_fields`** — definição dos campos do formulário. `field_type` num
  conjunto fixo (text, textarea, email, phone, number, url, date,
  single_select, multi_select, checkbox, instagram, tiktok). `field_key` único
  por programa. `options` (jsonb) para selects; `configuration.mapping` diz qual
  coluna estruturada o campo alimenta. Índice `(program_id, position)`.
- **`creators`** — a pessoa. **Sem status de candidatura.** Índices parciais
  `(organization_id, lower(email))` e `(organization_id, phone_e164)`.
- **`creator_social_profiles`** — handles fora de `creators` (plataformas novas
  não mexem em `creators`). `handle_normalized` é a forma comparável.
  `unique (organization_id, platform, handle_normalized)` — também o backstop de
  concorrência do dedup.
- **`applications`** — a inscrição. `status` só aceita `'new'` nesta fase
  (a máquina de estados é da Fase 2). Guarda `form_version`, `answers` (jsonb
  keyed por `field_key`), `field_snapshot` (rótulo+tipo no momento do envio, pra
  interpretar a inscrição sem depender do formulário atual), `possible_duplicate`
  e todos os campos de origem/UTM. `program_id` é `on delete restrict`
  (não se apaga um programa com inscrições). Índices
  `(organization_id, program_id, submitted_at desc)` e
  `(organization_id, creator_id)`.
- **`creator_events`** — log append-only mínimo (só `application_submitted` por
  ora), pra Fase 2 montar a timeline sem perder histórico. Sem UI. Não é event
  sourcing.

Não há campo hard-coded para a Rare Way. O programa "Rare Creators" é montado
só com linhas de `form_fields` (`supabase/seed_rare_creators.sql`).

## RLS (migration `...0004`)

Mesmo padrão da Fase 0: `enable row level security` nas 6 tabelas; `SELECT` para
membros da org, escrita administrativa (`INSERT`/`UPDATE`/`DELETE`) para
owner/admin via `is_organization_admin()`. `applications` **não tem policy de
INSERT** (só a RPC de submissão escreve). `creator_events` é read-only para
membros. O teste `tests/phase1.rls.test.ts` prova que o tenant B não lê nada de
`programs`/`form_fields`/`creators`/`creator_social_profiles`/`applications` do
tenant A.

## Caminho público (migration `...0005`)

O formulário público é anônimo. Em vez de abrir policies de `SELECT` para
`anon` nas tabelas administrativas, há **duas funções `SECURITY DEFINER`** —
o único caminho privilegiado. **A aplicação não usa `service_role` para isto.**

- **`get_public_program(org_slug, program_slug) → jsonb`** — devolve só o
  necessário pra renderizar: branding (nome/logo/cores), textos públicos do
  programa e os `form_fields` ativos ordenados. Retorna `null` para programa
  inexistente ou em `draft`/`archived`. Nenhum UUID interno no payload.
- **`submit_application(...) → jsonb`** — corpo `plpgsql` = **uma transação
  implícita**: qualquer `raise` faz rollback total, então uma submissão que
  falha nunca deixa creator/perfil órfão. Passos:
  1. resolve o programa pelos slugs; exige `status = 'active'` (senão
     `raise 'PROGRAM_NOT_ACCEPTING'`).
  2. `pg_advisory_xact_lock` numa hash de `org_id | identidade primária`
     (instagram → tiktok → email → telefone). Serializa submissões
     concorrentes da mesma pessoa — o caso óbvio de corrida — sem depender de
     "SELECT, não achei, INSERT".
  3. **Dedup** dentro da org, nessa ordem de prioridade: instagram
     normalizado, tiktok normalizado, e-mail, telefone. O primeiro match vira o
     creator; todos os matches distintos entram na detecção de conflito.
  4. 0 matches → cria `creators`. 1 match → reusa (e faz backfill só de campos
     de contato vazios). >1 match distinto → `possible_duplicate = true` e usa o
     de maior prioridade; **nada é mesclado** (sem merge destrutivo).
  5. Upsert de `creator_social_profiles` por
     `(organization_id, platform, handle_normalized)` — o `creator_id` **não** é
     alterado no conflito: um handle que já é de outro creator continua com ele.
  6. `insert` em `applications` (`status 'new'`, `form_version`, `answers`,
     `field_snapshot`, UTMs) e um `creator_events` `application_submitted`.
  Concedida a `anon` e `authenticated`; `set search_path = ''` + nomes
  qualificados.

### Normalização

`src/lib/normalize.ts` (puro, testado): e-mail (trim+lowercase),
handle (tira `@`, extrai de URL, lowercase — `@Marcus` = `marcus` =
`instagram.com/Marcus`), telefone BR best-effort E.164 (só quando os dígitos
são inequívocos; senão `null`, nunca inventa). O valor original fica em
`answers`. O server action normaliza; a RPC recebe os valores já normalizados —
o SQL fica simples.

### Anti-spam e limites

`src/features/public/actions.ts` faz, antes da RPC: honeypot (campo `_hp`
oculto; se preenchido, responde "sucesso" sem gravar), rate limiting em memória
por IP (`src/lib/rate-limit.ts` — janela fixa, por instância; trocar por
Redis/Turnstile é plug-in), e re-valida **tudo** server-side com o mesmo schema
Zod do cliente (`buildFieldSchema`). Consentimento é checkbox obrigatório,
validado no servidor. Erros ao usuário são amigáveis — nunca stack/SQL/UUID.

### Versão do formulário

Mudança estrutural no builder (adicionar/remover/reordenar campo, mudar
`required`/tipo/opções/chave) incrementa `programs.form_version`. Cada
`applications` grava a versão vigente + o `field_snapshot`.
