import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const app=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const context=readFileSync(new URL('./context-ui.js',import.meta.url),'utf8');

test('nested editable content does not delete, move or pan desktop objects',()=>{
 let handler;
 const line=app.split('\n').find(l=>l.startsWith("document.addEventListener('keydown'"));
 runInNewContext(line,{document:{addEventListener:(_,fn)=>handler=fn},dialog:{open:false}});
 for(const key of ['Delete','Backspace','ArrowLeft',' ']){
  // No desktop globals are provided: attempting any canvas action fails the test.
  handler({key,code:key===' '?'Space':key,target:{closest:()=>({isContentEditable:true})}});
 }
});

function shortcutHarness(){
 let handler;
 const start=context.indexOf("document.addEventListener('keydown',e=>{\n");
 const end=context.indexOf('\nfunction formatText',start);
 const scope={document:{addEventListener:(_,fn)=>handler=fn},dialog:{open:false},contextPopover:{hidden:true},inlineEdit:null,selected:new Set(),edgeSelected:'edge',visibleObjects:()=>[{id:'child-1'},{id:'child-2'}],state:{activeBoardId:'child-board',objects:[{id:'child-board',parentBoardId:'parent-board'}]},selectionUI:()=>{},renderConnections:()=>{},enterBoard:id=>scope.destination=id};
 runInNewContext(context.slice(start,end),scope);
 return {scope,press(key){let prevented=false;handler({key,ctrlKey:true,target:{closest:()=>null},preventDefault(){prevented=true},stopImmediatePropagation(){}});return prevented}};
}
test('select all is limited to visible board and clears edge selection',()=>{
 const h=shortcutHarness();assert.equal(h.press('a'),true);
 assert.deepEqual([...h.scope.selected],['child-1','child-2']);assert.equal(h.scope.edgeSelected,null);
});
test('parent shortcut navigates one level, and is safe on root',()=>{
 const h=shortcutHarness();assert.equal(h.press('u'),true);assert.equal(h.scope.destination,'parent-board');
 h.scope.state.activeBoardId=null;h.scope.destination=null;h.press('u');assert.equal(h.scope.destination,null);
});
test('interrupting a bend saves it and clears connection cursor',()=>{
 const code=readFileSync(new URL('./interactions.js',import.meta.url),'utf8');
 let saved=0,rendered=0,removed='';const scope={connecting:{bend:'edge'},save:()=>saved++,renderConnections:()=>rendered++,desk:{classList:{remove:c=>removed=c}}};
 runInNewContext(code.split('\n').find(l=>l.startsWith('function cancelConnection'))+';cancelConnection()',scope);
 assert.equal(saved,1);assert.equal(scope.connecting,null);assert.equal(removed,'connecting');assert.equal(rendered,1);
});
