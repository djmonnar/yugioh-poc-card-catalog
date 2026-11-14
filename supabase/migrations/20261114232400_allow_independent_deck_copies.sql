-- Deck IDs identify independently editable compositions. Chapter and starter
-- references remain attached to the original ID when an editor copies a deck.
do $migration$
declare
  validator regprocedure := to_regprocedure('poc_private.unified052_validate039_previous(text,text,jsonb)');
  definition text := pg_get_functiondef(validator);
  duplicate_check constant text := $check$  if jsonb_array_length(c->'main')+jsonb_array_length(c->'extra')>0 then
   select e.entity_id into other from poc_private.unified039_entities e where e.entity_type='deck' and not e.deleted and e.entity_id<>id
    and poc_private.unified044_composition(e.content)=poc_private.unified044_composition(c) order by e.entity_id limit 1;
   if other is not null then raise exception 'unified039_duplicate_deck:%',other;end if;
  end if;
$check$;
begin
  if md5(definition) is distinct from '5476207073790bf6ea6354c756b1ade9' then
    raise exception 'independent_deck_copies_validator_changed';
  end if;

  execute replace(replace(definition, duplicate_check, ''), 'r jsonb;d jsonb;other text;', 'r jsonb;d jsonb;');

  if md5(pg_get_functiondef(validator)) is distinct from 'd502f8d66fe0958dc2538d9aea85db72' then
    raise exception 'independent_deck_copies_validator_verification_failed';
  end if;
end;
$migration$;
