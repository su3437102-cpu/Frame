import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const bootstrap=source.slice(0,source.indexOf('const $='));
test('LAN HTTP can create canvas objects without native randomUUID',()=>{
 const context=vm.createContext({crypto:{getRandomValues:a=>webcrypto.getRandomValues(a)}});
 vm.runInContext(bootstrap,context);
 const ids=vm.runInContext('Array.from({length:1000},()=>crypto.randomUUID())',context);
 assert.equal(new Set(ids).size,1000);
 for(const id of ids)assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
 vm.runInContext(`let state={camera:{x:0,y:0,z:1},objects:[]},selected;
 const checkpoint=()=>{},update=()=>{},desk={clientWidth:1000,clientHeight:800},world={querySelector:()=>({classList:{add(){}}})};
 ${source.split('\n').find(line=>line.startsWith('function add('))}
 for(const type of ['note','todo','board','column','image'])add(type,{x:200,y:300});`,context);
 assert.equal(vm.runInContext('state.objects.length',context),5);
 assert.equal(vm.runInContext('state.objects.every(o=>o.x===200&&o.y===300)',context),true);
});
test('HTTPS native UUID implementation is preserved',()=>{
 const native=()=> 'native';const context=vm.createContext({crypto:{randomUUID:native}});
 vm.runInContext(bootstrap,context);assert.equal(context.crypto.randomUUID,native);
});
