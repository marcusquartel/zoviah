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

---

# Fase 2 — CRM operacional

## Máquina de estados da `applications`

`status` agora aceita: `new`, `awaiting_review`, `information_requested`,
`approved`, `archived` (migration `20260828000001`). `awaiting_address`,
`completed`, `analyzing` ficam para depois.

Rótulos: Nova / Aguardando avaliação / Informações solicitadas / Aprovada /
Arquivada.

Transições válidas (fonte de verdade =
`public.is_valid_application_transition(from, to)`, espelhada e testada em
`src/features/applications/status.ts`):

```
new                    → awaiting_review | approved | information_requested | archived
awaiting_review        → approved | information_requested | archived
information_requested  → awaiting_review | approved | archived
approved               → archived
archived               → awaiting_review   (reabrir)
```

Colunas novas: `applications.approved_at`, `creator_events.actor_user_id` (quem
fez a ação; nulo na submissão pública).

`approved_at` reflete a **aprovação atual** da application, não é histórico
(o histórico fica em `creator_events`). Regra na função de transição
(migration `20260828000002`): `→ approved` grava `now()`; `approved → archived`
preserva; qualquer volta a estado pré-decisão
(`awaiting_review` / `information_requested`) zera; uma nova aprovação grava
`now()` de novo.

## Mudança de status — fonte única

O frontend **nunca** faz `update applications set status = …`. Toda transição
passa por `public.transition_application_status(p_application_id, p_to_status,
p_note?)` — `SECURITY DEFINER`, `search_path = ''`:

1. exige `auth.uid()`;
2. deriva a org **da própria linha** da application (nunca confia em org vinda
   do cliente);
3. exige que o usuário seja **membro** dessa org (qualquer papel — owner, admin
   ou analyst; a policy da Fase 1 só deixava owner/admin dar `UPDATE` direto,
   por isso a operação de CRM vai por RPC);
4. valida a transição na tabela;
5. atualiza a linha + insere `creator_events` (`application_status_changed`,
   `data = {from, to, actor_email}`, `actor_user_id`) — e, se veio nota, um
   `note_added` — **atomicamente** (corpo plpgsql = 1 transação).

`public.add_creator_note(p_creator_id, p_text, p_application_id?)` segue o mesmo
padrão e grava `creator_events` tipo `note_added`. Nenhuma tabela nova para
notas (§8).

O server action `transitionApplicationStatus` / `addCreatorNote`
(`src/features/creators/actions.ts`) valida o payload com Zod e chama a RPC com
o client RLS-scoped. RLS continua sendo a última barreira.

## Timeline

`creator_events` (já existia) é o histórico. Tipos usados: `application_submitted`
(Fase 1), `application_status_changed`, `note_added`. **Sem** eventos
redundantes tipo `application_approved` — o `to` do `application_status_changed`
já diz. Não é event sourcing: a tabela é só auditoria/histórico.
`src/features/creators/components/timeline.tsx` renderiza (mais recente
primeiro), limite 50.

## Estratégia de consulta da lista

`/app/creators` mostra **applications** (com a creator embutida) — uma linha =
uma inscrição (§11).

- **View `public.application_list_items`** (`security_invoker = true`) achata,
  por application: creator (nome, contato, cidade/UF), programa, e o **top
  perfil de Instagram e de TikTok** (via `left join lateral … limit 1`).
  `security_invoker` é obrigatório: sem ele a view rodaria como `postgres` e
  **furaria a RLS** entre tenants; com ele, as policies `_select_member` de
  `applications`/`programs`/`creators`/`creator_social_profiles` valem para
  quem consulta.
- A listagem é **uma** `select` na view — sem N+1 por construção. Filtros
  (`program`, `status`, `possible_duplicate`, `cidade`/`UF` via `ilike`,
  tem-Instagram / tem-TikTok via `not is null`), busca (`or(ilike)` em nome /
  preferido / e-mail / telefone / handles) e ordenação (recentes, antigas,
  nome, maior IG, maior TikTok) são resolvidos no banco.
