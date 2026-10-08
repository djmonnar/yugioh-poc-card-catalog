-- Only public game recipes are readable. Email allowlist and history stay private.
begin;
create schema if not exists poc_private;
revoke all on schema poc_private from public, anon, authenticated;
create table if not exists poc_private.editors(email text primary key);
create table if not exists poc_private.catalog(dataset text primary key);
create table if not exists poc_private.cards(slot integer primary key, internal_id integer not null, identity_key text not null, fusion boolean not null, special boolean not null, limited integer not null, unlimited integer not null);
alter table poc_private.cards add column if not exists speed_limit integer check(speed_limit between 0 and 3);
create table if not exists poc_private.targets(filename text primary key, recipe jsonb not null, ruleset text not null);
create sequence if not exists poc_private.revision_seq;
create table if not exists poc_private.history(version bigint primary key, filename text not null, packet jsonb not null, editor uuid not null, updated_at timestamptz not null default now());
create table if not exists public.poc_ai_decks(filename text primary key, version bigint not null, packet jsonb not null, updated_at timestamptz not null default now());
alter table poc_private.editors enable row level security;
alter table poc_private.catalog enable row level security;
alter table poc_private.cards enable row level security;
alter table poc_private.targets enable row level security;
alter table poc_private.history enable row level security;
alter table public.poc_ai_decks enable row level security;
revoke all on public.poc_ai_decks from anon, authenticated;
grant select on public.poc_ai_decks to anon, authenticated;
do $$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='poc_ai_decks' and policyname='poc_public_recipes') then create policy poc_public_recipes on public.poc_ai_decks for select to anon,authenticated using(true); end if; end $$;
create or replace function poc_private.is_editor() returns boolean language sql stable security definer set search_path = pg_catalog as $$
select exists(select 1 from auth.users u join poc_private.editors e on lower(u.email)=e.email where u.id=auth.uid() and u.email_confirmed_at is not null);
$$;
create or replace function public.poc_editor_status() returns boolean language sql stable security definer set search_path = pg_catalog as $$ select poc_private.is_editor(); $$;
revoke all on function public.poc_editor_status() from public,anon;
grant execute on function public.poc_editor_status() to authenticated;
create or replace function poc_private.compact(j jsonb) returns text language plpgsql immutable set search_path = pg_catalog as $$
declare result text;
begin
 if jsonb_typeof(j)='array' then select '['||coalesce(string_agg(poc_private.compact(value),',' order by ord),'')||']' into result from jsonb_array_elements(j) with ordinality a(value,ord); return result;
 elsif jsonb_typeof(j)='object' then select '{'||coalesce(string_agg(to_jsonb(key)::text||':'||poc_private.compact(value),',' order by key collate "C"),'')||'}' into result from jsonb_each(j); return result;
 else return j::text; end if;
