-- Reuse the published lookups during a full editor save, and validate a
-- fallback starter graph only when the new graph could not be published.
do $migration$
declare
  rebuild_fn regprocedure := to_regprocedure('poc_private.unified039_rebuild(boolean)');
  caps_fn regprocedure := to_regprocedure('poc_private.unified058_projection_caps_text(jsonb,text)');
  rebuild_sql text := pg_get_functiondef(rebuild_fn);
  caps_sql text := pg_get_functiondef(caps_fn);
  old_parts text[] := array[
    $old$ validation093 jsonb:='{}';validation_key093 text;deck_issues093 jsonb;$old$,
    $old$ opps:='[]';chapters:=payload#>'{opponents,chapters}';$old$,
    $old$   select x into old044 from jsonb_array_elements(p.payload#>'{opponents,opponents}') x where x->>'id'=entry044->>'entry_id';$old$,
    $old$  select x into original from jsonb_array_elements(p.seed#>'{payload,starters,starters}') x where x->>'id'=s->>'starter_id';$old$,
    $old$ if good and jsonb_array_length(starter_rows)>0 then$old$,
    $old$ if exists(select 1 from jsonb_array_elements(payload#>'{starters,starters}') x where not exists($old$,
    $old$jsonb_array_elements(p.payload#>'{opponents,opponents}') with ordinality old(x,ord)$old$
  ];
  new_parts text[] := array[
    $new$ validation093 jsonb:='{}';validation_key093 text;deck_issues093 jsonb;
 previous_opponents jsonb;opponent_by_id jsonb;seed_starter_by_id jsonb;new_starters_valid boolean;$new$,
    $new$ opps:='[]';chapters:=payload#>'{opponents,chapters}';
 previous_opponents:=payload#>'{opponents,opponents}';
 select coalesce(jsonb_object_agg(x->>'id',x order by ord desc),'{}'::jsonb) into opponent_by_id
 from jsonb_array_elements(previous_opponents) with ordinality q(x,ord) where x->>'id' is not null;
 select coalesce(jsonb_object_agg(x->>'id',x order by ord desc),'{}'::jsonb) into seed_starter_by_id
 from jsonb_array_elements(p.seed#>'{payload,starters,starters}') with ordinality q(x,ord) where x->>'id' is not null;$new$,
    $new$   old044:=opponent_by_id->(entry044->>'entry_id');$new$,
    $new$  original:=seed_starter_by_id->(s->>'starter_id');$new$,
    $new$ new_starters_valid:=good and jsonb_array_length(starter_rows)>0;
 if new_starters_valid then$new$,
    $new$ -- Each newly projected starter already passed the same deck check above.
 if not new_starters_valid and exists(select 1 from jsonb_array_elements(payload#>'{starters,starters}') x where not exists($new$,
    $new$jsonb_array_elements(previous_opponents) with ordinality old(x,ord)$new$
  ];
  cap_before constant text := 'octet_length(poc_private.compact(candidate->''opponents''))';
  cap_after constant text := 'octet_length((txt::json->''opponents'')::text)';
  i integer;
begin
  if md5(rebuild_sql) is distinct from '703cb04b870b2034764a527003818f15'
      or md5(caps_sql) is distinct from '74cbc364ec01164b2dac50d6705f1c83' then
    raise exception 'editor_save_projection_definition_changed';
  end if;
  for i in 1..cardinality(old_parts) loop
    if length(rebuild_sql)-length(replace(rebuild_sql,old_parts[i],'')) <> length(old_parts[i]) then
      raise exception 'editor_save_projection_patch_missing:%',i;
    end if;
    rebuild_sql:=replace(rebuild_sql,old_parts[i],new_parts[i]);
  end loop;

  -- The only caller supplies compact(candidate). The json operator retains
  -- the exact already-serialized bytes, including JSON escapes and numbers.
  if length(caps_sql)-length(replace(caps_sql,cap_before,'')) <> length(cap_before) then
    raise exception 'editor_save_projection_cap_patch_missing';
  end if;
  caps_sql:=replace(caps_sql,cap_before,cap_after);
  execute rebuild_sql;
  execute caps_sql;
end;
$migration$;
