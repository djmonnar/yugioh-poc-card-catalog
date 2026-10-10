-- Reversible removal from the active game library. No saved battle IDs change.
begin;
create temporary table scenario_trash105_before on commit drop as select * from public.poc_stories;
alter table scenario_trash105_before enable row level security;
create table if not exists poc_private.scenario_trash(
 id text primary key check(id ~ '^[A-Za-z0-9_-]{1,100}$' and id<>'main'),
 document jsonb not null,source_version bigint not null,version bigint not null,
 deleted_at timestamptz not null default now(),editor uuid not null
);
alter table poc_private.scenario_trash enable row level security;
revoke all on poc_private.scenario_trash from public,anon,authenticated;

create or replace function public.poc_load_scenario_trash() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'document',poc_private.resolve_characters(document),'version',version,'deleted_at',deleted_at) order by deleted_at desc),'[]'::jsonb) from poc_private.scenario_trash);
end;$$;

create or replace function public.poc_archive_scenario(p_scenario_id text,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare s public.poc_stories%rowtype;revision bigint;
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501';end if;
 if p_scenario_id is null or p_scenario_id='main' or p_scenario_id !~ '^[A-Za-z0-9_-]{1,100}$' then raise exception 'poc_invalid_story';end if;
 perform pg_advisory_xact_lock(hashtextextended('poc-story-library',0));
 select * into s from public.poc_stories where id=p_scenario_id;
 if s.id is null or p_expected_version is null or s.version is distinct from p_expected_version then raise exception 'poc_conflict';end if;
 if (select count(*) from poc_private.scenario_trash)>=100 then raise exception 'poc_scenario_trash_limit';end if;
 revision:=nextval('poc_private.revision_seq');
 insert into poc_private.scenario_trash(id,document,source_version,version,editor)
 values(s.id,s.document,s.version,revision,auth.uid());
 insert into poc_private.story_history(version,document,editor,scenario_id) values(revision,s.document,auth.uid(),s.id);
 delete from public.poc_stories where id=s.id;
 return jsonb_build_object('id',s.id,'version',revision);
end;$$;

create or replace function public.poc_restore_scenario(p_scenario_id text,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare s poc_private.scenario_trash%rowtype;result jsonb;
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('poc-story-library',0));
 select * into s from poc_private.scenario_trash where id=p_scenario_id;
 if s.id is null or p_expected_version is null or s.version is distinct from p_expected_version
  or exists(select 1 from public.poc_stories where id=p_scenario_id) then raise exception 'poc_conflict';end if;
 -- The original save transaction enforces current card, reward and capacity
 -- checks. It creates a fresh revision, keeping the scenario and battle IDs.
 result:=poc_private.save_scenario_before_characters103(s.id,poc_private.resolve_characters(s.document),0);
 delete from poc_private.scenario_trash where id=s.id;
 return result;
end;$$;

create or replace function public.poc_save_scenario(p_scenario_id text,p_document jsonb,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('poc-story-library',0));
 -- A stale browser may not recreate an archived scenario with version zero.
 if exists(select 1 from poc_private.scenario_trash where id=p_scenario_id) then raise exception 'poc_scenario_deleted';end if;
 return poc_private.save_scenario_before_characters103(p_scenario_id,poc_private.resolve_characters(p_document),p_expected_version);
end;$$;

revoke all on function public.poc_load_scenario_trash(),public.poc_archive_scenario(text,bigint),public.poc_restore_scenario(text,bigint) from public,anon,authenticated;
grant execute on function public.poc_load_scenario_trash(),public.poc_archive_scenario(text,bigint),public.poc_restore_scenario(text,bigint) to authenticated;
do $$begin
 if exists((select * from scenario_trash105_before except select * from public.poc_stories)
  union all (select * from public.poc_stories except select * from scenario_trash105_before)) then raise exception 'saved scenarios changed';end if;
end;$$;
notify pgrst,'reload schema';
commit;
select 'scenario trash ready; active scenarios preserved' as result,count(*) as scenarios from public.poc_stories;
