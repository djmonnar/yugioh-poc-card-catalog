import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {portraitUrl081} from '../authoring081-assets.js';
import {validateAuthoringChange066} from '../authoring066-validation.js';
import {fixture041} from './authoring041-test-dom.js';

// (197) 판도라·빛과 어둠의 가면·어둠의 플레이어 킬러·텐죠인 아스카 portraits. Three are the official Duel Links images
// (dm22, dm31, gx06) byte for byte; the Legacy of the Duelist PaniK art is area-scaled into the same 550x500 frame
// (UnityExpeditionWork/Characters197/stage-characters197.py). The app ships the same images as Character197/<id>_start.
// The DB character rows that point here are added only on a public route that apps with the 197 character layer read
// (UnityExpeditionWork/Characters197/WEB-DB-PLAN.md).
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const portraits197={
  pandora:{path:'assets/actors/native197/pandora/start.png',sha256:'a2bfe672a71c29fb50fe84ee9768bd3297b6bf1121e4615198b694808d433eb2',name:'판도라'},
  masks_light_darkness:{path:'assets/actors/native197/masks_light_darkness/start.png',sha256:'b9a4589bc70c94a916627b0b941602f1964d9e56285b3cd6400eb668d55261c8',name:'빛과 어둠의 가면'},
  player_killer:{path:'assets/actors/native197/player_killer/start.png',sha256:'eb2e2742a65b286739fd4a8f40cd4dd26c544df69e638a6e72f5bd1156b80c40',name:'어둠의 플레이어 킬러'},
  asuka:{path:'assets/actors/native197/asuka/start.png',sha256:'c501f863182e814a865389819f2b2baa6eb1d6df292445902c77778a44a95214',name:'텐죠인 아스카'},
};

test('197 portraits are the reviewed 550x500 RGBA images',()=>{
  const hashes=new Set();
  for(const [id,{path,sha256}] of Object.entries(portraits197)){
    const image=fs.readFileSync(new URL(`../${path}`,import.meta.url));
    assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a',id);
    assert.equal(image.readUInt32BE(16),550,id);assert.equal(image.readUInt32BE(20),500,id);
    assert.equal(image[24],8,id);assert.equal(image[25],6,id);
    assert.equal(sha(image),sha256,id);hashes.add(sha(image));
  }
  assert.equal(hashes.size,4);
});

test('197 portrait paths pass the character validator and need no alias',()=>{
  const state=fixture041();
  assert(state.bootstrap.capabilities?.entities?.character,'the fixture defines the character entity');
  for(const [id,{path,name}] of Object.entries(portraits197)){
    assert.equal(portraitUrl081(path),path,id);
    assert.doesNotThrow(()=>validateAuthoringChange066(state,'character',`character-${id}-197`,{name,portrait:path,skills:[],skill_profiles:[]}),id);
    assert.throws(()=>validateAuthoringChange066(state,'character',`character-${id}-197`,{name,portrait:path.replace('.png','.gif'),skills:[],skill_profiles:[]}),id);
  }
});
