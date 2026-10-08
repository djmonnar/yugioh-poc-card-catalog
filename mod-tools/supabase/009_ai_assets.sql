-- Independent AI deck assets. Existing 42 targets, packets and stories stay intact.
begin;
-- Retain the deployed validator, correcting only its ambiguous Umi table alias.
do $repair$
declare definition text;
begin
 definition:=pg_get_functiondef('poc_private.validate_packet(jsonb)'::regprocedure);
 if position('join poc_private.cards c on c.slot=e.slot_key::integer' in definition)>0 then
  definition:=replace(definition,'join poc_private.cards c on c.slot=e.slot_key::integer','join poc_private.cards umi_card on umi_card.slot=e.slot_key::integer');
  definition:=replace(definition,'where (c.slot,c.internal_id) in ((86,333),(98,2040))','where (umi_card.slot,umi_card.internal_id) in ((86,333),(98,2040))');
  execute definition;
 end if;
end; $repair$;
create table if not exists poc_private.ai_asset_requests(
 request_id uuid primary key, filename text unique not null references poc_private.targets(filename),
 editor uuid not null, source_packet jsonb not null, result jsonb not null
);
alter table poc_private.ai_asset_requests enable row level security;
revoke all on poc_private.ai_asset_requests from public,anon,authenticated;
create or replace function public.poc_create_ai_deck(p_packet jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $body$
declare old poc_private.ai_asset_requests; fname text; prefix text; target jsonb; packet jsonb; result jsonb;
begin
 if not poc_private.is_editor() then raise exception 'poc_editor_required' using errcode='42501'; end if;
 if p_request_id is null then raise exception 'poc_invalid_request'; end if;
 perform pg_advisory_xact_lock(hashtextextended('poc-ai-asset-create',0));
 select * into old from poc_private.ai_asset_requests where request_id=p_request_id;
 if found then
  if old.editor is distinct from auth.uid() or old.source_packet is distinct from p_packet then raise exception 'poc_conflict'; end if;
  return old.result;
 end if;
 -- Validate card identities and size before allocating anything. Input uses
 -- an existing same-mode target as a template; its saved deck is never changed.
 perform poc_private.validate_packet(p_packet);
 if (select count(*) from poc_private.ai_asset_requests)>=100 then raise exception 'poc_ai_asset_limit'; end if;
 prefix:=case p_packet#>>'{deck,ruleset}' when 'classic' then 'cpu_' else 'DLR_' end;
 select prefix||n::text||'.ydc' into fname from generate_series(100,199) n
 where not exists(select 1 from poc_private.targets t where t.filename=prefix||n::text||'.ydc') order by n limit 1;
 if fname is null then raise exception 'poc_ai_asset_limit'; end if;
 target:=jsonb_build_object('filename',fname,'sha256','12a33979cd45f2158648670699351c44de64e0f1572e45c80fe47ee0a6d658db',
  'difficulty_levels',jsonb_build_array((p_packet#>>'{deck,difficulty}')::integer));
 insert into poc_private.targets values(fname,target,p_packet#>>'{deck,ruleset}');
 packet:=jsonb_set(p_packet,'{target}',target);
 result:=public.poc_save_ai_deck(packet,0);
 insert into poc_private.ai_asset_requests values(p_request_id,fname,auth.uid(),p_packet,result);
 return result;
end; $body$;
revoke all on function public.poc_create_ai_deck(jsonb,uuid) from public,anon;
grant execute on function public.poc_create_ai_deck(jsonb,uuid) to authenticated;
commit;
