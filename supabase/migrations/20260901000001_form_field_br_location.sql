-- Zoviah — public form: dedicated Brazil location field types.
--
-- `br_state` renders the 27 UFs; `br_city` renders the official IBGE
-- municipality list, filtered by the sibling `br_state` field. Both map to
-- creators.state / creators.city exactly like a text field mapped that way did
-- before — this only makes the input a controlled list instead of free text.
--
-- The only schema change is widening the allowed `field_type` set. Answers are
-- still stored in the applications JSONB map; no column changes.

alter table public.form_fields
  drop constraint if exists form_fields_type_check;

alter table public.form_fields
  add constraint form_fields_type_check check (field_type in (
    'text', 'textarea', 'email', 'phone', 'number', 'url', 'date',
    'single_select', 'multi_select', 'checkbox', 'instagram', 'tiktok',
    'br_state', 'br_city'
  ));
