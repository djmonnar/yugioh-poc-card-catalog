"""Public cloud balance settings -> local shop overlay. No wallet/save access."""
import json,os,pathlib,re,urllib.request,uuid
PRICES={'UR':(300,150),'SR':(200,100),'R':(100,50),'N':(50,25)}
def validate_rows(rows):
    if not isinstance(rows,list) or len(rows)>1110:raise ValueError('Invalid card settings')
    seen=set()
    for r in rows:
        if (not isinstance(r,dict) or type(r.get('slot')) is not int or not 1<=r['slot']<=2047 or r['slot'] in seen or type(r.get('internal_id')) is not int or not re.fullmatch(r'[a-f0-9]{64}',r.get('identity_key','')) or r.get('rarity') not in PRICES or type(r.get('stock')) is not bool or type(r.get('version')) is not int or r['version']<1):raise ValueError('Invalid card setting')
        seen.add(r['slot'])
    return rows
def apply_overrides(cards,path):
    if path is None or not pathlib.Path(path).exists():return cards
    state=json.loads(pathlib.Path(path).read_text(encoding='utf-8'))
    if state.get('schema_version')!=1 or state.get('kind')!='poc-cloud-card-settings':raise ValueError('Invalid card overlay')
    for row in validate_rows(state.get('rows')):
        c=cards.get(row['slot'])
        if c and c['identity_key']==row['identity_key'] and c['internal_id']==row['internal_id']:
            c.update(rarity=row['rarity'],stock=row['stock'],buy_price=PRICES[row['rarity']][0],sell_price=PRICES[row['rarity']][1],rarity_reason='도감에서 직접 저장한 등급')
    return cards
def fetch_rows(config):
    if config.get('provider')!='supabase' or not re.fullmatch(r'https://[a-z]{20}\.supabase\.co',config.get('url','')) or not re.fullmatch(r'sb_publishable_[A-Za-z0-9_-]+',config.get('publishable_key','')):raise ValueError('Invalid public cloud config')
    url=config['url']+'/rest/v1/rpc/poc_load_card_settings'
    req=urllib.request.Request(url,data=b'{}',method='POST',headers={'apikey':config['publishable_key'],'Content-Type':'application/json','User-Agent':'PoC-Card-Settings/1'})
    with urllib.request.urlopen(req,timeout=5) as response:
        if response.geturl()!=url:raise ValueError('Unexpected cloud redirect')
        blob=response.read(2*1024*1024+1)
    if len(blob)>2*1024*1024:raise ValueError('Settings too large')
    return validate_rows(json.loads(blob))
def sync_settings(patch,fetcher=None):
    patch=pathlib.Path(patch);settings=patch/'config/card_settings_sync.json'
    if not settings.exists() or not json.loads(settings.read_text(encoding='utf-8')).get('enabled'):return {'status':'disabled'}
    path=patch/'config/cloud_card_settings.json'
    try:
        config=json.loads((patch/'card_encyclopedia/data/cloud-config.json').read_text(encoding='utf-8'))
        rows=validate_rows((fetcher or fetch_rows)(config));value={'schema_version':1,'kind':'poc-cloud-card-settings','rows':rows}
        if path.exists() and json.loads(path.read_text(encoding='utf-8'))==value:return {'status':'unchanged','settings':len(rows)}
        path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_name(path.name+'.'+uuid.uuid4().hex+'.tmp')
        try:
            with temp.open('x',encoding='utf-8') as f:json.dump(value,f,ensure_ascii=False,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
            os.replace(temp,path)
        finally:
            if temp.exists():temp.unlink()
        return {'status':'updated','settings':len(rows)}
    except (OSError,ValueError,TypeError,KeyError):return {'status':'offline','message':'기존 등급·상점 설정 유지'}
