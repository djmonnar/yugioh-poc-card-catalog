"""Validate authored content and produce immutable review bundles, never apply them.

This is the authoring boundary. Native effects, story execution and roguelite
execution require separate adapters and validation before a release can apply.
Only Python's standard library is needed. No authored source is executed here.
"""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import tempfile

CATALOG_ROOT = Path(__file__).resolve().parents[2]
KINDS = ('assets', 'implementations', 'cards', 'decks', 'actors', 'story', 'roguelite')
ID = re.compile(r'[a-z][a-z0-9_-]{0,63}\Z')
HASH = re.compile(r'[0-9a-f]{64}\Z')
CAPABILITIES = {
    'ai_recipe': 'online_launcher_connected',
    'card_data': 'native_candidate_builder_required',
    'card_effect': 'native_candidate_builder_and_ai_validation_required',
    'story': 'runtime_adapter_required',
    'roguelite': 'runtime_adapter_required',
    'asset': 'resource_conversion_adapter_required',
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2)+'\n').encode('utf-8')


def sha(blob):
    return hashlib.sha256(blob).hexdigest()


def identifier(value, label):
    require(isinstance(value, str) and bool(ID.fullmatch(value)), f'{label}: invalid stable ID')


def fields(value, required, optional, label):
    require(isinstance(value, dict), f'{label}: expected an object')
    require(set(required) <= value.keys() and value.keys() <= set(required) | set(optional), f'{label}: unknown or missing fields')


def local_file(root, relative):
    require(isinstance(relative, str) and '\\' not in relative, 'Use pack-relative POSIX paths')
    parts = PurePosixPath(relative)
    require(bool(parts.parts) and not parts.is_absolute() and all(p not in ('..', '.') and ':' not in p for p in parts.parts), 'Unsafe pack path')
    path = (root/relative).resolve()
    require(path.is_relative_to(root.resolve()) and path.is_file(), 'Pack file missing or outside pack')
    require(path.stat().st_size <= 16*1024*1024, 'Pack file exceeds 16 MiB')
    return path


