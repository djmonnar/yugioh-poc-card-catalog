import test from 'node:test';
import assert from 'node:assert/strict';
import {DUEL_READY209, traitKindOffered209} from '../authoring209-traits.js';
import {traitLabel203, traitValues203} from '../authoring203-trait-summary.js';
import {createAuthoringPanels039} from '../authoring039-panels.js';
import {validateAuthoringChange066} from '../authoring066-validation.js';
import {Document041, fixture041, field041, button041} from './authoring041-test-dom.js';

test('Duel Ready has fixed options and respects the server capability', () => {
  assert.deepEqual(DUEL_READY209.fields, {});
  assert.equal(traitLabel203(DUEL_READY209, []), '듀얼 준비 완료');
  assert.deepEqual(traitValues203({kind: DUEL_READY209.kind}, {definitions: [DUEL_READY209]}), []);
  assert(traitKindOffered209(DUEL_READY209, false));
  assert(traitKindOffered209(DUEL_READY209, true, true));
  assert(!traitKindOffered209({...DUEL_READY209, starter: false}, true, true));
  assert(!traitKindOffered209({...DUEL_READY209, compiled: false}, false));
});

for (const section of ['decks', 'starters']) {
  test(`Duel Ready is shown and saved without fields in ${section}`, async t => {
    const state = fixture041();
    const capabilities = state.bootstrap.capabilities;
    capabilities.trait_form.kinds.push(DUEL_READY209);
    capabilities.starter_loadout = {lp_max: 1000000, gold_max: 1000000, relics_max: 70};
    const type = section === 'decks' ? 'deck' : 'starter_list';
    const entity = state.entities.find(row => row.entity_type === type);
    const doc = new Document041(), root = doc.createElement('main'), writes = [], errors = [];
    doc.body.append(root);
    const panels = createAuthoringPanels039({document: doc, onChange: (...args) => writes.push(structuredClone(args)),
      onError: error => errors.push(error)});
    t.after(() => panels.destroy());
    panels.selectEntity065(section, entity.entity_id);
    if (section === 'decks') {
      entity.content.skills = [];
      panels.selectDeck(entity.entity_id);
    }
    const render = () => {
      panels.render(section, root, state);
      if (section === 'decks') return root;
      const config = root.querySelector('.au-starter-loadout');
      config.open = true;
      config.fire('toggle', {bubbles: false});
      return config;
    };
    const form = render(), select = field041(form, '추가할 특성');
    assert(select.options.some(option => option.value === DUEL_READY209.kind));
    select.value = DUEL_READY209.kind;
    select.fire('change');
    button041(form, '특성 추가').click();
    await new Promise(resolve => setImmediate(resolve));
    const [writtenType, id, fields] = writes.at(-1);
    assert.equal(writtenType, type);
    if (section === 'decks') {
      assert.deepEqual(fields.skills, [{kind: DUEL_READY209.kind, value: 0, threshold: 0, sourceId: -1, position: 0, entries: []}]);
    } else {
      assert.deepEqual(fields.entries[0].start_loadout.traits, [{kind: DUEL_READY209.kind}]);
    }
    assert.doesNotThrow(() => validateAuthoringChange066(state, type, id, fields));
    Object.assign(entity.content, fields);
    const row = render().querySelectorAll('.au-trait-row203').find(item => item.textContent.includes(DUEL_READY209.label));
    assert(row);
    assert(row.textContent.includes(DUEL_READY209.help));
    assert.equal(row.querySelectorAll('input').length, 0);
    assert(!field041(section === 'decks' ? root : root.querySelector('.au-starter-loadout'), '추가할 특성')
      .options.some(option => option.value === DUEL_READY209.kind));
    assert.deepEqual(errors, []);
  });
}
