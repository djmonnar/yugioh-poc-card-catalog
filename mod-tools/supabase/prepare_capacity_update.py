"""Prepare a catalogue expansion without replacing RPCs or editing decks/stories."""
import json
from prepare_seed import root, seed, literal
from prepare_update import body


def expansion_sql():
    data = json.loads((root / 'data/cards.json').read_text(encoding='utf-8'))
    aliases = [dict(slot=c['slot'], internal_id=c['internal_id'], old_key=old,
                    identity_key=c['identity_key'])
               for c in data['cards'] for old in c.get('previous_identity_keys', [])
               if old != c['identity_key']]
    return '\n'.join([
        '-- Catalogue-only expansion: no function, permissions, save, deck or story replacement.',
        'begin;',
        "create temporary table poc_expansion_guard on commit drop as select "
        "md5(coalesce((select jsonb_agg(to_jsonb(d) order by filename)::text from public.poc_ai_decks d),'')) as decks,"
        "md5(coalesce((select jsonb_agg(to_jsonb(s) order by id)::text from public.poc_stories s),'')) as stories;",
        'create temporary table poc_identity_aliases on commit drop as select * from jsonb_to_recordset('
        + literal(aliases) + ') as a(slot integer,internal_id integer,old_key text,identity_key text);',
        "update public.poc_card_settings s set identity_key=a.identity_key,"
        "version=nextval('poc_private.revision_seq'),updated_at=now() from poc_identity_aliases a "
        "where s.slot=a.slot and s.internal_id=a.internal_id and s.identity_key=a.old_key;",
        "update public.poc_card_annotations s set identity_key=a.identity_key,"
        "version=nextval('poc_private.revision_seq'),updated_at=now() from poc_identity_aliases a "
        "where s.slot=a.slot and s.internal_id=a.internal_id and s.identity_key=a.old_key;",
        "with mapped as (select s.slot,jsonb_agg(case when a.identity_key is null then e.ref "
        "else jsonb_set(e.ref,'{identity_key}',to_jsonb(a.identity_key)) end order by e.ordinality) as links "
        "from public.poc_card_annotations s cross join lateral jsonb_array_elements(s.links) "
        "with ordinality e(ref,ordinality) left join poc_identity_aliases a "
        "on a.slot=(e.ref->>'slot')::integer and a.old_key=e.ref->>'identity_key' group by s.slot) "
        "update public.poc_card_annotations s set links=m.links,version=nextval('poc_private.revision_seq'),"
        "updated_at=now() from mapped m where s.slot=m.slot and s.links is distinct from m.links;",
        body(seed()),
        "do $$ begin if (select decks from poc_expansion_guard) is distinct from "
        "md5(coalesce((select jsonb_agg(to_jsonb(d) order by filename)::text from public.poc_ai_decks d),'')) "
        "or (select stories from poc_expansion_guard) is distinct from "
        "md5(coalesce((select jsonb_agg(to_jsonb(s) order by id)::text from public.poc_stories s),'')) "
        "then raise exception 'Expansion changed user decks/stories'; end if; end $$;",
        'commit;',
        "select 'catalogue expansion complete; user decks/stories preserved' as status,"
        "(select count(*) from poc_private.cards) as cards,"
        "(select count(*) from poc_private.cards where slot>=1116) as added_cards,"
        "(select count(*) from poc_private.targets) as ai_targets,"
        "(select count(*) from public.poc_stories) as stories;",
    ])


if __name__ == '__main__':
    dest = root / '.local-cloud'
    dest.mkdir(exist_ok=True)
    (dest / 'catalog-capacity59.sql').write_text(expansion_sql(), encoding='utf-8')
    print('Prepared .local-cloud/catalog-capacity59.sql; database unchanged.')
