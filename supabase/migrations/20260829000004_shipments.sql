-- Creator Hub — Phase 5: operational management of product seeding (shipments).
--
-- Answers "who gets what, to which address, when did we ship, did it arrive?".
-- NOT an ERP: no inventory, no product catalog, no carrier integration, no
-- labels, no freight. A shipment is its own entity — it NEVER touches
-- applications.status (an application stays `completed` forever). The recipient
-- address is SNAPSHOTTED server-side at creation so an old shipment keeps the
-- address it actually used. address_snapshot / internal_notes / tracking are
-- PII/operational: never in the list view, never in creator_events, never in a
-- Claude payload. No migration edited.

-- ===========================================================================
-- 1. shipments
-- ===========================================================================
create table public.shipments (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  creator_id        uuid not null references public.creators (id) on delete cascade,
  application_id    uuid not null references public.applications (id) on delete cascade,

  -- The creator_addresses row this shipment was built from, plus a frozen copy
  -- of it (server-built, never accepted from the client).
  source_address_id uuid not null references public.creator_addresses (id) on delete restrict,
  address_snapshot  jsonb not null,

  status            text not null
                      check (status in ('draft', 'preparing', 'shipped', 'delivered', 'cancelled')),

  carrier           text check (carrier is null or char_length(carrier) between 1 and 120),
  tracking_code     text check (tracking_code is null or char_length(tracking_code) between 1 and 120),
  tracking_url      text check (tracking_url is null or tracking_url ~* '^https?://'),
  internal_notes    text check (internal_notes is null or char_length(internal_notes) <= 2000),

  shipped_at        timestamptz,
  delivered_at      timestamptz,
  cancelled_at      timestamptz,

  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- The snapshot must at least carry the always-present address fields.
  constraint shipments_address_snapshot_shape check (
    jsonb_typeof(address_snapshot) = 'object'
    and address_snapshot ?& array[
      'recipient_name', 'postal_code', 'street', 'number',
      'neighborhood', 'city', 'state', 'country'
    ]
  )
);

create index shipments_org_status_created_idx
  on public.shipments (organization_id, status, created_at desc);
create index shipments_application_created_idx
  on public.shipments (application_id, created_at desc);
create index shipments_creator_created_idx
  on public.shipments (creator_id, created_at desc);

create trigger shipments_set_updated_at
  before update on public.shipments
  for each row execute function public.set_updated_at();

alter table public.shipments enable row level security;

-- Members read shipments of their own org. Writes: RPC only (no policy).
create policy shipments_select_member
  on public.shipments for select to authenticated
  using (public.is_organization_member(organization_id));

