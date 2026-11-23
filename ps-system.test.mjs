import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

function setup(){
 const c=vm.createContext({
  crypto:{randomUUID},
  state:{
   objects:[{id:'a',type:'image',src:'assets/photo-0.jpg'},{id:'b',type:'image',src:'assets/photo-1.jpg'}],
   trash:[],connections:[]
  },
  selected:new Set(),checkpoint(){},update(){vm.runInContext('render()',c)},
  render(){},objectHTML(){},actions:{delete(){}},toast(){}
 });
 for(const file of ['workbench-graph.js','ps-system.js']){
  vm.runInContext(readFileSync(new URL(file,import.meta.url),'utf8'),c);
 }
 return c;
}

function connect(c,from,to){
 c.state.connections=c.state.connections.filter(edge=>edge.to!==to);
 c.state.connections.push({from,to,kind:'ps-input'});
 c.update();
}

test('drop without selection makes empty module and no automatic connection',()=>{
 const c=setup();
 vm.runInContext('createPSNode({x:42,y:51})',c);
 assert.equal(c.state.objects[2].src,'');
 assert.equal(c.state.objects[2].x,42);
 assert.equal(c.state.connections.length,0);
});

test('connected photos are shown and replacing a connection changes the preview',()=>{
 const c=setup();
 const node=vm.runInContext('createPSNode();state.objects[2]',c);
 connect(c,'a',node.id);
 assert.equal(node.src,'assets/photo-0.jpg');
 connect(c,'b',node.id);
 assert.equal(node.src,'assets/photo-1.jpg');
 assert.equal(c.state.connections.length,1);
});

test('source replacement propagates and unlink clears preview',()=>{
 const c=setup();
 const node=vm.runInContext('createPSNode();state.objects[2]',c);
 connect(c,'a',node.id);
 c.state.objects[0].src='assets/photo-3.jpg';
 c.update();
 assert.equal(node.src,'assets/photo-3.jpg');
 c.state.connections=[];
 c.update();
 assert.equal(node.src,'');
});

test('a PS chain sends its current authored preview and waits for work after a source change',()=>{
 const c=setup();
 vm.runInContext('createPSNode();createPSNode()',c);
 const [first,second]=c.state.objects.slice(2);
 connect(c,'a',first.id);
 connect(c,first.id,second.id);
 assert.equal(first.src,'assets/photo-0.jpg');
 assert.equal(second.src,'');
 const project={
  pkd:'data:application/x-pikado;base64,AAAA',
  preview:'data:image/png;base64,AAAA',
  inputSrc:'assets/photo-0.jpg'
 };
 c.state.pikadoProjects={[first.id]:project};
 c.update();
 assert.equal(second.src,project.preview);
 connect(c,'b',first.id);
 assert.equal(first.src,'assets/photo-1.jpg');
 assert.equal(second.src,'');
 assert.equal(c.state.pikadoProjects[first.id],project);
});

test('deleting connected PS removes node without generating a photo and preserves originals',()=>{
 const c=setup();
 const node=vm.runInContext('createPSNode();state.objects[2]',c);
 connect(c,'a',node.id);
 c.actions.delete();
 assert.equal(c.state.objects.length,2);
 assert.equal(c.state.objects[0].src,'assets/photo-0.jpg');
 assert.equal(c.state.connections.length,0);
 assert.equal(c.state.trash.length,1);
 assert.equal(c.state.trash[0].variant,'ps');
 assert.equal(c.selected.size,0);
});

test('deleting intermediate PS removes both edges and clears downstream preview',()=>{
 const c=setup();
 vm.runInContext('createPSNode();createPSNode()',c);
 const [first,second]=c.state.objects.slice(2);
 connect(c,'a',first.id);
 connect(c,first.id,second.id);
 c.selected=new Set([first.id]);
 c.actions.delete();
 assert.equal(c.state.objects.length,3);
 assert.equal(c.state.objects[2].variant,'ps');
 assert.equal(c.state.objects[2].src,'');
 assert.equal(c.state.connections.length,0);
});

test('empty PS can be removed directly',()=>{
 const c=setup();
 vm.runInContext('createPSNode();actions.delete()',c);
 assert.equal(c.state.objects.length,2);
 assert.equal(c.state.trash[0].variant,'ps');
});
