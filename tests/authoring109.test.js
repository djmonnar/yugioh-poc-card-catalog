import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { GAME_IDENTITY103 } from '../authoring103-identity.js';
import { GAME_IDENTITY109, gameIdentityMatches109 } from '../authoring109-identity.js';
import { AuthoringStore039, normalizeBootstrap039, PROJECT039 } from '../authoring039-store.js';
import { normalizeCatalog039, changeDeckCard039, createAuthoringPanels039 } from '../authoring039-panels.js';
import { cardMetadata109 } from '../authoring109-catalog.js';
import { validateAuthoringChange066 } from '../authoring066-validation.js';
import { traitCardMatches089, sharedTraitRefMatches089 } from '../authoring089-traits.js';
import { catalogAdditions049 } from '../authoring049-recent.js';
import { additionThemes067 } from '../authoring067-themes.js';
import { CARD_SORTS091, sortCards091, cardQueryMatches091 } from '../authoring091-search.js';
import { Document041, fixture041, field041, button041 } from './authoring041-test-dom.js';

const read = file => readFileSync(new URL(file, import.meta.url));
const sha = value => createHash('sha256').update(value).digest('hex');
const previous = ['049','053','067','081','084','088','090','093','099','103'];
const cards = version => JSON.parse(read('../data/native-expansion' + version + '.json')).cards;
const current = [...cards(108), ...cards(109)];
const charId = 'web109-character';
const maskSource = 1418;

function baseFixture(latest = true) {
  const state = fixture041();
  state.user = { id: 'web109-synthetic-editor' };
  for (const version of [...previous, ...(latest ? ['108','109'] : [])]) {
    state.bootstrap.catalog.cards.push(...cards(version).map(card => {
      const { searchAliases, imageUrl, ...remaining } = card;
      return { ...remaining, source_id: card.sourceId, web_slot: card.slot, art_key: card.artKey,
        native_type: card.type, type_name: card.typeName, categories: card.categories,
        stock: card.playable !== false, draw_enabled: card.playable !== false };
    }));
  }
  if (latest) state.bootstrap.catalog.cards.find(card => card.source_id === maskSource).normal_limit = 1;
  return state;
}

