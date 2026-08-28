-- Creator Hub — Phase 2 follow-up: approved_at reflects the *current* approval.
--
-- Before: approved_at was preserved on every non-approve transition, so an
-- application reopened from `archived` back to `awaiting_review` still carried
-- an approved_at.
--
-- After: approved_at is set only while the application is in the "approved
-- lineage" (approved, or archived-after-approval). Any move back to a
-- pre-decision state (awaiting_review / information_requested) clears it. The
-- full approval history stays in creator_events; approved_at is not a log.
--
--   -> approved               : approved_at = now()
--   approved -> archived      : approved_at kept
--   archived -> awaiting_review: approved_at = null
--   awaiting_review -> approved: approved_at = now()  (fresh)
--
-- Only the central transition function changes; no schema change, no migration
-- edited. `create or replace function` keeps the existing grants/ownership.

create or replace function public.transition_application_status(
  p_application_id uuid,
  p_to_status      text,
  p_note           text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_org     uuid;
  v_creator uuid;
  v_from    text;
  v_email   text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select organization_id, creator_id, status
    into v_org, v_creator, v_from
  from public.applications
  where id = p_application_id;

  if v_org is null then
    raise exception 'APPLICATION_NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.organization_members
    where organization_id = v_org and user_id = v_uid
  ) then
    raise exception 'FORBIDDEN';
  end if;

  if not public.is_valid_application_transition(v_from, p_to_status) then
    raise exception 'INVALID_TRANSITION: % -> %', v_from, p_to_status;
  end if;

  select email into v_email from auth.users where id = v_uid;

  update public.applications set
    status      = p_to_status,
    approved_at = case
                    when p_to_status = 'approved' then now()  -- (re)approval
                    when p_to_status = 'archived' then approved_at  -- keep if it was approved
                    else null  -- awaiting_review / information_requested: not approved
                  end,
    archived_at = case
                    when p_to_status = 'archived' then now()
                    when v_from = 'archived' then null
                    else archived_at
                  end
  where id = p_application_id;

  insert into public.creator_events
    (organization_id, creator_id, application_id, type, actor_user_id, data)
  values (
    v_org, v_creator, p_application_id, 'application_status_changed', v_uid,
    jsonb_build_object('from', v_from, 'to', p_to_status, 'actor_email', v_email)
  );

  if p_note is not null and length(btrim(p_note)) > 0 then
    insert into public.creator_events
      (organization_id, creator_id, application_id, type, actor_user_id, data)
    values (
      v_org, v_creator, p_application_id, 'note_added', v_uid,
      jsonb_build_object('text', left(btrim(p_note), 4000), 'actor_email', v_email)
    );
  end if;

  return jsonb_build_object('ok', true, 'from', v_from, 'to', p_to_status);
end;
$$;

revoke all on function public.transition_application_status(uuid, text, text) from public;
grant execute on function public.transition_application_status(uuid, text, text) to authenticated;
