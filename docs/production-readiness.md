# Production readiness — deploy checklist

Técnico. O que precisa estar em pé **antes** de apontar um cliente pagante para
a instância de produção. Este documento não instala nada — é a lista de
verificação.

## Variáveis de ambiente

| Variável | Onde | Obrigatória em prod | Notas |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | sim | anon / publishable key |
| `NEXT_PUBLIC_APP_URL` | browser + server | **sim** | URL absoluta do app. Em prod NÃO pode ser localhost (validado em `src/lib/app-url.ts`). Usada nos links de `/complete/<token>` e `/invite/<token>` |
| `SUPABASE_SERVICE_ROLE_KEY` | server / scripts | não (só testes e scripts admin) | **nunca** importar em `src/` |
| `ANTHROPIC_API_KEY` | server | opcional | sem ela o CRM funciona; "Analisar creator" fica indisponível |
| `ANTHROPIC_MODEL` | server | opcional | ex.: `claude-sonnet-5` |
| `ANTHROPIC_WORKSPACE_ID` | server | opcional | só para API keys identity-linked |
| `NEXT_PUBLIC_TERMS_URL` | browser | recomendada | link nos rodapés públicos |
| `NEXT_PUBLIC_PRIVACY_POLICY_URL` | browser | recomendada | idem |

## Banco de dados

- [ ] Todas as migrations de `supabase/migrations/` aplicadas, em ordem de
      timestamp (via `supabase db push` ou colando cada arquivo no SQL Editor).
- [ ] `bootstrap.sql` rodado para o primeiro owner / primeira organização.
- [ ] Ao menos um `platform_admins` inserido (SQL Editor):
      `insert into platform_admins (user_id) select id from auth.users where email = 'operador@…';`
- [ ] Regenerar `src/types/database.ts` se o schema divergir do hand-written
      (`npx supabase gen types typescript`).

## DNS / domínio

- [ ] Domínio de produção apontando para o host (Vercel/etc.).
- [ ] `NEXT_PUBLIC_APP_URL` = esse domínio, com https.
- [ ] Custom domain por tenant: **fora de escopo** desta fase.

## Backups

- [ ] Confirmar a política de backup do plano Supabase em uso (point-in-time
      recovery a partir do plano Pro). **Não** há backup engine no app —
      documentar a janela de retenção e testar um restore antes do go-live.

## Error monitoring

- [ ] Integrar Sentry (ou equivalente) — **não** instalado ainda. Requisito
      pré-lançamento: capturar exceções de Server Actions / RPCs em produção.

## Segurança

- [ ] `SUPABASE_SERVICE_ROLE_KEY` só em variáveis de ambiente do runtime de
      scripts/CI, nunca no bundle do browser (`grep -r SERVICE_ROLE src/` = vazio).
- [ ] `ANTHROPIC_API_KEY` nunca com prefixo `NEXT_PUBLIC_`.
- [ ] Rodar `npm run lint && npm run typecheck && npm test && npm run build`
      verde. `npm run test:anthropic:smoke` roda 1 chamada real, sob demanda.

## Legal

- [ ] Termos de Serviço e Política de Privacidade **revisados por jurídico** e
      publicados. Este repositório **não** contém texto jurídico aprovado —
      só linka `NEXT_PUBLIC_TERMS_URL` / `NEXT_PUBLIC_PRIVACY_POLICY_URL` no
      rodapé das páginas públicas quando configurados.
