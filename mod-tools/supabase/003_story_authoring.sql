-- Authoring data only. These RPCs never launch a duel or grant a reward.
begin;
create table if not exists public.poc_stories(id text primary key check(id='main'),document jsonb not null,version bigint not null,updated_at timestamptz not null default now());
create table if not exists poc_private.story_history(version bigint primary key,document jsonb not null,editor uuid not null,updated_at timestamptz not null default now());
alter table public.poc_stories enable row level security;
alter table poc_private.story_history enable row level security;
revoke all on public.poc_stories,poc_private.story_history from public,anon,authenticated;
grant select on public.poc_stories to anon,authenticated;
do $$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='poc_stories' and policyname='poc_read_stories') then create policy poc_read_stories on public.poc_stories for select to anon,authenticated using(true); end if; end $$;
create or replace function poc_private.story_card(ref jsonb) returns void language plpgsql set search_path=pg_catalog as $$
begin
 if jsonb_typeof(ref) is distinct from 'object' or not (ref ?& array['slot','internal_id','identity_key','name_ko']) or jsonb_typeof(ref->'slot') is distinct from 'number' or jsonb_typeof(ref->'internal_id') is distinct from 'number' or ref->>'slot' !~ '^\d+$' or ref->>'internal_id' !~ '^\d+$' or ref->>'identity_key' !~ '^[a-f0-9]{64}$' then raise exception 'poc_invalid_story_card'; end if;
 if not exists(select 1 from poc_private.cards c where c.slot=(ref->>'slot')::integer and c.internal_id=(ref->>'internal_id')::integer and c.identity_key=ref->>'identity_key' and not c.special) then raise exception 'poc_identity_changed'; end if;
end; $$;
revoke all on function poc_private.story_card(jsonb) from public,anon,authenticated;
create or replace function poc_private.validate_story(d jsonb) returns void language plpgsql set search_path=pg_catalog as $$
declare a jsonb;b jsonb;s jsonb;r jsonb;g text;actors text[]:=array[]::text[];battles text[]:=array[]::text[];skills text[];t poc_private.targets;
begin
 if octet_length(d::text)>1048576 or jsonb_typeof(d) is distinct from 'object' or d->>'schema_version' is distinct from '1' or d->>'kind' is distinct from 'poc-story-authoring' or not (d ?& array['title','catalog_dataset_id','actors','battles']) or (select count(*) from jsonb_object_keys(d))<>6 then raise exception 'poc_invalid_story'; end if;
 if jsonb_typeof(d->'title') is distinct from 'string' or length(d->>'title') not between 1 and 200 or not exists(select 1 from poc_private.catalog where dataset=d->>'catalog_dataset_id') then raise exception 'poc_invalid_catalog'; end if;
 if jsonb_typeof(d->'actors') is distinct from 'array' or jsonb_typeof(d->'battles') is distinct from 'array' or jsonb_array_length(d->'actors')>100 or jsonb_array_length(d->'battles')>100 then raise exception 'poc_invalid_story'; end if;
 for a in select value from jsonb_array_elements(d->'actors') loop
  if jsonb_typeof(a) is distinct from 'object' or not (a ?& array['actor_id','name','portrait','skills']) or (select count(*) from jsonb_object_keys(a))<>4 or a->>'actor_id' !~ '^[A-Za-z0-9_-]{1,100}$' or (a->>'actor_id')=any(actors) or jsonb_typeof(a->'name') is distinct from 'string' or length(a->>'name') not between 1 and 100 then raise exception 'poc_invalid_story_actor'; end if;
  actors:=array_append(actors,a->>'actor_id');
  if jsonb_typeof(a->'portrait') is distinct from 'string' or length(a->>'portrait')>1000 or (a->>'portrait') like '%..%' or not (a->>'portrait'='' or a->>'portrait' ~ '^(assets|content-packs)/[A-Za-z0-9_./-]+\.(png|jpe?g|webp)$' or a->>'portrait' ~ '^https://[a-z]{20}\.supabase\.co/storage/v1/object/public/poc-story-assets/[A-Za-z0-9_./-]+\.(png|jpe?g|webp)$') then raise exception 'poc_invalid_story_portrait'; end if;
  if jsonb_typeof(a->'skills') is distinct from 'array' or jsonb_array_length(a->'skills')>5 then raise exception 'poc_invalid_story_skill'; end if;
  skills:=array[]::text[];
  for s in select value from jsonb_array_elements(a->'skills') loop
   if jsonb_typeof(s) is distinct from 'object' or s->>'kind' is null or (s->>'kind')=any(skills) or s->>'kind' not in ('lp_bonus','heal_once','start_hand','start_field','add_hand_once') then raise exception 'poc_invalid_story_skill'; end if;
   skills:=array_append(skills,s->>'kind');
   if s->>'kind' in ('lp_bonus','heal_once') then
    if jsonb_typeof(s->'value') is distinct from 'number' or s->>'value' !~ '^\d+$' or (s->>'value')::integer not between 100 and 8000 then raise exception 'poc_invalid_story_skill'; end if;
   else perform poc_private.story_card(s->'card'); end if;
  end loop;
 end loop;
 for b in select value from jsonb_array_elements(d->'battles') loop
  if jsonb_typeof(b) is distinct from 'object' or not (b ?& array['battle_id','name','actor_id','recipe','ruleset','intro','win','loss','rewards']) or (select count(*) from jsonb_object_keys(b))<>9 or b->>'battle_id' !~ '^[A-Za-z0-9_-]{1,100}$' or (b->>'battle_id')=any(battles) or jsonb_typeof(b->'name') is distinct from 'string' or length(b->>'name') not between 1 and 100 then raise exception 'poc_invalid_story_battle'; end if;
  battles:=array_append(battles,b->>'battle_id');
  if not ((b->>'actor_id')=any(actors)) then raise exception 'poc_invalid_story_actor'; end if;
  select * into t from poc_private.targets where filename=b->>'recipe';
  if not found or t.ruleset is distinct from b->>'ruleset' then raise exception 'poc_invalid_story_deck'; end if;
  foreach g in array array['intro','win','loss'] loop if jsonb_typeof(b->g) is distinct from 'string' or length(b->>g)>6000 then raise exception 'poc_invalid_story_text'; end if; end loop;
  if jsonb_typeof(b->'rewards') is distinct from 'object' or not (b->'rewards' ?& array['first','repeat']) or (select count(*) from jsonb_object_keys(b->'rewards'))<>2 then raise exception 'poc_invalid_story_reward'; end if;
  foreach g in array array['first','repeat'] loop
   if jsonb_typeof(b->'rewards'->g) is distinct from 'array' or jsonb_array_length(b->'rewards'->g)>20 then raise exception 'poc_invalid_story_reward'; end if;
   for r in select value from jsonb_array_elements(b->'rewards'->g) loop
    if jsonb_typeof(r) is distinct from 'object' then raise exception 'poc_invalid_story_reward'; end if;
    if r->>'kind'='gold' then
     if jsonb_typeof(r->'amount') is distinct from 'number' or r->>'amount' !~ '^\d+$' or (r->>'amount')::integer not between 1 and 100000 then raise exception 'poc_invalid_story_reward'; end if;
    elsif r->>'kind' in ('card','random') then
     if jsonb_typeof(r->'count') is distinct from 'number' or r->>'count' !~ '^[1-3]$' then raise exception 'poc_invalid_story_reward'; end if;
     if r->>'kind'='card' then perform poc_private.story_card(r->'card');
     elsif r->>'rarity' is null or r->>'rarity' not in ('ANY','N','R','SR','UR') then raise exception 'poc_invalid_story_reward'; end if;
    else raise exception 'poc_invalid_story_reward'; end if;
   end loop;
  end loop;
 end loop;
