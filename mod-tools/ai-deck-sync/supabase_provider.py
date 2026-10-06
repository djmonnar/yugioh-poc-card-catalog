"""Read public AI recipes with a publishable key. Never handles editor credentials."""
import datetime
import hashlib
import json
import re
import urllib.request

def validate_config(config):
    if (config.get('schema_version') != 1 or config.get('provider') != 'supabase'
        or not re.fullmatch(r'https://[a-z]{20}\.supabase\.co',config.get('url',''))
        or not re.fullmatch(r'sb_publishable_[A-Za-z0-9_-]+',config.get('publishable_key',''))):
        raise ValueError('Invalid Supabase public configuration')
    return config

def adapt_rows(rows):
    if not isinstance(rows,list) or len(rows)>42: raise ValueError('Invalid Supabase state')
    entries={}
    for row in rows:
        name,version,packet=row.get('filename'),row.get('version'),row.get('packet')
        if (not isinstance(name,str) or not re.fullmatch(r'(cpu|DLR)_\d{3}\.ydc',name)
            or type(version) is not int or version<1 or name in entries
            or not isinstance(packet,dict) or packet.get('target',{}).get('filename')!=name):
            raise ValueError('Invalid Supabase revision')
        stamp=row.get('updated_at')
        if not isinstance(stamp,str): raise ValueError('Invalid Supabase timestamp')
        instant=datetime.datetime.fromisoformat(stamp.replace('Z','+00:00'))
        if instant.tzinfo is None: raise ValueError('Cloud timestamp needs timezone')
        stamp=instant.astimezone(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        revision=hashlib.sha256(json.dumps(packet,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode('utf-8')).hexdigest()
        # Native journal v1 uses issue_number as its positive source version field.
        entries[name]={'issue_number':version,'issue_updated_at':stamp,'revision':revision,'packet':packet,'provider':'supabase'}
    return {'schema_version':1,'kind':'poc-ai-sync-state','revision':max((r['issue_number'] for r in entries.values()),default=0),'entries':entries}

def fetch_state(config):
    validate_config(config)
    url=config['url']+'/rest/v1/rpc/poc_load_ai_decks'
    request=urllib.request.Request(url,data=b'{}',method='POST',headers={'apikey':config['publishable_key'],'Content-Type':'application/json','User-Agent':'PoC-AI-Deck-Sync/2','Cache-Control':'no-cache'})
    with urllib.request.urlopen(request,timeout=5) as response:
        if response.geturl()!=url: raise ValueError('Unexpected cloud redirect')
        blob=response.read(2*1024*1024+1)
    if len(blob)>2*1024*1024: raise ValueError('Cloud state too large')
    return adapt_rows(json.loads(blob))