-- ===========================================================================
-- 2. shipment_items — snapshot of what was sent (no catalog).
-- ===========================================================================
create table public.shipment_items (
  id              uuid primary key default gen_random_uuid(),
  shipment_id     uuid not null references public.shipments (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,

  item_name       text not null check (char_length(item_name) between 1 and 200),
  sku             text check (sku is null or char_length(sku) between 1 and 100),
  quantity        integer not null check (quantity between 1 and 999),
  position        integer not null,

  created_at      timestamptz not null default now()
);

create index shipment_items_shipment_position_idx
  on public.shipment_items (shipment_id, position);

alter table public.shipment_items enable row level security;

create policy shipment_items_select_member
  on public.shipment_items for select to authenticated
  using (public.is_organization_member(organization_id));

-- ===========================================================================
-- 3. shipment_list_items — flattened operational list row.
-- security_invoker: RLS of the base tables applies. NEVER exposes
-- address_snapshot / internal_notes (§48).
-- ===========================================================================
create view public.shipment_list_items
with (security_invoker = true) as
select
  s.id,
  s.organization_id,
  s.creator_id,
  s.application_id,
  s.status,
  s.carrier,
  s.tracking_code,
  s.tracking_url,
  s.created_at,
  s.shipped_at,
  s.delivered_at,
  a.program_id,
  p.name       as program_name,
  c.full_name  as creator_name,
  c.email      as creator_email,
  coalesce(it.item_count, 0)     as item_count,
  coalesce(it.total_quantity, 0) as total_quantity,
  it.first_item_name
from public.shipments s
join public.creators c     on c.id = s.creator_id
join public.applications a on a.id = s.application_id
join public.programs p     on p.id = a.program_id
left join lateral (
  select
    count(*)                                          as item_count,
    sum(i.quantity)                                   as total_quantity,
    (array_agg(i.item_name order by i.position))[1]   as first_item_name
  from public.shipment_items i
  where i.shipment_id = s.id
) it on true;

grant select on public.shipment_list_items to authenticated;

-- ===========================================================================
-- 4. is_valid_shipment_transition — the shipment state machine.
-- delivered→shipped and shipped→preparing are operational corrections
-- (§14, §15); their timestamp resets are handled in transition_shipment_status.
-- ===========================================================================
create or replace function public.is_valid_shipment_transition(
  p_from text, p_to text
)
returns boolean
language sql
immutable
as $$
  select (p_from, p_to) in (
    ('draft', 'preparing'),
    ('draft', 'cancelled'),
    ('preparing', 'draft'),
    ('preparing', 'shipped'),
    ('preparing', 'cancelled'),
    ('shipped', 'delivered'),
    ('shipped', 'preparing'),
    ('delivered', 'shipped'),
    ('cancelled', 'draft')
  );
$$;

grant execute on function public.is_valid_shipment_transition(text, text) to authenticated;

-- ===========================================================================
-- 5. shipment_counts — operational counters, RLS-scoped (security invoker).
-- ===========================================================================
create or replace function public.shipment_counts(p_program_id uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'open',      count(*) filter (where status in ('draft', 'preparing')),
    'draft',     count(*) filter (where status = 'draft'),
    'preparing', count(*) filter (where status = 'preparing'),
    'shipped',   count(*) filter (where status = 'shipped'),
    'delivered', count(*) filter (where status = 'delivered'),
    'cancelled', count(*) filter (where status = 'cancelled')
  )
  from public.shipment_list_items
  where (p_program_id is null or program_id = p_program_id);
$$;

grant execute on function public.shipment_counts(uuid) to authenticated;

-- ===========================================================================
-- Shared helpers for the write RPCs.
-- ===========================================================================

-- Build the frozen address snapshot from a creator_addresses row. Raises
-- NO_CURRENT_ADDRESS when the creator has no usable current address (§6, §69).
create or replace function public.build_address_snapshot(
  p_org uuid, p_creator uuid, out o_address_id uuid, out o_snapshot jsonb
)
language plpgsql
set search_path = ''
as $$
declare
  v_addr public.creator_addresses%rowtype;
begin
  select * into v_addr
  from public.creator_addresses
  where organization_id = p_org and creator_id = p_creator and is_current
  limit 1;

  if not found
     or coalesce(btrim(v_addr.recipient_name), '') = ''
     or v_addr.postal_code !~ '^[0-9]{8}$'
     or coalesce(btrim(v_addr.street), '') = ''
     or coalesce(btrim(v_addr.number), '') = ''
     or coalesce(btrim(v_addr.neighborhood), '') = ''
     or coalesce(btrim(v_addr.city), '') = ''
     or v_addr.state !~ '^[A-Z]{2}$' then
    raise exception 'NO_CURRENT_ADDRESS';
  end if;

  o_address_id := v_addr.id;
  o_snapshot := jsonb_build_object(
    'recipient_name', v_addr.recipient_name,
    'cpf',            v_addr.cpf,
    'postal_code',    v_addr.postal_code,
    'street',         v_addr.street,
    'number',         v_addr.number,
    'complement',     v_addr.complement,
    'neighborhood',   v_addr.neighborhood,
    'city',           v_addr.city,
    'state',          v_addr.state,
    'country',        v_addr.country
  );
end;
$$;

-- Validate + normalize the items array. Raises INVALID_ITEMS on any problem.
-- Returns nothing; callers re-read p_items for the insert.
create or replace function public.assert_valid_shipment_items(p_items jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_len int;
  v_item jsonb;
  v_name text;
  v_sku text;
  v_qty numeric;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_ITEMS';
  end if;
  v_len := jsonb_array_length(p_items);
  if v_len < 1 or v_len > 50 then
    raise exception 'INVALID_ITEMS';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_name := btrim(coalesce(v_item->>'item_name', ''));
    v_sku  := nullif(btrim(coalesce(v_item->>'sku', '')), '');
    v_qty  := nullif(v_item->>'quantity', '')::numeric;

    if v_name = '' or char_length(v_name) > 200 then
      raise exception 'INVALID_ITEMS';
    end if;
    if v_sku is not null and char_length(v_sku) > 100 then
      raise exception 'INVALID_ITEMS';
    end if;
    if v_qty is null or v_qty <> floor(v_qty) or v_qty < 1 or v_qty > 999 then
      raise exception 'INVALID_ITEMS';
    end if;
  end loop;
end;
$$;

-- (re)write the items of a shipment from a validated array.
create or replace function public.write_shipment_items(
  p_shipment_id uuid, p_org uuid, p_items jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_item jsonb;
  v_pos int := 0;
begin
  delete from public.shipment_items where shipment_id = p_shipment_id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.shipment_items (
      shipment_id, organization_id, item_name, sku, quantity, position
    ) values (
      p_shipment_id, p_org,
      btrim(v_item->>'item_name'),
      nullif(btrim(coalesce(v_item->>'sku', '')), ''),
      (v_item->>'quantity')::int,
      v_pos
    );
    v_pos := v_pos + 1;
  end loop;
end;
$$;

-- ===========================================================================
-- 6. create_shipment(application_id, items, internal_notes) — SECURITY DEFINER
-- ===========================================================================
create or replace function public.create_shipment(
  p_application_id uuid,
  p_items          jsonb,
  p_internal_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_org    uuid;
  v_creator uuid;
  v_status text;
  v_email  text;
  v_addr_id uuid;
  v_snap   jsonb;
  v_notes  text := nullif(btrim(coalesce(p_internal_notes, '')), '');
  v_id     uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_notes is not null and char_length(v_notes) > 2000 then
    raise exception 'INVALID_NOTES';
  end if;

  select organization_id, creator_id, status
    into v_org, v_creator, v_status
  from public.applications
  where id = p_application_id
  for update;

  if v_org is null then
    raise exception 'APPLICATION_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.organization_members
    where organization_id = v_org and user_id = v_uid
  ) then
    raise exception 'FORBIDDEN';
  end if;
  if v_status <> 'completed' then
    raise exception 'APPLICATION_NOT_COMPLETED';
  end if;

  perform public.assert_valid_shipment_items(p_items);
  select o_address_id, o_snapshot into v_addr_id, v_snap
  from public.build_address_snapshot(v_org, v_creator);

  insert into public.shipments (
    organization_id, creator_id, application_id,
    source_address_id, address_snapshot, status, internal_notes, created_by
  ) values (
    v_org, v_creator, p_application_id,
    v_addr_id, v_snap, 'draft', v_notes, v_uid
  )
  returning id into v_id;

  perform public.write_shipment_items(v_id, v_org, p_items);

  select email into v_email from auth.users where id = v_uid;
  insert into public.creator_events
    (organization_id, creator_id, application_id, type, actor_user_id, data)
  values (
    v_org, v_creator, p_application_id, 'shipment_created', v_uid,
    jsonb_build_object('shipment_id', v_id, 'actor_email', v_email)
  );

  return jsonb_build_object('ok', true, 'shipment_id', v_id);
end;
$$;

revoke all on function public.create_shipment(uuid, jsonb, text) from public;
grant execute on function public.create_shipment(uuid, jsonb, text) to authenticated;

-- ===========================================================================
-- 7. update_shipment_items(shipment_id, items) — draft/preparing only
-- ===========================================================================
create or replace function public.update_shipment_items(
  p_shipment_id uuid,
  p_items       jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_org    uuid;
  v_status text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select organization_id, status into v_org, v_status
  from public.shipments where id = p_shipment_id for update;

  if v_org is null then
    raise exception 'SHIPMENT_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.organization_members
    where organization_id = v_org and user_id = v_uid
  ) then
    raise exception 'FORBIDDEN';
  end if;
  if v_status not in ('draft', 'preparing') then
    raise exception 'ITEMS_LOCKED';
  end if;

  perform public.assert_valid_shipment_items(p_items);
  perform public.write_shipment_items(p_shipment_id, v_org, p_items);
  update public.shipments set updated_at = now() where id = p_shipment_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.update_shipment_items(uuid, jsonb) from public;
grant execute on function public.update_shipment_items(uuid, jsonb) to authenticated;

-- ===========================================================================
-- 8. update_shipment_tracking(...) — carrier / code / url / notes.
-- Allowed while not cancelled (§27). URL must be http(s) (§26).
-- ===========================================================================
create or replace function public.update_shipment_tracking(
  p_shipment_id    uuid,
  p_carrier        text,
  p_tracking_code  text,
  p_tracking_url   text,
  p_internal_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_org    uuid;
  v_status text;
  v_carrier text := nullif(btrim(coalesce(p_carrier, '')), '');
  v_code   text := nullif(btrim(coalesce(p_tracking_code, '')), '');
  v_url    text := nullif(btrim(coalesce(p_tracking_url, '')), '');
  v_notes  text := nullif(btrim(coalesce(p_internal_notes, '')), '');
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select organization_id, status into v_org, v_status
  from public.shipments where id = p_shipment_id for update;

  if v_org is null then
    raise exception 'SHIPMENT_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.organization_members
    where organization_id = v_org and user_id = v_uid
  ) then
    raise exception 'FORBIDDEN';
  end if;
  if v_status = 'cancelled' then
    raise exception 'SHIPMENT_CANCELLED';
  end if;

  if (v_carrier is not null and char_length(v_carrier) > 120)
     or (v_code is not null and char_length(v_code) > 120)
     or (v_notes is not null and char_length(v_notes) > 2000)
     or (v_url is not null and v_url !~* '^https?://') then
    raise exception 'INVALID_TRACKING';
  end if;

  update public.shipments set
    carrier        = v_carrier,
    tracking_code  = v_code,
    tracking_url   = v_url,
    internal_notes = v_notes,
    updated_at     = now()
  where id = p_shipment_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.update_shipment_tracking(uuid, text, text, text, text) from public;
grant execute on function public.update_shipment_tracking(uuid, text, text, text, text) to authenticated;

-- ===========================================================================
-- 9. transition_shipment_status(shipment_id, to_status) — the ONLY status path.
-- ===========================================================================
create or replace function public.transition_shipment_status(
  p_shipment_id uuid,
  p_to_status   text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_org    uuid;
  v_creator uuid;
  v_app    uuid;
  v_from   text;
  v_email  text;
  v_items  int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select organization_id, creator_id, application_id, status
    into v_org, v_creator, v_app, v_from
  from public.shipments where id = p_shipment_id for update;

  if v_org is null then
    raise exception 'SHIPMENT_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.organization_members
    where organization_id = v_org and user_id = v_uid
  ) then
    raise exception 'FORBIDDEN';
  end if;
  if not public.is_valid_shipment_transition(v_from, p_to_status) then
    raise exception 'INVALID_TRANSITION: % -> %', v_from, p_to_status;
  end if;

  -- A shipment cannot be prepared or shipped with no items (§21).
  if p_to_status in ('preparing', 'shipped') then
    select count(*) into v_items from public.shipment_items where shipment_id = p_shipment_id;
    if v_items < 1 then
      raise exception 'NO_ITEMS';
    end if;
  end if;

  update public.shipments set
    status       = p_to_status,
    shipped_at   = case
                     when p_to_status = 'shipped' then now()
                     when v_from = 'shipped' and p_to_status = 'preparing' then null
                     else shipped_at
                   end,
    delivered_at = case
                     when p_to_status = 'delivered' then now()
                     when p_to_status in ('shipped', 'preparing') then null
                     else delivered_at
                   end,
    cancelled_at = case
                     when p_to_status = 'cancelled' then now()
                     when v_from = 'cancelled' and p_to_status = 'draft' then null
                     else cancelled_at
                   end
  where id = p_shipment_id;

  select email into v_email from auth.users where id = v_uid;
  insert into public.creator_events
    (organization_id, creator_id, application_id, type, actor_user_id, data)
  values (
    v_org, v_creator, v_app, 'shipment_status_changed', v_uid,
    jsonb_build_object('shipment_id', p_shipment_id, 'from', v_from, 'to', p_to_status, 'actor_email', v_email)
  );

  return jsonb_build_object('ok', true, 'from', v_from, 'to', p_to_status);
end;
$$;

revoke all on function public.transition_shipment_status(uuid, text) from public;
grant execute on function public.transition_shipment_status(uuid, text) to authenticated;

-- ===========================================================================
-- 10. refresh_shipment_address(shipment_id) — re-copy the creator's current
-- address. draft/preparing only; immutable once shipped (§10, §92).
-- ===========================================================================
create or replace function public.refresh_shipment_address(
  p_shipment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_org    uuid;
  v_creator uuid;
  v_app    uuid;
  v_status text;
  v_email  text;
  v_addr_id uuid;
  v_snap   jsonb;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select organization_id, creator_id, application_id, status
    into v_org, v_creator, v_app, v_status
  from public.shipments where id = p_shipment_id for update;

  if v_org is null then
    raise exception 'SHIPMENT_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.organization_members
    where organization_id = v_org and user_id = v_uid
  ) then
    raise exception 'FORBIDDEN';
  end if;
  if v_status not in ('draft', 'preparing') then
    raise exception 'ADDRESS_LOCKED';
  end if;

  select o_address_id, o_snapshot into v_addr_id, v_snap
  from public.build_address_snapshot(v_org, v_creator);

  update public.shipments set
    source_address_id = v_addr_id,
    address_snapshot  = v_snap,
    updated_at        = now()
  where id = p_shipment_id;

  select email into v_email from auth.users where id = v_uid;
  insert into public.creator_events
    (organization_id, creator_id, application_id, type, actor_user_id, data)
  values (
    v_org, v_creator, v_app, 'shipment_address_refreshed', v_uid,
    jsonb_build_object('shipment_id', p_shipment_id, 'actor_email', v_email)
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.refresh_shipment_address(uuid) from public;
grant execute on function public.refresh_shipment_address(uuid) to authenticated;
