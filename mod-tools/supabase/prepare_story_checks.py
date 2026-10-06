"""Rollback-only SQL integration checks for story saving and shared card names."""
import json
from prepare_seed import root, literal


def checks():
    catalog = json.loads((root / 'data/cards.json').read_text(encoding='utf-8'))
    c = next(c for c in catalog['cards'] if c['type'] == '마법' and c['reward_eligible'])
    ref = {k: c[k] for k in ('slot','internal_id','identity_key','name_ko')}
    story = dict(schema_version=1,kind='poc-story-authoring',title='스토리 저장 검사',
        catalog_dataset_id=catalog['meta']['dataset_id'],
        actors=[dict(actor_id='check-yongman',name='다이노소어 용만',portrait='',
            skills=[dict(kind='lp_bonus',value=1000),dict(kind='start_hand',card=ref)])],
        battles=[dict(battle_id='battle-1',name='검사 전투',actor_id='check-yongman',
            recipe='DLR_000.ydc',ruleset='duel_links_plan',intro='시작',win='승리',loss='패배',
            rewards=dict(first=[dict(kind='gold',amount=100),dict(kind='card',card=ref,count=1)],
                repeat=[dict(kind='random',rarity='SR',count=1)]))])
    return f"""begin;
insert into poc_private.editors values('poc-story-qa@invalid.example') on conflict do nothing;
insert into auth.users(id,email,email_confirmed_at) values('b8226482-9f23-49e4-9141-58cc1250de39','poc-story-qa@invalid.example',now());
select set_config('request.jwt.claims','{{"sub":"b8226482-9f23-49e4-9141-58cc1250de39","role":"authenticated"}}',true);
set local role authenticated;
do $check$ declare d jsonb:={literal(story)};bad jsonb;v bigint;result jsonb;
begin
 if not public.poc_editor_status() then raise exception 'owner context failed'; end if;
 select coalesce(max(version),0) into v from public.poc_stories;
 result:=public.poc_save_story(d,v);
 if public.poc_load_story()->'document' is distinct from d then raise exception 'round trip failed'; end if;
 begin perform public.poc_save_story(d,v);raise exception 'conflict not rejected';exception when others then if sqlerrm<>'poc_conflict' then raise;end if;end;
 v:=(result->>'version')::bigint;
 bad:=jsonb_set(d,'{{actors,0,skills,0,value}}','null'::jsonb);
 begin perform public.poc_save_story(bad,v);raise exception 'null skill accepted';exception when others then if sqlerrm<>'poc_invalid_story_skill' then raise;end if;end;
 bad:=jsonb_set(d,'{{battles,0,recipe}}','"cpu_000.ydc"'::jsonb);
 begin perform public.poc_save_story(bad,v);raise exception 'wrong mode accepted';exception when others then if sqlerrm<>'poc_invalid_story_deck' then raise;end if;end;
 bad:=jsonb_set(d,'{{actors,0,portrait}}','"javascript:alert(1)"'::jsonb);
 begin perform public.poc_save_story(bad,v);raise exception 'unsafe portrait accepted';exception when others then if sqlerrm<>'poc_invalid_story_portrait' then raise;end if;end;
 bad:=jsonb_set(d,'{{battles,0,rewards,first,1,card,identity_key}}',to_jsonb(repeat('0',64)));
 begin perform public.poc_save_story(bad,v);raise exception 'stale identity accepted';exception when others then if sqlerrm<>'poc_identity_changed' then raise;end if;end;
 perform set_config('request.jwt.claims','{{"sub":"d694b52a-c981-4ce8-84e5-e84d753b14c4","role":"authenticated"}}',true);
 begin perform public.poc_save_story(d,v);raise exception 'nonowner accepted';exception when insufficient_privilege then null;end;
end; $check$;
reset role;
do $harpie$ declare rows jsonb;ids jsonb;t jsonb;p jsonb;
begin
 select recipe into t from poc_private.targets where filename='DLR_000.ydc';
 select jsonb_agg(jsonb_build_array(slot,internal_id,n) order by slot) into rows from
 (select slot,internal_id,1 as n from poc_private.cards where slot in (108,606,696,697)
 union all select slot,internal_id,3 from (select slot,internal_id from poc_private.cards where not fusion and not special and unlimited>=3 and slot not in (108,606,696,697,827) order by slot limit 6) q) c;
 select jsonb_agg(jsonb_build_array('main',(r->>0)::integer,c.internal_id,(r->>2)::integer,c.identity_key) order by ord) into ids from jsonb_array_elements(rows) with ordinality e(r,ord) join poc_private.cards c on c.slot=(r->>0)::integer;
 p:=jsonb_build_object('schema_version',1,'kind','poc-ai-deck-sync','catalog_dataset_id','{catalog['meta']['dataset_id']}',
 'target',t,'identity_sha256',encode(sha256(convert_to(poc_private.compact(ids),'UTF8')),'hex'),
 'deck',jsonb_build_object('name','해피 공유 이름 검사','ruleset','duel_links_plan','banlist_enabled',false,'difficulty',1,
 'strategy',jsonb_build_object('goal','','priorities','','combos','','avoid',''),'groups',jsonb_build_object('main',rows,'side','[]'::jsonb,'extra','[]'::jsonb)));
 begin perform poc_private.validate_packet(p);raise exception 'four Harpies accepted';exception when others then if sqlerrm<>'poc_harpie_shared_copy_limit' then raise;end if;end;
end; $harpie$;
rollback;
select 'passed: story owner save/load, conflict, null skill, wrong rules, unsafe portrait, stale card, nonowner, four-Harpie rejection; test changes rolled back' as checks,
 not has_table_privilege('anon','public.poc_stories','INSERT') as anonymous_write_blocked,
 (select relrowsecurity from pg_class where oid='public.poc_stories'::regclass) as rls_enabled,
 (select count(*) from public.poc_stories) as existing_stories;
"""


if __name__ == '__main__':
    dest=root/'.local-cloud';dest.mkdir(exist_ok=True)
    (dest/'story-checks.sql').write_text(checks(),encoding='utf-8')
    print('Prepared rollback-only story checks; database unchanged.')