- **Paginação**: offset (`range`), 50/página, botão "Carregar mais"; busca 51
  para saber se há próxima. (Keyset é a otimização futura se a base passar de
  algumas dezenas de milhares — a maioria do uso é filtrada.)
- **Busca textual**: só PostgreSQL. Índices GIN `pg_trgm` em
  `creators.full_name/email/phone_e164` e `creator_social_profiles.handle_normalized`.
- **Contadores** (`/app/creators` e `/app`): RPC `public.crm_counts(program?)`
  — `security invoker`, uma ida ao banco, `count(*) filter (…)` por status; RLS
  limita ao tenant.
- `answers` e a timeline **nunca** entram na listagem. O Drawer busca o detalhe
  sob demanda (`loadDrawerData` server action).

## Drawer

`Sheet` lateral (tela cheia no mobile). Abas Resumo / Cadastro / Redes /
Respostas / Histórico, cada uma um componente pequeno em
`src/features/creators/components/drawer/`. A aba **Respostas** reconstrói
`label → valor` a partir de `applications.field_snapshot` (capturado na
submissão), então continua legível mesmo se o formulário do programa mudou
depois (§24 — a Fase 1 já armazenava o snapshot, nenhuma migration foi
necessária para isso).

## Hardening de handles (§23)

`normalizeHandle` agora também: remove `@` em qualquer posição, remove espaços
internos, remove caracteres fora de `[a-z0-9._]` (inválidos em usernames de
IG/TikTok) e **apara `.`/`_` das bordas** — foi o caso `@quarteldesign.` →
antes `quarteldesign.`, agora `quarteldesign`. Um `.` no meio (`marcus.creator`)
é preservado. `normalizeHandle(v, "instagram"|"tiktok")` também limita o
comprimento. `isPlausibleHandle` faz validação **suave** (só para avisos na UI —
nunca rejeita submissão). A migration faz um `update` pontual e seguro nos
handles já gravados com borda inválida.

## RLS da Fase 2

Sem novas policies de tabela. Leitura do CRM usa as policies `_select_member`
da Fase 1 (analyst já lia). Escrita (status, nota) vai pelas RPCs
`SECURITY DEFINER` que checam **membership** (qualquer papel) — essa é a "menor
migration necessária" do §34 para o analyst operar, sem enfraquecer nenhuma
policy. `crm_counts` e a view são `security invoker` → RLS vale. Sem
cross-tenant em nenhum caminho (provado por `tests/phase2.crm.test.ts`).

---

# Fase 3A — Motor de inteligência (Creator Score)

## Três camadas, separadas de propósito

```
EVIDÊNCIA (payload sanitizado)
   ├─► CRITÉRIOS DETERMINÍSTICOS  (src/features/analysis/objective.ts)   — 60 pts
   └─► CRITÉRIOS QUALITATIVOS     (Claude, via src/lib/anthropic/)       — 40 pts
                    │
                    ▼
   SCORE ENGINE DETERMINÍSTICO   (src/features/analysis/score-engine.ts — PURO)
                    │
        score preliminar · evidence coverage · confidence · tier
                    │
                    ▼
            DECISÃO HUMANA  (status da application — separado)
```

**A IA nunca calcula o score.** Ela devolve, por critério qualitativo,
`{score|null, coverage, evidence_status, rationale, evidence_used}` — e mais
`summary`, `strengths`, `attention_points`, `suggested_tags`. Campos como
`overall_score`, `tier`, `confidence`, `approval` são **descartados** se
aparecerem (`qualitative-schema.ts`). O backend combina objetivo + qualitativo
e roda o engine.

## Score canônico (`src/features/analysis/criteria.ts` — fonte única)

