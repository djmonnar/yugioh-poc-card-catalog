"""Strict AI recipe format and journaled native writes. Standard library only.

No player save, collection, wallet, executable or downloaded code is opened.
"""
import base64
import collections
import contextlib
import datetime
import gzip
import hashlib
import io
import json
import os
import pathlib
import re
import struct
import urllib.request
import uuid

REPO = 'djmonnar/yugioh-poc-card-catalog'
OWNER = 'djmonnar'
SYNC_URL = f'https://api.github.com/repos/{REPO}/contents/sync.json?ref=ai-sync-data'
MARKER = '<!-- POC-AI-SYNC:v1 -->'
GROUPS = ('main', 'extra', 'side')

class SyncError(ValueError):
    pass

def require(condition, message):
    if not condition:
        raise SyncError(message)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2)+'\n').encode('utf-8')

def load(path):
    return json.loads(pathlib.Path(path).read_text(encoding='utf-8'))

def atomic(path, blob):
    path = pathlib.Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name+'.'+uuid.uuid4().hex+'.tmp')
    try:
        with temporary.open('xb') as file:
            file.write(blob)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()

def decode_recipe(blob):
    require(14 <= len(blob) <= 512, 'Invalid native recipe size')
    offset, groups = 8, []
    for index in range(3):
        require(offset+2 <= len(blob), 'Truncated recipe')
        count = struct.unpack_from('<H', blob, offset)[0]
        offset += 2
        require(count <= (80 if index == 0 else 15) and offset+count*2 <= len(blob), 'Invalid group size')
        groups.append(list(struct.unpack_from(f'<{count}H', blob, offset)))
        offset += count*2
    require(offset == len(blob), 'Trailing recipe bytes')
    return groups

def validate_packet(packet, catalog, opponents):
    require(isinstance(packet, dict) and packet.get('schema_version') == 1 and packet.get('kind') == 'poc-ai-deck-sync', 'Invalid sync packet')
    snapshot=None
    if packet.get('catalog_dataset_id') != catalog['meta']['dataset_id']:
        compatible=next((s for s in catalog['meta'].get('compatible_datasets',[]) if s['dataset_id']==packet.get('catalog_dataset_id')),None)
        require(compatible is not None, 'Catalog changed; reopen current catalog')
        snapshot={(s,n):key for s,n,key in compatible['identities']}
    target = packet.get('target', {})
    require(isinstance(target, dict), 'Invalid target')
    original = next((d for d in opponents['decks'] if d['source_recipe']['filename'] == target.get('filename')), None)
    require(original is not None and target == original['source_recipe'], 'Target differs from audited opponent recipe')
    deck = packet.get('deck', {})
    require(isinstance(deck, dict) and deck.get('ruleset') == original['ruleset'], 'Duel mode differs from target')
    require(type(deck.get('banlist_enabled')) is bool and type(deck.get('difficulty')) is int and 1 <= deck['difficulty'] <= 7, 'Invalid deck policy')
    require(isinstance(deck.get('name'), str) and 1 <= len(deck['name']) <= 80, 'Invalid deck name')
    strategy = deck.get('strategy', {})
    require(isinstance(strategy, dict) and set(strategy) == {'goal','priorities','combos','avoid'} and all(isinstance(v,str) and len(v)<=6000 for v in strategy.values()), 'Invalid notes')
    require(isinstance(deck.get('groups'), dict) and set(deck['groups']) == set(GROUPS), 'Invalid groups')
    cards = {(c['slot'],c['internal_id']):c for c in catalog['cards']}
    identities, expanded, totals = [], [], collections.Counter()
    for group in GROUPS:
        rows = deck['groups'][group]
        require(isinstance(rows, list) and len(rows) <= 80, 'Invalid card rows')
        ids, seen = [], set()
        for row in rows:
            require(isinstance(row, list) and len(row) == 3 and all(type(n) is int for n in row), 'Invalid card row')
            slot, internal_id, count = row
            require((slot,internal_id) in cards and 1 <= count <= 3 and slot not in seen, 'Unknown or duplicate card')
            seen.add(slot)
            card = cards[(slot,internal_id)]
            require(not card.get('special'), 'Special card cannot enter deck')
            require((card['type'] == '융합 몬스터') == (group == 'extra'), 'Wrong card group')
            key=card['identity_key'] if snapshot is None else snapshot.get((slot,internal_id))
            require(key in {card['identity_key'],*card.get('previous_identity_keys',[])}, 'Card identity changed; reopen current catalog')
            identities.append([group,slot,internal_id,count,key])
            ids.extend([internal_id]*count)
            totals[(slot,internal_id)] += count
        expanded.append(ids)
    limits = (40,80) if deck['ruleset'] == 'classic' else (20,30)
    require(limits[0] <= len(expanded[0]) <= limits[1] and len(expanded[1]) <= 15 and len(expanded[2]) <= 15, 'Deck size outside mode limits')
    for key,count in totals.items():
        card = cards[key]
        require(count <= 3, f'AI same-card copy limit: {card["name_ko"]}')
    harpies={(108,1530),(606,609),(696,61),(697,1249),(827,608)}
    require(sum(count for key,count in totals.items() if key in harpies)<=3,
            'Harpie Lady shared name: main/side total must not exceed 3')
    require(sum(count for key,count in totals.items() if key==(86,333) or
                (key==(98,2040) and cards[key]['name_en']=='A Legendary Ocean'))<=3,
            'Umi / A Legendary Ocean shared name: all groups total must not exceed 3')
    require(sha(json.dumps(identities,separators=(',',':'),ensure_ascii=False).encode('utf-8')) == packet.get('identity_sha256'), 'Card identities changed')
    return expanded

