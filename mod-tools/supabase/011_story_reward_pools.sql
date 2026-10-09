-- Extend the private validator; retain the current skills, decks and RPCs.
do $pool_base$
begin
 if to_regprocedure('poc_private.validate_story_base_pool84(jsonb)') is null then
  alter function poc_private.validate_story(jsonb) rename to validate_story_base_pool84;
 end if;
end;$pool_base$;
revoke all on function poc_private.validate_story_base_pool84(jsonb) from public,anon,authenticated;

create or replace function poc_private.validate_story(d jsonb) returns void
language plpgsql set search_path=pg_catalog as $body$
declare b jsonb;r jsonb;e jsonb;phase text;clean jsonb:=d;battles jsonb:='[]';rewards jsonb;rows jsonb;slots integer[];
begin
 if octet_length(d::text)>1048576 or jsonb_typeof(d->'battles') is distinct from 'array' then raise exception 'poc_invalid_story';end if;
 for b in select value from jsonb_array_elements(d->'battles') loop
  rewards:=b->'rewards';
  foreach phase in array array['first','repeat'] loop
   if jsonb_typeof(rewards->phase) is distinct from 'array' or jsonb_array_length(rewards->phase)>20 then raise exception 'poc_invalid_story_reward';end if;
   rows:='[]';
   for r in select value from jsonb_array_elements(rewards->phase) loop
    if r->>'kind'='card_pool' then
     if jsonb_typeof(r->'count') is distinct from 'number' or r->>'count' !~ '^[1-3]$' or jsonb_typeof(r->'entries') is distinct from 'array' or jsonb_array_length(r->'entries') not between 1 and 100 then raise exception 'poc_invalid_story_reward_pool';end if;
     slots:=array[]::integer[];
     for e in select value from jsonb_array_elements(r->'entries') loop
      perform poc_private.story_card(e->'card');
      if jsonb_typeof(e->'weight') is distinct from 'number' or e->>'weight' !~ '^\d+$' or (e->>'weight')::numeric not between 1 and 10000 or (e#>>'{card,slot}')::integer=any(slots) then raise exception 'poc_invalid_story_reward_pool';end if;
      slots:=array_append(slots,(e#>>'{card,slot}')::integer);
     end loop;
     -- Only the validation copy is normalized. The saving RPC stores d intact.
     rows:=rows||jsonb_build_array(jsonb_build_object('kind','card','count',r->'count','card',r#>'{entries,0,card}'));
    else rows:=rows||jsonb_build_array(r);end if;
   end loop;
   rewards:=jsonb_set(rewards,array[phase],rows);
  end loop;
  battles:=battles||jsonb_build_array(jsonb_set(b,'{rewards}',rewards));
 end loop;
 clean:=jsonb_set(clean,'{battles}',battles);
 perform poc_private.validate_story_base_pool84(clean);
end;$body$;
revoke all on function poc_private.validate_story(jsonb) from public,anon,authenticated;
