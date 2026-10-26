import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mergeCatalogNative035} from '../catalog-native035.js';
import {makeReview,exportPayload,EXPORT_KIND,STORAGE_KEY,parseImport} from '../review-core.js';
import {NATIVE_REVIEW_KEY037 as NK,RECOVERY_KEY037 as RK,IMPORT_BACKUP_KEY037 as IK,RESET_BACKUP_KEY037 as BK,NATIVE_REVIEW_KIND037 as KIND,REVIEW_BUNDLE_KIND037 as BUNDLE,loadReviews037,payloadReviews037,parseReviews037,mergeReviews037,persistReviews037,reviewRows037,reviewMarkdown037} from '../catalog-review037.js';
const hash=c=>c.repeat(64),meta={dataset_id:hash('b'),snapshot_date:'2026-10-26',source_exe_sha256:hash('c')};
const legacy={identity_key:hash('a'),slot:1,internal_id:0,name_ko:'기존 카드',name_en:'Legacy',rarity:'N',deck_limit:3};
const native={identity_key:hash('d'),slot:1427,internal_id:2390,sourceId:2390,nativeOnly:true,engine:'unity-native-035',legacyExportAllowed:false,legacySlot:null,name_ko:'Unity 카드',name_en:'Native',rarity:'SR',deck_limit:3};
const cards=[legacy,native],row=(card,note='의견')=>makeReview(card,{note});
const strip=p=>{const copy=structuredClone(p);delete copy.exported_at;return copy;};
class Storage{
  constructor(seed={},fail=[]){this.values=new Map(Object.entries(seed));this.fail=fail.map(r=>({...r,seen:0}));this.writes=[];}
  check(op,key){for(const f of this.fail)if(f.op===op&&(!f.key||f.key===key)&&++f.seen===(f.at??1)){const e=Error('injected '+key);e.name=f.name??'QuotaExceededError';throw e;}}
  getItem(k){this.check('get',k);return this.values.get(k)??null;}
  setItem(k,v){this.check('set',k);this.writes.push(k);this.values.set(k,String(v));}
  removeItem(k){this.check('remove',k);this.values.delete(k);}
  snapshot(){return Object.fromEntries(this.values);}
}
const initial=()=>({[STORAGE_KEY]:JSON.stringify(exportPayload(meta,[row(legacy,'old L')])),[NK]:JSON.stringify(payloadReviews037(meta,cards,[row(native,'old N')]))});
test('legacy-only retains exact original kind/meta and old parser round-trip',()=>{
 const r=row(legacy),p=payloadReviews037(meta,cards,[r]);assert.deepEqual(strip(p),strip(exportPayload(meta,[r])));assert.equal(p.kind,EXPORT_KIND);assert.equal(parseImport(p,[legacy]).valid.length,1);
});
test('Native-only has its own engine/catalog/kind and keeps legacy source zero separate',()=>{
 const p=payloadReviews037(meta,cards,[row(native)]);assert.equal(p.kind,KIND);assert.equal(p.catalog.engine,'unity-native-035');assert.equal(parseReviews037(p,cards).valid[0].internal_id,2390);
 assert.equal(parseReviews037(payloadReviews037(meta,cards,[row(legacy)]),cards).valid[0].internal_id,0);
});
test('mixed export is an explicit typed bundle; JSON round-trip keeps both',()=>{
 const p=payloadReviews037(meta,cards,[row(native),row(legacy)]);assert.equal(p.kind,BUNDLE);assert.equal(p.legacy.kind,EXPORT_KIND);assert.equal(p.native035.kind,KIND);
 assert.equal(parseReviews037(JSON.parse(JSON.stringify(p)),cards).valid.length,2);assert.equal(reviewRows037(p).length,2);assert.match(reviewMarkdown037(p),/Unity 추가 카드/);assert.match(reviewMarkdown037(p),/기존 카드/);
});
for(const mutate of [p=>p.catalog.catalog_id=hash('e'),p=>p.catalog.engine='fake',p=>p.catalog.extra=true,p=>p.schema_version=2])test('Native catalog/engine/schema forgery rejected '+mutate,()=>{const p=payloadReviews037(meta,cards,[row(native)]);mutate(p);assert.throws(()=>parseReviews037(p,cards));});
test('known Native cannot be smuggled into legacy even with changed source or slot',()=>{
 assert.throws(()=>parseReviews037(exportPayload(meta,[row(native)]),cards));assert.throws(()=>parseReviews037(exportPayload(meta,[{...row(native),internal_id:12,slot:4}]),cards));
});
test('known legacy cannot enter Native, including mismatched identity with existing legacy source',()=>{
 const p=payloadReviews037(meta,cards,[row(native)]);p.reviews=[row(legacy)];assert.throws(()=>parseReviews037(p,cards));p.reviews=[{...row(legacy),identity_key:hash('f')}];assert.throws(()=>parseReviews037(p,cards));
});
test('one malformed bundle part aborts complete parse',()=>{const p=payloadReviews037(meta,cards,[row(native),row(legacy)]);p.native035.catalog.catalog_id=hash('e');assert.throws(()=>parseReviews037(p,cards));});
test('unknown unmatched retains envelope domain; do not infer from slot',()=>{
 const p=payloadReviews037(meta,cards,[row(native)]);p.reviews=[{...row(native),identity_key:hash('e'),slot:999,internal_id:65000}];
 const parsed=parseReviews037(p,cards);assert.equal(parsed.valid.length,0);assert.equal(parsed.unmatched.length,1);
 const out=payloadReviews037(meta,cards,[],parsed.unmatched);assert.equal(out.kind,KIND);assert.deepEqual(out.unmatched_reviews[0],p.reviews[0]);
 assert.throws(()=>payloadReviews037(meta,cards,[],[structuredClone(parsed.unmatched[0])]));
});
test('legacy unmatched and Native unmatched remain separate in mixed bundle',()=>{
 const lp=exportPayload(meta,[{...row(legacy),identity_key:hash('f')}]);const np=payloadReviews037(meta,cards,[row(native)]);np.reviews=[{...row(native),identity_key:hash('e')}];
 const l=parseReviews037(lp,cards),n=parseReviews037(np,cards);const p=payloadReviews037(meta,cards,[],[...l.unmatched,...n.unmatched]);assert.equal(p.legacy.unmatched_reviews.length,1);assert.equal(p.native035.unmatched_reviews.length,1);assert.equal(p.legacy.unmatched_reviews[0].internal_id,0);
});
test('published alias migrates only in original domain',()=>{const corrected={...legacy,identity_key:hash('f'),previous_identity_keys:[legacy.identity_key]};const parsed=parseReviews037(exportPayload(meta,[row(legacy)]),[corrected,native]);assert.equal(parsed.valid[0].identity_key,corrected.identity_key);assert.throws(()=>parseReviews037(exportPayload(meta,[row(legacy),row(corrected)]),[corrected,native]));});
test('valid/unmatched collision is quarantined instead of making next reload fail',()=>{
 const stale=parseReviews037(exportPayload(meta,[{...row(legacy,'stale'),slot:999}]),cards);
 const incoming=parseReviews037(exportPayload(meta,[row(legacy,'correct')]),cards),merged=mergeReviews037(cards,[],stale.unmatched,incoming);
 assert.equal(merged.valid.length,1);assert.equal(merged.unmatched.length,0);assert.equal(merged.collisions.length,1);assert.equal(merged.collisions[0].displaced.changes.note,'stale');
 assert.equal(parseReviews037(payloadReviews037(meta,cards,merged.valid,merged.unmatched),cards).valid.length,1);
 assert.throws(()=>persistReviews037(new Storage(),meta,cards,merged.valid,merged.unmatched),/저장하지/);
 const s=new Storage();persistReviews037(s,meta,cards,merged.valid,merged.unmatched,{backupKey:IK,backupPayload:payloadReviews037(meta,cards,[],stale.unmatched)});assert.match(s.getItem(IK),/stale/);
});
test('undo merge preserves newer current opinions in both namespaces and reports displaced ones',()=>{
 const current=[row(legacy,'new L'),row(native,'new N')],old=parseReviews037(payloadReviews037(meta,cards,[row(legacy,'old L'),row(native,'old N')]),cards);
 const merged=mergeReviews037(cards,current,[],old,{preferIncoming:false});assert.deepEqual(merged.valid.map(r=>r.changes.note),['new L','new N']);assert.equal(merged.collisions.length,2);
});
test('first legacy-only autosave never creates Native active key',()=>{const s=new Storage();const r=persistReviews037(s,meta,cards,[row(legacy)]);assert.deepEqual(r.changedDomains,['legacy']);assert.equal(s.getItem(NK),null);assert.equal(loadReviews037(s,cards).errors.length,0);});
test('first Native-only autosave never changes legacy active or legacy backup keys',()=>{const s=new Storage({unrelated:'keep'});persistReviews037(s,meta,cards,[row(native)]);assert.equal(s.getItem(STORAGE_KEY),null);assert.equal(s.getItem(STORAGE_KEY+'-before-import'),null);assert.equal(s.getItem('unrelated'),'keep');});
test('no-op persist preserves exact existing bytes and does not churn exported_at/updated_at',()=>{
 const s=new Storage(initial());const loaded=loadReviews037(s,cards),before=s.snapshot();const r=persistReviews037(s,meta,cards,loaded.valid,loaded.unmatched);assert.deepEqual(r.changedDomains,[]);assert.deepEqual(s.snapshot(),before);assert.equal(s.writes.length,0);
});
test('Native-only import preserves legacy exact bytes while backing up both domains',()=>{
 const seed=initial(),s=new Storage(seed),loaded=loadReviews037(s,cards),before=payloadReviews037(meta,cards,loaded.valid,loaded.unmatched);
 const imported=parseReviews037(payloadReviews037(meta,cards,[row(native,'imported')]),cards),merged=mergeReviews037(cards,loaded.valid,loaded.unmatched,imported);
 const receipt=persistReviews037(s,meta,cards,merged.valid,merged.unmatched,{backupKey:IK,backupPayload:before});assert.deepEqual(receipt.changedDomains,['native035']);assert.equal(s.getItem(STORAGE_KEY),seed[STORAGE_KEY]);assert.equal(JSON.parse(s.getItem(IK)).kind,BUNDLE);
});
for(const key of [IK,RK,STORAGE_KEY,NK])test('write failure at '+key+' restores original active bytes',()=>{
 const seed=initial(),s=new Storage(seed,[{op:'set',key}]),loaded=loadReviews037(s,cards),before=payloadReviews037(meta,cards,loaded.valid,loaded.unmatched);
 assert.throws(()=>persistReviews037(s,meta,cards,[row(legacy,'new L'),row(native,'new N')],[],{backupKey:IK,backupPayload:before}));
 assert.equal(s.getItem(STORAGE_KEY),seed[STORAGE_KEY]);assert.equal(s.getItem(NK),seed[NK]);
 assert.equal(loadReviews037(new Storage(s.snapshot()),cards).errors.length,0);
});
test('final journal commit failure also rolls active domains back',()=>{
 const seed=initial(),s=new Storage(seed,[{op:'set',key:RK,at:2}]);assert.throws(()=>persistReviews037(s,meta,cards,[row(legacy,'new L'),row(native,'new N')]));assert.equal(s.getItem(STORAGE_KEY),seed[STORAGE_KEY]);assert.equal(s.getItem(NK),seed[NK]);
});
test('partial commit plus rollback failure retains exact original raw and blocks reload writes',()=>{
 const seed=initial(),s=new Storage(seed,[{op:'set',key:NK},{op:'set',key:STORAGE_KEY,at:2,name:'SecurityError'}]);let failure;
 try{persistReviews037(s,meta,cards,[row(legacy,'new L'),row(native,'new N')]);}catch(e){failure=e;}
 assert.equal(failure.rollbackComplete,false);assert.equal(failure.recoveryPayload.before.legacy,seed[STORAGE_KEY]);assert.equal(failure.recoveryPayload.before.native035,seed[NK]);
 const reload=new Storage(s.snapshot()),loaded=loadReviews037(reload,cards);assert.equal(loaded.blockedDomains.length,2);assert.ok(loaded.recoveryPayload);assert.throws(()=>persistReviews037(reload,meta,cards,loaded.valid,loaded.unmatched));
});
test('failed new Native write rollback removes newly created legacy key without touching unrelated keys',()=>{
 const s=new Storage({unrelated:'keep'},[{op:'set',key:NK}]);assert.throws(()=>persistReviews037(s,meta,cards,[row(legacy),row(native)]));assert.equal(s.getItem(STORAGE_KEY),null);assert.equal(s.getItem(NK),null);assert.equal(s.getItem('unrelated'),'keep');
});
test('reset and undo preserve both namespaces; old backup keys stay exact',()=>{
 const seed={...initial(),[STORAGE_KEY+'-before-reset']:'old recovery'},s=new Storage(seed),loaded=loadReviews037(s,cards),before=payloadReviews037(meta,cards,loaded.valid,loaded.unmatched);
 persistReviews037(s,meta,cards,[],[],{backupKey:BK,backupPayload:before});assert.equal(loadReviews037(s,cards).valid.length,0);assert.equal(s.getItem(STORAGE_KEY+'-before-reset'),'old recovery');
 const saved=parseReviews037(JSON.parse(s.getItem(BK)),cards);persistReviews037(s,meta,cards,saved.valid,saved.unmatched,{backupKey:BK,backupPayload:payloadReviews037(meta,cards,[],[])});assert.equal(loadReviews037(s,cards).valid.length,2);
});
test('typed bundle cannot overwrite historical legacy backup keys',()=>{const s=new Storage();assert.throws(()=>persistReviews037(s,meta,cards,[row(legacy)],[],{backupKey:STORAGE_KEY+'-before-reset',backupPayload:payloadReviews037(meta,cards,[row(legacy),row(native)])}));assert.equal(s.getItem(STORAGE_KEY+'-before-reset'),null);});
for(const key of [STORAGE_KEY,NK])test('read denial preserves good other domain and exposes exact raw recovery '+key,()=>{const seed=initial(),s=new Storage(seed,[{op:'get',key,name:'SecurityError'}]);const loaded=loadReviews037(s,cards);assert.equal(loaded.valid.length,1);assert.equal(loaded.errors.length,1);assert.ok(loaded.blockedDomains.length);assert.ok(loaded.recoveryPayload);assert.equal(s.writes.length,0);});
test('one malformed active JSON does not hide the other namespace or get overwritten',()=>{const seed={...initial(),[NK]:'{broken'},s=new Storage(seed),loaded=loadReviews037(s,cards);assert.equal(loaded.valid.length,1);assert.equal(loaded.recoveryPayload.before.native035,'{broken');assert.throws(()=>persistReviews037(s,meta,cards,[row(legacy,'edit')]));assert.equal(s.getItem(NK),'{broken');assert.equal(s.writes.length,0);});
test('oversized duplicate and non-array opinions reject before any persistence',()=>{const p=payloadReviews037(meta,cards,[row(native)]);assert.throws(()=>parseReviews037({...p,reviews:Array(10001).fill(row(native))},cards));assert.throws(()=>parseReviews037({...p,unmatched_reviews:{}},cards));assert.throws(()=>parseReviews037({...p,reviews:[row(native),row(native)]},cards));});
test('actual merged 1456-card catalog round-trips every new source and legacy source zero',()=>{
 const base=JSON.parse(readFileSync(new URL('../data/cards.json',import.meta.url),'utf8')),extra=JSON.parse(readFileSync(new URL('../data/native-expansion035.json',import.meta.url),'utf8'));
 const all=mergeCatalogNative035(base,extra).cards,selected=all.filter(c=>c.nativeOnly),zero=all.find(c=>c.internal_id===0);assert.equal(selected.length,30);
 const p=payloadReviews037(base.meta,all,[row(zero),...selected.map(c=>row(c,'신규 '+c.internal_id))]),parsed=parseReviews037(JSON.parse(JSON.stringify(p)),all);
 assert.equal(parsed.valid.length,31);assert.equal(p.kind,BUNDLE);assert.equal(p.legacy.reviews.length,1);assert.equal(p.native035.reviews.length,30);
});
test('legacy autosave does not overwrite a different tab Native edit',()=>{
 const a=new Storage(initial()),b=new Storage();b.values=a.values;
 const first=loadReviews037(a,cards),second=loadReviews037(b,cards);
 persistReviews037(b,meta,cards,[second.valid.find(r=>r.internal_id===0),row(native,'other tab')]);const otherRaw=a.getItem(NK);
 persistReviews037(a,meta,cards,[row(legacy,'my edit'),first.valid.find(r=>r.internal_id===2390)]);
 assert.equal(a.getItem(NK),otherRaw);assert.match(a.getItem(STORAGE_KEY),/my edit/);
 // Repeated legacy edits must keep the stale-but-unedited Native namespace untouched.
 persistReviews037(a,meta,cards,[row(legacy,'my second edit'),first.valid.find(r=>r.internal_id===2390)]);assert.equal(a.getItem(NK),otherRaw);
});
test('same-domain external edit is a conflict before any writes',()=>{
 const a=new Storage(initial()),b=new Storage();b.values=a.values;loadReviews037(a,cards);const loaded=loadReviews037(b,cards);
 persistReviews037(b,meta,cards,[row(legacy,'external'),loaded.valid.find(r=>r.internal_id===2390)]);const before=a.snapshot(),writes=a.writes.length;
 assert.throws(()=>persistReviews037(a,meta,cards,[row(legacy,'stale local'),loaded.valid.find(r=>r.internal_id===2390)]),/다른 탭/);assert.deepEqual(a.snapshot(),before);assert.equal(a.writes.length,writes);
});
test('backup key old bytes also survive a later active write failure',()=>{
 const seed={...initial(),[BK]:'earlier recovery bytes'},s=new Storage(seed,[{op:'set',key:NK}]),loaded=loadReviews037(s,cards),before=payloadReviews037(meta,cards,loaded.valid,loaded.unmatched);
 assert.throws(()=>persistReviews037(s,meta,cards,[row(legacy,'new'),row(native,'new')],[],{backupKey:BK,backupPayload:before}));assert.equal(s.getItem(BK),'earlier recovery bytes');
});
test('incoming displaced opinion remains in committed recovery JSON across reload',()=>{
 const s=new Storage(initial()),loaded=loadReviews037(s,cards),before=payloadReviews037(meta,cards,loaded.valid,loaded.unmatched),incoming=parseReviews037(payloadReviews037(meta,cards,[row(native,'restore old note')]),cards);
 const edited=[loaded.valid.find(r=>r.internal_id===0),row(native,'keep newer note')],merged=mergeReviews037(cards,edited,[],incoming,{preferIncoming:false});
 const receipt=persistReviews037(s,meta,cards,merged.valid,[],{backupKey:BK,backupPayload:before});assert.match(JSON.stringify(receipt.recoveryPayload.collisions),/restore old note/);
 const reload=loadReviews037(new Storage(s.snapshot()),cards);assert.equal(reload.errors.length,0);assert.match(JSON.stringify(reload.collisionRecovery),/restore old note/);
});
