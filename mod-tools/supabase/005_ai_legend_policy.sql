begin;
create table if not exists public.poc_card_settings(slot integer primary key,internal_id integer not null,identity_key text not null,rarity text not null,stock boolean not null,version bigint not null,updated_at timestamptz not null default now());
alter table public.poc_card_settings add column if not exists draw_enabled boolean not null default true;
alter table public.poc_card_settings drop constraint if exists poc_card_settings_rarity_check;
alter table public.poc_card_settings add constraint poc_card_settings_rarity_check check(rarity in ('L','UR','SR','R','N'));
alter table public.poc_card_settings drop constraint if exists poc_card_settings_legend_check;
alter table public.poc_card_settings add constraint poc_card_settings_legend_check check(rarity <> 'L' or (not stock and not draw_enabled));
create table if not exists poc_private.card_history(version bigint primary key,setting jsonb not null,editor uuid not null,updated_at timestamptz not null default now());
alter table public.poc_card_settings enable row level security;
alter table poc_private.card_history enable row level security;
revoke all on public.poc_card_settings from public,anon,authenticated;
grant select on public.poc_card_settings to anon,authenticated;
revoke all on poc_private.card_history from public,anon,authenticated;
do $$ begin if not exists(select 1 from pg_policies where schemaname='public' and tablename='poc_card_settings' and policyname='poc_public_card_settings') then create policy poc_public_card_settings on public.poc_card_settings for select to anon,authenticated using(true); end if; end $$;
create or replace function public.poc_load_card_settings() returns jsonb language sql stable security definer set search_path=pg_catalog as $$
select coalesce(jsonb_agg(to_jsonb(s) order by s.slot),'[]'::jsonb) from public.poc_card_settings s join poc_private.cards c on c.slot=s.slot and c.internal_id=s.internal_id and c.identity_key=s.identity_key where not c.special;
$$;
revoke all on function public.poc_load_card_settings() from public;
grant execute on function public.poc_load_card_settings() to anon,authenticated;
create or replace function public.poc_save_card_setting_v2(p_dataset text,p_slot integer,p_identity_key text,p_rarity text,p_stock boolean,p_expected_version bigint,p_draw_enabled boolean) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare c poc_private.cards; oldversion bigint; nextversion bigint; result jsonb;
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501'; end if;
 if not exists(select 1 from poc_private.catalog where dataset=p_dataset) then raise exception 'poc_invalid_catalog'; end if;
 select * into c from poc_private.cards where slot=p_slot and identity_key=p_identity_key and not special;
 if not found then raise exception 'poc_identity_changed'; end if;
 if p_rarity is null or p_rarity not in ('L','UR','SR','R','N') or p_stock is null or p_draw_enabled is null then raise exception 'poc_invalid_card_setting'; end if;
 perform pg_advisory_xact_lock(hashtextextended('poc-card:'||p_slot,0));
 select version into oldversion from public.poc_card_settings where slot=p_slot and identity_key=c.identity_key;
 if coalesce(oldversion,0) is distinct from p_expected_version then raise exception 'poc_conflict'; end if;
 nextversion:=nextval('poc_private.revision_seq');
 insert into public.poc_card_settings(slot,internal_id,identity_key,rarity,stock,version,updated_at,draw_enabled)
 values(c.slot,c.internal_id,c.identity_key,p_rarity,p_stock and p_rarity<>'L',nextversion,now(),p_draw_enabled and p_rarity<>'L')
 on conflict(slot) do update set internal_id=excluded.internal_id,identity_key=excluded.identity_key,rarity=excluded.rarity,stock=excluded.stock,version=excluded.version,updated_at=excluded.updated_at,draw_enabled=excluded.draw_enabled returning to_jsonb(poc_card_settings.*) into result;
 insert into poc_private.card_history values(nextversion,result,auth.uid(),now());
 return result;
end; $$;
revoke all on function public.poc_save_card_setting_v2(text,integer,text,text,boolean,bigint,boolean) from public,anon;
grant execute on function public.poc_save_card_setting_v2(text,integer,text,text,boolean,bigint,boolean) to authenticated;
-- Older clients preserve the current draw policy.
create or replace function public.poc_save_card_setting(p_dataset text,p_slot integer,p_identity_key text,p_rarity text,p_stock boolean,p_expected_version bigint) returns jsonb language sql security definer set search_path=pg_catalog as $$
select public.poc_save_card_setting_v2(p_dataset,p_slot,p_identity_key,p_rarity,p_stock,p_expected_version,coalesce((select s.draw_enabled from public.poc_card_settings s where s.slot=p_slot and s.identity_key=p_identity_key),true));
$$;
revoke all on function public.poc_save_card_setting(text,integer,text,text,boolean,bigint) from public,anon;
grant execute on function public.poc_save_card_setting(text,integer,text,text,boolean,bigint) to authenticated;
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
end; $$;
commit;
