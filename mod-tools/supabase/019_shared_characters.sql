-- One authoritative visual/voice profile per character. Battle IDs, decks,
-- skills, rewards and prerequisites remain scenario-owned.
begin;
create temporary table characters103_before on commit drop as select id,document from public.poc_stories;
alter table characters103_before enable row level security;
create table if not exists public.poc_characters(
 id text primary key check(id ~ '^[A-Za-z0-9_-]{1,100}$'),
 profile jsonb not null, version bigint not null, updated_at timestamptz not null default now()
);
alter table public.poc_characters enable row level security;
revoke all on public.poc_characters from public,anon,authenticated;
create table if not exists poc_private.character_history(
 version bigint primary key,character_id text not null,profile jsonb not null,editor uuid,created_at timestamptz not null default now()
);
alter table poc_private.character_history enable row level security;
revoke all on poc_private.character_history from public,anon,authenticated;
create or replace function poc_private.character_name(v text) returns text
language sql immutable set search_path=pg_catalog as $$
 select case lower(regexp_replace(v,'[[:space:].]','','g'))
  when '페가수스j크로프트' then '페가수스' when '페가수스j크로포드' then '페가수스'
  when '어둠의유희' then '어둠의 유희' when '어둠의바쿠라' then '어둠의 바쿠라'
  else v end;
$$;
create or replace function poc_private.validate_character(v jsonb) returns void
language plpgsql set search_path=pg_catalog as $$
declare url text;
begin
 if jsonb_typeof(v) is distinct from 'object' or v - array['name','portrait','presentation'] <> '{}'::jsonb
  or jsonb_typeof(v->'name') is distinct from 'string' or length(v->>'name') not between 1 and 100 or btrim(v->>'name')=''
  or jsonb_typeof(v->'portrait') is distinct from 'string' then raise exception 'poc_invalid_character';end if;
 url:=v->>'portrait';
 if length(url)>1000 or strpos(url,'..')>0 or not(url='' or url ~* '^((assets|content-packs)/|https://[a-z]{20}\.supabase\.co/storage/v1/object/public/poc-story-assets/)[A-Za-z0-9_./-]+\.(png|jpe?g|webp)$') then raise exception 'poc_invalid_character';end if;
 if v ? 'presentation' then perform poc_private.validate_media88(v->'presentation');end if;
end;$$;
create or replace function poc_private.resolve_characters(d jsonb) returns jsonb
language plpgsql stable set search_path=pg_catalog as $$
declare a jsonb;v jsonb;actors jsonb:='[]';
begin
 if jsonb_typeof(d->'actors') is distinct from 'array' then raise exception 'poc_invalid_story';end if;
 for a in select value from jsonb_array_elements(d->'actors') loop
  if a ? 'character_id' then
   if jsonb_typeof(a->'character_id') is distinct from 'string' then raise exception 'poc_invalid_character';end if;
   select profile into v from public.poc_characters where id=a->>'character_id';
   if v is null then raise exception 'poc_unknown_character';end if;
   a:=(a-array['name','portrait','presentation'])||v;
  end if;
  actors:=actors||jsonb_build_array(a);
 end loop;
 return jsonb_set(d,'{actors}',actors);
end;$$;
-- Preserve the current validator and scenario transaction. Never replace its
-- reward, version, quota or prerequisite checks with a character-only check.
do $$begin
 if to_regprocedure('poc_private.validate_story_before_characters103(jsonb)') is null then
  alter function poc_private.validate_story(jsonb) rename to validate_story_before_characters103;
 end if;
 if to_regprocedure('poc_private.save_scenario_before_characters103(text,jsonb,bigint)') is null then
  alter function public.poc_save_scenario(text,jsonb,bigint) set schema poc_private;
  alter function poc_private.poc_save_scenario(text,jsonb,bigint) rename to save_scenario_before_characters103;
 end if;
