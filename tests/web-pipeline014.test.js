import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {legacyEmbedRequested014,mountExpeditionEntry014} from '../roguelite-entry014.js';
import {redirectAuthoring039} from './unified-route-helper039.js';

const text = name => readFile(new URL(`../${name}`, import.meta.url),'utf8');
function fixture() {
  const pane = {hidden:false}, classes = new Set(['web-entry014']);
  const document = {
    getElementById(id) {assert.equal(id,'web-editor014');return pane;},
    body:{classList:{toggle(name,on) {if(on)classes.add(name);else classes.delete(name);}}},
  };
  return {document,pane,classes};
}

test('catalog and old AI deck links expose the unified chapter editor while battle editing remains reachable',async()=>{
  const index=await text('index.html'),shell=await text('authoring039-panels.js');assert.match(index,/id="authoring-root"/);assert.match(shell,/\['chapters','장별 적 편성'\]/);
  const target=redirectAuthoring039('ai-decks.html','?deck=deck-014#chapters');assert.equal(target.pathname,'/catalog/index.html');assert.equal(target.searchParams.get('section'),'chapters');assert.equal(target.searchParams.get('deck'),'deck-014');
  const story=await text('story.html'),linked=/href="(ai-decks|campaign164)\.html"/.exec(story);assert.ok(linked);assert.equal(redirectAuthoring039(linked[1]+'.html','#chapters').searchParams.get('section'),'chapters');
});
test('normal web URLs never load the legacy game or any save handler',async()=>{
  for(const search of ['', '?v=20261017-159','?in_game=0','?in_game=01','?in_game=true','?session_id=old']) {
    const f=fixture();let calls=0;
    assert.equal(await mountExpeditionEntry014({...f,search,loadGame:()=>{calls++;}}),'web-editor');
    assert.equal(f.pane.hidden,false);assert.equal(f.classes.has('web-entry014'),true);assert.equal(calls,0);
  }
});
test('explicit legacy embed URL loads the unchanged game exactly once',async()=>{
  for(const search of ['?in_game=1','?in_game=1&session_id=old&v=20261018-166']) {
    const f=fixture();let calls=0;
    assert.equal(await mountExpeditionEntry014({...f,search,loadGame:()=>{calls++;assert.equal(f.pane.hidden,true);assert.equal(f.classes.has('web-entry014'),false);}}),'legacy-embedded');
    assert.equal(calls,1);
  }
  // Availability and handshake are still checked by embedbridge154, not here.
  assert.equal(legacyEmbedRequested014('?in_game=1'),true);
  assert.match(await text('roguelite-entry014.js'),/import\('\.\/roguelite166\.js\?v=20261018-166'\)/);
});
test('standalone doorway explains the snapshot/import steps and retains all tool links',async()=>{
  const html=await text('roguelite.html'),portal=html.match(/<section id="web-editor014"[\s\S]*?<\/section>/)[0];
  for(const href of ['campaign164.html','ai-decks.html','story.html','expedition-content.html','characters.html'])assert.ok(portal.includes(`href="${href}"`));
  for(const label of ['Unity','온라인','최신 자료로 갱신','새 원정','진행 중인 원정'])assert.ok(portal.includes(label));
  assert.match(html,/src="roguelite-entry014\.js\?v=20261019-014"/);
  assert.match(html,/id="embed152-gate"/);
  assert.match(html,/id="new-run-dialog"/);
  const entry=await text('roguelite-entry014.js');
  assert.doesNotMatch(entry,/localStorage|sessionStorage|fetch\(|createClient|\.rpc\(/);
  assert.equal(redirectAuthoring039('campaign164.html','?deck=deck-014#chapters').searchParams.get('section'),'chapters');
});

