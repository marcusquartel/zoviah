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
