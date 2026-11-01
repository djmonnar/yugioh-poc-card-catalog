import test from 'node:test';
import assert from 'node:assert/strict';
import {GAME_IDENTITY067,gameIdentityMatches067} from '../authoring067-identity.js';
const layer=count=>Object.fromEntries(Object.entries(GAME_IDENTITY067).slice(0,count));
test('the 067 web reader accepts each complete pinned earlier and current identity layer',()=>{
  for(const count of [3,5,7,9])assert.equal(gameIdentityMatches067(layer(count)),true);
});
test('partial, foreign and unknown identity layers are rejected before publication use',()=>{
  for(const count of [0,1,2,4,6,8])assert.equal(gameIdentityMatches067(layer(count)),false);
  for(const [key] of Object.entries(GAME_IDENTITY067))assert.equal(gameIdentityMatches067({...GAME_IDENTITY067,[key]:'0'.repeat(64)}),false);
  assert.equal(gameIdentityMatches067({...GAME_IDENTITY067,unknown_catalog_sha256:'0'.repeat(64)}),false);
  assert.equal(gameIdentityMatches067(null),false);assert.equal(gameIdentityMatches067([]),false);
});
