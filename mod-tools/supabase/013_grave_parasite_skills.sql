-- Additional starting traits. Saved stories and AI decks are never rewritten.
begin;
do $base$
begin
 if to_regprocedure('poc_private.validate_story_base_skills87(jsonb)') is null then
  alter function poc_private.validate_story(jsonb) rename to validate_story_base_skills87;
 end if;
end;$base$;
revoke all on function poc_private.validate_story_base_skills87(jsonb) from public,anon,authenticated;

create or replace function poc_private.validate_skills87(v jsonb) returns void
language plpgsql set search_path=pg_catalog as $body$
declare s jsonb;e jsonb;kinds text[]:=array[]::text[];slots integer[];total integer;slot_id integer;old_skills jsonb:='[]';
begin
 if jsonb_typeof(v) is distinct from 'array' or jsonb_array_length(v)>10 then raise exception 'poc_invalid_story_skill';end if;
 for s in select value from jsonb_array_elements(v) loop
  if jsonb_typeof(s) is distinct from 'object' or s->>'kind' is null or s->>'kind'=any(kinds) then raise exception 'poc_invalid_story_skill';end if;
  kinds:=array_append(kinds,s->>'kind');
  if s->>'kind'='start_grave' then
   if jsonb_typeof(s->'entries') is distinct from 'array' or jsonb_array_length(s->'entries') not between 1 and 12 then raise exception 'poc_invalid_story_skill';end if;
   total:=0;slots:=array[]::integer[];
   for e in select value from jsonb_array_elements(s->'entries') loop
    if jsonb_typeof(e) is distinct from 'object' or jsonb_typeof(e->'count') is distinct from 'number' or e->>'count' !~ '^\d+$' or (e->>'count')::numeric not between 1 and 12 then raise exception 'poc_invalid_story_skill';end if;
    perform poc_private.story_card(e->'card');slot_id:=(e#>>'{card,slot}')::integer;
    if slot_id=any(slots) or not exists(select 1 from poc_private.cards c where c.slot=slot_id and not c.fusion and not c.special) then raise exception 'poc_invalid_story_skill';end if;
    slots:=array_append(slots,slot_id);total:=total+(e->>'count')::integer;
   end loop;
   if total>12 then raise exception 'poc_invalid_story_skill';end if;
  elsif s->>'kind'='parasite_deck' then
   if not exists(select 1 from poc_private.cards c where c.slot=197 and c.internal_id=762) then raise exception 'poc_missing_parasite';end if;
  else old_skills:=old_skills||jsonb_build_array(s);
  end if;
 end loop;
 perform poc_private.validate_skills72(old_skills);
end;$body$;
revoke all on function poc_private.validate_skills87(jsonb) from public,anon,authenticated;

create or replace function poc_private.validate_story(d jsonb) returns void
language plpgsql set search_path=pg_catalog as $body$
declare a jsonb;p jsonb;actors jsonb:='[]';profiles jsonb;clean jsonb:=d;
begin
 if octet_length(d::text)>1048576 or jsonb_typeof(d->'actors') is distinct from 'array' then raise exception 'poc_invalid_story';end if;
 for a in select value from jsonb_array_elements(d->'actors') loop
  perform poc_private.validate_skills87(a->'skills');
  a:=jsonb_set(a,'{skills}',coalesce((select jsonb_agg(s) from jsonb_array_elements(a->'skills') as t(s) where s->>'kind' not in ('start_grave','parasite_deck')),'[]'));
  if a ? 'skill_profiles' then
   if jsonb_typeof(a->'skill_profiles') is distinct from 'array' then raise exception 'poc_invalid_skill_profiles';end if;
   profiles:='[]';
   for p in select value from jsonb_array_elements(a->'skill_profiles') loop
    perform poc_private.validate_skills87(p->'skills');
    profiles:=profiles||jsonb_build_array(jsonb_set(p,'{skills}',coalesce((select jsonb_agg(s) from jsonb_array_elements(p->'skills') as t(s) where s->>'kind' not in ('start_grave','parasite_deck')),'[]')));
   end loop;
   a:=jsonb_set(a,'{skill_profiles}',profiles);
  end if;
  actors:=actors||jsonb_build_array(a);
 end loop;
 clean:=jsonb_set(clean,'{actors}',actors);
 perform poc_private.validate_story_base_skills87(clean);
end;$body$;
revoke all on function poc_private.validate_story(jsonb) from public,anon,authenticated;

do $check$
declare d jsonb;r jsonb;skills jsonb;changed jsonb;before_docs text;after_docs text;n integer;
begin
 select md5(coalesce(jsonb_agg(to_jsonb(s) order by id)::text,'[]')) into before_docs from public.poc_stories s;
 select jsonb_build_object('slot',slot,'internal_id',internal_id,'identity_key',identity_key,'name_ko','기생충 파라사이드') into r from poc_private.cards where slot=197;
 skills:=jsonb_build_array(jsonb_build_object('kind','start_grave','entries',jsonb_build_array(jsonb_build_object('card',r,'count',3))),jsonb_build_object('kind','parasite_deck'));
 perform poc_private.validate_skills87(skills);
 for n in 0..3 loop
  changed:=jsonb_set(skills,'{0,entries,0,count}',case n when 0 then '0' when 1 then '13' when 2 then 'true' else '1.5' end::jsonb);
  begin
   perform poc_private.validate_skills87(changed);raise exception 'invalid grave count accepted';
  exception when others then if sqlerrm<>'poc_invalid_story_skill' then raise;end if;end;
 end loop;
 begin
  perform poc_private.validate_skills87(jsonb_set(skills,'{0,entries}',jsonb_build_array(jsonb_build_object('card',r,'count',1),jsonb_build_object('card',r,'count',1))));raise exception 'duplicate grave card accepted';
 exception when others then if sqlerrm<>'poc_invalid_story_skill' then raise;end if;end;
 for d in select document from public.poc_stories loop
  perform poc_private.validate_story(d);
  perform poc_private.validate_story(jsonb_set(d,'{actors,0,skills}',skills));
 end loop;
 select md5(coalesce(jsonb_agg(to_jsonb(s) order by id)::text,'[]')) into after_docs from public.poc_stories s;
 if before_docs is distinct from after_docs then raise exception 'story preservation failed';end if;
end;$check$;
commit;
select 'starting grave and activated Parasite ready; existing stories preserved' as result;
