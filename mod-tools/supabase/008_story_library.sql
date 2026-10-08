-- Independent scenarios; existing main document/version and all reward data remain intact.
begin;
alter table public.poc_stories drop constraint if exists poc_stories_id_check;
alter table public.poc_stories add constraint poc_stories_id_check check(id ~ '^[A-Za-z0-9_-]{1,100}$');
alter table poc_private.story_history add column if not exists scenario_id text not null default 'main';

create or replace function public.poc_load_scenarios() returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(to_jsonb(s) order by (s.id='main') desc,s.id),'[]'::jsonb)
 from public.poc_stories s;
$$;
revoke all on function public.poc_load_scenarios() from public;
grant execute on function public.poc_load_scenarios() to anon,authenticated;

create or replace function public.poc_save_scenario(p_scenario_id text,p_document jsonb,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare oldversion bigint; nextversion bigint; result jsonb; total integer;
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501'; end if;
 if p_scenario_id is null or p_scenario_id !~ '^[A-Za-z0-9_-]{1,100}$' then raise exception 'poc_invalid_story'; end if;
 if p_expected_version is null or p_expected_version<0 then raise exception 'poc_conflict'; end if;
 perform poc_private.validate_story(p_document);
 if jsonb_array_length(p_document->'battles')<1 then raise exception 'poc_invalid_story'; end if;
 -- Serialize the bounded library count and the optimistic document update together.
 perform pg_advisory_xact_lock(hashtextextended('poc-story-library',0));
 select version into oldversion from public.poc_stories where id=p_scenario_id;
 if coalesce(oldversion,0) is distinct from p_expected_version then raise exception 'poc_conflict'; end if;
 if oldversion is null and (select count(*) from public.poc_stories)>=20 then raise exception 'poc_story_scenario_limit'; end if;
 select coalesce(sum(jsonb_array_length(document->'battles')),0) into total from public.poc_stories where id<>p_scenario_id;
 if total+jsonb_array_length(p_document->'battles')>100 then raise exception 'poc_story_battle_limit'; end if;
 nextversion:=nextval('poc_private.revision_seq');
 insert into public.poc_stories(id,document,version,updated_at) values(p_scenario_id,p_document,nextversion,now())
 on conflict(id) do update set document=excluded.document,version=excluded.version,updated_at=excluded.updated_at
 returning to_jsonb(poc_stories.*) into result;
 insert into poc_private.story_history(version,document,editor,scenario_id) values(nextversion,p_document,auth.uid(),p_scenario_id);
 return result;
end; $$;
revoke all on function public.poc_save_scenario(text,jsonb,bigint) from public,anon;
grant execute on function public.poc_save_scenario(text,jsonb,bigint) to authenticated;

-- Old clients continue to edit main with the same conflict protection.
create or replace function public.poc_save_story(p_document jsonb,p_expected_version bigint) returns jsonb
language sql security definer set search_path=pg_catalog as $$
 select public.poc_save_scenario('main',p_document,p_expected_version);
$$;
revoke all on function public.poc_save_story(jsonb,bigint) from public,anon;
grant execute on function public.poc_save_story(jsonb,bigint) to authenticated;
notify pgrst,'reload schema';
commit;
