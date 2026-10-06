"""Cross-content references and staging integrity, no native game execution."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
import pipeline as p


class PipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.example = p.read(p.CATALOG_ROOT/'content-packs/pipeline-demo/pack.json')
        cls.catalog = p.read(p.CATALOG_ROOT/'data/cards.json')
        cls.opponents = p.read(p.CATALOG_ROOT/'data/ai-opponents.json')

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.pack = copy.deepcopy(self.example)
        self.path = self.root/'pack.json'

    def save(self):
        self.path.write_bytes(p.encoded(self.pack))
        return self.path

    def check(self):
        return p.validate(self.save())

    def test_story_and_run_are_review_data_until_adapters_exist(self):
        bundle = self.check()
        self.assertFalse(bundle['engine_applied'])
        self.assertFalse(bundle['progress_written'])
        self.assertEqual(bundle['capabilities']['story'], 'runtime_adapter_required')
        self.assertEqual(bundle['capabilities']['roguelite'], 'runtime_adapter_required')
        self.pack['status'] = 'candidate'
        with self.assertRaisesRegex(ValueError, 'requires an adapter'):self.check()

    def test_stale_dataset_unknown_fields_and_duplicate_ids_rejected(self):
        for mutate in (
            lambda v:v.update(catalog_dataset_id='old'),
            lambda v:v.update(exec='not-an-allowed-field'),
            lambda v:v['decks'].append(copy.deepcopy(v['decks'][0])),
        ):
            self.pack = copy.deepcopy(self.example)
            mutate(self.pack)
            with self.assertRaises(ValueError):self.check()

    def test_wrong_mode_actor_deck_and_story_reference_rejected(self):
        self.pack['decks'][0]['ruleset'] = 'duel_links_plan'
        with self.assertRaisesRegex(ValueError, 'Wrong mode'):self.check()
        self.pack = copy.deepcopy(self.example)
        self.pack['story'][0]['nodes'][1]['deck'] = 'missing'
        with self.assertRaisesRegex(ValueError, 'cannot use'):self.check()
        self.pack = copy.deepcopy(self.example)
        self.pack['story'][0]['nodes'][0]['next'] = 'missing'
        with self.assertRaisesRegex(ValueError, 'Dangling'):self.check()

    def test_unreachable_and_nonterminating_story_branches_rejected(self):
        self.pack['story'][0]['nodes'].append({'id':'orphan', 'kind':'end', 'text':'unused'})
        with self.assertRaisesRegex(ValueError, 'Unreachable'):self.check()
        self.pack = copy.deepcopy(self.example)
        self.pack['story'][0]['nodes'][2] = {'id':'victory', 'kind':'dialogue', 'actor':'guide', 'text':'loop', 'next':'victory'}
        with self.assertRaisesRegex(ValueError, 'no path'):self.check()

    def test_existing_card_identity_and_native_ids_are_protected(self):
        card = self.catalog['cards'][0]
        self.pack['cards'] = [{'id':'card-edit', 'operation':'edit',
            'target':{key:card[key] for key in ('slot','internal_id','identity_key')},
            'fields':{'rarity':'R'}, 'effect_adapter':None, 'ai_adapter':None}]
        self.assertTrue(self.check()['requires_catalog_refresh'])
        self.pack['cards'][0]['target']['identity_key'] = 'different'
        with self.assertRaisesRegex(ValueError, 'identity mismatch'):self.check()
        self.pack['cards'][0]['operation'] = 'add'
        self.pack['cards'][0]['target'].pop('identity_key')
        with self.assertRaisesRegex(ValueError, 'slot already'):self.check()

    def test_effect_change_requires_ai_contract_and_parent_build(self):
        card = self.catalog['cards'][0]
        source = self.root/'effect.c'
        source.write_text('/* source candidate only; never executed */\n',encoding='utf-8')
        self.pack['implementations'] = [{'id':'effect', 'kind':'card_effect', 'source':'effect.c', 'sha256':p.sha(source.read_bytes())}]
        self.pack['cards'] = [{'id':'effect-change', 'operation':'edit',
            'target':{key:card[key] for key in ('slot','internal_id','identity_key')},
            'fields':{'description_ko':'효과 후보'}, 'effect_adapter':'effect', 'ai_adapter':None}]
        with self.assertRaisesRegex(ValueError, 'AI adapter'):self.check()

    def test_hash_path_and_binary_type_rejected(self):
        path = self.root/'portrait.png'
        path.write_bytes(b'candidate artwork fixture')
        item = {'id':'portrait', 'kind':'portrait', 'source':'portrait.png', 'sha256':p.sha(path.read_bytes())}
        self.pack['assets'] = [item]
        self.check()
        item['sha256'] = 'bad'
        with self.assertRaisesRegex(ValueError, 'hash mismatch'):self.check()
        item['source'] = '../outside.png'
        with self.assertRaisesRegex(ValueError, 'Unsafe'):self.check()
        path = self.root/'game.exe'
        path.write_bytes(b'not-a-real-exe')
        item.update(source='game.exe',sha256=p.sha(path.read_bytes()))
        with self.assertRaisesRegex(ValueError, 'Unsupported file type'):self.check()

    def test_json_adapter_source_is_hashed_data_and_rejects_changed_bytes(self):
        path=self.root/'registry.json';path.write_text('{"actions":[]}\n',encoding='utf-8')
        self.pack['implementations']=[{'id':'registry','kind':'card_effect','source':'registry.json','sha256':p.sha(path.read_bytes())}]
        self.assertEqual(self.check()['files'][0]['sha256'],p.sha(path.read_bytes()))
        path.write_text('{"actions":[1]}\n',encoding='utf-8')
        with self.assertRaisesRegex(ValueError,'hash mismatch'):self.check()

    def test_immutable_staging_and_manifest_never_touch_progress(self):
        sentinel = self.root/'system.dat'
        sentinel.write_bytes(b'player-progress-sentinel')
        result = p.stage(self.save(), self.root/'review')
        output = Path(result['output'])
        manifest = p.read(output/'manifest.json')
        self.assertEqual(p.sha((output/'bundle.json').read_bytes()),manifest['bundle_sha256'])
        for entry in manifest['files']:
            self.assertEqual(p.sha((output/entry['path']).read_bytes()),entry['sha256'])
        with self.assertRaisesRegex(ValueError, 'never overwritten'):p.stage(self.path,self.root/'review')
        self.assertEqual(sentinel.read_bytes(),b'player-progress-sentinel')
        self.assertFalse(result['engine_applied'])

    def test_run_mode_and_permanent_progress_rejected(self):
        self.pack['roguelite'][0]['ruleset'] = 'duel_links_plan'
        with self.assertRaisesRegex(ValueError, 'mixed deck rules'):self.check()
        self.pack = copy.deepcopy(self.example)
        self.pack['roguelite'][0]['permanent_progress'] = True
        with self.assertRaisesRegex(ValueError, 'separate progress'):self.check()


if __name__ == '__main__':unittest.main()