| Critério | Peso | Camada |
|---|---|---|
| performance | 25 | determinística |
| content_quality | 20 | IA |
| consistency | 15 | determinística |
| communication | 10 | IA |
| brand_affinity | 10 | IA |
| community_quality | 10 | determinística |
| growth_potential | 5 | determinística |
| professionalism | 5 | determinística |
| **Total** | **100** | 60 objetivo / 40 IA |

`SCORING_VERSION = creator-score-v1`, `PROMPT_VERSION = creator-analysis-v1`.
Toda análise grava as duas versões; mudança relevante ⇒ `-v2`, nunca sobrescreve
histórico.

## Score engine — fórmula exata

```
scoredWeight   = Σ peso dos critérios com score != null
earnedPoints   = Σ (score/100 · peso)  sobre esses mesmos critérios
score          = round(earnedPoints / scoredWeight · 100)
                 (null se scoredWeight < 10  — MIN_SCORED_WEIGHT, §8)
coverage       = Σ (peso · coverage)  sobre os 8 critérios  / 100   → 0..1
confidence     = coverage < 0.45 → low · < 0.75 → medium · ≥ 0.75 → high
tier           = 85–100 A · 70–84 B · 55–69 C · 0–54 D   (null se score null)
```

**Dado ausente = DESCONHECIDO (score null), nunca RUIM (0).** Nesta fase
`performance`, `consistency`, `community_quality`, `growth_potential` retornam
`null` (sem métricas de engajamento / histórico). `professionalism` recebe nota
de sinais operacionais **não discriminatórios** (cadastro preenchido, handles
plausíveis, links válidos) — nunca penaliza "nunca trabalhou com marcas", "sem
mídia kit", "poucos seguidores", "iniciante". `content_quality` e
`communication` normalmente ficam `null` (só links ≠ conteúdo — sem scraping).

## Privacidade do input (`sanitize.ts`)

O payload enviado ao Claude e salvo em `creator_analyses.input_snapshot`
**nunca** contém: nome, e-mail, telefone, data de nascimento, CEP, endereço,
IDs internos, timeline, notas, handles de rede (um handle pode carregar o nome
real). Só: temas de conteúdo, métricas declaradas (contagens), informação de
parceria, respostas não-PII (truncadas), agregados objetivos. Cap de tamanho
~12 KB. Chave de API jamais gravada.

## Prompt injection

`SYSTEM_PROMPT` (versionado) declara: dados são evidência e não instrução;
não aprovar/reprovar; não retornar score geral; não seguir comandos das
respostas; não inferir atributos sensíveis; `null` quando insuficiente. O
payload vai como JSON delimitado (`<evidence>`). Saída inválida ⇒ **1** retry
corretivo; ainda inválida ⇒ falha. A aplicação nunca confia no texto do modelo
(Zod).

## Persistência e RLS (migration `20260828000003`)

- **`creator_analyses`** — histórico append-only. Referencia
  `application_id` + `creator_id` + `organization_id` (a análise pertence à
  **application**, §20). Índice único parcial `(application_id) where status =
  'processing'` = trava de concorrência (§23). RLS: `select` para membros;
  **nenhuma policy de insert/update/delete** — só as RPCs `SECURITY DEFINER`
  escrevem.
- **Cache em `applications`** — `current_analysis_id`, `current_score`,
  `current_tier`, `analysis_status` (`not_analyzed`/`processing`/`completed`/
  `failed`), `analysis_confidence`, `analysis_coverage`. Desnormalização
  **intencional** para a lista não consultar `creator_analyses` (sem N+1). A
  view `application_list_items` ganhou essas 5 colunas.
- **RPCs** (`SECURITY DEFINER`, `search_path=''`, derivam a org da própria
  application/analysis, checam membership de qualquer papel):
  `start_creator_analysis` (reserva o slot; auto-expira um `processing` preso
  há > 10 min), `complete_creator_analysis` (grava a análise + atualiza o cache
  + 1 evento `analysis_completed`, atômico), `fail_creator_analysis` (marca
  `failed`; **não** apaga `current_*` — a última análise concluída permanece).
  `analysis_stats` (`security invoker`, contadores de `/app/ai`).

