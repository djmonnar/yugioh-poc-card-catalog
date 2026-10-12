-- Review candidate for the independent card-pack API. No other content tables
-- or user documents are modified. Apply and run pack_checks.sql in a transaction.
begin;
create table if not exists public.poc_card_packs(
 id text primary key check(id ~ '^[A-Za-z0-9_-]{1,100}$'),
 version bigint not null check(version>0),
 document jsonb not null check(jsonb_typeof(document)='object'),
 archived boolean not null default false,
 updated_at timestamptz not null default now()
);
create table if not exists poc_private.card_pack_history(
 version bigint primary key,pack_id text not null,document jsonb not null,
 archived boolean not null,editor uuid not null,updated_at timestamptz not null default now()
);
alter table public.poc_card_packs enable row level security;
alter table poc_private.card_pack_history enable row level security;
revoke all on public.poc_card_packs from public,anon,authenticated;
grant select on public.poc_card_packs to anon,authenticated;
revoke all on poc_private.card_pack_history from public,anon,authenticated;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='poc_card_packs' and policyname='poc_public_card_packs') then
  create policy poc_public_card_packs on public.poc_card_packs for select to anon,authenticated using(true);
 end if;
end; $$;

create or replace function poc_private.validate_pack_card(r jsonb) returns void
language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if jsonb_typeof(r) is distinct from 'object' then raise exception 'poc_invalid_pack_card'; end if;
 if not(r?&array['slot','internal_id','identity_key','name_ko']) or (select count(*) from jsonb_object_keys(r))<>4
 or jsonb_typeof(r->'slot') is distinct from 'number' or coalesce(r->>'slot','') !~ '^[0-9]{1,4}$'
 or jsonb_typeof(r->'internal_id') is distinct from 'number' or coalesce(r->>'internal_id','') !~ '^[0-9]{1,5}$'
 or jsonb_typeof(r->'identity_key') is distinct from 'string' or coalesce(r->>'identity_key','') !~ '^[a-f0-9]{64}$'
 or jsonb_typeof(r->'name_ko') is distinct from 'string' or length(r->>'name_ko')>200 then raise exception 'poc_invalid_pack_card'; end if;
 if (r->>'slot')::integer not between 1 and 2047 or (r->>'internal_id')::integer not between 0 and 65535
 or not exists(select 1 from poc_private.cards c where c.slot=(r->>'slot')::integer and c.internal_id=(r->>'internal_id')::integer and c.identity_key=r->>'identity_key' and not c.special)
 then raise exception 'poc_invalid_pack_card'; end if;
end; $$;
revoke all on function poc_private.validate_pack_card(jsonb) from public,anon,authenticated;

create or replace function poc_private.validate_card_pack(d jsonb) returns void
language plpgsql security invoker set search_path=pg_catalog as $$
declare r jsonb;seen integer[]:=array[]::integer[];
begin
 if d is null or jsonb_typeof(d) is distinct from 'object' or octet_length(d::text)>500000 then raise exception 'poc_invalid_pack'; end if;
 if not(d?&array['schema_version','kind','catalog_dataset_id','name','description','cover','enabled','price','cards_per_pack','odds','cards'])
 or (select count(*) from jsonb_object_keys(d))<>11 or d->'schema_version' is distinct from '1'::jsonb or d->>'kind' is distinct from 'poc-card-pack'
 or d->'price' is distinct from '200'::jsonb or d->'cards_per_pack' is distinct from '5'::jsonb
 or d->'odds' is distinct from '{"UR":2,"SR":6,"R":42,"N":50}'::jsonb
 or jsonb_typeof(d->'enabled') is distinct from 'boolean' or d->'cover' is distinct from '""'::jsonb
 or jsonb_typeof(d->'name') is distinct from 'string' or length(btrim(d->>'name')) not between 1 and 100
 or jsonb_typeof(d->'description') is distinct from 'string' or length(d->>'description')>2000
 or jsonb_typeof(d->'cards') is distinct from 'array' then raise exception 'poc_invalid_pack'; end if;
 if not exists(select 1 from poc_private.catalog where dataset=d->>'catalog_dataset_id') then raise exception 'poc_invalid_catalog'; end if;
 if jsonb_array_length(d->'cards')>2047 then raise exception 'poc_invalid_pack'; end if;
 for r in select value from jsonb_array_elements(d->'cards') loop
  perform poc_private.validate_pack_card(r);
  if (r->>'slot')::integer=any(seen) then raise exception 'poc_invalid_pack'; end if;
  seen:=array_append(seen,(r->>'slot')::integer);
 end loop;
end; $$;
revoke all on function poc_private.validate_card_pack(jsonb) from public,anon,authenticated;

create or replace function public.poc_load_card_packs() returns jsonb
language sql stable security invoker set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(to_jsonb(p) order by p.archived,p.id),'[]'::jsonb) from public.poc_card_packs p;
$$;
revoke all on function public.poc_load_card_packs() from public;
grant execute on function public.poc_load_card_packs() to anon,authenticated;

