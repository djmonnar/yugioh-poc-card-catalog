-- Wrap the unchanged legacy validator. This migration never edits scenarios,
-- rewards, AI decks or editor permissions. Called inside one atomic DO packet.
create or replace function poc_private.validate_skills72(values_json jsonb) returns void
language plpgsql set search_path=pg_catalog as $body$
declare s jsonb; kinds text[]:=array[]::text[];
begin
 if jsonb_typeof(values_json) is distinct from 'array' or jsonb_array_length(values_json)>8 then raise exception 'poc_invalid_story_skill';end if;
 for s in select value from jsonb_array_elements(values_json) loop
  if jsonb_typeof(s) is distinct from 'object' or s->>'kind' is null or s->>'kind'=any(kinds) or s->>'kind' not in ('lp_bonus','heal_once','start_hand','start_field','add_hand_once','opening_draw','draw_once','start_monster') then raise exception 'poc_invalid_story_skill';end if;
  kinds:=array_append(kinds,s->>'kind');
  if s->>'kind' in ('lp_bonus','heal_once') then
   if jsonb_typeof(s->'value') is distinct from 'number' or s->>'value' !~ '^\d+$' or (s->>'value')::numeric not between 100 and 8000 then raise exception 'poc_invalid_story_skill';end if;
  elsif s->>'kind' in ('opening_draw','draw_once') then
   if jsonb_typeof(s->'value') is distinct from 'number' or s->>'value' !~ '^[1-3]$' then raise exception 'poc_invalid_story_skill';end if;
   if s->>'kind'='draw_once' and (jsonb_typeof(s->'threshold') is distinct from 'number' or s->>'threshold' !~ '^\d+$' or (s->>'threshold')::numeric not between 100 and 16000) then raise exception 'poc_invalid_story_skill';end if;
  else perform poc_private.story_card(s->'card');end if;
  if s->>'kind'='start_monster' and (s->>'position' is null or s->>'position' not in ('attack','defense','set') or not exists(select 1 from poc_private.cards c where c.slot=(s#>>'{card,slot}')::integer and not c.fusion and not c.special)) then raise exception 'poc_invalid_story_skill';end if;
 end loop;
end;$body$;
revoke all on function poc_private.validate_skills72(jsonb) from public,anon,authenticated;

create or replace function poc_private.validate_story(d jsonb) returns void
language plpgsql set search_path=pg_catalog as $body$
declare a jsonb;p jsonb;b jsonb;source_actor jsonb;clean jsonb:=d;actors jsonb:='[]';battles jsonb:='[]';ids text[];
begin
 if octet_length(d::text)>1048576 or jsonb_typeof(d->'actors') is distinct from 'array' or jsonb_typeof(d->'battles') is distinct from 'array' then raise exception 'poc_invalid_story';end if;
 for a in select value from jsonb_array_elements(d->'actors') loop
  perform poc_private.validate_skills72(a->'skills');
  if a ? 'skill_profiles' then
   if jsonb_typeof(a->'skill_profiles') is distinct from 'array' or jsonb_array_length(a->'skill_profiles')>10 then raise exception 'poc_invalid_skill_profiles';end if;
   ids:=array[]::text[];
   for p in select value from jsonb_array_elements(a->'skill_profiles') loop
    if jsonb_typeof(p) is distinct from 'object' or p->>'profile_id' is null or p->>'profile_id' !~ '^[A-Za-z0-9_-]{1,100}$' or p->>'profile_id'=any(ids) or jsonb_typeof(p->'name') is distinct from 'string' or length(trim(p->>'name')) not between 1 and 100 or (select count(*) from jsonb_object_keys(p))<>3 then raise exception 'poc_invalid_skill_profiles';end if;
    ids:=array_append(ids,p->>'profile_id');perform poc_private.validate_skills72(p->'skills');
   end loop;
  end if;
  actors:=actors||jsonb_build_array(jsonb_set(a-'skill_profiles','{skills}',coalesce((select jsonb_agg(s) from jsonb_array_elements(a->'skills') as t(s) where s->>'kind' not in ('opening_draw','draw_once','start_monster')),'[]')));
 end loop;
 for b in select value from jsonb_array_elements(d->'battles') loop
  if b ? 'skill_profile' then
   if jsonb_typeof(b->'skill_profile') is distinct from 'string' or (b->>'skill_profile'<>'' and b->>'skill_profile' !~ '^[A-Za-z0-9_-]{1,100}$') then raise exception 'poc_invalid_skill_profile';end if;
   if b->>'skill_profile'<>'' then
    select value into source_actor from jsonb_array_elements(d->'actors') where value->>'actor_id'=b->>'actor_id';
    if not exists(select 1 from jsonb_array_elements(coalesce(source_actor->'skill_profiles','[]')) as t(profile) where t.profile->>'profile_id'=b->>'skill_profile') then raise exception 'poc_invalid_skill_profile';end if;
   end if;
  end if;
  battles:=battles||jsonb_build_array(b-'skill_profile');
 end loop;
 clean:=jsonb_set(jsonb_set(clean,'{actors}',actors),'{battles}',battles);
 perform poc_private.validate_story_base72(clean);
end;$body$;
revoke all on function poc_private.validate_story(jsonb) from public,anon,authenticated;
