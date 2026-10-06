begin;
create table if not exists public.poc_card_settings(slot integer primary key,internal_id integer not null,identity_key text not null,rarity text not null check(rarity in ('UR','SR','R','N')),stock boolean not null,version bigint not null,updated_at timestamptz not null default now());
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
create or replace function public.poc_save_card_setting(p_dataset text,p_slot integer,p_identity_key text,p_rarity text,p_stock boolean,p_expected_version bigint) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare c poc_private.cards; oldversion bigint; nextversion bigint; result jsonb;
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501'; end if;
 if not exists(select 1 from poc_private.catalog where dataset=p_dataset) then raise exception 'poc_invalid_catalog'; end if;
 select * into c from poc_private.cards where slot=p_slot and identity_key=p_identity_key and not special;
 if not found then raise exception 'poc_identity_changed'; end if;
 if p_rarity is null or p_rarity not in ('UR','SR','R','N') or p_stock is null then raise exception 'poc_invalid_card_setting'; end if;
 perform pg_advisory_xact_lock(hashtextextended('poc-card:'||p_slot,0));
 select version into oldversion from public.poc_card_settings where slot=p_slot and identity_key=c.identity_key;
 if coalesce(oldversion,0) is distinct from p_expected_version then raise exception 'poc_conflict'; end if;
 nextversion:=nextval('poc_private.revision_seq');
 insert into public.poc_card_settings values(c.slot,c.internal_id,c.identity_key,p_rarity,p_stock,nextversion,now()) on conflict(slot) do update set internal_id=excluded.internal_id,identity_key=excluded.identity_key,rarity=excluded.rarity,stock=excluded.stock,version=excluded.version,updated_at=excluded.updated_at returning to_jsonb(poc_card_settings.*) into result;
 insert into poc_private.card_history values(nextversion,result,auth.uid(),now());
 return result;
end; $$;
revoke all on function public.poc_save_card_setting(text,integer,text,text,boolean,bigint) from public,anon;
grant execute on function public.poc_save_card_setting(text,integer,text,text,boolean,bigint) to authenticated;
commit;
