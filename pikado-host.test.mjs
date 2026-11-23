import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const result={
 channel:'framelab-pikado',type:'result',session:'token',
 preview:'data:image/png;base64,AAAA',pkd:'data:application/x-pikado;base64,AAAA',
 sourceLayerId:'layer'
};

function setup(){
 let handler;
 const frame={};
 const source={id:'source',type:'image',src:'input'};
 const c=vm.createContext({
  MutationObserver:class{observe(){}},
  state:{objects:[{id:'ps',type:'image',variant:'ps',src:'old'},source],connections:[{from:source.id,to:'ps',kind:'ps-input'}]},
  window:{addEventListener:(type,fn)=>handler=fn},document:{addEventListener(){}},
  location:{origin:'https://frame.example'},zoneHTML(){},render(){},openObject(){},checkpoint(){},update(){},clearTimeout,frame
 });
 for(const file of ['workbench-graph.js','pikado-host.js']){
  vm.runInContext(readFileSync(new URL(file,import.meta.url),'utf8'),c);
 }
 const session=vm.runInContext(`pikaSession={
  id:'ps',token:'token',src:'input',inputId:'source',frame:{contentWindow:frame},
  status:{},button:{},cancel:{hidden:true,focus(){}}
 }`,c);
 return {c,source,frame,handler,session};
}

test('bridge rejects wrong source, origin and session',()=>{
 const {c,frame,handler}=setup();
 handler({source:{},origin:'https://frame.example',data:result});
 handler({source:frame,origin:'https://evil.example',data:result});
 handler({source:frame,origin:'https://frame.example',data:{...result,session:'wrong'}});
 assert.equal(c.state.objects[0].src,'old');
});

test('valid result updates preview and saves editable project',()=>{
 const {c,frame,handler}=setup();
 handler({source:frame,origin:'https://frame.example',data:result});
 assert.equal(c.state.objects[0].src,result.preview);
 assert.equal(c.state.pikadoProjects.ps.sourceLayerId,'layer');
 assert.equal(c.state.pikadoProjects.ps.inputSrc,'input');
});

test('a stale input rejects both the editor result and flush acknowledgement',()=>{
 const {c,source,frame,handler,session}=setup();
 source.src='updated-input';
 session.closing=true;
 handler({source:frame,origin:'https://frame.example',data:result});
 handler({source:frame,origin:'https://frame.example',data:{...result,type:'flushed'}});
 assert.equal(c.state.objects[0].src,'old');
 assert.equal(c.state.pikadoProjects,undefined);
 assert.equal(session.button.disabled,true);
 assert.equal(session.cancel.hidden,false);
 assert.equal(session.closing,false);
 assert.match(session.status.textContent,/重新打开 PS/);
});
