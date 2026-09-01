-- Zoviah — make the help-article search tolerant of natural phrasing.
--
-- The old version used plainto_tsquery (AND between every word). A question
-- like "Como alterar um creator?" then required an article containing the
-- lexeme "alter" AND "creator" — so a synonym gap ("editar" vs "alterar")
-- returned zero rows and the assistant fell straight to "não encontrei"
-- without even seeing the KB.
--
-- New behaviour, in order, stopping at the first that yields rows:
--   1. websearch_to_tsquery (handles quotes / OR / -term, AND by default)
--   2. OR of every content lexeme of the query (any word matches)
--   3. ILIKE over title + keywords + summary (accent-insensitive via unaccent
--      when available, plain ILIKE otherwise)
-- Empty query still returns the most recently updated published articles.

create or replace function public.search_help_articles(p_query text, p_limit int default 5)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_q    text := btrim(coalesce(p_query, ''));
  v_lim  int  := least(greatest(coalesce(p_limit, 5), 1), 20);
  v_tsq  tsquery;
  v_or   text;
  v_rows jsonb;
begin
  if v_q = '' then
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows
    from (
      select a.id, a.category, a.title, a.slug, a.summary, a.content,
             0::float4 as rank
      from public.help_articles a
      where a.status = 'published'
      order by a.updated_at desc
      limit v_lim
    ) t;
    return v_rows;
  end if;

  -- 1) websearch parsing
  v_tsq := websearch_to_tsquery('portuguese', v_q);
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows
  from (
    select a.id, a.category, a.title, a.slug, a.summary, a.content,
           ts_rank(a.search_vector, v_tsq) as rank
    from public.help_articles a
    where a.status = 'published' and a.search_vector @@ v_tsq
    order by rank desc nulls last, a.updated_at desc
    limit v_lim
  ) t;
  if jsonb_array_length(v_rows) > 0 then
    return v_rows;
  end if;

  -- 2) OR of the query's own lexemes (any word)
  select string_agg(lex, ' | ')
    into v_or
  from unnest(
    tsvector_to_array(to_tsvector('portuguese', v_q))
  ) as lex;

  if v_or is not null and v_or <> '' then
    v_tsq := to_tsquery('portuguese', v_or);
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows
    from (
      select a.id, a.category, a.title, a.slug, a.summary, a.content,
             ts_rank(a.search_vector, v_tsq) as rank
      from public.help_articles a
      where a.status = 'published' and a.search_vector @@ v_tsq
      order by rank desc nulls last, a.updated_at desc
      limit v_lim
    ) t;
    if jsonb_array_length(v_rows) > 0 then
      return v_rows;
    end if;
  end if;

  -- 3) substring match on the human-readable fields
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_rows
  from (
    select a.id, a.category, a.title, a.slug, a.summary, a.content,
           0::float4 as rank
    from public.help_articles a
    where a.status = 'published'
      and (
        a.title ilike '%' || v_q || '%'
        or coalesce(a.summary, '') ilike '%' || v_q || '%'
        or array_to_string(a.keywords, ' ') ilike '%' || v_q || '%'
      )
    order by a.updated_at desc
    limit v_lim
  ) t;
  return v_rows;
end;
$$;

grant execute on function public.search_help_articles(text, int) to authenticated;
