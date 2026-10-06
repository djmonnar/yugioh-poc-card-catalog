import json,pathlib
root=pathlib.Path(__file__).resolve().parents[2]
data=json.loads((root/'data/cards.json').read_text(encoding='utf-8'));c=next(c for c in data['cards'] if c['slot']==316)
uid='bb1f0a14-ef35-4f55-bd67-8f8f5c57a332'
sql=f"""begin;
insert into poc_private.editors values('poc-card-qa@invalid.example') on conflict do nothing;
insert into auth.users(id,email,email_confirmed_at) values('{uid}','poc-card-qa@invalid.example',now());
select set_config('request.jwt.claims','{{"sub":"{uid}","role":"authenticated"}}',true);
set local role authenticated;
do $check$ declare result jsonb; old bigint; dataset text:='{data['meta']['dataset_id']}'; identity text:='{c['identity_key']}';
begin
 select coalesce(max(version),0) into old from public.poc_card_settings where slot=316 and identity_key=identity;
 result:=public.poc_save_card_setting(dataset,316,identity,'UR',true,old);
 if result->>'rarity'<>'UR' or result->'stock'<>'true'::jsonb then raise exception 'setting save failed'; end if;
 begin perform public.poc_save_card_setting(dataset,316,identity,'N',false,old); raise exception 'conflict not rejected'; exception when others then if sqlerrm<>'poc_conflict' then raise; end if; end;
 result:=public.poc_save_card_setting(dataset,316,identity,'N',false,(result->>'version')::bigint);
 if result->>'rarity'<>'N' or result->'stock'<>'false'::jsonb then raise exception 'stock removal failed'; end if;
 begin perform public.poc_save_card_setting(dataset,316,repeat('0',64),'R',true,0); raise exception 'old identity not rejected'; exception when others then if sqlerrm<>'poc_identity_changed' then raise; end if; end;
 begin perform public.poc_save_card_setting(dataset,316,identity,'UNKNOWN',true,(result->>'version')::bigint); raise exception 'tier not rejected'; exception when others then if sqlerrm<>'poc_invalid_card_setting' then raise; end if; end;
 perform set_config('request.jwt.claims','{{"sub":"ea82098b-bf39-4a15-a764-c83d470f8573","role":"authenticated"}}',true);
 begin perform public.poc_save_card_setting(dataset,316,identity,'SR',false,(result->>'version')::bigint); raise exception 'nonowner not rejected'; exception when insufficient_privilege then null; end;
end; $check$;
reset role;
rollback;
select 'passed: rarity, stock add/remove, version conflict, identity, invalid tier, nonowner; rolled back' as checks, public.poc_load_card_settings() as settings, not has_table_privilege('anon','public.poc_card_settings','INSERT') as anonymous_write_blocked;
"""
(root/'.local-cloud/card-checks.sql').write_text(sql,encoding='utf-8')
