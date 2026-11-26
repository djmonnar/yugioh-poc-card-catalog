import test from 'node:test';
import assert from 'node:assert/strict';
import {DESTRUCTION_DEFAULT211, DESTRUCTION_REWARD211, destructionRewardValid211} from '../authoring211-traits.js';
import {traitValues203} from '../authoring203-trait-summary.js';
import {createAuthoringPanels039} from '../authoring039-panels.js';
import {validateAuthoringChange066} from '../authoring066-validation.js';
import {Document041, fixture041, field041, button041} from './authoring041-test-dom.js';

test('destruction reward accepts all four causes with reward-specific ranges', () => {
  for (const cause of ['battle', 'monster_effect', 'spell', 'trap']) {
    assert(destructionRewardValid211({...DESTRUCTION_DEFAULT211, cause}));
    assert(destructionRewardValid211({cause, frequency: 'duel', reward: 'draw', amount: 3}));
  }
  for (const option of [{cause: 'effect'}, {frequency: 'phase'}, {amount: 99}, {amount: 8001},
    {reward: 'draw', amount: 4}, {reward: 'draw', amount: 0}, {amount: '500'}, {extra: 1}]) {
    assert(!destructionRewardValid211({...DESTRUCTION_DEFAULT211, ...option}));
  }
  assert.deepEqual(traitValues203({kind: DESTRUCTION_REWARD211.kind, destructionReward: DESTRUCTION_DEFAULT211}),
    ['턴당 1번', '전투로 파괴 시', 'LP 500 회복']);
});

for (const [section, type] of [['decks', 'deck'], ['starters', 'starter_list']]) {
  test(`destruction reward settings round-trip in ${section}`, async t => {
    const state = fixture041();
    state.bootstrap.capabilities.trait_form.kinds.push(DESTRUCTION_REWARD211);
    state.bootstrap.capabilities.starter_loadout = {lp_max: 1000000, gold_max: 1000000, relics_max: 70};
    const entity = state.entities.find(row => row.entity_type === type);
    const doc = new Document041(), root = doc.createElement('main'), writes = [], errors = [];
    doc.body.append(root);
    const panels = createAuthoringPanels039({document: doc,
      onChange: (writtenType, id, fields) => {
        assert.equal(writtenType, type);
        assert.equal(id, entity.entity_id);
        validateAuthoringChange066(state, type, id, fields);
        writes.push(fields);
        Object.assign(entity.content, structuredClone(fields));
      }, onError: error => errors.push(error)});
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
    const form = render();
    field041(form, '추가할 특성').value = DESTRUCTION_REWARD211.kind;
    button041(form, '특성 추가').click();
    const settle = () => new Promise(resolve => setImmediate(resolve));
    await settle();
    const skill = () => section === 'decks' ? entity.content.skills[0] : entity.content.entries[0].start_loadout.traits[0];
    assert.deepEqual(skill().destructionReward, DESTRUCTION_DEFAULT211);
    for (const [label, value] of [['파괴 원인','trap'], ['발동 횟수','duel'], ['보상','draw'], ['드로우할 매수','3']]) {
      const control = field041(render(), label);
      control.value = value;
      control.fire(label === '드로우할 매수' ? 'input' : 'change');
      await settle();
    }
    assert.deepEqual(skill().destructionReward, {cause:'trap', frequency:'duel', reward:'draw', amount:3});
    assert(render().textContent.includes('전투당 1번 · 함정으로 파괴 시 · 3장 드로우'));
    assert.equal(writes.length, 5);
    assert.deepEqual(errors, []);
  });
}
