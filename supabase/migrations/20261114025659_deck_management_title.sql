-- Extend the existing versioned deck document. The game projection keeps its
-- existing names and shape, and the read-only web graph omits this field.
create function poc_private.unified116_follow_deck_names(
  deck_renames jsonb, write_revision bigint
) returns jsonb
language sql
set search_path to 'pg_catalog'
as $function$
  with inherited_names as (
    select e.entity_type, e.entity_id, jsonb_agg(
      case
        when e.entity_type = 'chapter_role' and item #>> '{encounter,deck_name}' = rename->>'old'
          then jsonb_set(item, '{encounter,deck_name}', rename->'new')
        when e.entity_type = 'starter_list' and item->>'name' = rename->>'old' and length(rename->>'new') <= 80
          then jsonb_set(item, '{name}', rename->'new')
        else item
      end order by ordinal
    ) as entries
    from poc_private.unified039_entities e
    cross join lateral jsonb_array_elements(e.content->'entries') with ordinality as item_rows(item, ordinal)
    cross join lateral (select deck_renames -> (item->>'deck_id') as rename) as deck
    where e.entity_type in ('chapter_role', 'starter_list') and not e.deleted
    group by e.entity_type, e.entity_id
  ), changed as (
    update poc_private.unified039_entities e
    set content = jsonb_set(e.content, '{entries}', inherited.entries)
    from inherited_names inherited
    where e.entity_type = inherited.entity_type and e.entity_id = inherited.entity_id
      and e.content->'entries' is distinct from inherited.entries
    returning e.entity_type, e.entity_id
  ), versioned as (
    insert into poc_private.unified039_versions (entity_type, entity_id, version)
    select entity_type, entity_id, write_revision from changed
    on conflict (entity_type, entity_id) do update set version = excluded.version
    returning entity_type, entity_id
  )
  select coalesce(jsonb_agg(to_jsonb(versioned)), '[]'::jsonb) from versioned;
$function$;
revoke all on function poc_private.unified116_follow_deck_names(jsonb, bigint) from public;

do $migration$
declare
  writer_definition text := pg_get_functiondef('poc_private.unified056_writer039_previous(jsonb)'::regprocedure);
  validator_definition text := pg_get_functiondef('poc_private.unified039_deck_issues(jsonb)'::regprocedure);
  graph_definition text := pg_get_functiondef('poc_private.unified044_public_graph()'::regprocedure);
  traits_definition text := pg_get_functiondef('poc_private.unified039_compile_traits(jsonb)'::regprocedure);
  patch_fields text := $fields$array['deck_name','name','main','extra','banlist_enabled']$fields$;
  deck_fields text := $fields$array['name','deck_name','profile_id','art_key','banlist_enabled','main','extra','lp_bonus','opening_draw_bonus','skills','shared_character_id','shared_skill_profile_id','use_shared_skills']$fields$;
