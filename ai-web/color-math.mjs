// Half-pixel bilinear sampling matches PyTorch align_corners=False, without antialias.
export function modelInput(rgba,w,h){
 const out=new Float32Array(3*256*256);
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){
  const sx=Math.max(0,(x+.5)*w/256-.5),sy=Math.max(0,(y+.5)*h/256-.5),x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),fx=sx-x0,fy=sy-y0;
  for(let c=0;c<3;c++)out[c*65536+y*256+x]=((rgba[(y0*w+x0)*4+c]*(1-fx)+rgba[(y0*w+x1)*4+c]*fx)*(1-fy)+(rgba[(y1*w+x0)*4+c]*(1-fx)+rgba[(y1*w+x1)*4+c]*fx)*fy)/255;
 }return out;
}
export function applyLUT(rgba,lut,vertices,strength){
 const indices=[],fractions=[];
 for(let c=0;c<3;c++){const ids=new Uint8Array(256),fs=new Float32Array(256);for(let i=0;i<256;i++){let u=1;while(u<32&&vertices[c*33+u]<=i/255)u++;ids[i]=u-1;fs[i]=(i/255-vertices[c*33+u-1])/Math.max(1e-8,vertices[c*33+u]-vertices[c*33+u-1])}indices.push(ids);fractions.push(fs)}
 const out=new Uint8ClampedArray(rgba.length);
 for(let p=0;p<rgba.length;p+=4){const r=indices[0][rgba[p]],g=indices[1][rgba[p+1]],b=indices[2][rgba[p+2]],fr=fractions[0][rgba[p]],fg=fractions[1][rgba[p+1]],fb=fractions[2][rgba[p+2]];
  for(let c=0;c<3;c++){let value=0;for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++)value+=lut[c*35937+(b+z)*1089+(g+y)*33+r+x]*(x?fr:1-fr)*(y?fg:1-fg)*(z?fb:1-fb);out[p+c]=Math.round(rgba[p+c]*(1-strength)+255*Math.min(1,Math.max(0,value))*strength)}out[p+3]=rgba[p+3];
 }return out;
}