## Fluxo Anthropic (§41, §42)

`analyzeApplication(applicationId)` (server action): membership → detalhe via
RLS → sanitiza + calcula objetivo → **`start_creator_analysis`** (curto) →
**chamada externa fora de qualquer transação** (`runQualitativeAnalysis`,
timeout 60 s, `maxRetries: 1` no SDK) → combina + engine →
**`complete_creator_analysis`** (curto). Qualquer falha após reservar o slot ⇒
`fail_creator_analysis`; nunca fica `processing` eterno. **Nenhuma submissão
pública dispara IA** — só o clique da equipe (§39).

`ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL` são server-only. Sem elas: "IA não
configurada", CRM intacto. O nome do modelo real usado é gravado em cada
análise; `input_tokens` / `output_tokens` / `latency_ms` também (§35).

## Reanálise

Botão "Reanalisar" cria uma **nova** `creator_analyses` (nunca sobrescreve).
`current_analysis_id` passa a apontar para a mais recente **concluída**;
histórico completo fica na aba Inteligência → Histórico.

---

# Fase 3B — Evidence Layer

Fase de **coleta de evidência**, não de pontuação. O objetivo é acumular
observações reais de métricas sociais (com proveniência e histórico) para,
numa fase futura própria, calibrar o `creator-score-v2` a partir da
distribuição real. **O score não muda nesta fase.**

## O que NÃO mudou (garantido por teste — §68)

`creator-score-v1` está congelado: `SCORING_VERSION = "creator-score-v1"`,
pesos idênticos (25/20/15/10/10/10/5/5), `objective.ts` intacto —
`performance` / `consistency` / `community_quality` / `growth_potential`
continuam retornando `score: null, coverage: 0`. `tests/phase3b.regression.test.ts`
fixa a saída do engine para um conjunto de critérios de referência.
Só o **prompt** mudou de forma material (passou a reconhecer métricas
observadas como contexto factual), então `PROMPT_VERSION` avançou para
`"creator-analysis-v2"`; análises antigas mantêm o `v1` gravado e nada é
reprocessado.

## Metric Snapshots (migration `20260828000004`)

**`social_metric_snapshots`** — uma observação de um perfil social num ponto
no tempo. Uma linha por observação (append-only na prática; há `update` para
correção). Campos: `followers`, `average_views`, `median_views`,
`views_sample` (jsonb, array de contagens de views recentes), `average_likes`
/`_comments`/`_shares`/`_saves`, `reach`, `interactions`, `posts_count`,
`period_days` (1–365), `observed_at` (pode ser no passado; `default now()`;
data absurda no futuro é rejeitada na RPC), `notes`. Constraint
`social_metric_snapshots_has_metric` impede snapshot vazio. `platform` **não**
é duplicado — deriva-se via `social_profile_id` (§9). Índices:
`(social_profile_id, observed_at desc, created_at desc)` e
`(organization_id, created_at desc)`.

`views_sample` é a **única** entrada de views persistida como texto do
usuário; `median_views` e `average_views` são **sempre** recalculados no
servidor (SQL `percentile_cont` / `avg` via `jsonb_int_median` /
`jsonb_int_avg`) — a preview no cliente é cosmética (§11). Mediana:
ímpar → valor do meio; par → média dos dois centrais (`[10,20,30,40] → 25`).
Amostra: 1–30 inteiros ≥ 0; NaN / string / negativo são descartados, nunca
viram 0 (§14). O parser pt-BR (`parse-views.ts`) lê `"7.100"` como `7100`
(separador de milhar), não `7.1`.

`followers` do snapshot é o **valor observado**;
`creator_social_profiles.followers_declared` **nunca** é sobrescrito — a
distinção declarado × observado é preservada de propósito (§15).

## Proveniência (`source`)

