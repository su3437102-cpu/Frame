import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeProject,encodeProject,rgbaTiff} from '../ai-web/spektralab/frame-tools.mjs';

test('portable darkroom project retains recipe and exact original bytes',async()=>{
  const original = new Uint8Array([255,216,255,224,42,0,1,255,217]);
  const photo={name:'样片.jpg',blob:new Blob([original],{type:'image/jpeg'})};
  const recipe={film:'kodak_gold_200',appearance:{border:'135',imprint:'2026 11 26',turn:1}};
  const record=await decodeProject(encodeProject(photo,recipe));
  assert.equal(record.name,photo.name);
  assert.equal(record.blob.type,'image/jpeg');
  assert.deepEqual(record.recipe,recipe);
  assert.deepEqual(new Uint8Array(await record.blob.arrayBuffer()),original);
  await assert.rejects(decodeProject(new Blob(['FRAMELAB-SPEKTRA-1\n'])),/无法识别/);
});

test('TIFF export declares and retains uncompressed RGB pixels',async()=>{
  const expected=[9,20,30,255,140,33,160,255];
  const data=new Uint8Array(await rgbaTiff(2,1,expected).arrayBuffer());
  const view=new DataView(data.buffer);
  assert.equal(view.getUint16(0,true),0x4949);
  assert.equal(view.getUint16(2,true),42);
  const ifd=view.getUint32(4,true);
  let offset=0;
  for(let i=0;i<view.getUint16(ifd,true);i++){
    const field=ifd+2+i*12;
    if(view.getUint16(field,true)===273) offset=view.getUint32(field+8,true);
  }
  assert.ok(offset>0);
  assert.deepEqual([...data.slice(offset)],[9,20,30,140,33,160]);
});
