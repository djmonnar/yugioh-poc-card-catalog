import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {portraitUrl081} from '../authoring081-assets.js';
import {validateAuthoringChange066} from '../authoring066-validation.js';
import {fixture041} from './authoring041-test-dom.js';

// (178) 유키 쥬다이·만죠메 준 portraits: the two official Duel Links character images (gx01, gx05), byte for byte.
// The app ships the same images as Character178/<id>_start. The DB character rows that point here are added only
// on a public route that apps with the 178 character layer read (UnityExpeditionWork/Characters178/WEB-DB-PLAN.md).
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const portraits178={
  judai:{path:'assets/actors/native178/judai/start.png',sha256:'a64d110b06c95a17fc0fa565cee023f95cc6893e99b33eb02c63f891baba59a7'},
  manjoume:{path:'assets/actors/native178/manjoume/start.png',sha256:'61239472a261a06ace8aa023c40dcfcddf2a311e341f265bd74be4a79c7119cd'},
};

test('178 portraits are the exact official 550x500 RGBA images',()=>{
  const hashes=new Set();
  for(const [id,{path,sha256}] of Object.entries(portraits178)){
    const image=fs.readFileSync(new URL(`../${path}`,import.meta.url));
    assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a',id);
    assert.equal(image.readUInt32BE(16),550,id);assert.equal(image.readUInt32BE(20),500,id);
    assert.equal(image[24],8,id);assert.equal(image[25],6,id);
    assert.equal(sha(image),sha256,id);hashes.add(sha(image));
  }
  assert.equal(hashes.size,2);
});

test('178 portrait paths pass the character validator and need no alias',()=>{
  const state=fixture041();
  assert(state.bootstrap.capabilities?.entities?.character,'the fixture defines the character entity');
  for(const [id,{path}] of Object.entries(portraits178)){
    assert.equal(portraitUrl081(path),path,id);
    const name=id==='judai'?'유키 쥬다이':'만죠메 준';
    assert.doesNotThrow(()=>validateAuthoringChange066(state,'character',`character-${id}-178`,{name,portrait:path,skills:[],skill_profiles:[]}),id);
    assert.throws(()=>validateAuthoringChange066(state,'character',`character-${id}-178`,{name,portrait:path.replace('.png','.gif'),skills:[],skill_profiles:[]}),id);
  }
});
