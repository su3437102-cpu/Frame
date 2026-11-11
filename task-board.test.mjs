import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
const code=readFileSync(new URL('./task-board.js',import.meta.url),'utf8');
const models=code.slice(code.indexOf('function taskRows'),code.indexOf('function taskRowHTML'));
test('legacy task migration preserves text, completion and identity after insertion',()=>{
 const api=runInNewContext(models+';({taskRows,syncTaskFields})',{crypto:webcrypto});
 const o={text:'first\nsecond',done:[1]};const rows=api.taskRows(o),secondId=rows[1].id;
 rows.unshift({id:'new',text:'new',done:false});api.syncTaskFields(o);
 assert.equal(o.text,'new\nfirst\nsecond');assert.equal(o.done[0],2);assert.equal(api.taskRows(o)[2].id,secondId);
 assert.equal(JSON.parse(JSON.stringify(o)).taskItems[2].done,true);
});
test('board scope isolates root and child objects without removing snapshot data',()=>{
 const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');const fn=app.split('\n').find(line=>line.startsWith('function visibleObjects'));
 const state={objects:[{id:'root'},{id:'a',parentBoardId:'board-a'},{id:'b',parentBoardId:'board-b'}]};
 const visible=runInNewContext(fn+';visibleObjects',{state});assert.equal(visible()[0].id,'root');
 state.activeBoardId='board-a';assert.equal(visible().length,1);assert.equal(visible()[0].id,'a');assert.equal(state.objects.length,3);
});
test('board breadcrumbs terminate safely for malformed cyclic imported parents',()=>{
 const fn=code.slice(code.indexOf('function boardPath'),code.indexOf('function renderBoardNav'));
 const path=runInNewContext(fn+';boardPath',{state:{objects:[{id:'a',type:'board',parentBoardId:'b'},{id:'b',type:'board',parentBoardId:'a'}]}});
 assert.equal(path('a').length,2);assert.equal(path('missing').length,0);
});
