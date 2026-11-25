import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {portraitUrl081} from '../authoring081-assets.js';
import {validateAuthoringChange066} from '../authoring066-validation.js';
import {fixture041} from './authoring041-test-dom.js';

// (203) 미사와 다이치 portrait: the official Duel Links image (gx10) byte for byte
// (UnityExpeditionWork/Characters203/stage-characters203.py). The app ships the same image as Character203/misawa_start.
// The DB character row that points here is added only on a public route that apps with the 203 character layer read
// (UnityExpeditionWork/Characters203/PLAN.md).
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const portraits203={
  misawa:{path:'assets/actors/native203/misawa/start.png',sha256:'25039a19501848bf6b2250e882f109bd46fce8f27426bdd90c38b5f9479d743e',name:'미사와 다이치'},
};

test('203 portrait is the reviewed 550x500 RGBA image',()=>{
  for(const [id,{path,sha256}] of Object.entries(portraits203)){
    const image=fs.readFileSync(new URL(`../${path}`,import.meta.url));
    assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a',id);
    assert.equal(image.readUInt32BE(16),550,id);assert.equal(image.readUInt32BE(20),500,id);
    assert.equal(image[24],8,id);assert.equal(image[25],6,id);
    assert.equal(sha(image),sha256,id);
  }
});

test('203 portrait path passes the character validator and needs no alias',()=>{
  const state=fixture041();
  assert(state.bootstrap.capabilities?.entities?.character,'the fixture defines the character entity');
  for(const [id,{path,name}] of Object.entries(portraits203)){
    assert.equal(portraitUrl081(path),path,id);
    assert.doesNotThrow(()=>validateAuthoringChange066(state,'character',`character-${id}-203`,{name,portrait:path,skills:[],skill_profiles:[]}),id);
    assert.throws(()=>validateAuthoringChange066(state,'character',`character-${id}-203`,{name,portrait:path.replace('.png','.gif'),skills:[],skill_profiles:[]}),id);
  }
});
