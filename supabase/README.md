# supabase/

SQL versionado da Zoviah.

```
migrations/
  20260827000001_foundation.sql   tabelas, constraints, índices, triggers
  20260827000002_rls.sql          is_organization_member/_admin, RLS, policies
bootstrap.sql                     cria a 1ª organização (Rare Way) + owner
```

## Aplicar as migrations

**Supabase CLI**

```bash
supabase link --project-ref <ref>
supabase db push
```

**Ou pelo SQL Editor:** cole o conteúdo de cada arquivo de `migrations/` na
ordem do timestamp.

## Bootstrap do primeiro usuário

1. Crie o usuário em *Authentication → Users* no dashboard.
2. No SQL Editor, cole `bootstrap.sql`, troque `REPLACE_WITH_USER_EMAIL` e
   rode. O SQL Editor roda como `postgres` e ignora RLS — é o caminho de
   operador previsto.

O script é idempotente (upsert por `slug` e por `(organization_id, user_id)`).

## Regenerar os tipos TypeScript

Depois que o schema estiver no ar:

```bash
npx supabase gen types typescript --project-id <ref> > ../src/types/database.ts
```

O `src/types/database.ts` atual é escrito à mão com a mesma forma da saída do
gerador, então a troca é direta.

## Storage

O Supabase Storage será usado para logo/favicon numa fase futura. Nenhum
bucket é criado agora.
