import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {conditionError, statConditionsMatch, statConditionSummary} from '../card-filters.js';

test('attack range includes both endpoints and excludes non-monster or unknown values', () => {
  const range = [{field: 'atk', min: '1900', max: '2000'}];
  for (const atk of [1900, 1950, 2000]) assert.equal(statConditionsMatch({atk}, range), true);
  for (const atk of [null, undefined, -1, 1899, 2001]) assert.equal(statConditionsMatch({atk}, range), false);
});

test('zero and one-sided defense bounds remain usable', () => {
  assert.equal(statConditionsMatch({def: 0}, [{field: 'def', min: '', max: '0'}]), true);
  assert.equal(statConditionsMatch({def: null}, [{field: 'def', min: '', max: '0'}]), false);
  assert.equal(statConditionsMatch({def: 1200}, [{field: 'def', min: '1200', max: ''}]), true);
  assert.equal(statConditionsMatch({def: 1100}, [{field: 'def', min: '1200', max: ''}]), false);
  assert.equal(statConditionsMatch({def: null}, [{field: 'def', min: '', max: ''}]), true);
});

test('selected stars are alternatives while different conditions intersect', () => {
  const conditions = [{field: 'level', levels: [4, 6]}, {field: 'atk', min: '1900', max: '2000'}, {field: 'def', min: '', max: '1500'}];
  for (const level of [4, 6]) assert.equal(statConditionsMatch({level, atk: 2000, def: 1500}, conditions), true);
  for (const card of [{level: 5, atk: 2000, def: 1500}, {level: 4, atk: 1800, def: 1500}, {level: 6, atk: 2000, def: 1600}, {level: null, atk: 2000, def: 1500}]) assert.equal(statConditionsMatch(card, conditions), false);
  assert.equal(statConditionsMatch({level: null}, [{field: 'level', levels: []}]), true);
  assert.equal(statConditionsMatch({level: null}, []), true);
});

test('invalid or reversed ranges explain the error and cannot silently broaden results', () => {
  for (const condition of [{field: 'atk', min: '2000', max: '1900'}, {field: 'def', min: '-1', max: ''}, {field: 'atk', min: '1.5', max: ''}, {field: 'atk', min: 'invalid', max: ''}]) {
    assert.ok(conditionError(condition));
    assert.equal(statConditionsMatch({atk: 1950, def: 1000}, [condition]), false);
  }
});

test('active summaries describe exact ranges and all selected stars', () => {
  assert.equal(statConditionSummary({field: 'atk', min: '1900', max: '2000'}), '공격력 1900~2000');
  assert.equal(statConditionSummary({field: 'def', min: '', max: '0'}), '수비력 0 이하');
  assert.equal(statConditionSummary({field: 'level', levels: [6, 4]}), '레벨 4·6');
});

test('the published pool provides actual cards matching the requested combined filter', () => {
  const cards = JSON.parse(readFileSync(new URL('../data/cards.json', import.meta.url), 'utf8')).cards;
  const results = cards.filter(card => statConditionsMatch(card, [{field: 'atk', min: '1900', max: '2000'}, {field: 'level', levels: [4]}]));
  assert.ok(results.length > 5);
  assert.ok(results.some(card => card.name_ko === '메가로스매셔X'));
  assert.ok(results.every(card => card.level === 4 && card.atk >= 1900 && card.atk <= 2000));
});