def validate(pack_path, catalog_path=None, opponents_path=None):
    pack_path = Path(pack_path).resolve()
    pack = read(pack_path)
    catalog = read(catalog_path or CATALOG_ROOT/'data/cards.json')
    opponents = read(opponents_path or CATALOG_ROOT/'data/ai-opponents.json')
    fields(pack, ('schema_version', 'kind', 'id', 'name', 'status', 'catalog_dataset_id', *KINDS), ('engine_parent_sha256',), 'pack')
    require(pack['schema_version'] == 1 and pack['kind'] == 'poc-content-pack', 'Unsupported content schema')
    identifier(pack['id'], 'pack')
    require(isinstance(pack['name'], str) and 0 < len(pack['name']) <= 200, 'Invalid pack name')
    require(pack['status'] in ('draft', 'candidate'), 'This pipeline cannot certify a native release')
    require(pack['catalog_dataset_id'] == catalog['meta']['dataset_id'], 'Stale catalog snapshot')
    if 'engine_parent_sha256' in pack:
        require(isinstance(pack['engine_parent_sha256'], str) and HASH.fullmatch(pack['engine_parent_sha256']), 'Invalid engine parent hash')
    rows = {}
    for kind in KINDS:
        require(isinstance(pack[kind], list) and len(pack[kind]) <= 2048, f'{kind}: invalid collection')
        rows[kind] = {}
        for item in pack[kind]:
            require(isinstance(item, dict), f'{kind}: expected objects')
            identifier(item.get('id'), kind)
            require(item['id'] not in rows[kind], f'{kind}: duplicate ID')
            rows[kind][item['id']] = item

    files = []
    for kind, suffixes in (('assets', {'.png', '.jpg', '.jpeg', '.webp', '.wav', '.ogg'}),
                           ('implementations', {'.c', '.h', '.inc', '.py'})):
        for item in rows[kind].values():
            fields(item, ('id', 'kind', 'source', 'sha256'), (), kind)
            expected_kinds = ('portrait', 'card_art', 'background', 'icon', 'audio') if kind == 'assets' else ('card_effect', 'ai_policy', 'story_event', 'roguelite_rule')
            require(item['kind'] in expected_kinds, f'{kind}: unknown adapter or asset kind')
            path = local_file(pack_path.parent, item['source'])
            require(path.suffix.lower() in suffixes, 'Unsupported file type; binary game files are excluded')
            blob = path.read_bytes()
            require(isinstance(item['sha256'], str) and sha(blob) == item['sha256'], 'Source hash mismatch')
            files.append({'kind':kind, 'id':item['id'], 'source':item['source'],
                          'bundle_path':f"sources/{kind}/{item['id']}/{path.name}", 'sha256':sha(blob), 'size':len(blob)})

    by_slot = {card['slot']:card for card in catalog['cards']}
    used_ids = {card['internal_id'] for card in catalog['cards']}
    assigned_slots, assigned_ids = set(), set()

    def card_identity(ref):
        fields(ref, ('slot', 'internal_id', 'identity_key'), (), 'card reference')
        require(type(ref['slot']) is int and type(ref['internal_id']) is int, 'Invalid card reference integers')
        current = by_slot.get(ref['slot'])
        require(current and current['internal_id'] == ref['internal_id'] and current['identity_key'] == ref['identity_key'], 'Card identity mismatch; replaced cards must be reviewed again')

    def adapter(ref, kind):
        require(ref in rows['implementations'] and rows['implementations'][ref]['kind'] == kind, 'Missing or wrong implementation adapter')

    for item in rows['cards'].values():
        fields(item, ('id', 'operation', 'target', 'fields', 'effect_adapter', 'ai_adapter'), (), 'card change')
        require(item['operation'] in ('edit', 'replace', 'add'), 'Unknown card operation')
        if item['operation'] == 'add':
            fields(item['target'], ('slot', 'internal_id'), (), 'new card assignment')
            slot, native_id = item['target']['slot'], item['target']['internal_id']
            require(type(slot) is int and slot > 0 and slot not in by_slot and slot not in assigned_slots, 'New card slot already assigned or invalid')
            require(type(native_id) is int and 0 < native_id <= 65535 and native_id not in used_ids and native_id not in assigned_ids, 'New card native ID already assigned or invalid')
            assigned_slots.add(slot)
            assigned_ids.add(native_id)
        else:
            card_identity(item['target'])
            require(item['target']['slot'] not in assigned_slots, 'Multiple changes to one card slot')
            assigned_slots.add(item['target']['slot'])
        allowed = {'name_ko', 'description_ko', 'official_cid', 'rarity', 'limit', 'level', 'atk', 'def', 'race', 'attribute', 'card_type'}
        require(isinstance(item['fields'], dict) and item['fields'] and item['fields'].keys() <= allowed, 'Invalid changed card fields; IDs are never fields')
        for key, value in item['fields'].items():
            if key in ('name_ko', 'description_ko', 'race', 'attribute', 'card_type'):
                require(isinstance(value, str) and 0 < len(value) <= 6000, 'Invalid card text')
            elif key == 'rarity':require(value in ('N', 'R', 'SR', 'UR'), 'Invalid rarity')
            else:
                require(type(value) is int and value >= 0, 'Invalid numeric card field')
                if key == 'limit':require(value <= 3, 'Invalid copy limit')
                if key == 'level':require(1 <= value <= 12, 'Invalid card level')
                if key == 'official_cid':require(value > 0, 'Invalid official CID')
                if key in ('atk', 'def'):require(value <= 65535, 'Invalid ATK/DEF')
        # Effects and AI are separately declared, but use shared legality/cost/resolve contracts.
        for key, kind in (('effect_adapter','card_effect'), ('ai_adapter','ai_policy')):
            if item[key] is not None:adapter(item[key], kind)
        if item['operation'] in ('add', 'replace'):
            require({'name_ko', 'description_ko', 'card_type'} <= item['fields'].keys(), 'New/replacement card requires printed identity')
        if item['effect_adapter'] is not None:
            require(item['ai_adapter'] is not None and 'engine_parent_sha256' in pack, 'Effect candidate requires AI adapter and engine parent hash')

    recipes = {deck['source_recipe']['filename']:deck for deck in opponents['decks']}
    for item in rows['decks'].values():
        fields(item, ('id', 'ruleset', 'source_recipe'), ('name', 'packet'), 'deck')
        require(item['source_recipe'] in recipes and recipes[item['source_recipe']]['ruleset'] == item['ruleset'], 'Wrong mode or unknown native recipe')
        if 'packet' in item:
            # Reuse the exact online/native validator; no second implementation of card rules.
            import importlib.util
            spec = importlib.util.spec_from_file_location('pipeline_ai_sync', CATALOG_ROOT/'mod-tools/ai-deck-sync/sync_core.py')
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            module.validate_packet(item['packet'], catalog, opponents)
            require(item['packet']['target']['filename'] == item['source_recipe'], 'Deck packet target mismatch')

    for item in rows['actors'].values():
        fields(item, ('id', 'name', 'portrait', 'decks'), (), 'actor')
        require(isinstance(item['name'], str) and 0 < len(item['name']) <= 200, 'Invalid actor name')
        require(item['portrait'] is None or item['portrait'] in rows['assets'] and rows['assets'][item['portrait']]['kind'] == 'portrait', 'Missing actor portrait')
        require(isinstance(item['decks'], list) and item['decks'] and all(ref in rows['decks'] for ref in item['decks']), 'Missing actor deck')

    for chapter in rows['story'].values():
        fields(chapter, ('id', 'title', 'start', 'nodes'), (), 'story')
        require(isinstance(chapter['title'], str) and 0 < len(chapter['title']) <= 200, 'Invalid chapter title')
        require(isinstance(chapter['nodes'], list) and 0 < len(chapter['nodes']) <= 2048, 'Invalid story nodes')
        nodes = {}
        for node in chapter['nodes']:
            fields(node, ('id', 'kind'), ('actor', 'text', 'deck', 'next', 'on_win', 'on_loss', 'choices'), 'story node')
            identifier(node['id'], 'story node')
            require(node['id'] not in nodes, 'Duplicate story node')
            nodes[node['id']] = node
        require(chapter['start'] in nodes, 'Missing story start')
        edges = {}
        for node in nodes.values():
            kind = node['kind']
            expected = {'dialogue':{'id','kind','actor','text','next'}, 'duel':{'id','kind','actor','deck','on_win','on_loss'}, 'choice':{'id','kind','text','choices'}, 'end':{'id','kind','text'}}
            require(kind in expected and node.keys() == expected[kind], 'Wrong fields for story node kind')
            if 'actor' in node:require(node['actor'] in rows['actors'], 'Missing story actor')
            if 'deck' in node:require(node['deck'] in rows['decks'] and node['deck'] in rows['actors'][node['actor']]['decks'], 'Actor cannot use this deck')
            if 'text' in node:require(isinstance(node['text'], str) and 0 < len(node['text']) <= 6000, 'Invalid dialogue text')
            targets = [node[key] for key in ('next', 'on_win', 'on_loss') if key in node]
            if kind == 'choice':
                require(isinstance(node['choices'], list) and 2 <= len(node['choices']) <= 8, 'Choice requires 2–8 alternatives')
                for choice in node['choices']:
                    fields(choice, ('text', 'next'), (), 'choice')
                    require(isinstance(choice['text'], str) and 0 < len(choice['text']) <= 200, 'Invalid choice label')
                    targets.append(choice['next'])
            require(all(target in nodes for target in targets), 'Dangling story branch')
            edges[node['id']] = targets
        reached, queue = set(), [chapter['start']]
        while queue:
            node_id = queue.pop()
            if node_id not in reached:
                reached.add(node_id)
                queue.extend(edges[node_id])
        require(reached == nodes.keys(), 'Unreachable story nodes')
        can_end = {name for name, node in nodes.items() if node['kind'] == 'end'}
        while True:
            expanded = can_end | {name for name, targets in edges.items() if any(target in can_end for target in targets)}
            if expanded == can_end:break
            can_end = expanded
        require(can_end == reached, 'Story has a branch with no path to an ending')

    for item in rows['roguelite'].values():
        fields(item, ('id', 'ruleset', 'encounters', 'rules', 'permanent_progress'), (), 'roguelite')
        require(item['ruleset'] in ('classic', 'duel_links_plan'), 'Invalid run ruleset')
        require(item['permanent_progress'] is False, 'Run prototype must use separate progress, never player save/gold')
        require(isinstance(item['encounters'], list) and item['encounters'] and all(ref in rows['decks'] and rows['decks'][ref]['ruleset'] == item['ruleset'] for ref in item['encounters']), 'Invalid run encounter or mixed deck rules')
        require(isinstance(item['rules'], list) and item['rules'], 'Run requires explicit rules')
        seen = set()
        for rule in item['rules']:
            fields(rule, ('id', 'description', 'trigger', 'implementation'), (), 'run rule')
            identifier(rule['id'], 'run rule')
            require(rule['id'] not in seen, 'Duplicate run rule')
            seen.add(rule['id'])
            require(isinstance(rule['description'], str) and 0 < len(rule['description']) <= 6000, 'Missing run rule description')
            require(rule['trigger'] in ('run_start', 'before_duel', 'after_win', 'after_loss', 'run_end'), 'Unknown run event')
            if rule['implementation'] is None:
                require(pack['status'] == 'draft', 'Candidate run rule requires an adapter')
            else:adapter(rule['implementation'], 'roguelite_rule')

    bundle = {'schema_version':1, 'kind':'poc-content-review-bundle', 'content':pack,
              'capabilities':CAPABILITIES, 'files':files,
              'requires_catalog_refresh':bool(pack['cards']),
              'engine_applied':False, 'game_launched':False, 'progress_written':False}
    return bundle


