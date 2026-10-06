"""Prepare an atomic catalogue/story migration; never read credentials or run SQL."""
import json
from prepare_seed import root, seed, literal


def body(sql):
    return '\n'.join(line for line in sql.splitlines() if line.strip().lower() not in ('begin;', 'commit;'))


def update_sql():
    catalog = json.loads((root / 'data/cards.json').read_text(encoding='utf-8'))
    aliases = [dict(slot=c['slot'], internal_id=c['internal_id'], old_key=old,
                    identity_key=c['identity_key'])
               for c in catalog['cards'] for old in c.get('previous_identity_keys', [])]
    base = (root / 'mod-tools/supabase/001_ai_decks.sql').read_text(encoding='utf-8')
    start = base.index('create or replace function poc_private.validate_packet(')
    end = base.index('end; $$;', start) + len('end; $$;')
    # Only explicitly published same-card property corrections migrate a setting.
    # Donor replacements retain their old setting/history and are never re-used.
    migrate = ('update public.poc_card_settings s set identity_key=a.identity_key,'
               'version=nextval(\'poc_private.revision_seq\'),updated_at=now() '
               'from jsonb_to_recordset(' + literal(aliases) + ') as a(slot integer,'
               'internal_id integer,old_key text,identity_key text) '
               'where s.slot=a.slot and s.internal_id=a.internal_id and s.identity_key=a.old_key;')
    refresh = """do $refresh$ declare s public.poc_ai_decks;candidate jsonb;target jsonb;revision bigint;author uuid;
begin
 for s in select * from public.poc_ai_decks loop
  perform pg_advisory_xact_lock(hashtextextended('poc-ai:'||s.filename,0));
  if not exists(select 1 from public.poc_ai_decks where filename=s.filename and version=s.version) then continue;end if;
  select recipe into target from poc_private.targets where filename=s.filename;
  if target is null then continue;end if;
  candidate:=jsonb_set(jsonb_set(s.packet,'{catalog_dataset_id}',to_jsonb('__DATASET__'::text)),'{target}',target);
  if candidate=s.packet then continue;end if;
  -- Current identity fingerprint must still match every card: donor replacements
  -- and even property corrections needing review stay as the original draft.
  begin perform poc_private.validate_packet(candidate);exception when others then
   raise notice 'Deck % retained for identity/rules review',s.filename;continue;
  end;
  select editor into author from poc_private.history where version=s.version;
  if author is null then continue;end if;
  revision:=nextval('poc_private.revision_seq');
  insert into poc_private.history values(revision,s.filename,candidate,author,now());
  update public.poc_ai_decks set packet=candidate,version=revision,updated_at=now() where filename=s.filename and version=s.version;
 end loop;
end; $refresh$;""".replace('__DATASET__',catalog['meta']['dataset_id'])
    story = (root / 'mod-tools/supabase/003_story_authoring.sql').read_text(encoding='utf-8')
    return '\n'.join(['begin;', migrate, body(seed()), base[start:end], refresh, body(story), 'commit;',
        "select 'catalogue, shared Harpie limit and story authoring installed' as status,"
        "(select count(*) from poc_private.cards) as cards,"
        "(select count(*) from poc_private.targets) as ai_decks,"
        "(select count(*) from public.poc_stories) as stories;"])


if __name__ == '__main__':
    dest = root / '.local-cloud'
    dest.mkdir(exist_ok=True)
    (dest / 'catalog-story-update.sql').write_text(update_sql(), encoding='utf-8')
    print('Prepared .local-cloud/catalog-story-update.sql; database unchanged.')
