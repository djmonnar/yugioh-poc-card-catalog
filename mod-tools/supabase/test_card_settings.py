import copy,json,pathlib,tempfile,unittest
import card_settings_sync as sync
class SettingsTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=pathlib.Path(self.temp.name)
        self.row={'slot':316,'internal_id':1,'identity_key':'a'*64,'rarity':'UR','stock':True,'version':3}
    def tearDown(self):self.temp.cleanup()
    def test_matching_overlay_updates_price_stock_and_not_identity(self):
        cards={316:{**self.row,'rarity':'N','stock':False,'buy_price':50,'sell_price':25}};path=self.root/'settings.json'
        path.write_text(json.dumps({'schema_version':1,'kind':'poc-cloud-card-settings','rows':[self.row]}),encoding='utf-8')
        result=sync.apply_overrides(cards,path)[316];self.assertEqual((result['buy_price'],result['sell_price'],result['stock']),(300,150,True));self.assertEqual(result['identity_key'],'a'*64)
        old={316:{**cards[316],'identity_key':'b'*64,'rarity':'N'}};self.assertEqual(sync.apply_overrides(old,path)[316]['rarity'],'N')
    def test_offline_keeps_previous_settings_and_does_not_touch_save_wallet(self):
        config=self.root/'config';config.mkdir();(config/'card_settings_sync.json').write_text('{"enabled":true}')
        web=self.root/'card_encyclopedia/data';web.mkdir(parents=True);(web/'cloud-config.json').write_text('{}')
        old=config/'cloud_card_settings.json';old.write_bytes(b'previous-settings')
        for name in ('system.dat','ledger.json'):(self.root/name).write_bytes(b'player-sentinel')
        def offline(_):raise OSError('offline')
        self.assertEqual(sync.sync_settings(self.root,offline)['status'],'offline');self.assertEqual(old.read_bytes(),b'previous-settings')
        for name in ('system.dat','ledger.json'):self.assertEqual((self.root/name).read_bytes(),b'player-sentinel')
    def test_duplicate_and_wrong_types_never_replace_cache(self):
        for rows in [[self.row,self.row],[{**self.row,'stock':1}],[{**self.row,'version':True}],[{**self.row,'rarity':'XX'}]]:
            with self.assertRaises(ValueError):sync.validate_rows(rows)
    def test_legend_and_draw_settings_preserve_identity_and_grant_eligibility(self):
        row={**self.row,'rarity':'L','stock':False,'draw_enabled':False}
        sync.validate_rows([row]);path=self.root/'legend.json'
        path.write_text(json.dumps({'schema_version':1,'kind':'poc-cloud-card-settings','rows':[row]}),encoding='utf-8')
        cards={316:{**self.row,'reward_eligible':True}};c=sync.apply_overrides(cards,path)[316]
        self.assertEqual((c['stock'],c['draw_enabled'],c['sell_enabled'],c['sell_price']),(False,False,False,0));self.assertTrue(c['reward_eligible'])
        for bad in ({**row,'stock':True},{**row,'draw_enabled':True},{**row,'draw_enabled':1}):
            with self.assertRaises(ValueError):sync.validate_rows([bad])
if __name__=='__main__':unittest.main()
