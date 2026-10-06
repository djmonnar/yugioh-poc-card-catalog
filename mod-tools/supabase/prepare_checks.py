"""Rollback-only database integration test. Never leaves an auth user or recipe."""
import json,pathlib
root=pathlib.Path(__file__).resolve().parents[2]
packet=json.loads((root.parent/'reports/ai_sync_fixture.json').read_text(encoding='utf-8'))['packet']
literal="'"+json.dumps(packet,ensure_ascii=False,separators=(',',':')).replace("'","''")+"'::jsonb"
test_uid='70914040-f6b5-499f-8489-3d24dd5cbd22'
sql=f"""begin;
insert into poc_private.editors values('poc-qa@invalid.example') on conflict do nothing;
insert into auth.users(id,email,email_confirmed_at) values('{test_uid}','poc-qa@invalid.example',now());
select set_config('request.jwt.claims','{{"sub":"{test_uid}","role":"authenticated"}}',true);
set local role authenticated;
do $check$ declare p jsonb:={literal}; result jsonb; old bigint; bad jsonb;
begin
 if not public.poc_editor_status() then raise exception 'owner context failed'; end if;
 select coalesce(max(version),0) into old from public.poc_ai_decks where filename=p#>>'{{target,filename}}';
 result:=public.poc_save_ai_deck(p,old);
 if (result->>'version')::bigint<=old then raise exception 'save version failed'; end if;
 begin perform public.poc_save_ai_deck(p,old); raise exception 'conflict not rejected'; exception when others then if sqlerrm<>'poc_conflict' then raise; end if; end;
 bad:=jsonb_set(p,'{{identity_sha256}}',to_jsonb(repeat('0',64)));
 begin perform public.poc_save_ai_deck(bad,(result->>'version')::bigint); raise exception 'identity not rejected'; exception when others then if sqlerrm<>'poc_identity_changed' then raise; end if; end;
 bad:=jsonb_set(p,'{{deck,groups,main,0,2}}','null'::jsonb);
 begin perform public.poc_save_ai_deck(bad,(result->>'version')::bigint); raise exception 'null row not rejected'; exception when others then if sqlerrm<>'poc_invalid_row' then raise; end if; end;
 perform set_config('request.jwt.claims','{{"sub":"ea82098b-bf39-4a15-a764-c83d470f8573","role":"authenticated"}}',true);
 begin perform public.poc_save_ai_deck(p,(result->>'version')::bigint); raise exception 'nonowner not rejected'; exception when insufficient_privilege then null; end;
end; $check$;
reset role;
rollback;
select 'passed: owner save, version conflict, card identity, null row, nonowner; all test changes rolled back' as checks,
 (select count(*) from public.poc_ai_decks) as saved_decks,
 not has_table_privilege('anon','public.poc_ai_decks','INSERT') as anonymous_write_blocked,
 (select bool_and(relrowsecurity) from pg_class where oid in ('public.poc_ai_decks'::regclass,'poc_private.editors'::regclass,'poc_private.cards'::regclass,'poc_private.targets'::regclass,'poc_private.history'::regclass)) as rls_enabled;
"""
dest=root/'.local-cloud';dest.mkdir(exist_ok=True);(dest/'checks.sql').write_text(sql,encoding='utf-8')