Enum `declared | admin_manual | creator_provided | import | api`. É **só
proveniência** — não é qualidade, não entra no score, não gera "Data Quality
Score" (§7, §55). `admin_manual` é o fluxo principal desta fase. Múltiplos
snapshots na mesma data são permitidos (a origem diferencia, §77).

## Métricas derivadas (`src/features/evidence/metrics.ts` — puro)

Sem I/O, sem score. Toda função retorna `null` quando falta a entrada
(nunca 0, nunca chute): `viewRate` (= `median_views / followers`, **não** é
"engajamento"), `engagementByFollowers` e `engagementByReach` (os dois
denominadores são expostos lado a lado — nenhum é a taxa "oficial"),
`postsPerWeek` (= `posts_count / period_days * 7`), `followerGrowth`
(absoluto sempre; taxa só quando o snapshot anterior tem `followers > 0`;
usa o snapshot anterior por `observed_at` do **mesmo** perfil — não mistura
plataformas). Métricas nunca viram nota.

## RLS e RPCs

`social_metric_snapshots` com RLS: `select` para membros da org; **nenhuma
policy de escrita** — só as RPCs `SECURITY DEFINER` (`search_path=''`)
gravam. `create_metric_snapshot(p_social_profile_id, p_payload)` e
`update_metric_snapshot(p_snapshot_id, p_payload)` derivam
`organization_id` / `creator_id` / `platform` do próprio perfil (ou da linha
do snapshot) — o cliente **não** envia `organization_id` (§58). Checam
`auth.uid()` + membership de qualquer papel (owner/admin/analyst). Recalculam
mediana/média. Escrevem um evento de timeline mínimo
(`metric_snapshot_added` / `_updated` com `snapshot_id`, `social_profile_id`,
`platform`, `source`, `observed_at` — sem PII). Timeline legível:
"Métricas do Instagram adicionadas."

View **`latest_metric_snapshots`** (`security_invoker`) — `distinct on
(social_profile_id)` ordenado por `observed_at desc, created_at desc`.

`evidence_stats()` (`security invoker`) — contadores de `/app/ai`: total de
snapshots, creators com snapshot, perfis com 2+ snapshots.

## Crescimento histórico

`follower_growth_*` compara o snapshot mais recente com o anterior do mesmo
perfil (por `observed_at`). Taxa só existe com base anterior > 0. A UI mostra
"Atualizado há X dias"; badge "Dados antigos" quando > 90 dias — **efeito só
de UX**, zero efeito no score (§54). Diferença grande entre observado e
declarado exibe "Valor observado difere do valor informado no cadastro." —
sem acusação de fraude, sem penalidade (§50).

## Enriquecimento da análise (sem mudar o score)

`analyzeApplication` busca o snapshot mais recente (+ o anterior, para
crescimento) por plataforma e passa para `sanitizeEvidence`.
`objective_metrics.social` no payload ganha só **números derivados**
(`followers`, `median_views`, `median_view_rate`, `posts_per_week`,
`engagement_by_followers`/`_by_reach`, `follower_growth_rate`,
`snapshot_age_days`, `source`) — **sem** handle, nome, e-mail, telefone ou ID
interno. `input_snapshot` continua sendo exatamente o que foi enviado ao
modelo; a auditoria de *quais* snapshots alimentaram a análise fica separada
em `creator_analyses.used_snapshot_ids uuid[]` (§49). O `SYSTEM_PROMPT`
proíbe transformar métrica em nota, criar benchmark ou afirmar
fraude/bot/seguidor falso — o modelo pode citar um valor como contexto
factual e nada além disso.

## UI