begin
  if md5(writer_definition) <> 'e5a76fc882d42f379532e817eb60c458'
    or md5(validator_definition) <> '56ab85ef3720b64d32f158343682a1db'
    or md5(graph_definition) <> '9c0c9443e24db5b172ec824d52a60b07'
    or md5(traits_definition) <> '8de400821849c2cc141e9cf0aec1ec25' then
    raise exception 'deck_management_title: review changed authoring functions';
  end if;

  writer_definition := replace(writer_definition, patch_fields,
    left(patch_fields, -1) || $fields$,'management_title']$fields$);
  writer_definition := replace(writer_definition,
    $old$old_category_version bigint;$old$,
    $new$old_category_version bigint;deck_renames jsonb:='{}';previous_deck_name text;title_only boolean;$new$);
  writer_definition := replace(writer_definition,
    $old$issues:=poc_private.unified039_validate(t,id,content);
    insert into poc_private.unified039_entities$old$,
    $new$title_only:=t='deck' and op='patch' and fields ? 'management_title'
     and fields - 'management_title'::text = '{}'::jsonb;
    if title_only then
     if jsonb_typeof(fields->'management_title') <> 'string' or length(fields->>'management_title') > 100
      or fields->>'management_title' ~ '[[:cntrl:]]' then raise exception 'unified039_invalid_deck';end if;
     select e.issues into issues from poc_private.unified039_entities e where e.entity_type=t and e.entity_id=id;
    else
     issues:=poc_private.unified039_validate(t,id,content);
    end if;
    if t='deck' and op='patch' and not title_only and issues='[]'::jsonb then
     select coalesce(e.ready_content->>'deck_name',previous->>'deck_name') into previous_deck_name
      from poc_private.unified039_entities e where e.entity_type=t and e.entity_id=id;
     if previous_deck_name is not null and previous_deck_name is distinct from content->>'deck_name' then
      deck_renames:=jsonb_set(deck_renames,array[id],jsonb_build_object('old',previous_deck_name,'new',content->>'deck_name'));
     end if;
    end if;
    insert into poc_private.unified039_entities$new$);
  writer_definition := replace(writer_definition,
    $old$ready_content=case when excluded.issues='[]'::jsonb then excluded.content when unified039_entities.deleted then null else unified039_entities.ready_content end,state=excluded.state,issues=excluded.issues$old$,
    $new$ready_content=case when title_only then unified039_entities.ready_content when excluded.issues='[]'::jsonb then excluded.content - 'management_title' when unified039_entities.deleted then null else unified039_entities.ready_content end,state=case when title_only then unified039_entities.state else excluded.state end,issues=excluded.issues$new$);
  writer_definition := replace(writer_definition,
    $old$update poc_private.unified039_project set revision=writer039.revision$old$,
    $new$if deck_renames<>'{}'::jsonb then
  affected:=affected||poc_private.unified116_follow_deck_names(deck_renames,revision);
 end if;
 update poc_private.unified039_project set revision=writer039.revision$new$);
  writer_definition := replace(writer_definition,
    $old$where x->>'entity_type' not in ('category_group','category_group_order')) then$old$,
    $new$where x->>'entity_type' not in ('category_group','category_group_order')
   and not (x->>'entity_type'='deck' and x->>'operation'='patch'
     and (x->'fields') ? 'management_title' and (x->'fields') - 'management_title'::text = '{}'::jsonb)) then$new$);
  if position('affected||poc_private.unified116_follow_deck_names' in writer_definition) = 0
    or position('into previous_deck_name' in writer_definition) = 0 then
    raise exception 'deck_management_title: writer patch did not match';
  end if;
  execute writer_definition;

  validator_definition := replace(validator_definition, deck_fields || ',' || deck_fields,
    left(deck_fields, -1) || $fields$,'management_title'],$fields$ || deck_fields);
  validator_definition := replace(validator_definition,
    $old$or jsonb_typeof(c->'banlist_enabled')<>'boolean'$old$,
    $new$or (c ? 'management_title' and
     (jsonb_typeof(c->'management_title') <> 'string' or length(c->>'management_title') > 100
      or c->>'management_title' ~ '[[:cntrl:]]'))
 or jsonb_typeof(c->'banlist_enabled')<>'boolean'$new$);
  execute validator_definition;

  traits_definition := replace(traits_definition,
    $old$poc_private.unified039_keys(c,array[$old$,
    $new$poc_private.unified039_keys(c - 'management_title',array[$new$);
  execute traits_definition;

  graph_definition := replace(graph_definition,
    $old$'decks',(select coalesce(jsonb_agg(jsonb_build_object('entity_type',e.entity_type,'entity_id',e.entity_id,'content',e.ready_content,$old$,
    $new$'decks',(select coalesce(jsonb_agg(jsonb_build_object('entity_type',e.entity_type,'entity_id',e.entity_id,'content',e.ready_content - 'management_title',$new$);
  execute graph_definition;

  update poc_private.unified039_project
  set capabilities = jsonb_set(capabilities, '{entities,deck,fields,management_title}', '{"type":"text","max":100}'::jsonb)
  where project_id = 'ygoclassic-expedition'
    and jsonb_typeof(capabilities #> '{entities,deck,fields}') = 'object';
  if not found then
    raise exception 'deck_management_title: deck capabilities missing';
  end if;
end;
$migration$;
