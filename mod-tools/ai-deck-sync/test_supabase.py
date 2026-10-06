import copy,json,pathlib,unittest
from unittest import mock
import supabase_provider as provider
import sync_core
ROOT=pathlib.Path(__file__).resolve().parents[2]
CATALOG=sync_core.load(ROOT/'data/cards.json')
OPPONENTS=sync_core.load(ROOT/'data/ai-opponents.json')
def fixture():
    target=next(d for d in OPPONENTS['decks'] if d['ruleset']=='classic')
    rows,identities,left=[],[],40
    for card in CATALOG['cards']:
        if card.get('special') or card['type']!='일반 몬스터' or card['deck_limit']!=3:continue
        count=min(3,left);rows.append([card['slot'],card['internal_id'],count])
        identities.append(['main',card['slot'],card['internal_id'],count,card['identity_key']]);left-=count
        if not left:break
    return {'schema_version':1,'kind':'poc-ai-deck-sync','catalog_dataset_id':CATALOG['meta']['dataset_id'],
        'target':target['source_recipe'],'deck':{'name':'클라우드 읽기 검사','ruleset':'classic','difficulty':1,
        'banlist_enabled':True,'strategy':dict.fromkeys(['goal','priorities','combos','avoid'],''),
        'groups':{'main':rows,'extra':[],'side':[]}},
        'identity_sha256':sync_core.sha(json.dumps(identities,separators=(',',':'),ensure_ascii=False).encode('utf-8'))}
FIXTURE=fixture()
CONFIG=json.loads((ROOT/'data/cloud-config.json').read_text(encoding='utf-8'))

class CloudTests(unittest.TestCase):
    def row(self):return dict(filename=FIXTURE['target']['filename'],version=8,packet=copy.deepcopy(FIXTURE),updated_at='2026-10-06T04:00:00+00:00')
    def test_supabase_packet_matches_native_hash_and_validator(self):
        row=self.row();state=provider.adapt_rows([row]);entry=state['entries'][row['filename']]
        self.assertEqual(entry['revision'],sync_core.packet_revision(FIXTURE))
        self.assertEqual(entry['issue_number'],8)
        self.assertEqual(entry['issue_updated_at'],'2026-10-06T04:00:00Z')
        groups=sync_core.validate_packet(entry['packet'],sync_core.load(ROOT/'data/cards.json'),sync_core.load(ROOT/'data/ai-opponents.json'))
        self.assertEqual(len(groups[0]),40)
    def test_bad_revisions_and_targets_are_rejected(self):
        row=self.row()
        for changes in [dict(version=True),dict(version=0),dict(filename='../cpu_000.ydc'),dict(updated_at='bad')]:
            with self.assertRaises(ValueError):provider.adapt_rows([{**row,**changes}])
        with self.assertRaises(ValueError):provider.adapt_rows([row,row])
    def test_service_keys_and_other_hosts_cannot_be_used(self):
        self.assertEqual(provider.validate_config(CONFIG),CONFIG)
        for changes in [dict(url='http://localhost'),dict(url=CONFIG['url']+'/path'),dict(publishable_key='sb_secret_hidden')]:
            with self.assertRaises(ValueError):provider.validate_config({**CONFIG,**changes})
    def test_network_errors_propagate_without_empty_success(self):
        with mock.patch('urllib.request.urlopen',side_effect=OSError('offline')):
            with self.assertRaises(OSError):provider.fetch_state(CONFIG)
if __name__=='__main__':unittest.main()