Aba **Métricas** no modal do creator (ordem: Resumo · Inteligência · Cadastro
· Redes · **Métricas** · Respostas · Histórico). Modal continua modal (não
virou drawer); ScoreBar fixa no topo. Por perfil: handle, seguidores
declarados, e do snapshot mais recente — seguidores observados, mediana/média
de views, view rate, posts/semana, engajamento (quando houver), data e
origem. `—` para ausente, nunca 0. Tabela de histórico (Data, Seguidores,
Mediana views, View rate, Posts/sem, Origem; mais recente primeiro; sem
gráficos; "Carregar mais" de 10 em 10, §73). Botão "Adicionar métricas" por
perfil abre um `Dialog` **dentro** do modal, com preview ao vivo da amostra
de views ("Amostra: 5 conteúdos · Mediana: 7.500 · Média: 7.780"). Snapshot
é editável (mesmo formulário pré-preenchido); **sem** delete destrutivo no
MVP (§75).

Aba **Inteligência** ganhou "Evidências" (✓/— por tipo de dado) e "Dados que
ainda faltam" (por critério `null`, com o porquê) — explica por que um
critério está "dados insuficientes" sem inventar nota. A ScoreBar mostra
"Novas evidências" quando `max(social_metric_snapshots.created_at) >
current_analysis.created_at`; o botão é "Reanalisar" se já há análise, senão
"Analisar creator". Adicionar snapshot **não** dispara o Claude (§43).

Carregamento da aba Métricas é **sob demanda** — a lista do CRM não ganhou
join de snapshot (§72).

## Futuro — calibração do `creator-score-v2`

Fase própria, não agora: com massa de snapshots, derivar percentis /
benchmarks por plataforma e faixa de seguidores e então pontuar
`performance` / `consistency` / `community_quality` / `growth_potential` a
partir da distribuição real — substituindo os `null` atuais. O ponto de
extensão é `objective.ts` (os quatro critérios já existem, só retornam
`null`). Nada de thresholds arbitrários antes dessa fase.

---

# Fase 4 — Aprovação → solicitação segura de endereço → cadastro completo

Fecha o ciclo operacional do MVP: uma creator aprovada recebe um link privado,
preenche o endereço de envio numa página pública fora do painel, e a
`application` chega a `completed`. Nenhuma logística, transportadora, e-mail ou
WhatsApp — só a coleta segura do dado.

## Status da application

Dois estados novos: `awaiting_address` ("Aguardando endereço") e `completed`
("Cadastro completo"). Fluxo principal:

```
new → awaiting_review → approved → awaiting_address → completed
```

`is_valid_application_transition` (migration `20260829000002`) conhece o grafo
completo, incluindo `approved → awaiting_address`, `awaiting_address →
completed` e `awaiting_address → approved`. **Essas três arestas são
"secure-only"**: `transition_application_status` as recusa para um chamador
manual (`USE_ADDRESS_REQUEST_FLOW`) — só acontecem dentro das RPCs de
solicitação de endereço, atômicas com a criação/revogação do token. A UI
espelha isso: `nextStatuses()` remove as arestas secure-only dos dropdowns.

`approved_at` é preservado em `approved → awaiting_address → completed`. Só a
reabertura para avaliação (fluxo da Fase 2) o zera. Arquivar uma application em
`awaiting_address` também revoga a request pendente (invariante
"`awaiting_address` ⟺ request `pending` viva").

## application_requests

Uma solicitação suplementar com token. `request_type` só admite
`shipping_address` nesta fase (não é motor genérico de formulários privados).
`status`: `pending | completed | expired | revoked`. Índices: `unique
(token_hash)`; `unique (application_id, request_type) where status = 'pending'`
(no máximo uma request viva); `(application_id, created_at desc)` e
`(organization_id, status, created_at desc)`. RLS: membros leem as da própria
org; escrita só via RPC. `expires_at` = `now() + 7 dias`
(`ADDRESS_REQUEST_TTL_DAYS`, centralizado na migration).

## Segurança do token

- **Entropia**: `crypto.randomBytes(32)` → base64url (~256 bits). Nunca
  application UUID, creator UUID, e-mail, telefone ou slug previsível.
- **Hash**: o banco só guarda `sha256(raw)` em hex (`application_requests.token_hash`).
  O raw existe apenas no escopo da server action, na URL mostrada ao admin e na
  URL que a creator recebe. **Não é recuperável** — perdeu, gera outro.
