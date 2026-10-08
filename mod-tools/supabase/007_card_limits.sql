begin;
create table if not exists public.poc_card_limits(
 slot integer primary key,internal_id integer not null,identity_key text not null,
 normal_limit integer check(normal_limit between 0 and 3),
 speed_limit integer check(speed_limit between -1 and 3),
 version bigint not null,updated_at timestamptz not null default now());
comment on column public.poc_card_limits.speed_limit is 'NULL = original policy; -1 = unrestricted; 0 = forbidden; 1/2/3 = aggregate group. Player only.';
create table if not exists poc_private.card_limit_history(version bigint primary key,setting jsonb not null,editor uuid not null,updated_at timestamptz not null default now());
alter table public.poc_card_limits enable row level security;
alter table poc_private.card_limit_history enable row level security;
revoke all on public.poc_card_limits from public,anon,authenticated;
revoke all on poc_private.card_limit_history from public,anon,authenticated;
-- Only identity-checked RPCs expose rows. Direct client writes are disabled.
create or replace function public.poc_load_card_limits() returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(to_jsonb(s) order by s.slot),'[]'::jsonb) from public.poc_card_limits s join poc_private.cards c on c.slot=s.slot and c.internal_id=s.internal_id and c.identity_key=s.identity_key where not c.special;
$$;
revoke all on function public.poc_load_card_limits() from public;
grant execute on function public.poc_load_card_limits() to anon,authenticated;
create or replace function public.poc_save_card_limit(p_dataset text,p_slot integer,p_identity_key text,p_normal_limit integer,p_speed_limit integer,p_expected_version bigint) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare c poc_private.cards; oldversion bigint; nextversion bigint; result jsonb;
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501'; end if;
 if not exists(select 1 from poc_private.catalog where dataset=p_dataset) then raise exception 'poc_invalid_catalog'; end if;
 select * into c from poc_private.cards where slot=p_slot and identity_key=p_identity_key and not special;
 if not found then raise exception 'poc_identity_changed'; end if;
 if (p_normal_limit is not null and p_normal_limit not between 0 and 3) or (p_speed_limit is not null and p_speed_limit not between -1 and 3) or p_expected_version is null or p_expected_version<0 then raise exception 'poc_invalid_card_limit'; end if;
 perform pg_advisory_xact_lock(hashtextextended('poc-limit:'||p_slot,0));
 select version into oldversion from public.poc_card_limits where slot=p_slot and identity_key=c.identity_key;
 if coalesce(oldversion,0) is distinct from p_expected_version then raise exception 'poc_conflict'; end if;
 nextversion:=nextval('poc_private.revision_seq');
 insert into public.poc_card_limits(slot,internal_id,identity_key,normal_limit,speed_limit,version,updated_at)
 values(c.slot,c.internal_id,c.identity_key,p_normal_limit,p_speed_limit,nextversion,now())
 on conflict(slot) do update set internal_id=excluded.internal_id,identity_key=excluded.identity_key,normal_limit=excluded.normal_limit,speed_limit=excluded.speed_limit,version=excluded.version,updated_at=excluded.updated_at returning to_jsonb(poc_card_limits.*) into result;
 insert into poc_private.card_limit_history values(nextversion,result,auth.uid(),now());return result;
end; $$;
revoke all on function public.poc_save_card_limit(text,integer,text,integer,integer,bigint) from public,anon;
grant execute on function public.poc_save_card_limit(text,integer,text,integer,integer,bigint) to authenticated;
notify pgrst,'reload schema';
commit;