def parse_issue(issue, catalog, opponents):
    require(isinstance(issue, dict) and issue.get('user', {}).get('login') == OWNER and not issue.get('pull_request'), 'Only owner AI issues are accepted')
    require(type(issue.get('number')) is int and issue['number'] > 0, 'Invalid issue number')
    body = issue.get('body', '')
    require(isinstance(body, str) and len(body) <= 100000 and body.startswith(MARKER), 'Not an AI sync issue')
    body = body.replace('\r\n','\n').replace('\r','\n')
    match = re.search(r'```poc-ai-sync\n([A-Za-z0-9_-]{1,64000})\n```', body)
    require(match is not None, 'Missing sync payload')
    packed = match.group(1)
    try:
        compressed = base64.b64decode(packed.replace('-','+').replace('_','/')+'='*(-len(packed)%4),validate=True)
        with gzip.GzipFile(fileobj=io.BytesIO(compressed)) as file:
            raw = file.read(48001)
        require(len(raw) <= 48000, 'Sync payload too large')
        packet = json.loads(raw)
    except (OSError,ValueError,EOFError) as exc:
        raise SyncError('Malformed compressed sync payload') from exc
    validate_packet(packet,catalog,opponents)
    require(isinstance(issue.get('updated_at'),str) and re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ',issue['updated_at']), 'Invalid issue timestamp')
    return {'issue_number':issue['number'],'issue_updated_at':issue['updated_at'],'revision':packet_revision(packet),'packet':packet}

def packet_revision(packet):
    return sha(json.dumps(packet,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode('utf-8'))

def fetch_state():
    request = urllib.request.Request(SYNC_URL+'&check='+uuid.uuid4().hex,headers={'User-Agent':'PoC-AI-Deck-Sync/1','Cache-Control':'no-cache','Accept':'application/vnd.github.raw+json'})
    with urllib.request.urlopen(request,timeout=5) as response:
        require(response.geturl().startswith(SYNC_URL), 'Unexpected sync redirect')
        data = response.read(2*1024*1024+1)
    require(len(data) <= 2*1024*1024,'Remote state too large')
    value = json.loads(data)
    require(value.get('schema_version') == 1 and value.get('kind') == 'poc-ai-sync-state' and isinstance(value.get('entries'),dict) and len(value['entries']) <= 42,'Invalid online state')
    return value

class NativeSync:
    def __init__(self, game, stage, manifest, catalog, opponents, directory, guard, fault=None):
        self.game,self.stage,self.manifest = map(pathlib.Path,(game,stage,manifest))
        self.catalog,self.opponents = catalog,opponents
        self.directory = pathlib.Path(directory)
        self.guard,self.fault = guard,fault or (lambda _:None)
        self.journal = self.directory/'pending.json'
        self.state_path = self.directory/'applied.json'

    @contextlib.contextmanager
    def locked(self):
        self.directory.mkdir(parents=True,exist_ok=True)
        path = self.directory/'sync.lock'
        with path.open('a+b') as file:
            if file.tell() == 0:
                file.write(b'0');file.flush()
            file.seek(0)
            if os.name == 'nt':
                import msvcrt
                try:msvcrt.locking(file.fileno(),msvcrt.LK_NBLCK,1)
                except OSError as exc:raise SyncError('AI sync already running') from exc
            try:yield
            finally:
                if os.name == 'nt':
                    file.seek(0);msvcrt.locking(file.fileno(),msvcrt.LK_UNLCK,1)

    def paths(self, names):
        allowed = {d['source_recipe']['filename'] for d in self.opponents['decks']}
        paths = {'manifest':self.manifest,'state':self.state_path}
        for name in names:
            require(name in allowed and re.fullmatch(r'(cpu|DLR)_\d{3}\.ydc',name), 'Unauthorized recipe path')
            relative = pathlib.Path('Mege/y/file')/name
            for label,root in (('game',self.game),('stage',self.stage)):
                path = root/relative
                require(path.resolve().is_relative_to(root.resolve()) and not path.is_symlink(), 'Recipe path escapes game')
                paths[label+':'+name] = path
        return paths

    def recover(self):
        self.guard()
        if not self.journal.exists():return None
        value = load(self.journal)
        require(value.get('schema') == 1 and isinstance(value.get('names'),list),'Invalid local sync journal')
        paths = self.paths(value['names'])
        require(set(value['writes']) == set(paths),'Invalid journal participants')
        for key,row in value['writes'].items():
            path = paths[key]
            actual = sha(path.read_bytes()) if path.exists() else None
            require(actual in (row['before'],row['after']),'Local change conflicts with interrupted AI sync')
            if row['after'] is None:
                require(key.startswith('stage:cpu_') and row['blob'] is None,'Invalid journal deletion')
            else:require(sha(base64.b64decode(row['blob'],validate=True)) == row['after'],'Invalid journal content')
        for key,row in value['writes'].items():
            self.guard()
            if row['after'] is None:
                if paths[key].exists():paths[key].unlink()
            else:atomic(paths[key],base64.b64decode(row['blob'],validate=True))
            self.fault('write:'+key)
        self.journal.unlink()
        return {'status':'recovered','targets':value['names']}

    def apply(self, remote):
        self.guard()
        recovered = self.recover()
        require(remote.get('schema_version') == 1 and remote.get('kind') == 'poc-ai-sync-state' and isinstance(remote.get('entries'),dict) and len(remote['entries']) <= 42,'Invalid online state')
        state = load(self.state_path) if self.state_path.exists() else {'schema':1,'targets':{}}
        require(state.get('schema') == 1 and isinstance(state.get('targets'),dict),'Invalid local state')
        manifest = load(self.manifest)
        rows = {r['path']:r for r in manifest['files']}
        updates,rejected,writes = [],[],{}
        ids_blob = (self.game/'Mege/bin#/card_id.bin').read_bytes()
        native_ids = list(struct.unpack('<'+str(len(ids_blob)//2)+'H',ids_blob))
        for name,entry in remote['entries'].items():
            try:
                packet = entry['packet']
                groups = validate_packet(packet,self.catalog,self.opponents)
                require(packet['target']['filename'] == name and type(entry['issue_number']) is int and entry['issue_number']>0 and entry['revision']==packet_revision(packet), 'Invalid remote entry')
                require(isinstance(entry.get('issue_updated_at'),str) and re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ',entry['issue_updated_at']),'Invalid remote timestamp')
                previous = state['targets'].get(name,{})
                paths = self.paths([name])
                current = paths['game:'+name].read_bytes()
                staged = paths['stage:'+name]
                require((staged.exists() and staged.read_bytes() == current) or (not staged.exists() and name.startswith('cpu_') and not previous),'Game and stage recipe differ')
                relative = 'Mege/y/file/'+name
                require((relative in rows and rows[relative]['patched_sha256'] == sha(current)) or (relative not in rows and name.startswith('cpu_') and not previous),'Recipe differs from applied manifest')
                require(sha(current) == previous.get('after_sha256',packet['target']['sha256']),'Recipe changed since audited source')
                decode_recipe(current)
                for group in GROUPS:
                    for slot,internal_id,_ in packet['deck']['groups'][group]:
                        require(slot < len(native_ids) and native_ids[slot] == internal_id,'Native card mapping differs from catalog')
                if previous.get('revision') == entry['revision']:continue
                after = current[:8]+b''.join(struct.pack('<H',len(g))+struct.pack(f'<{len(g)}H',*g) for g in groups)
                require(decode_recipe(after) == groups,'Native encoding mismatch')
                for label in ('game','stage'):writes[label+':'+name] = after
                if relative not in rows:
                    rows[relative] = {'path':relative,'original_sha256':sha(current),'pilot_sha256':sha(current)}
                    manifest['files'].append(rows[relative])
                rows[relative].update(patched_sha256=sha(after),size=len(after))
                state['targets'][name] = {k:entry[k] for k in ('issue_number','revision','issue_updated_at')}|{'after_sha256':sha(after),'base_sha256':packet['target']['sha256'],'name':packet['deck']['name'],'strategy':packet['deck']['strategy']}
                updates.append(name)
            except (KeyError,TypeError,ValueError,OSError) as exc:
                rejected.append({'filename':name,'reason':str(exc)})
        if not updates:return {'status':'unchanged','recovered':recovered,'rejected':rejected,'targets':[]}
        paths = self.paths(updates)
        writes['manifest'],writes['state'] = json_bytes(manifest),json_bytes(state)
        backup = self.directory/'backups'/datetime.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        backup.mkdir(parents=True,exist_ok=False)
        journal = {'schema':1,'names':updates,'backup':str(backup),'writes':{}}
        for key,after in writes.items():
            path = paths[key];before = path.read_bytes() if path.exists() else None
            if before is not None:atomic(backup/(key.replace(':','_')+'.bak'),before)
            journal['writes'][key] = {'before':sha(before) if before is not None else None,'after':sha(after),'blob':base64.b64encode(after).decode('ascii')}
        atomic(backup/'transaction.json',json_bytes(journal))
        self.guard()
        atomic(self.journal,json_bytes(journal))
        self.fault('prepared')
        self.recover()
        return {'status':'applied','targets':updates,'rejected':rejected,'backup':str(backup)}

    def restore(self, backup):
        self.guard()
        self.recover()
        backup = pathlib.Path(backup).resolve()
        require(backup.is_relative_to((self.directory/'backups').resolve()),'Backup outside AI sync directory')
        old = load(backup/'transaction.json')
        paths = self.paths(old['names'])
        require(set(old['writes']) == set(paths),'Invalid backup participants')
        reverse = {'schema':1,'names':old['names'],'writes':{}}
        for key,row in old['writes'].items():
            actual = sha(paths[key].read_bytes()) if paths[key].exists() else None
            require(actual == row['after'],'Files changed after this AI sync; restore stopped')
            if row['before'] is None:
                require(key == 'state' or key.startswith('stage:cpu_'),'Unexpected missing original')
                blob = json_bytes({'schema':1,'targets':{}}) if key == 'state' else None
            else:
                blob = (backup/(key.replace(':','_')+'.bak')).read_bytes()
                require(sha(blob) == row['before'],'Backup checksum mismatch')
            reverse['writes'][key] = {'before':actual,'after':sha(blob) if blob is not None else None,'blob':base64.b64encode(blob).decode('ascii') if blob is not None else None}
        atomic(self.journal,json_bytes(reverse))
        self.recover()
        return {'status':'restored','targets':old['names']}