function wire(state, identity, revision) {
  const payload = JSON.stringify({ catalog: state.bootstrap.catalog.cards, deck_rules035: {}, opponents: {}, starters: {},
    content022: {}, meta017: {}, characters: state.bootstrap.characters, shop_rules: {} });
  return { schema: 1, kind: 'unified039-bootstrap', project_id: PROJECT039, view: 'authoring',
    project_revision: revision, unchanged: false, permissions: { can_edit: true }, authoring: { entities: state.entities },
    game: { schema: 1, kind: 'poc-unified-game039', game_revision: revision, authoring_revision: revision,
      metadata_revision: String(revision), identity, payload_json: payload, source_fingerprint: sha(payload) } };
}
function mount(t, state, section, id) {
  const document = new Document041();
  const root = document.createElement('main');
  const writes = [], errors = [];
  document.body.append(root);
  const panels = createAuthoringPanels039({ document, onChange: (...args) => writes.push(structuredClone(args)),
    onError: error => errors.push(error) });
  if (id) panels.selectEntity065(section, id);
  if (section === 'decks') panels.selectDeck(id);
  panels.render(section, root, state);
  t.after(() => panels.destroy());
  return { root, panels, writes, errors };
}
const ref = card => ({ slot: card.slot, internal_id: card.source_id, identity_key: card.identity_key, name_ko: card.name_ko });
function addCharacter(state, skills) {
  state.entities.push({ entity_type: 'character', entity_id: charId, version: 1, state: 'saved', issues: [],
    content: { name: '기존 사용자 캐릭터', portrait: '', skills, skill_profiles: [] } });
}
function pick(root, target) {
  const input = root.querySelectorAll('input').find(node => node.dataset.editKey === 'character:' + charId + '.skills.0.card');
  assert(input);
  const search = field041(input.parentElement, '대상 카드 검색');
  search.value = target.name_ko;
  search.fire('input');
  const option = input.parentElement.querySelectorAll('.au-card-pick')
    .find(node => node.textContent.replace(/ ✓$/, '') === target.name_ko);
  assert(option && !option.disabled, target.name_ko);
  option.click();
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('Web109 validates exact 27 identity fields and all supported prior identities', () => {
  const keys = Object.keys(GAME_IDENTITY109);
  assert.equal(keys.length, 27);
  assert.deepEqual(Object.fromEntries(Object.entries(GAME_IDENTITY109).slice(0,23)), GAME_IDENTITY103);
  for (const size of [3,5,7,9,11,13,15,17,19,21,23,27]) {
    assert(gameIdentityMatches109(Object.fromEntries(Object.entries(GAME_IDENTITY109).slice(0,size))));
  }
  for (const size of [0,2,4,6,8,10,12,14,16,18,20,22,24,25,26]) {
    assert.equal(gameIdentityMatches109(Object.fromEntries(Object.entries(GAME_IDENTITY109).slice(0,size))), false);
  }
  for (const key of keys) assert.equal(gameIdentityMatches109({ ...GAME_IDENTITY109, [key]: '0'.repeat(64) }), false);
  assert.equal(gameIdentityMatches109({ ...GAME_IDENTITY109, alien: '' }), false);
});

test('Web109 manifests and all 21 local artworks match their source identities', () => {
  assert.equal(sha(read('../data/native-expansion108.json')), 'edd1cc722702e387c80129dc6152618fe242d1284cd18f22477008278bc9165a');
  assert.equal(sha(read('../data/native-expansion109.json')), 'bf2f0d731ae9f3fd9c99227b53265f4ac9eb3b9debe534a5ccbf2632fc256314');
  assert.equal(current.length, 21);
  for (const [index, card] of current.entries()) {
    const version = index < 9 ? 108 : 109;
    assert.equal(card.sourceId, 2744 + index);
    assert.equal(card.slot, 1776 + index);
    assert.equal(card.identity_key, sha(['unity-native' + version,card.slot,card.sourceId,card.code].join('\0')));
    const meta = cardMetadata109(card.sourceId, card.identity_key);
    assert.deepEqual(meta, { image: 'assets/native' + version + '/cards/' + card.sourceId + '.jpg', searchAliases: card.searchAliases });
    assert.equal(cardMetadata109(card.sourceId, '0'.repeat(64)), null);
    const image = read('../' + meta.image);
    assert(image.length > 1000 && image[0] === 255 && image[1] === 216);
  }
  assert.deepEqual(JSON.parse(read('../data/native-expansion109.json')).limitOverrides,
    [{ sourceId: maskSource, code: 29549364, normalLimit: 1 }]);
});

test('Web109 accepts live103 and new109 payloads, retaining old user settings and enforcing the single Mask copy', async () => {
  for (const [latest, identity, count, maskLimit] of [[false,GAME_IDENTITY103,1775,3],[true,GAME_IDENTITY109,1796,1]]) {
    const state = baseFixture(latest);
    state.entities.push({ entity_type: 'card_annotation', entity_id: '2702', version: 628, state: 'saved', issues: [],
      content: { tags: ['사용자 기존 분류'], links: [] } });
    state.entities.push({ entity_type: 'card_setting', entity_id: '2659', version: 628, state: 'saved', issues: [],
      content: { stock: false, draw_enabled: false, rarity: 'R' } });
    const raw = wire(state, identity, latest ? 629 : 628);
    const saved = JSON.stringify(raw);
    const normalized = await normalizeBootstrap039(raw, webcrypto);
    const rows = normalizeCatalog039({ bootstrap: normalized });
    assert.equal(rows.length, count);
    assert.equal(new Set(rows.map(card => card.source_id)).size, count);
    assert.deepEqual(rows.find(card => card.source_id === 2702).tags, ['사용자 기존 분류']);
    assert.equal(rows.find(card => card.source_id === 2659).stock, false);
    assert.equal(rows.find(card => card.source_id === 2659).draw_enabled, false);
    const mask = rows.find(card => card.source_id === maskSource);
    assert.equal(mask.code, 29549364);
    assert.equal(mask.deck_limit, maskLimit);
    assert.equal(mask.effective_normal_limit, maskLimit);
    const once = changeDeckCard039({ main: [], extra: [], banlist_enabled: true }, mask, 1, rows);
    if (latest) assert.throws(() => changeDeckCard039(once, mask, 1, rows));
    else assert.doesNotThrow(() => changeDeckCard039(once, mask, 1, rows));
    assert.equal(JSON.stringify(raw), saved);
  }
});

test('Web109 every new card enters shared deck, hand, grave, and matching field choices', () => {
  const state = baseFixture();
  addCharacter(state, []);
  const rows = normalizeCatalog039(state);
  const added = rows.filter(card => card.source_id >= 2744);
  assert.equal(added.length, 21);
  for (const card of added) {
    const pin = current.find(row => row.sourceId === card.source_id);
    assert(traitCardMatches089(card));
    assert(sharedTraitRefMatches089(card, ref(card)));
    assert.equal(traitCardMatches089(card,'shared-start-monster'), Boolean(card.native_type & 1));
    assert.equal(traitCardMatches089(card,'shared-start-spell-trap'), Boolean(card.native_type & 6));
    for (const banlist_enabled of [false,true]) {
      const deck = changeDeckCard039({ main: [], extra: [], banlist_enabled }, card, 1, rows);
      assert.deepEqual(deck.main, [{ source_id: card.source_id, identity_key: card.identity_key, count: 1 }]);
    }
    const skills = [{ kind: 'start_hand', card: ref(card) }, { kind: 'start_grave', entries: [{ card: ref(card), count: 1 }] },
      card.native_type & 1 ? { kind: 'start_monster', card: ref(card), position: 'attack' } : { kind: 'start_field', card: ref(card) }];
    assert.doesNotThrow(() => validateAuthoringChange066(state,'character',charId,{skills}));
    assert.doesNotThrow(() => validateAuthoringChange066(state,'character',charId,{
      skill_profiles: [{ profile_id: 'web109-traits', name: '저장된 특성 묶음', skills }]
    }));
    assert.throws(() => validateAuthoringChange066(state,'character',charId,{
      skills: [{ kind: 'start_hand', card: { ...ref(card), identity_key: '0'.repeat(64) } }]
    }));
    for (const query of pin.searchAliases) assert(cardQueryMatches091(card,query), query);
    assert(cardQueryMatches091(card,card.name_ko));
    assert(cardQueryMatches091(card,card.name_en));
  }
  for (const [key] of CARD_SORTS091) {
    const result = sortCards091(rows,key);
    assert.equal(result.length,1796);
    assert.equal(result.filter(card => card.source_id >= 2744).length,21);
  }
});

test('Web109 the live panel queues matching card references in hand and spell/trap traits', async t => {
  const rows = normalizeCatalog039(baseFixture());
  const first = rows.find(card => card.source_id === 2404);
  for (const target of rows.filter(card => card.source_id >= 2744)) {
    for (const kind of ['start_hand', ...(target.native_type & 6 ? ['start_field'] : [])]) {
      const state = baseFixture();
      const existing = { kind: 'heal_once', value: 900 };
      addCharacter(state, [{ kind, card: ref(first) }, existing]);
      const ui = mount(t,state,'characters',charId);
      pick(ui.root,target);
      await tick();
      assert.deepEqual(ui.errors,[]);
      assert.deepEqual(ui.writes,[['character',charId,{ skills: [{ kind, card: ref(target) }, existing] },{ operation:'patch' }]]);
    }
  }
});

test('Web109 recent card groups retain previous filters and expose both additions', t => {
  const state = baseFixture();
  const rows = normalizeCatalog039(state);
  const index = catalogAdditions049(rows);
  assert.equal(index.latest.key,'Cards109');
  for (const [key,count] of [['Cards103',15],['Cards108',9],['Cards109',12]]) {
    assert.equal(index.groups.find(group => group.key === key).count,count);
    assert.equal(additionThemes067(rows,key,index).reduce((n,row) => n + row.count,0),count);
  }
  const ui = mount(t,state,'cards');
  button041(ui.root,'최근 추가').click();
  const selector = field041(ui.root,'추가 묶음');
  assert.equal(selector.value,'Cards109');
  selector.value='Cards108';
  selector.fire('change');
  assert.match(ui.root.querySelector('.au-card-results-summary').textContent,/9종/);
  ui.panels.render('cards',ui.root,structuredClone(state),{force:true});
  assert.equal(field041(ui.root,'추가 묶음').value,'Cards108');
  assert.deepEqual(ui.errors,[]);
  assert.deepEqual(ui.writes,[]);
});

test('Web109 open103 authoring preserves its queued edits across the update and rejects mixed identities', async t => {
  const old = baseFixture(false), next = baseFixture();
  const deck = old.entities.find(entity => entity.entity_type === 'deck');
  let response = wire(old, GAME_IDENTITY103, 628);
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,String(value)) };
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id: 'web109-pending-editor' } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    rpc: async (name,args) => { assert.equal(name,'poc_bootstrap039'); assert.equal(args.p_view,'authoring'); return { data: structuredClone(response) }; } };
  const store = new AuthoringStore039({ client,storage,crypto:webcrypto,events:{},pollMs:0,debounceMs:100000 });
  t.after(() => store.stop());
  await store.start();
  store.patch('deck',deck.entity_id,{name:'저장 전 이름'});
  const queue = JSON.stringify(store.queue);
  response = wire(next, GAME_IDENTITY109, 629);
  await store.refresh(true);
  assert.equal(store.fetchedRevision,629);
  assert.equal(JSON.stringify(store.queue),queue);
  assert.equal(store.snapshot().entities.find(entity => entity.entity_id === deck.entity_id).content.name,'저장 전 이름');
  response = wire(next, {...GAME_IDENTITY109,native_manifest109_sha256:'0'.repeat(64)},630);
  await assert.rejects(store.refresh(true),/게임 버전이 일치하지 않아/);
  assert.equal(store.fetchedRevision,629);
  assert.equal(JSON.stringify(store.queue),queue);
});