end;$$;
create or replace function poc_private.validate_story(d jsonb) returns void
language plpgsql set search_path=pg_catalog as $$
declare a jsonb;actors jsonb:='[]';resolved jsonb;
begin
 resolved:=poc_private.resolve_characters(d);
 for a in select value from jsonb_array_elements(resolved->'actors') loop
  actors:=actors||jsonb_build_array(a-'character_id');
 end loop;
 perform poc_private.validate_story_before_characters103(jsonb_set(resolved,'{actors}',actors));
end;$$;
create or replace function public.poc_load_characters() returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(to_jsonb(c) order by c.profile->>'name',c.id),'[]'::jsonb) from public.poc_characters c;
$$;
create or replace function public.poc_load_scenarios() returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(jsonb_set(to_jsonb(s),'{document}',poc_private.resolve_characters(s.document)) order by (s.id='main') desc,s.id),'[]'::jsonb) from public.poc_stories s;
$$;
create or replace function public.poc_load_story() returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
 select jsonb_set(to_jsonb(s),'{document}',poc_private.resolve_characters(s.document)) from public.poc_stories s where id='main';
$$;
create or replace function public.poc_save_characters(p_characters jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare x jsonb;oldversion bigint;nextversion bigint;ids text[]:='{}';
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501';end if;
 if jsonb_typeof(p_characters) is distinct from 'array' or jsonb_array_length(p_characters) not between 1 and 100 or octet_length(p_characters::text)>1048576 then raise exception 'poc_invalid_character';end if;
 perform pg_advisory_xact_lock(hashtextextended('poc-story-library',0));
 for x in select value from jsonb_array_elements(p_characters) loop
  if jsonb_typeof(x->'id') is distinct from 'string' or (x->>'id') !~ '^[A-Za-z0-9_-]{1,100}$' or x->>'id'=any(ids)
   or jsonb_typeof(x->'expected_version') is distinct from 'number' or (x->>'expected_version') !~ '^[0-9]+$' then raise exception 'poc_invalid_character';end if;
  ids:=array_append(ids,x->>'id');perform poc_private.validate_character(x->'profile');
  select version into oldversion from public.poc_characters where id=x->>'id';
  if coalesce(oldversion,0) is distinct from (x->>'expected_version')::bigint then raise exception 'poc_conflict';end if;
  if oldversion is null and (select count(*) from public.poc_characters)>=100 then raise exception 'poc_character_limit';end if;
  nextversion:=nextval('poc_private.revision_seq');
  insert into public.poc_characters(id,profile,version) values(x->>'id',x->'profile',nextversion)
   on conflict(id) do update set profile=excluded.profile,version=excluded.version,updated_at=now();
  insert into poc_private.character_history(version,character_id,profile,editor) values(nextversion,x->>'id',x->'profile',auth.uid());
 end loop;
 return public.poc_load_characters();
end;$$;
create or replace function public.poc_save_scenario(p_scenario_id text,p_document jsonb,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('poc-story-library',0));
 return poc_private.save_scenario_before_characters103(p_scenario_id,poc_private.resolve_characters(p_document),p_expected_version);
end;$$;
create or replace function public.poc_save_story(p_document jsonb,p_expected_version bigint) returns jsonb
language sql security definer set search_path=pg_catalog as $$
 select public.poc_save_scenario('main',p_document,p_expected_version);
$$;
-- Backfill once; existing per-scenario skills and stable actor/battle IDs stay.
do $$declare s record;a jsonb;actors jsonb;cid text;n text;v jsonb;old_battles jsonb;newversion bigint;editor_id uuid;
begin
 for s in select * from public.poc_stories order by (id='main') desc,id loop
  actors:='[]';old_battles:=s.document->'battles';
  for a in select value from jsonb_array_elements(s.document->'actors') loop
   if not a ? 'character_id' then
    n:=poc_private.character_name(a->>'name');cid:='character-'||md5(lower(regexp_replace(n,'[[:space:].]','','g')));
    v:=jsonb_build_object('name',n,'portrait',a->>'portrait');if a ? 'presentation' then v:=v||jsonb_build_object('presentation',a->'presentation');end if;
    v:=jsonb_set(v,'{portrait}',to_jsonb(case n
     when '어둠의 바쿠라' then 'assets/actors/shared-bakura.png' when '페가수스' then 'assets/actors/shared-pegasus.png'
     when '사마준' then 'assets/actors/shared-weevil.png' when '메이 쿠자쿠' then 'assets/actors/shared-mai.png'
     when '다이노소어 용만' then 'assets/actors/shared-rex.png' when '해골수스' then 'assets/actors/shared-bonz.png'
     when '마해룡' then 'assets/actors/shared-mako.png' when '어둠의 마리크' then 'assets/actors/shared-marik.png'
     when '이시즈 이슈타르' then 'assets/actors/shared-ishizu.png' else a->>'portrait' end));
    perform poc_private.validate_character(v);
    insert into public.poc_characters(id,profile,version) values(cid,v,nextval('poc_private.revision_seq')) on conflict(id) do nothing;
    a:=a||jsonb_build_object('character_id',cid);
   end if;
   actors:=actors||jsonb_build_array(a);
  end loop;
  v:=poc_private.resolve_characters(jsonb_set(s.document,'{actors}',actors));
  perform poc_private.validate_story(v);
  if v->'battles' is distinct from old_battles then raise exception 'battle preservation failed';end if;
  if v is distinct from s.document then
   select editor into editor_id from poc_private.story_history where scenario_id=s.id order by version desc limit 1;
   if editor_id is null then select editor into editor_id from poc_private.story_history order by version desc limit 1;end if;
   if editor_id is null then raise exception 'missing migration provenance';end if;
   newversion:=nextval('poc_private.revision_seq');
   insert into poc_private.story_history(version,document,editor,scenario_id) values(s.version,s.document,editor_id,s.id) on conflict do nothing;
   update public.poc_stories set document=v,version=newversion,updated_at=now() where id=s.id;
   insert into poc_private.story_history(version,document,editor,scenario_id) values(newversion,v,editor_id,s.id);
  end if;
 end loop;
end;$$;
-- Whole-library preservation and resolution checks run before COMMIT. Any
-- failure rolls back the schema and all backfilled documents together.
do $$declare s record;old_actors jsonb;new_actors jsonb;a jsonb;begin
 for s in select b.document as old_document,n.document as new_document from characters103_before b join public.poc_stories n using(id) loop
  if (s.old_document-'actors') is distinct from (s.new_document-'actors') then raise exception 'non-character story data changed';end if;
  select jsonb_agg(value-array['name','portrait','presentation','character_id'] order by value->>'actor_id') into old_actors from jsonb_array_elements(s.old_document->'actors');
  select jsonb_agg(value-array['name','portrait','presentation','character_id'] order by value->>'actor_id') into new_actors from jsonb_array_elements(s.new_document->'actors');
  if old_actors is distinct from new_actors then raise exception 'local actor skill preservation failed';end if;
  perform poc_private.validate_story(s.new_document);
 end loop;
 if (select count(*) from characters103_before)<>(select count(*) from public.poc_stories) then raise exception 'scenario count changed';end if;
 for a in select profile from public.poc_characters loop perform poc_private.validate_character(a);end loop;
end;$$;
revoke all on function poc_private.character_name(text),poc_private.validate_character(jsonb),poc_private.resolve_characters(jsonb),poc_private.validate_story(jsonb),poc_private.validate_story_before_characters103(jsonb),poc_private.save_scenario_before_characters103(text,jsonb,bigint) from public,anon,authenticated;
revoke all on function public.poc_load_characters(),public.poc_load_scenarios(),public.poc_load_story(),public.poc_save_characters(jsonb),public.poc_save_scenario(text,jsonb,bigint),public.poc_save_story(jsonb,bigint) from public,anon,authenticated;
grant execute on function public.poc_load_characters(),public.poc_load_scenarios(),public.poc_load_story() to anon,authenticated;
grant execute on function public.poc_save_characters(jsonb),public.poc_save_scenario(text,jsonb,bigint),public.poc_save_story(jsonb,bigint) to authenticated;
notify pgrst,'reload schema';
commit;
select 'shared character library ready' as result,(select count(*) from public.poc_characters) as characters,(select count(*) from public.poc_stories) as scenarios;
