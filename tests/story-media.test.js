import test from 'node:test';import assert from 'node:assert/strict';
import {defaultPresentation,parsePresentation,safeMedia,validateAudioFile} from '../story-media.js';
import {emptyStory,newActor,parseStory} from '../story-core.js';

test('existing extra-character portraits default to cutins and Trilogy stays native',()=>{
 for(const name of ['사마준','메이 쿠자쿠','해골수스'])assert.equal(defaultPresentation({name,portrait:'assets/portrait.png'}).enabled,true);
 for(const name of ['어둠의 유희','카이바','Joey Wheeler'])assert.equal(defaultPresentation({name,portrait:'assets/portrait.png'}).enabled,false);
 assert.equal(defaultPresentation({name:'바쿠라',portrait:''}).enabled,false);
});
test('character media roundtrips without changing existing identity, skills or stories',()=>{
 const doc=emptyStory(),a=newActor('a');a.name='사마준';a.presentation={enabled:true,portrait:true,events:{start:{image:'assets/weevil.png',audio:'assets/weevil.wav'}}};doc.actors.push(a);
 assert.deepEqual(parseStory(doc),doc);assert.deepEqual(parseStory({...doc,actors:[newActor('old')]}).actors[0],newActor('old'));
 const b=parseStory(doc);b.actors[0].presentation.events.start.image='';assert.equal(a.presentation.events.start.image,'assets/weevil.png');
});
test('unknown events, malformed booleans, traversal and foreign origins are rejected',()=>{
 for(const v of [{enabled:1,portrait:true,events:{}},{enabled:true,portrait:true,events:{bad:{image:'',audio:''}}},{enabled:true,portrait:true,events:{start:{image:'assets/../bad.png',audio:''}}}])assert.throws(()=>parsePresentation(v));
 assert.equal(safeMedia('https://other.invalid/test.wav','audio'),false);assert.equal(safeMedia('assets/test.mp3','audio'),false);assert.equal(safeMedia('assets/test.wav','audio'),true);
});
test('audio uploader validates native PCM format and duration before sending',async()=>{
 const buffer=new ArrayBuffer(48),v=new DataView(buffer),text=(p,s)=>[...s].forEach((c,i)=>v.setUint8(p+i,c.charCodeAt(0)));
 text(0,'RIFF');v.setUint32(4,40,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,22050,true);v.setUint32(28,44100,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,4,true);
 const f={size:48,arrayBuffer:async()=>buffer};await validateAudioFile(f);v.setUint16(20,3,true);await assert.rejects(()=>validateAudioFile(f));
 await assert.rejects(()=>validateAudioFile({size:48,arrayBuffer:async()=>new ArrayBuffer(48)}));
});
