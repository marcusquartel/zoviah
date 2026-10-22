-- Zoviah — match Shopify webhooks by the shop's permanent domain.
--
-- Webhooks carry X-Shopify-Shop-Domain = the shop's permanent
-- "<id>.myshopify.com", which differs from the alias a merchant may type on
-- connect (e.g. rarewaycosmeticos.myshopify.com vs 9m0mnq-i9.myshopify.com).
-- The lookup only knew the typed one, so every webhook was acknowledged and
-- dropped. Store the permanent domain too and match either.

alter table public.shopify_connections
  add column myshopify_domain text unique
    check (myshopify_domain is null or myshopify_domain ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$');

create or replace function public.shopify_connection_secrets(p_shop_domain text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.shopify_connections%rowtype;
  v_domain text := lower(btrim(coalesce(p_shop_domain, '')));
begin
  select * into r from public.shopify_connections
  where (shop_domain = v_domain or myshopify_domain = v_domain)
    and status <> 'disconnected'
  limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'organization_id', r.organization_id, 'shop_domain', r.shop_domain,
    'client_id', r.client_id, 'secret_enc', r.secret_enc,
    'token_enc', r.token_enc, 'token_expires_at', r.token_expires_at
  );
end;
$$;

-- Recorded by the server after it asks Shopify for shop.myshopifyDomain.
create or replace function public.shopify_set_myshopify_domain(
  p_org uuid, p_ingest_key text, p_domain text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_domain text := lower(btrim(coalesce(p_domain, '')));
begin
  perform public.assert_shopify_ingest_key(p_org, p_ingest_key);
  if v_domain !~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$' then raise exception 'INVALID_SHOP_DOMAIN'; end if;
  update public.shopify_connections
     set myshopify_domain = v_domain, updated_at = now()
   where organization_id = p_org and myshopify_domain is distinct from v_domain;
end;
$$;
revoke all on function public.shopify_set_myshopify_domain(uuid, text, text) from public;
grant execute on function public.shopify_set_myshopify_domain(uuid, text, text) to anon, authenticated;