-- Write endpoints use a definer only to validate against the private catalog
-- and append private history. The allowlist check is inside each endpoint.
create or replace function public.poc_save_card_pack(p_pack_id text,p_document jsonb,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare old public.poc_card_packs;nextversion bigint;result jsonb;
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501'; end if;
 if p_pack_id is null or p_pack_id !~ '^[A-Za-z0-9_-]{1,100}$' then raise exception 'poc_invalid_pack'; end if;
 if p_expected_version is null or p_expected_version<0 then raise exception 'poc_pack_conflict'; end if;
 perform poc_private.validate_card_pack(p_document);
 perform pg_advisory_xact_lock(hashtextextended('poc-card-pack-library',0));
 select * into old from public.poc_card_packs where id=p_pack_id;
 if coalesce(old.version,0) is distinct from p_expected_version then raise exception 'poc_pack_conflict'; end if;
 if old.archived then raise exception 'poc_pack_archived'; end if;
 if old.version is null and (select count(*) from public.poc_card_packs)>=100 then raise exception 'poc_pack_limit'; end if;
 nextversion:=nextval('poc_private.revision_seq');
 insert into public.poc_card_packs(id,version,document,archived,updated_at) values(p_pack_id,nextversion,p_document,false,now())
 on conflict(id) do update set version=excluded.version,document=excluded.document,updated_at=excluded.updated_at
 returning to_jsonb(poc_card_packs.*) into result;
 insert into poc_private.card_pack_history(version,pack_id,document,archived,editor) values(nextversion,p_pack_id,p_document,false,auth.uid());
 return result;
end; $$;
revoke all on function public.poc_save_card_pack(text,jsonb,bigint) from public,anon;
grant execute on function public.poc_save_card_pack(text,jsonb,bigint) to authenticated;

create or replace function public.poc_set_card_pack_member(p_pack_id text,p_dataset text,p_card jsonb,p_included boolean,p_expected_version bigint)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare old public.poc_card_packs;d jsonb;members jsonb;
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501'; end if;
 if p_included is null then raise exception 'poc_invalid_pack'; end if;
 if not exists(select 1 from poc_private.catalog where dataset=p_dataset) then raise exception 'poc_invalid_catalog'; end if;
 perform poc_private.validate_pack_card(p_card);
 perform pg_advisory_xact_lock(hashtextextended('poc-card-pack-library',0));
 select * into old from public.poc_card_packs where id=p_pack_id;
 if old.version is null or p_expected_version is null or old.version is distinct from p_expected_version then raise exception 'poc_pack_conflict'; end if;
 if old.archived then raise exception 'poc_pack_archived'; end if;
 -- Change only this membership. Preserve the latest name, description, selling
 -- state, other memberships and fixed rates from this exact pack version.
 select coalesce(jsonb_agg(r.value order by r.ord),'[]'::jsonb) into members
 from jsonb_array_elements(old.document->'cards') with ordinality r(value,ord)
 where r.value->>'slot'<>p_card->>'slot';
 if p_included then members:=members||jsonb_build_array(p_card); end if;
 d:=jsonb_set(jsonb_set(old.document,'{cards}',members),'{catalog_dataset_id}',to_jsonb(p_dataset));
 return public.poc_save_card_pack(p_pack_id,d,p_expected_version);
end; $$;
revoke all on function public.poc_set_card_pack_member(text,text,jsonb,boolean,bigint) from public,anon;
grant execute on function public.poc_set_card_pack_member(text,text,jsonb,boolean,bigint) to authenticated;

create or replace function poc_private.set_card_pack_archived(p_pack_id text,p_expected_version bigint,p_archived boolean)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare old public.poc_card_packs;nextversion bigint;result jsonb;
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('poc-card-pack-library',0));
 select * into old from public.poc_card_packs where id=p_pack_id;
 if old.version is null or p_expected_version is null or old.version is distinct from p_expected_version then raise exception 'poc_pack_conflict'; end if;
 nextversion:=nextval('poc_private.revision_seq');
 update public.poc_card_packs set version=nextversion,archived=p_archived,updated_at=now() where id=p_pack_id returning to_jsonb(poc_card_packs.*) into result;
 insert into poc_private.card_pack_history(version,pack_id,document,archived,editor) values(nextversion,p_pack_id,old.document,p_archived,auth.uid());return result;
end; $$;
revoke all on function poc_private.set_card_pack_archived(text,bigint,boolean) from public,anon,authenticated;
create or replace function public.poc_archive_card_pack(p_pack_id text,p_expected_version bigint) returns jsonb
language sql security definer set search_path=pg_catalog as $$ select poc_private.set_card_pack_archived(p_pack_id,p_expected_version,true); $$;
create or replace function public.poc_restore_card_pack(p_pack_id text,p_expected_version bigint) returns jsonb
language sql security definer set search_path=pg_catalog as $$ select poc_private.set_card_pack_archived(p_pack_id,p_expected_version,false); $$;
revoke all on function public.poc_archive_card_pack(text,bigint) from public,anon;
revoke all on function public.poc_restore_card_pack(text,bigint) from public,anon;
grant execute on function public.poc_archive_card_pack(text,bigint),public.poc_restore_card_pack(text,bigint) to authenticated;
notify pgrst,'reload schema';
commit;
