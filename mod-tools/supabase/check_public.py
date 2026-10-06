"""Read-only cloud check plus rejected anonymous write probes. No auth token."""
import importlib.util,json,pathlib,urllib.request,urllib.error
root=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('provider',root/'mod-tools/ai-deck-sync/supabase_provider.py')
provider=importlib.util.module_from_spec(spec);spec.loader.exec_module(provider)
config=json.loads((root/'data/cloud-config.json').read_text(encoding='utf-8'))
state=provider.fetch_state(config)
headers={'apikey':config['publishable_key'],'Content-Type':'application/json'}
with urllib.request.urlopen(urllib.request.Request(config['url']+'/rest/v1/rpc/poc_load_card_settings',data=b'{}',method='POST',headers=headers),timeout=10) as response:
    card_settings=json.loads(response.read(2*1024*1024))
assert isinstance(card_settings,list)
blocked=[]
for path,body in [('/rest/v1/rpc/poc_save_ai_deck',{'p_packet':{},'p_expected_version':0}),('/rest/v1/poc_ai_decks',{'filename':'NOT_A_NATIVE_FILE','version':1,'packet':{}}),('/rest/v1/rpc/poc_save_card_setting',{'p_dataset':'test','p_slot':1,'p_identity_key':'0'*64,'p_rarity':'N','p_stock':False,'p_expected_version':0})]:
    req=urllib.request.Request(config['url']+path,data=json.dumps(body).encode(),method='POST',headers=headers)
    try:
        with urllib.request.urlopen(req,timeout=10) as response:raise AssertionError('Anonymous write unexpectedly allowed')
    except urllib.error.HTTPError as error:
        if error.code not in (401,403):raise
        blocked.append({'endpoint':path,'status':error.code})
print(json.dumps({'public_read':'passed','saved_decks':len(state['entries']),'card_settings':len(card_settings),'anonymous_writes':blocked,'editor_credentials_used':False},ensure_ascii=False))
