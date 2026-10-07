-- Public catalogue categories; editing remains with the existing email allowlist.
begin;
create table if not exists public.poc_card_categories(name text primary key check(length(name) between 1 and 40),created_at timestamptz not null default now());
create table if not exists public.poc_card_annotations(slot integer primary key,internal_id integer not null,identity_key text not null,tags jsonb not null,links jsonb not null,version bigint not null,updated_at timestamptz not null default now());
create table if not exists poc_private.annotation_history(version bigint primary key,annotation jsonb not null,editor uuid not null,updated_at timestamptz not null default now());
alter table public.poc_card_categories enable row level security;
alter table public.poc_card_annotations enable row level security;
alter table poc_private.annotation_history enable row level security;
revoke all on public.poc_card_categories,public.poc_card_annotations from public,anon,authenticated;
revoke all on poc_private.annotation_history from public,anon,authenticated;
grant select on public.poc_card_categories,public.poc_card_annotations to anon,authenticated;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='poc_card_categories' and policyname='poc_public_categories') then create policy poc_public_categories on public.poc_card_categories for select to anon,authenticated using(true);end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='poc_card_annotations' and policyname='poc_public_annotations') then create policy poc_public_annotations on public.poc_card_annotations for select to anon,authenticated using(true);end if;
end; $$;
create or replace function public.poc_load_card_annotations() returns jsonb language sql stable security definer set search_path=pg_catalog as $$
select jsonb_build_object('categories',(select coalesce(jsonb_agg(jsonb_build_object('name',name) order by name),'[]') from public.poc_card_categories),
 'annotations',(select coalesce(jsonb_agg(to_jsonb(s) order by s.slot),'[]') from public.poc_card_annotations s join poc_private.cards c on c.slot=s.slot and c.internal_id=s.internal_id and c.identity_key=s.identity_key));
$$;
create or replace function public.poc_create_card_category(p_name text) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501';end if;
 if p_name is null or length(p_name) not between 1 and 40 or p_name<>btrim(p_name) or p_name~'[[:cntrl:]]' then raise exception 'poc_invalid_category';end if;
 perform pg_advisory_xact_lock(hashtextextended('poc-categories',0));
 if not exists(select 1 from public.poc_card_categories where name=p_name) and (select count(*) from public.poc_card_categories)>=128 then raise exception 'poc_category_maximum';end if;
 insert into public.poc_card_categories(name) values(p_name) on conflict do nothing;
 return jsonb_build_object('name',p_name);
end; $$;
create or replace function public.poc_save_card_annotation(p_dataset text,p_slot integer,p_identity_key text,p_tags jsonb,p_links jsonb,p_expected_version bigint) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare c poc_private.cards;r jsonb;oldversion bigint;nextversion bigint;result jsonb;seen integer[]:=array[]::integer[];
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501';end if;
 if not exists(select 1 from poc_private.catalog where dataset=p_dataset) then raise exception 'poc_invalid_catalog';end if;
 select * into c from poc_private.cards where slot=p_slot and identity_key=p_identity_key;
 if not found then raise exception 'poc_identity_changed';end if;
 if jsonb_typeof(p_tags) is distinct from 'array' or jsonb_array_length(p_tags)>12 or jsonb_typeof(p_links) is distinct from 'array' or jsonb_array_length(p_links)>20 or p_expected_version is null or p_expected_version<0 then raise exception 'poc_invalid_annotation';end if;
 if (select count(*) from jsonb_array_elements(p_tags))<>(select count(distinct value) from jsonb_array_elements(p_tags)) then raise exception 'poc_invalid_annotation';end if;
 for r in select value from jsonb_array_elements(p_tags) loop
  if jsonb_typeof(r)<>'string' or not exists(select 1 from public.poc_card_categories where name=r#>>'{}') then raise exception 'poc_invalid_category';end if;
 end loop;
 for r in select value from jsonb_array_elements(p_links) loop
  if jsonb_typeof(r)<>'object' or (select count(*) from jsonb_object_keys(r))<>2 or not(r?&array['slot','identity_key']) or jsonb_typeof(r->'slot') is distinct from 'number' or r->>'slot'!~'^\d+$' or jsonb_typeof(r->'identity_key') is distinct from 'string' then raise exception 'poc_invalid_annotation';end if;
  if (r->>'slot')::integer=p_slot or (r->>'slot')::integer=any(seen) or not exists(select 1 from poc_private.cards where slot=(r->>'slot')::integer and identity_key=r->>'identity_key') then raise exception 'poc_identity_changed';end if;
  seen:=array_append(seen,(r->>'slot')::integer);
 end loop;
 perform pg_advisory_xact_lock(hashtextextended('poc-annotation:'||p_slot,0));
 select version into oldversion from public.poc_card_annotations where slot=p_slot and identity_key=c.identity_key;
 if coalesce(oldversion,0) is distinct from p_expected_version then raise exception 'poc_conflict';end if;
 nextversion:=nextval('poc_private.revision_seq');
 insert into public.poc_card_annotations values(c.slot,c.internal_id,c.identity_key,p_tags,p_links,nextversion,now()) on conflict(slot) do update set internal_id=excluded.internal_id,identity_key=excluded.identity_key,tags=excluded.tags,links=excluded.links,version=excluded.version,updated_at=excluded.updated_at returning to_jsonb(poc_card_annotations.*) into result;
 insert into poc_private.annotation_history values(nextversion,result,auth.uid(),now());return result;
end; $$;
revoke all on function public.poc_load_card_annotations() from public;
grant execute on function public.poc_load_card_annotations() to anon,authenticated;
revoke all on function public.poc_create_card_category(text),public.poc_save_card_annotation(text,integer,text,jsonb,jsonb,bigint) from public,anon;
grant execute on function public.poc_create_card_category(text),public.poc_save_card_annotation(text,integer,text,jsonb,jsonb,bigint) to authenticated;
commit;
select 'card categories and related links installed' as status,public.poc_load_card_annotations() as current_data;
