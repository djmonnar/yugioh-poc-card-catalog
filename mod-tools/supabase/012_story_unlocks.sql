-- Keep optional per-battle prerequisites in saved documents. Only the
-- validation copy is normalized for the existing reward/skill validators.
begin;
do $unlock_base$
begin
 if to_regprocedure('poc_private.validate_story_base_unlock86(jsonb)') is null then
  alter function poc_private.validate_story(jsonb) rename to validate_story_base_unlock86;
 end if;
end;$unlock_base$;
revoke all on function poc_private.validate_story_base_unlock86(jsonb) from public,anon,authenticated;

create or replace function poc_private.validate_story(d jsonb) returns void
language plpgsql set search_path=pg_catalog as $body$
declare b jsonb;clean jsonb:=d;battles jsonb:='[]';
begin
 if octet_length(d::text)>1048576 or jsonb_typeof(d->'battles') is distinct from 'array' then raise exception 'poc_invalid_story';end if;
 for b in select value from jsonb_array_elements(d->'battles') loop
  if b ? 'requires_previous' and jsonb_typeof(b->'requires_previous') is distinct from 'boolean' then raise exception 'poc_invalid_story_prerequisite';end if;
  battles:=battles||jsonb_build_array(b-'requires_previous');
 end loop;
 clean:=jsonb_set(clean,'{battles}',battles);
 perform poc_private.validate_story_base_unlock86(clean);
end;$body$;
revoke all on function poc_private.validate_story(jsonb) from public,anon,authenticated;
do $unlock_check$
declare d jsonb;before_docs text;after_docs text;
begin
 select md5(coalesce(jsonb_agg(to_jsonb(s) order by id)::text,'[]')) into before_docs from public.poc_stories s;
 for d in select document from public.poc_stories loop
  perform poc_private.validate_story(d);
  perform poc_private.validate_story(jsonb_set(d,'{battles,0,requires_previous}','false'));
  perform poc_private.validate_story(jsonb_set(d,'{battles,0,requires_previous}','true'));
  begin
   perform poc_private.validate_story(jsonb_set(d,'{battles,0,requires_previous}','"false"'));
   raise exception 'invalid prerequisite accepted';
  exception when others then
   if sqlerrm<>'poc_invalid_story_prerequisite' then raise;end if;
  end;
 end loop;
 select md5(coalesce(jsonb_agg(to_jsonb(s) order by id)::text,'[]')) into after_docs from public.poc_stories s;
 if before_docs is distinct from after_docs then raise exception 'story preservation failed';end if;
end;$unlock_check$;
commit;
select 'story prerequisites ready; existing stories preserved' as result;
