"""Launcher integration for public owner-confirmed AI recipes."""
import importlib.util
import json
import pathlib
import sys

def core(patch):
    path = pathlib.Path(patch)/'card_encyclopedia/mod-tools/ai-deck-sync/sync_core.py'
    spec = importlib.util.spec_from_file_location('poc_ai_sync_core',path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def fetch_remote(patch,settings=None):
    settings=settings or json.loads((pathlib.Path(patch)/'config/ai_sync.json').read_text(encoding='utf-8'))
    if settings.get('backend','github')=='github':return core(patch).fetch_state()
    if settings.get('backend')!='supabase':raise ValueError('Unknown AI sync backend')
    path=pathlib.Path(patch)/'card_encyclopedia/mod-tools/ai-deck-sync/supabase_provider.py'
    spec=importlib.util.spec_from_file_location('poc_supabase_provider',path)
    provider=importlib.util.module_from_spec(spec);spec.loader.exec_module(provider)
    config=json.loads((pathlib.Path(patch)/'card_encyclopedia/data/cloud-config.json').read_text(encoding='utf-8'))
    return provider.fetch_state(config)

def store(launcher):
    module = core(launcher.P)
    catalog = module.load(launcher.P/'card_encyclopedia/data/cards.json')
    opponents = module.load(launcher.P/'card_encyclopedia/data/ai-opponents.json')
    return module.NativeSync(launcher.GAME,launcher.P/'full_patch_files',launcher.MANIFEST,
        catalog,opponents,launcher.P/'ai_sync',launcher.require_game_closed)

def before_launch(launcher):
    settings = launcher.P/'config/ai_sync.json'
    if not settings.exists() or not json.loads(settings.read_text(encoding='utf-8')).get('enabled'):
        return {'status':'disabled'}
    module = core(launcher.P)
    native = store(launcher)
    launcher.require_game_closed()
    with native.locked():
        recovered = native.recover()
        try:remote = fetch_remote(launcher.P)
        except Exception:
            result = {'status':'offline','message':'온라인 덱 확인 실패 · 기존 AI 덱으로 실행','recovered':recovered}
        else:result = native.apply(remote)
        module.atomic(launcher.P/'reports/last_ai_sync.json',module.json_bytes(result))
        return result

def main():
    import argparse
    import launch_windowed as launcher
    parser = argparse.ArgumentParser()
    parser.add_argument('--check',action='store_true',help='Download/validate only; never write a native recipe')
    parser.add_argument('--restore',type=pathlib.Path,help='Restore an AI sync backup while game is closed')
    args = parser.parse_args()
    if args.check:
        module = core(launcher.P)
        remote = fetch_remote(launcher.P)
        native = store(launcher)
        results = []
        for name,entry in remote['entries'].items():
            module.validate_packet(entry['packet'],native.catalog,native.opponents)
            results.append(name)
        print(json.dumps({'status':'validated','targets':results,'native_files_written':False},ensure_ascii=False))
    elif args.restore:
        native = store(launcher)
        with native.locked():
            result = native.restore(args.restore)
            module = core(launcher.P)
            settings = launcher.P/'config/ai_sync.json'
            config = module.load(settings)
            config['enabled'] = False
            module.atomic(settings,module.json_bytes(config))
            result['automatic_sync_disabled'] = True
            print(json.dumps(result,ensure_ascii=False))
    else:print(json.dumps(before_launch(launcher),ensure_ascii=False))

if __name__=='__main__':main()
