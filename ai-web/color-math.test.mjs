import {test} from 'node:test';
import assert from 'node:assert/strict';
import {modelInput,applyLUT} from './color-math.mjs';
test('adaptive nonuniform identity LUT preserves colors and alpha at boundaries',()=>{
 const vertices=new Float32Array(99),lut=new Float32Array(3*35937);
 for(let c=0;c<3;c++)for(let i=0;i<33;i++)vertices[c*33+i]=(i/32)**[.7,1.2,1.8][c];
 for(let b=0;b<33;b++)for(let g=0;g<33;g++)for(let r=0;r<33;r++){const i=b*1089+g*33+r;lut[i]=vertices[r];lut[35937+i]=vertices[33+g];lut[71874+i]=vertices[66+b]}
 const rgba=Uint8ClampedArray.from({length:4096},(_,i)=>(i*73)%256);
 assert.deepEqual(applyLUT(rgba,lut,vertices,1),rgba);
 assert.deepEqual(applyLUT(rgba,new Float32Array(lut.length),vertices,0),rgba);
});
test('half-pixel resize keeps constant RGB in channel-first format',()=>{
 const rgba=new Uint8ClampedArray([32,64,128,255,32,64,128,255]);const x=modelInput(rgba,2,1);
 for(let c=0;c<3;c++)for(const value of x.subarray(c*65536,(c+1)*65536))assert.ok(Math.abs(value-[32,64,128][c]/255)<1e-7);
});