end; $$;
revoke all on function poc_private.validate_story(jsonb) from public,anon,authenticated;
create or replace function public.poc_load_story() returns jsonb language sql stable security definer set search_path=pg_catalog as $$
select to_jsonb(s) from public.poc_stories s where id='main'; $$;
revoke all on function public.poc_load_story() from public;
grant execute on function public.poc_load_story() to anon,authenticated;
create or replace function public.poc_save_story(p_document jsonb,p_expected_version bigint) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare oldversion bigint;nextversion bigint;result jsonb;
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501'; end if;
 if p_expected_version is null or p_expected_version<0 then raise exception 'poc_conflict'; end if;
 perform poc_private.validate_story(p_document);perform pg_advisory_xact_lock(hashtextextended('poc-story:main',0));
 select version into oldversion from public.poc_stories where id='main';
 if coalesce(oldversion,0) is distinct from p_expected_version then raise exception 'poc_conflict'; end if;
 nextversion:=nextval('poc_private.revision_seq');
 insert into public.poc_stories values('main',p_document,nextversion,now()) on conflict(id) do update set document=excluded.document,version=excluded.version,updated_at=excluded.updated_at returning to_jsonb(poc_stories.*) into result;
 insert into poc_private.story_history values(nextversion,p_document,auth.uid(),now());return result;
end; $$;
revoke all on function public.poc_save_story(jsonb,bigint) from public,anon;
grant execute on function public.poc_save_story(jsonb,bigint) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('poc-story-assets','poc-story-assets',true,3145728,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
do $$ begin if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='poc_story_assets_editor_upload') then create policy poc_story_assets_editor_upload on storage.objects for insert to authenticated with check(bucket_id='poc-story-assets' and (select public.poc_editor_status())); end if; end $$;
commit;
