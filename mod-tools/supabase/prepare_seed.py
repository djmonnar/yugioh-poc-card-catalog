"""Generate private bootstrap SQL from the published catalog; no credentials."""
import argparse, json, pathlib
root = pathlib.Path(__file__).resolve().parents[2]
def literal(value):
    return "'" + json.dumps(value,ensure_ascii=False,separators=(',',':')).replace("'","''") + "'::jsonb"
def seed():
    data=json.loads((root/'data/cards.json').read_text(encoding='utf-8'))
    cards=[dict(slot=c['slot'],internal_id=c['internal_id'],identity_key=c['identity_key'],fusion=c['type']=='융합 몬스터',special=bool(c.get('special')),limited=c.get('deck_limit') or 0,unlimited=c.get('deck_limit_without_banlist') or 0) for c in data['cards']]
    decks=json.loads((root/'data/ai-opponents.json').read_text(encoding='utf-8'))['decks']
    targets=[dict(filename=d['source_recipe']['filename'],recipe=d['source_recipe'],ruleset=d['ruleset']) for d in decks]
    return '\n'.join(['begin;',"insert into poc_private.catalog values ('"+data['meta']['dataset_id']+"') on conflict do nothing;",
        'insert into poc_private.cards select * from jsonb_to_recordset('+literal(cards)+') as x(slot integer,internal_id integer,identity_key text,fusion boolean,special boolean,limited integer,unlimited integer) on conflict(slot) do update set internal_id=excluded.internal_id,identity_key=excluded.identity_key,fusion=excluded.fusion,special=excluded.special,limited=excluded.limited,unlimited=excluded.unlimited;',
        'insert into poc_private.targets select * from jsonb_to_recordset('+literal(targets)+') as x(filename text,recipe jsonb,ruleset text) on conflict(filename) do update set recipe=excluded.recipe,ruleset=excluded.ruleset;', 'commit;'])
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--owner-email',required=True);args=parser.parse_args()
    if '@' not in args.owner_email: raise ValueError('Owner email required')
    dest=root/'.local-cloud';dest.mkdir(exist_ok=True)
    owner="insert into poc_private.editors(email) values ('"+args.owner_email.lower().replace("'","''")+"') on conflict do nothing;"
    (dest/'bootstrap.sql').write_text((root/'mod-tools/supabase/001_ai_decks.sql').read_text(encoding='utf-8')+'\n'+seed()+'\n'+owner+'\nselect (select count(*) from poc_private.cards) as cards,(select count(*) from poc_private.targets) as targets, public.poc_load_ai_decks() as saved_decks;\n',encoding='utf-8')
