-- Optional per-character cutins and WAV voices. Existing story rows stay intact.
begin;
do $base$
begin
 if to_regprocedure('poc_private.validate_story_base_media88(jsonb)') is null then
  alter function poc_private.validate_story(jsonb) rename to validate_story_base_media88;
 end if;
end;$base$;
revoke all on function poc_private.validate_story_base_media88(jsonb) from public,anon,authenticated;

create or replace function poc_private.validate_media88(v jsonb) returns void
language plpgsql set search_path=pg_catalog as $body$
declare e record;k text;url text;ext text;
begin
 if jsonb_typeof(v) is distinct from 'object' or jsonb_typeof(v->'enabled') is distinct from 'boolean' or jsonb_typeof(v->'portrait') is distinct from 'boolean' or jsonb_typeof(v->'events') is distinct from 'object' then raise exception 'poc_invalid_character_media';end if;
 for e in select * from jsonb_each(v->'events') loop
  if e.key not in ('start','summon','attack','activate','damage','win','lose','draw') or jsonb_typeof(e.value) is distinct from 'object' then raise exception 'poc_invalid_character_media';end if;
  foreach k in array array['image','audio'] loop
   url:=e.value->>k;ext:=case when k='audio' then 'wav' else '(png|jpe?g|webp)' end;
   if jsonb_typeof(e.value->k) is distinct from 'string' or length(url)>1000 or strpos(url,'..')>0 or not (url='' or url ~* ('^((assets|content-packs)/|https://[a-z]{20}\.supabase\.co/storage/v1/object/public/poc-story-assets/)[A-Za-z0-9_./-]+\.'||ext||'$')) then raise exception 'poc_invalid_character_media';end if;
  end loop;
 end loop;
end;$body$;
revoke all on function poc_private.validate_media88(jsonb) from public,anon,authenticated;

create or replace function poc_private.validate_story(d jsonb) returns void
language plpgsql set search_path=pg_catalog as $body$
declare a jsonb;actors jsonb:='[]';
begin
 if octet_length(d::text)>1048576 or jsonb_typeof(d->'actors') is distinct from 'array' then raise exception 'poc_invalid_story';end if;
 for a in select value from jsonb_array_elements(d->'actors') loop
  if a ? 'presentation' then perform poc_private.validate_media88(a->'presentation');end if;
  actors:=actors||jsonb_build_array(a-'presentation');
 end loop;
 perform poc_private.validate_story_base_media88(jsonb_set(d,'{actors}',actors));
end;$body$;
revoke all on function poc_private.validate_story(jsonb) from public,anon,authenticated;

do $check$
declare d jsonb;v jsonb;bad jsonb;before_docs text;after_docs text;
begin
 select md5(coalesce(jsonb_agg(to_jsonb(s) order by id)::text,'[]')) into before_docs from public.poc_stories s;
 v:='{"enabled":true,"portrait":true,"events":{"start":{"image":"assets/actors/test.png","audio":"assets/actors/test.wav"}}}'::jsonb;
 perform poc_private.validate_media88(v);
 for bad in select x from jsonb_array_elements('[{"enabled":1,"portrait":true,"events":{}},{"enabled":true,"portrait":true,"events":{"unknown":{"image":"","audio":""}}},{"enabled":true,"portrait":true,"events":{"start":{"image":"https://foreign.invalid/test.png","audio":""}}},{"enabled":true,"portrait":true,"events":{"start":{"image":"assets/../test.png","audio":""}}}]') t(x) loop
  begin
   perform poc_private.validate_media88(bad);raise exception 'invalid media accepted';
  exception when others then if sqlerrm<>'poc_invalid_character_media' then raise;end if;end;
 end loop;
 for d in select document from public.poc_stories loop
  perform poc_private.validate_story(d);
  perform poc_private.validate_story(jsonb_set(d,'{actors,0,presentation}',v));
 end loop;
 select md5(coalesce(jsonb_agg(to_jsonb(s) order by id)::text,'[]')) into after_docs from public.poc_stories s;
 if before_docs is distinct from after_docs then raise exception 'story preservation failed';end if;
end;$check$;
update storage.buckets set allowed_mime_types=array(select distinct unnest(coalesce(allowed_mime_types,array[]::text[])||array['image/png','image/jpeg','image/webp','audio/wav','audio/x-wav'])) where id='poc-story-assets';
commit;
select 'character media ready; saved stories preserved' as result,count(*) as saved_stories from public.poc_stories;
