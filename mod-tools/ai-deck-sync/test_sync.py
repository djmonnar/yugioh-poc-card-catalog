import base64
import copy
import datetime
import gzip
import hashlib
import importlib.util
import json
import pathlib
import struct
import tempfile
import unittest
from unittest import mock
import sync_core
from sync_core import NativeSync,SyncError,MARKER,load,parse_issue,packet_revision,validate_packet,json_bytes,sha

ROOT=pathlib.Path(__file__).resolve().parents[2]
PATCH=ROOT.parent
CATALOG=load(ROOT/'data/cards.json')
OPPONENTS=load(ROOT/'data/ai-opponents.json')
FIXTURE=load(PATCH/'reports/ai_sync_fixture.json')

class SyncTests(unittest.TestCase):
    def test_supabase_provider_applies_only_to_isolated_native_recipes(self):
        from supabase_provider import adapt_rows
        remote=adapt_rows([{'filename':self.name,'version':23,'packet':self.packet,'updated_at':'2026-10-06T04:00:00+00:00'}])
        with self.native.locked():result=self.native.apply(remote)
        self.assertEqual(result['status'],'applied')
        self.assertEqual(len(self.native.catalog['cards']),1115)
        actual=(self.game/'Mege/y/file'/self.name).read_bytes()
        self.assertEqual(actual[:8],self.original[:8])
        self.assertEqual(len(sync_core.decode_recipe(actual)[0]),40)
    def setUp(self):
        parent=PATCH/'assets/ai_sync_tests';parent.mkdir(exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=parent)
        self.root=pathlib.Path(self.temp.name)
        assert self.root.resolve().is_relative_to(parent.resolve())
        self.game,self.stage=self.root/'game',self.root/'stage'
        self.packet=copy.deepcopy(FIXTURE['packet'])
        self.name=self.packet['target']['filename']
        live=PATCH.parent/'YuGiOh_THE_LEGEND_REBORN_v2_Win_Preinstalled_EN/Game Files'
        self.original=(live/'Mege/y/file'/self.name).read_bytes()
        for root in (self.game,self.stage):
            path=root/'Mege/y/file'/self.name;path.parent.mkdir(parents=True);path.write_bytes(self.original)
        path=self.game/'Mege/bin#/card_id.bin';path.parent.mkdir(parents=True);path.write_bytes((live/'Mege/bin#/card_id.bin').read_bytes())
        self.manifest=self.root/'manifest.json'
        self.manifest.write_bytes(json_bytes({'files':[{'path':'Mege/y/file/'+self.name,'patched_sha256':sha(self.original),'patched_size':len(self.original)}]}))
        self.guard_calls=0
        def guard():self.guard_calls+=1
        self.native=NativeSync(self.game,self.stage,self.manifest,CATALOG,OPPONENTS,self.root/'sync',guard)
        self.entry={'issue_number':1,'issue_updated_at':'2026-10-06T12:00:00Z','packet':self.packet,'revision':packet_revision(self.packet)}
        self.remote={'schema_version':1,'kind':'poc-ai-sync-state','entries':{self.name:self.entry}}
        # Player files are sentinels; sync must not read or write them.
        self.sentinels=[self.game/'deck.ydc',self.root/'system.dat',self.root/'ledger.json',self.game/'Yugi Reborn - Normal.exe']
        for path in self.sentinels:path.write_bytes(b'UNTOUCHED-'+path.name.encode())
        self.before={p:p.read_bytes() for p in self.sentinels}
    def tearDown(self):
        for path,blob in self.before.items():self.assertEqual(path.read_bytes(),blob)
        self.temp.cleanup()
    def test_javascript_payload_is_accepted_and_only_owner_can_save(self):
        issue={'number':1,'user':{'login':'djmonnar'},'updated_at':'2026-10-06T12:00:00Z','body':FIXTURE['draft']['body']}
        self.assertEqual(parse_issue(issue,CATALOG,OPPONENTS)['packet'],self.packet)
        issue['body']=issue['body'].replace('\n','\r\n')
        self.assertEqual(parse_issue(issue,CATALOG,OPPONENTS)['packet'],self.packet)
        issue['user']['login']='someone-else'
        with self.assertRaises(SyncError):parse_issue(issue,CATALOG,OPPONENTS)
    def test_native_apply_preserves_header_updates_stage_manifest_and_is_idempotent(self):
        result=self.native.apply(self.remote);self.assertEqual(result['status'],'applied')
        after=(self.game/'Mege/y/file'/self.name).read_bytes();self.assertEqual(after[:8],self.original[:8]);self.assertNotEqual(after,self.original)
        self.assertEqual(after,(self.stage/'Mege/y/file'/self.name).read_bytes())
        self.assertEqual(load(self.manifest)['files'][0]['patched_sha256'],sha(after))
        self.assertEqual((pathlib.Path(result['backup'])/('game_'+self.name+'.bak')).read_bytes(),self.original)
        self.assertEqual(self.native.apply(self.remote)['status'],'unchanged')
    def test_interrupted_apply_recovers_every_participant(self):
        def crash(stage):
            if stage=='write:game:'+self.name:raise RuntimeError('Fixture interruption')
        self.native.fault=crash
        with self.assertRaises(RuntimeError):self.native.apply(self.remote)
        self.assertTrue(self.native.journal.exists());self.native.fault=lambda _:None
        self.assertEqual(self.native.apply(self.remote)['status'],'unchanged')
        self.assertFalse(self.native.journal.exists())
        self.assertEqual((self.game/'Mege/y/file'/self.name).read_bytes(),(self.stage/'Mege/y/file'/self.name).read_bytes())
    def test_unknown_change_to_interrupted_apply_blocks_without_overwriting(self):
        self.native.fault=lambda stage:(_ for _ in ()).throw(RuntimeError('stop')) if stage=='prepared' else None
        with self.assertRaises(RuntimeError):self.native.apply(self.remote)
        target=self.game/'Mege/y/file'/self.name;target.write_bytes(b'unknown-edit')
        self.native.fault=lambda _:None
        with self.assertRaises(SyncError):self.native.recover()
        self.assertEqual(target.read_bytes(),b'unknown-edit')
    def test_running_game_never_changes_any_recipe(self):
        def running():raise RuntimeError('Game running')
        self.native.guard=running
        with self.assertRaises(RuntimeError):self.native.apply(self.remote)
        self.assertEqual((self.game/'Mege/y/file'/self.name).read_bytes(),self.original)
    def test_bad_dataset_path_identity_limit_and_mode_are_rejected(self):
        mutations=[lambda p:p.update(catalog_dataset_id='0'*64),lambda p:p['target'].update(filename='../deck.ydc'),lambda p:p.update(identity_sha256='0'*64),lambda p:p['deck']['groups']['main'][0].__setitem__(2,4),lambda p:p['deck'].update(ruleset='duel_links_plan')]
        for mutate in mutations:
            packet=copy.deepcopy(self.packet);mutate(packet)
            with self.assertRaises(SyncError):validate_packet(packet,CATALOG,OPPONENTS)
    def test_mapping_and_external_recipe_changes_are_rejected(self):
        ids=self.game/'Mege/bin#/card_id.bin';blob=bytearray(ids.read_bytes());struct.pack_into('<H',blob,self.packet['deck']['groups']['main'][0][0]*2,65535);ids.write_bytes(blob)
        self.assertEqual(len(self.native.apply(self.remote)['rejected']),1)
        self.assertFalse(self.native.journal.exists())
    def test_restore_changes_only_synced_participants(self):
        result=self.native.apply(self.remote);self.assertEqual(self.native.restore(result['backup'])['status'],'restored')
        self.assertEqual((self.game/'Mege/y/file'/self.name).read_bytes(),self.original)
        self.assertEqual(load(self.native.state_path)['targets'],{})
    def test_unmodified_cpu_recipe_can_enter_patch_manifest_and_restore(self):
        staged=self.stage/'Mege/y/file'/self.name;staged.unlink()
        self.manifest.write_bytes(json_bytes({'files':[]}))
        result=self.native.apply(self.remote)
        self.assertEqual(result['status'],'applied');self.assertTrue(staged.exists())
        self.assertEqual(len(load(self.manifest)['files']),1)
        self.native.restore(result['backup'])
        self.assertFalse(staged.exists());self.assertEqual(load(self.manifest)['files'],[])
        self.assertEqual((self.game/'Mege/y/file'/self.name).read_bytes(),self.original)
    def test_restore_refuses_later_manifest_change(self):
        result=self.native.apply(self.remote);self.manifest.write_bytes(b'newer-release')
        with self.assertRaises(SyncError):self.native.restore(result['backup'])
        self.assertEqual(self.manifest.read_bytes(),b'newer-release')
    def test_compression_bomb_is_rejected(self):
        packed=base64.urlsafe_b64encode(gzip.compress(b'x'*100000)).decode().rstrip('=')
        issue={'number':1,'user':{'login':'djmonnar'},'updated_at':'2026-10-06T12:00:00Z','body':MARKER+'\n```poc-ai-sync\n'+packed+'\n```'}
        with self.assertRaises(SyncError):parse_issue(issue,CATALOG,OPPONENTS)
    def integration(self):
        spec=importlib.util.spec_from_file_location('sync_launcher_test',ROOT/'mod-tools/ai-deck-sync/launcher.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        import types
        launcher=types.SimpleNamespace(P=self.root,require_game_closed=self.native.guard)
        (self.root/'config').mkdir();(self.root/'config/ai_sync.json').write_text('{"enabled":true}',encoding='utf-8')
        return module,launcher
    def test_offline_launcher_keeps_recipes_and_writes_status(self):
        module,launcher=self.integration()
        with mock.patch.object(module,'core',return_value=sync_core),mock.patch.object(module,'store',return_value=self.native),mock.patch.object(sync_core,'fetch_state',side_effect=OSError('offline')):
            result=module.before_launch(launcher)
        self.assertEqual(result['status'],'offline')
        self.assertEqual((self.game/'Mege/y/file'/self.name).read_bytes(),self.original)
        self.assertEqual(load(self.root/'reports/last_ai_sync.json')['status'],'offline')
    def test_launcher_recovers_before_offline_network_failure(self):
        self.native.fault=lambda stage:(_ for _ in ()).throw(RuntimeError('stop')) if stage=='prepared' else None
        with self.assertRaises(RuntimeError):self.native.apply(self.remote)
        self.native.fault=lambda _:None
        module,launcher=self.integration()
        with mock.patch.object(module,'core',return_value=sync_core),mock.patch.object(module,'store',return_value=self.native),mock.patch.object(sync_core,'fetch_state',side_effect=OSError('offline')):
            result=module.before_launch(launcher)
        self.assertEqual(result['recovered']['status'],'recovered');self.assertFalse(self.native.journal.exists())

if __name__=='__main__':unittest.main(verbosity=2)