def stage(pack_path, output, **kwargs):
    bundle = validate(pack_path, **kwargs)
    payload = encoded(bundle)
    digest = sha(payload)
    parent = Path(output).resolve()
    parent.mkdir(parents=True, exist_ok=True)
    target = parent/f"{bundle['content']['id']}_{digest[:12]}"
    require(not target.exists(), 'Review bundle already exists; immutable output is never overwritten')
    with tempfile.TemporaryDirectory(dir=parent, prefix='.content-build-') as temp:
        temp_root = Path(temp)
        (temp_root/'bundle.json').write_bytes(payload)
        for entry in bundle['files']:
            source = local_file(Path(pack_path).resolve().parent, entry['source'])
            # Revalidate bytes immediately before copying; a collaborator may edit during staging.
            blob = source.read_bytes()
            require(sha(blob) == entry['sha256'], 'Source changed during staging')
            destination = temp_root/entry['bundle_path']
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(blob)
        manifest = {'kind':'poc-content-review-manifest', 'bundle_sha256':digest,
                    'files':[{'path':path.relative_to(temp_root).as_posix(), 'sha256':sha(path.read_bytes()), 'size':path.stat().st_size}
                             for path in sorted(temp_root.rglob('*')) if path.is_file()]}
        (temp_root/'manifest.json').write_bytes(encoded(manifest))
        # Verify both resolved paths before moving our temporary child on Windows.
        require(temp_root.resolve().parent == parent and target.resolve().parent == parent,
                'Staging paths escaped the explicit output directory')
        temp_root.rename(target)
    return {'status':'staged_for_review', 'output':str(target), 'bundle_sha256':digest,
            'engine_applied':False, 'progress_written':False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('check', 'stage'))
    parser.add_argument('pack', type=Path)
    parser.add_argument('--output', type=Path, help='New immutable bundles are written only here')
    args = parser.parse_args()
    if args.command == 'stage':
        require(args.output is not None, 'stage requires an explicit --output directory')
        result = stage(args.pack, args.output)
    else:
        bundle = validate(args.pack)
        result = {'status':'validated', 'pack':bundle['content']['id'], 'counts':{kind:len(bundle['content'][kind]) for kind in KINDS},
                  'capabilities':CAPABILITIES, 'engine_applied':False, 'progress_written':False}
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':main()
