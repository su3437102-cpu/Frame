import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
function setup(){
 const c=vm.createContext({crypto:{randomUUID},structuredClone,Image:class{},document:{addEventListener(){}},window:{dispatchEvent(){}},CustomEvent:class{},state:{objects:[{id:'a',type:'image',src:'assets/photo-0.jpg',name:'A',x:0,y:0,w:300,h:200},{id:'b',type:'image',src:'assets/photo-1.jpg',name:'B',x:0,y:0,w:300,h:200}],trash:[]},selected:new Set(['a','b']),checkpoint(){},update(){},save(){},render(){},objectHTML(){},openObject(){},actions:{delete(){}},toast(){}});
 vm.runInContext(readFileSync(new URL('./ps-system.js',import.meta.url),'utf8'),c);return c;
}
test('multi-input creates one result node and independent layers',()=>{const c=setup();vm.runInContext('createPSNode({x:50,y:60})',c);assert.equal(c.state.objects.length,3);assert.equal(c.state.connections.length,2);const p=Object.values(c.state.psProjects)[0];assert.equal(p.layers.length,2);assert.notEqual(p.layers[0].id,p.layers[1].id);});
test('deletion freezes node, retains inputs and project, detaches sources',()=>{const c=setup();vm.runInContext('createPSNode();actions.delete()',c);assert.equal(c.state.objects.length,3);assert.equal(c.state.objects[2].variant,undefined);assert.equal(c.state.objects[2].frozen,true);assert.equal(c.state.connections.length,0);assert.ok(Object.values(c.state.psProjects)[0].layers.every(l=>l.sourceId===null));});
test('upstream changes preserve downstream document, masks and transform',()=>{const c=setup();vm.runInContext(`createPSNode();var p=Object.values(state.psProjects)[0];p.editorDocument={layers:true};p.layers[0].mask={id:'mask'};p.layers[0].transform.x=12;state.objects[0].src='assets/photo-2.jpg';update();`,c);const p=Object.values(c.state.psProjects)[0];assert.equal(p.layers[0].src,'assets/photo-2.jpg');assert.equal(p.layers[0].mask.id,'mask');assert.equal(p.layers[0].transform.x,12);assert.equal(p.needsEditorRender,true);assert.equal(p.editorDocument.layers,true);});
test('editor commit updates result in place and clears pending render',()=>{const c=setup();vm.runInContext(`createPSNode();var p=Object.values(state.psProjects)[0];p.needsEditorRender=true;window.FrameLabPS.commit(p.id,{preview:'data:image/png;base64,AAAA',document:{layers:[]}})`,c);assert.equal(c.state.objects.length,3);assert.equal(c.state.objects[2].src,'data:image/png;base64,AAAA');assert.equal(Object.values(c.state.psProjects)[0].needsEditorRender,false);});