end; $$;
create or replace function poc_private.validate_packet(p jsonb) returns void language plpgsql set search_path = pg_catalog as $$
declare t poc_private.targets; d jsonb; g text; r jsonb; c poc_private.cards; ids jsonb := '[]'; totals jsonb := '{}'; seen integer[]; cnt integer; slotid integer; num integer; mainnum integer := 0; limitnum integer; k text; v jsonb; bucket integer; used integer;
begin
 if octet_length(p::text)>48000 or p->>'kind'<>'poc-ai-deck-sync' or p->'schema_version'<>'1'::jsonb or not exists(select 1 from poc_private.catalog where dataset=p->>'catalog_dataset_id') then raise exception 'poc_invalid_catalog'; end if;
 select * into t from poc_private.targets where filename=p#>>'{target,filename}';
 if not found or p->'target' is distinct from t.recipe then raise exception 'poc_invalid_target'; end if;
 d:=p->'deck';
 if d->>'ruleset' is distinct from t.ruleset or jsonb_typeof(d->'banlist_enabled') is distinct from 'boolean' or jsonb_typeof(d->'name') is distinct from 'string' or length(d->>'name') not between 1 and 80 or jsonb_typeof(d->'difficulty') is distinct from 'number' or coalesce(d->>'difficulty','') !~ '^[1-7]$' then raise exception 'poc_invalid_deck'; end if;
 if jsonb_typeof(d->'strategy') is distinct from 'object' or not (d->'strategy' ?& array['goal','priorities','combos','avoid']) or (select count(*) from jsonb_object_keys(d->'strategy'))<>4 then raise exception 'poc_invalid_notes'; end if;
 for v in select value from jsonb_each(d->'strategy') loop if jsonb_typeof(v)<>'string' or length(v#>>'{}')>6000 then raise exception 'poc_invalid_notes'; end if; end loop;
 if jsonb_typeof(d->'groups') is distinct from 'object' or not (d->'groups' ?& array['main','extra','side']) or (select count(*) from jsonb_object_keys(d->'groups'))<>3 then raise exception 'poc_invalid_groups'; end if;
 foreach g in array array['main','extra','side'] loop
  if jsonb_typeof(d->'groups'->g) is distinct from 'array' or jsonb_array_length(d->'groups'->g)>80 then raise exception 'poc_invalid_rows'; end if;
  cnt:=0; seen:=array[]::integer[];
  for r in select value from jsonb_array_elements(d->'groups'->g) loop
   if jsonb_typeof(r)<>'array' or jsonb_array_length(r)<>3 or jsonb_typeof(r->0) is distinct from 'number' or jsonb_typeof(r->1) is distinct from 'number' or jsonb_typeof(r->2) is distinct from 'number' or r->>0 !~ '^\d+$' or r->>1 !~ '^\d+$' or r->>2 !~ '^[1-3]$' then raise exception 'poc_invalid_row'; end if;
   slotid:=(r->>0)::integer; num:=(r->>2)::integer;
   select * into c from poc_private.cards where slot=slotid and internal_id=(r->>1)::integer;
   if not found or c.special or c.fusion<>(g='extra') or slotid=any(seen) then raise exception 'poc_invalid_card'; end if;
   seen:=array_append(seen,slotid); cnt:=cnt+num;
   totals:=jsonb_set(totals,array[slotid::text],to_jsonb(coalesce((totals->>slotid::text)::integer,0)+num));
   ids:=ids||jsonb_build_array(jsonb_build_array(g,slotid,c.internal_id,num,c.identity_key));
  end loop;
  if g='main' then mainnum:=cnt; elsif cnt>15 then raise exception 'poc_invalid_size'; end if;
 end loop;
 if (t.ruleset='classic' and mainnum not between 40 and 80) or (t.ruleset='duel_links_plan' and mainnum not between 20 and 30) then raise exception 'poc_invalid_size'; end if;
 for k,v in select * from jsonb_each(totals) loop
  if v::text::integer>3 then raise exception 'poc_copy_limit'; end if;
 end loop;
 if encode(sha256(convert_to(poc_private.compact(ids),'UTF8')),'hex') is distinct from p->>'identity_sha256' then raise exception 'poc_identity_changed'; end if;
 if (select coalesce(sum(e.amount::text::integer),0) from jsonb_each(totals) as e(slot_key,amount) join poc_private.cards harpie_card on harpie_card.slot=e.slot_key::integer
     where (harpie_card.slot,harpie_card.internal_id) in ((108,1530),(606,609),(696,61),(697,1249),(827,608)))>3 then
  raise exception 'poc_harpie_shared_copy_limit';
 end if;
 if (select coalesce(sum(e.amount::text::integer),0) from jsonb_each(totals) as e(slot_key,amount)
     join poc_private.cards c on c.slot=e.slot_key::integer
     where (c.slot,c.internal_id) in ((86,333),(98,2040)))>3 then
  raise exception 'poc_umi_shared_copy_limit';
 end if;
end; $$;
create or replace function public.poc_load_ai_decks() returns jsonb language sql stable security definer set search_path = pg_catalog as $$
select coalesce(jsonb_agg(jsonb_build_object('filename',filename,'version',version,'packet',packet,'updated_at',updated_at) order by filename),'[]'::jsonb) from public.poc_ai_decks;
$$;
revoke all on function public.poc_load_ai_decks() from public;
grant execute on function public.poc_load_ai_decks() to anon, authenticated;
create or replace function public.poc_save_ai_deck(p_packet jsonb,p_expected_version bigint) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare fname text; oldversion bigint; nextversion bigint; stamp timestamptz:=now();
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501'; end if;
 perform poc_private.validate_packet(p_packet); fname:=p_packet#>>'{target,filename}';
 perform pg_advisory_xact_lock(hashtextextended('poc-ai:'||fname,0));
 select version into oldversion from public.poc_ai_decks where filename=fname;
 if coalesce(oldversion,0) is distinct from p_expected_version then raise exception 'poc_conflict'; end if;
 nextversion:=nextval('poc_private.revision_seq');
 insert into poc_private.history(version,filename,packet,editor,updated_at) values(nextversion,fname,p_packet,auth.uid(),stamp);
 insert into public.poc_ai_decks values(fname,nextversion,p_packet,stamp) on conflict(filename) do update set version=excluded.version,packet=excluded.packet,updated_at=excluded.updated_at;
 return jsonb_build_object('filename',fname,'version',nextversion,'packet',p_packet,'updated_at',stamp);
end; $$;
revoke all on function public.poc_save_ai_deck(jsonb,bigint) from public,anon;
grant execute on function public.poc_save_ai_deck(jsonb,bigint) to authenticated;
revoke all on all functions in schema poc_private from public,anon,authenticated;
revoke all on all tables in schema poc_private from public,anon,authenticated;
revoke all on all sequences in schema poc_private from public,anon,authenticated;
commit;
