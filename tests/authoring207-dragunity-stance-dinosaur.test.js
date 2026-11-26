import assert from 'node:assert/strict';
import {createHash, webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {GAME_IDENTITY203, gameIdentityAccepts203} from '../authoring203-identity.js';
import {CONTENT_PROFILE207, GAME_IDENTITY207, gameIdentityAccepts207} from '../authoring207-identity.js';
import {cardMetadata207} from '../authoring207-catalog.js';
import {normalizeBootstrap039, PROJECT039} from '../authoring039-store.js';
import {changeDeckCard039, normalizeCatalog039} from '../authoring039-panels.js';
import {canonicalPositionCategories212} from '../authoring131-category-aliases.js';
import {catalogAdditions049} from '../authoring049-recent.js';
import {additionThemes067} from '../authoring067-themes.js';
import {portraitUrl081} from '../authoring081-assets.js';
import {thumbnailUrl170} from '../authoring170-catalog.js';
import {CARD_RELATIONS198, CARD_RELATIONS_META198} from '../authoring198-card-relations-data.js';
import {previewSeed170} from '../scripts/preview170-seed.mjs';

const read = relative => readFileSync(new URL(`../${relative}`, import.meta.url));
const pack = JSON.parse(read('data/native-expansion207.json'));
const relics = JSON.parse(read('data/relics207.json'));
const hash = data => createHash('sha256').update(data).digest('hex');
const extraIds = [3350, 3354, 3355];

function bootstrap(identity, rows = []) {
  const catalog = rows.map(row => ({source_id:row.sourceId,web_slot:row.slot,identity_key:row.identity_key,
    name:row.name,name_english:row.nameEnglish,description:row.description,alias:row.alias,native_type:row.type,
    type_name:row.typeName,normal_limit:row.normalLimit,speed_limit:row.speedLimit,code:row.code,art_key:row.artKey,
    playable:row.playable,token:row.token,race:row.race,categories:row.categories,stock:row.playable,draw_enabled:row.playable}));
  const payload = JSON.stringify({catalog,deck_rules035:{},opponents:{},starters:{},content022:{},meta017:{},characters:[],shop_rules:{}});
  return {schema:1,kind:'unified039-bootstrap',project_id:PROJECT039,project_revision:1,unchanged:false,
    permissions:{can_edit:false},authoring:null,game:{schema:1,kind:'poc-unified-game039',game_revision:1,
      authoring_revision:1,metadata_revision:'1',identity,payload_json:payload,source_fingerprint:hash(payload)}};
}

test('53 cards keep canonical art, thumbnails, deck limits and the three Synchro Extra Deck entries',async()=>{
  const cards = normalizeCatalog039({bootstrap:await normalizeBootstrap039(bootstrap(GAME_IDENTITY207, pack.cards),webcrypto)});
  assert.deepEqual(cards.map(card=>card.source_id),Array.from({length:53},(_,index)=>3350+index));
  const actualExtra = [];
  for (const [index, card] of cards.entries()) {
    const row = pack.cards[index];
    assert.equal(card.name_ko,row.name);
    assert.deepEqual(card.tags,canonicalPositionCategories212(row.categories));
    assert.deepEqual(cardMetadata207(row.sourceId,row.identity_key).searchAliases,row.searchAliases);
    assert.equal(cardMetadata207(row.sourceId,'0'.repeat(64)),null);
    assert.equal(card.image,`assets/native207/cards/${row.sourceId}.jpg`);
    const thumbnail = thumbnailUrl170(card.image);
    assert.equal(thumbnail,`assets/native207/thumbs/${row.sourceId}.jpg`);
    assert.equal(read(card.image).subarray(0,3).toString('hex'),'ffd8ff');
    assert.equal(read(thumbnail).subarray(0,3).toString('hex'),'ffd8ff');
    assert(read(thumbnail).length < read(card.image).length);
    assert.equal(card.deck_limit,3);
    const changed = changeDeckCard039({banlist_enabled:true,main:[],extra:[]},card,1,cards);
    if (changed.extra.length) actualExtra.push(card.source_id);
    else assert.equal(changed.main[0].source_id,card.source_id);
  }
  assert.deepEqual(actualExtra, extraIds);
  const additions = catalogAdditions049(cards);
  assert.deepEqual([additions.latest.key,additions.latest.label],['Cards207','드래그니티·표시 변경·공룡']);
  assert.deepEqual(additionThemes067(cards,'latest',additions).filter(theme=>theme.key!=='all').map(theme=>[theme.label,theme.count]),
    [['드래그니티',18],['표시 변경',17],['공룡',18]]);
});

test('the editor verifies 207 while loading the earlier 203 and a later catalog identity',async()=>{
  assert.deepEqual(CONTENT_PROFILE207,{schema:1,card_set:'dragunity-stance-dinosaur207'});
  assert.equal(GAME_IDENTITY207.native_manifest207_sha256,hash(read('data/native-expansion207.json')));
  assert.equal(GAME_IDENTITY207.catalog203_sha256,pack.parentCatalogSha256);
  assert(gameIdentityAccepts203(GAME_IDENTITY207));
  for (const identity of [GAME_IDENTITY203,GAME_IDENTITY207,{...GAME_IDENTITY207,catalog208_sha256:'a'.repeat(64)}])
    await normalizeBootstrap039(bootstrap(identity),webcrypto);
  const forged = {...GAME_IDENTITY207,catalog207_sha256:'0'.repeat(64)};
  assert(!gameIdentityAccepts207(forged));
  await assert.rejects(normalizeBootstrap039(bootstrap(forged),webcrypto),/게임 버전/);
});

test('preview exposes Kenzan and the ten relic names, descriptions and editable bounds',async()=>{
  const seed = await previewSeed170(fileURLToPath(new URL('../',import.meta.url)));
  const kenzan = seed.characters.find(character=>character.profile_id==='tyranno_kenzan');
  assert.equal(kenzan.profile.name,'티라노 켄잔');
  const portrait = 'assets/actors/native208/tyranno_kenzan/start.png';
  assert.equal(portraitUrl081(kenzan.art_key),portrait);
  assert.equal(portraitUrl081(kenzan.profile.portrait),portrait);
  assert.equal(portraitUrl081('Character208/tyranno_kenzan_start'),portrait);
  assert.equal(hash(read(portrait)),'de9786097445946e7d90d224ee315c4f3a7cc9f4fd70748f6e3716029c584494');
  assert.equal(relics.length,10);
  for (const relic of relics) {
    assert.equal(seed.rows.find(row=>row.entity_type==='relic'&&row.entity_id===relic.id).content.description,relic.description);
    assert.deepEqual(seed.capabilities.form.relics.find(form=>form.id===relic.id).bounds,relic.bounds);
  }
  assert.equal(CARD_RELATIONS_META198.catalog,'catalog207.json');
  assert.deepEqual(CARD_RELATIONS198[3359]?.n,[3157]);
});
