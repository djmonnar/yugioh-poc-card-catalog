"""GitHub Actions entry point. Issue text is data, never shell/code."""
import base64
import json
import os
import pathlib
import urllib.request
from sync_core import REPO, MARKER, SyncError, json_bytes, load, parse_issue

ROOT = pathlib.Path(__file__).resolve().parents[2]

def api(path, token, method='GET', value=None):
    request = urllib.request.Request('https://api.github.com/repos/'+REPO+'/'+path,
        data=json.dumps(value).encode('utf-8') if value is not None else None,method=method,
        headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'PoC-AI-Deck-Sync'})
    with urllib.request.urlopen(request,timeout=20) as response:return json.load(response)

def main():
    event = load(os.environ['GITHUB_EVENT_PATH'])
    issue = event['issue']
    if not isinstance(issue.get('body'),str) or not issue['body'].startswith(MARKER):
        print('Not an AI sync save; skipped.');return
    try:entry = parse_issue(issue,load(ROOT/'data/cards.json'),load(ROOT/'data/ai-opponents.json'))
    except SyncError as exc:
        print('AI deck save rejected:',str(exc));raise SystemExit(1)
    token = os.environ['GITHUB_TOKEN']
    old = api('contents/sync.json?ref=ai-sync-data',token)
    state = json.loads(base64.b64decode(old['content']))
    filename = entry['packet']['target']['filename']
    previous = state['entries'].get(filename)
    if previous and (previous['issue_updated_at'],previous['issue_number']) > (entry['issue_updated_at'],entry['issue_number']):
        print('A newer AI save is already published; skipped.');return
    state['entries'][filename] = entry
    state['revision'] = state.get('revision',0)+1
    blob = json_bytes(state)
    if len(blob)>2*1024*1024:raise SyncError('Online state capacity exceeded')
    api('contents/sync.json',token,'PUT',{'message':f'Save AI recipe {filename} from issue #{issue["number"]}',
        'content':base64.b64encode(blob).decode('ascii'),'sha':old['sha'],'branch':'ai-sync-data'})
    print('Saved validated AI recipe:',filename)

if __name__=='__main__':main()