- **Expiração**: 7 dias. `get_public_address_request` / `complete_address_request`
  marcam um `pending` vencido como `expired` na hora e recusam.
- **Revogação**: `revoke_address_request` → request `revoked`, application volta
  a `approved`.
- **Regeneração**: `regenerate_address_request` revoga o token anterior e cria
  um novo numa única transação; a application continua em `awaiting_address`
  (sem bounce artificial de status).
- **Uso único**: depois de `completed`, o token é idempotente — uma nova
  submissão retorna `already_completed` e não cria segundo endereço.

## creator_addresses

O endereço pertence à **creator** (atributo da pessoa no tenant), não à
application; `source_request_id` registra de qual request veio. Histórico
versionado: `unique (organization_id, creator_id) where is_current`. CHECK de
tamanho em cada campo, `postal_code ~ '^[0-9]{8}$'`, `state ~ '^[A-Z]{2}$'`,
`country = 'BR'`. RLS: membros leem os da própria org; escrita só via RPC.

## Fluxo público

Rota `/complete/[token]` (sem IDs na URL). O Server Component resolve
`sha256(token)` e chama `get_public_address_request` (SECURITY DEFINER, anon) —
que devolve **só** branding da org, nome do programa, `expires_at` e um status
grosseiro. Token inexistente / inválido / revogado / expirado colapsam todos em
`invalid` com a mesma mensagem ("Este link não está mais disponível ou
expirou"), sem enumeração.

`next.config.ts` serve `/complete/:token*` com `Cache-Control: no-store`,
`Referrer-Policy: no-referrer` e `X-Robots-Tag: noindex`. O formulário
(mobile-first, labels reais, `autocomplete`, honeypot) envia via
`complete_address_request` (SECURITY DEFINER, anon, rate-limit por IP):

1. lock da request pelo hash; 2. valida status/expiração/tipo; 3. valida
`application.status = awaiting_address`; 4. normaliza (CEP → 8 dígitos, UF →
2 maiúsculas, trim) e valida; 5. exige consentimento; 6. marca o endereço
current anterior como `is_current = false`; 7. insere o novo; 8. request →
`completed` (+ `completed_at`, `consent_at`); 9. application → `completed`;
10. evento `address_submitted` (`actor_user_id = null`, `source =
public_secure_request`, **sem endereço**). Tudo ou nada.

## CRM / Modal

Nova aba **Endereço** no modal (ordem: Resumo · Inteligência · Cadastro · Redes
· Métricas · **Endereço** · Respostas · Histórico), carregada sob demanda — a
lista do CRM nunca toca `application_requests` / `creator_addresses`. Estados:
`approved` → botão "Solicitar endereço" (mostra o link uma vez, com aviso de
não-recuperável); `awaiting_address` → "Gerar novo link" / "Revogar
solicitação" + data de criação/expiração; `completed` → endereço atual em
layout copiável. Histórico de solicitações (Criada / Status / Expira /
Concluída / Revogada / Criada por) — **nunca** o token/hash. Contadores da CRM
e colunas do Kanban ganham "Aguardando endereço" e "Cadastros completos".

## PII

`creator_addresses` é PII operacional: **nunca** vai para logs, analytics,
`creator_events`, Anthropic, mensagens de erro ou URL. `buildClaudePayload` não
tem caminho para endereço (teste de regressão em `analysis-sanitize.test.ts`).
`city` / `state` do cadastro inicial seguem a política de privacidade que já
existia; `creator_addresses` jamais entra automaticamente em qualquer payload.
Sem política de retenção automática nesta fase (documentado como pendência
consciente).

## RLS / anon

`application_requests` e `creator_addresses`: RLS obrigatória, `select` só para
membros da org, escrita só pelas RPCs. Nenhuma policy anon. Anon só executa
`get_public_address_request` e `complete_address_request`. Cross-tenant
coberto: org B não vê/gera/revoga request ou endereço de org A.
