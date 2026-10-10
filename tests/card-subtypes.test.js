import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {SPELL_TRAP_SUBTYPES,subtypeMatches} from '../card-subtypes.js';
const cards=JSON.parse(readFileSync(new URL('../data/cards.json',import.meta.url))).cards;
test('every requested spell/trap subtype maps to published cards',()=>{
 for(const [type,types] of Object.entries(SPELL_TRAP_SUBTYPES))for(const subtype of types){const value=`${type}:${subtype}`,found=cards.filter(c=>subtypeMatches(c,value));assert.ok(found.length, value);assert.ok(found.every(c=>c.type===type&&c.subtype===subtype));}
});
test('continuous spell and trap filters stay separate and all includes monsters',()=>{
 assert.equal(subtypeMatches({type:'함정',subtype:'지속'},'마법:지속'),false);
 assert.equal(subtypeMatches({type:'마법',subtype:'일반'},'함정:일반'),false);
 assert.equal(subtypeMatches({type:'효과 몬스터',subtype:''},''),true);
 assert.equal(subtypeMatches({type:'효과 몬스터',subtype:''},'마법:의식'),false);
});
