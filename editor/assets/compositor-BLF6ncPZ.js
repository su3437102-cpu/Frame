import{n as e}from"./layer-noKPnXYg.js";import{C as t,S as n,i as r,r as i,s as a,w as o}from"./styles-BLvpZkyp.js";import{i as s,o as c}from"./util-BJwCO6BT.js";var l={"linear-burn":1,"vivid-light":2,"linear-light":3,"pin-light":4,"hard-mix":5,subtract:6,divide:7,"darker-color":8,"lighter-color":9,dissolve:10},u=`#version 300 es
in vec2 aPos;
out vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`,d=`#version 300 es
precision highp float;

uniform sampler2D uBase;
uniform sampler2D uSrc;
uniform int uMode;
uniform float uOpacity;
uniform float uSeed;

in vec2 vUV;
out vec4 outColor;

float lum(vec3 c) { return 0.3 * c.r + 0.59 * c.g + 0.11 * c.b; }

float hash(vec2 p, float seed) {
  return fract(sin(dot(p, vec2(127.1, 311.7)) + seed) * 43758.5453123);
}

// Separable blend functions, all operating on 0..1 channel values.
float sep(int mode, float b, float s) {
  if (mode == 1) return b + s - 1.0;                       // linear burn
  if (mode == 2) {                                          // vivid light
    if (s <= 0.5) return s <= 0.0 ? 0.0 : 1.0 - min(1.0, (1.0 - b) / (2.0 * s));
    return s >= 1.0 ? 1.0 : min(1.0, b / (2.0 * (1.0 - s)));
  }
  if (mode == 3) return b + 2.0 * s - 1.0;                  // linear light
  if (mode == 4) return s <= 0.5 ? min(b, 2.0 * s)          // pin light
                                 : max(b, 2.0 * s - 1.0);
  if (mode == 5) return (b + 2.0 * s - 1.0) >= 0.5 ? 1.0 : 0.0; // hard mix
  if (mode == 6) return b - s;                              // subtract
  if (mode == 7) return s <= 0.0 ? 1.0 : min(1.0, b / s);   // divide
  return s;
}

void main() {
  vec4 B = texture(uBase, vUV);
  vec4 S = texture(uSrc, vUV);

  float sa = S.a * uOpacity;
  float ba = B.a;

  if (uMode == 10) {                                        // dissolve
    float r = hash(gl_FragCoord.xy, uSeed);
    outColor = (sa > 0.0 && r < sa) ? vec4(S.rgb, 1.0) : B;
    return;
  }

  if (sa <= 0.0) { outColor = B; return; }

  float ra = sa + ba * (1.0 - sa);
  if (ra <= 0.0) { outColor = vec4(0.0); return; }

  vec3 blended;
  if (uMode == 8 || uMode == 9) {                           // darker/lighter colour
    bool takeSrc = uMode == 8 ? lum(S.rgb) < lum(B.rgb) : lum(S.rgb) > lum(B.rgb);
    blended = takeSrc ? S.rgb : B.rgb;
  } else {
    blended = vec3(sep(uMode, B.r, S.r), sep(uMode, B.g, S.g), sep(uMode, B.b, S.b));
  }
  blended = clamp(blended, 0.0, 1.0);

  // Photoshop applies the blend only where the backdrop exists; elsewhere the
  // source shows through unblended.
  vec3 cs = S.rgb * (1.0 - ba) + blended * ba;
  vec3 rgb = (cs * sa + B.rgb * ba * (1.0 - sa)) / ra;

  outColor = vec4(clamp(rgb, 0.0, 1.0), ra);
}`,f=null,p=null,m=null,h=null,g=null,_=null,v=0,y=!1;function b(){let e=f.createTexture();return f.bindTexture(f.TEXTURE_2D,e),f.texParameteri(f.TEXTURE_2D,f.TEXTURE_MIN_FILTER,f.NEAREST),f.texParameteri(f.TEXTURE_2D,f.TEXTURE_MAG_FILTER,f.NEAREST),f.texParameteri(f.TEXTURE_2D,f.TEXTURE_WRAP_S,f.CLAMP_TO_EDGE),f.texParameteri(f.TEXTURE_2D,f.TEXTURE_WRAP_T,f.CLAMP_TO_EDGE),e}function x(e,t){let n=f.createShader(e);if(f.shaderSource(n,t),f.compileShader(n),!f.getShaderParameter(n,f.COMPILE_STATUS)){let e=f.getShaderInfoLog(n);throw f.deleteShader(n),Error(`shader compile failed: ${e}`)}return n}function ee(){if(f||y)return!!f;try{if(p=document.createElement(`canvas`),p.width=1,p.height=1,f=p.getContext(`webgl2`,{alpha:!0,premultipliedAlpha:!1,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!0,desynchronized:!1}),!f)throw Error(`no webgl2`);p.addEventListener(`webglcontextlost`,e=>{e.preventDefault(),f=null,m=null,y=!1});let e=x(f.VERTEX_SHADER,u),t=x(f.FRAGMENT_SHADER,d);if(m=f.createProgram(),f.attachShader(m,e),f.attachShader(m,t),f.bindAttribLocation(m,0,`aPos`),f.linkProgram(m),!f.getProgramParameter(m,f.LINK_STATUS))throw Error(`link failed: ${f.getProgramInfoLog(m)}`);f.deleteShader(e),f.deleteShader(t);let n=f.createBuffer();return f.bindBuffer(f.ARRAY_BUFFER,n),f.bufferData(f.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),f.STATIC_DRAW),f.enableVertexAttribArray(0),f.vertexAttribPointer(0,2,f.FLOAT,!1,0,0),f.useProgram(m),h={base:f.getUniformLocation(m,`uBase`),src:f.getUniformLocation(m,`uSrc`),mode:f.getUniformLocation(m,`uMode`),opacity:f.getUniformLocation(m,`uOpacity`),seed:f.getUniformLocation(m,`uSeed`)},f.uniform1i(h.base,0),f.uniform1i(h.src,1),g=b(),_=b(),v=f.getParameter(f.MAX_TEXTURE_SIZE),f.disable(f.BLEND),f.disable(f.DEPTH_TEST),!0}catch(e){return console.warn(`[gpu-blend] unavailable, falling back to CPU:`,e&&e.message),y=!0,f=null,!1}}var S=4e5;function C(e,t){return y||!ee()?!1:e<=v&&t<=v}function w(e,t){return e*t>=S&&C(e,t)}function T(e,t,n){f.activeTexture(f.TEXTURE0+t),f.bindTexture(f.TEXTURE_2D,e),f.pixelStorei(f.UNPACK_FLIP_Y_WEBGL,!0),f.pixelStorei(f.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),f.texImage2D(f.TEXTURE_2D,0,f.RGBA,f.RGBA,f.UNSIGNED_BYTE,n)}function te(e,t,n,r){let i=l[n];if(i===void 0)return!1;let a=e.canvas.width,o=e.canvas.height;if(!w(a,o))return!1;try{return(p.width!==a||p.height!==o)&&(p.width=a,p.height=o),f.viewport(0,0,a,o),f.useProgram(m),T(g,0,e.canvas),T(_,1,t),f.uniform1i(h.mode,i),f.uniform1f(h.opacity,r),f.uniform1f(h.seed,Math.random()*1e3),f.clearColor(0,0,0,0),f.clear(f.COLOR_BUFFER_BIT),f.drawArrays(f.TRIANGLES,0,3),f.isContextLost&&f.isContextLost()?!1:(e.save(),e.globalAlpha=1,e.globalCompositeOperation=`copy`,e.drawImage(p,0,0),e.restore(),!0)}catch(e){return console.warn(`[gpu-blend] blend failed, falling back to CPU:`,e&&e.message),!1}}var E=new Map;function D(e){if(!e||!e.id)throw Error(`Adjustment needs an id`);if(!e.defaults){e.defaults={};for(let t of e.params||[])t.key!==void 0&&(e.defaults[t.key]=t.default)}return e.layerable===void 0&&(e.layerable=!0),E.set(e.id,e),e}function O(e){return E.get(e)||null}function ne(){return[...E.values()]}function re(e){let t=E.get(e);return t?structuredClone(t.defaults):{}}function k(e,t,n,r){let i=E.get(e);if(!i||typeof i.apply!=`function`)return t;try{let e={...i.defaults,...n||{}};i.apply(t,e,r||{})}catch(t){console.error(`[adjustment:${e}]`,t)}return t}function A(e){let t=new Uint8ClampedArray(256);for(let n=0;n<256;n++)t[n]=e(n);return t}function j(e){let t=new Float32Array(256);for(let n=0;n<256;n++)t[n]=e(n);return t}function M(e,t){let n=t<=0?0:t>=255?255:t,r=Math.floor(n),i=n-r;return i===0||r>=255?e[r]:e[r]+(e[r+1]-e[r])*i}function ie(e,t,n=t,r=t){let i=e.data;for(let e=0;e<i.length;e+=4)i[e+3]!==0&&(t&&(i[e]=t[i[e]]),n&&(i[e+1]=n[i[e+1]]),r&&(i[e+2]=r[i[e+2]]));return e}var N=new Map;function ae(e,t){t?N.set(e,t):N.delete(e)}function P(e,t={}){let n=s(e.width,e.height),r=n.getContext(`2d`);return W(e.layers,r,e,t),n}function F(e,t){return t?P(e,t):(e._compositeValid&&e._composite&&e._composite.width===e.width&&e._composite.height===e.height||(e._composite=P(e),e._compositeValid=!0),e._composite)}var I={r:!0,g:!0,b:!0};function L(e){if(!e)return{...I};let t=e.channelView;return!t||typeof t!=`object`?(e.channelView={...I},e.channelView):(typeof t.r!=`boolean`&&(t.r=!0),typeof t.g!=`boolean`&&(t.g=!0),typeof t.b!=`boolean`&&(t.b=!0),t)}function R(e){return!!(e&&e.r&&e.g&&e.b)}function z(e,t){if(!e||!t)return!1;let n=L(e),r=!1;for(let e of[`r`,`g`,`b`]){if(t[e]===void 0)continue;let i=!!t[e];n[e]!==i&&(n[e]=i,r=!0)}return r}function B(e,t){if(R(t))return!1;let n=e.canvas.width,r=e.canvas.height;if(n<1||r<1)return!1;let i=[!!t.r,!!t.g,!!t.b],a=+!!i[0]+ +!!i[1]+ +!!i[2],o=e.getImageData(0,0,n,r),s=o.data;if(a===1){let e=i[0]?0:i[1]?1:2;for(let t=0;t<s.length;t+=4){let n=s[t+e];s[t]=n,s[t+1]=n,s[t+2]=n}}else for(let e=0;e<s.length;e+=4)i[0]||(s[e]=0),i[1]||(s[e+1]=0),i[2]||(s[e+2]=0);return e.putImageData(o,0,0),!0}function V(e){let t=F(e),n=L(e),r=e&&e.proof&&e.proof.enabled?e.proof:null;if(R(n)&&!r)return e._channelComposite=null,e._channelCompositeSrc=null,t;let i=`${+!!n.r}${+!!n.g}${+!!n.b}|`+(r?`${r.profileId}:${r.intent}:${+!!r.blackPoint}:${+!!r.gamutWarning}`:`-`),a=e._channelComposite;if(a&&e._channelCompositeSrc===t&&e._channelCompositeKey===i&&a.width===t.width&&a.height===t.height)return a;let o=s(t.width,t.height),l=c(o);return l.drawImage(t,0,0),r&&H&&H(l,e),B(l,n),e._channelComposite=o,e._channelCompositeSrc=t,e._channelCompositeKey=i,o}var H=null;function U(e){H=typeof e==`function`?e:null}function W(e,t,n,r={}){for(let i=e.length-1;i>=0;i--){let a=e[i];if(!G(a,r)||a.clipped)continue;let o=[];for(let t=i-1;t>=0&&e[t].clipped;t--)o.push(e[t]);o.length===0?Z(a,t,n,r):K(a,o,t,n,r)}}function G(e,t){return!(!e.visible||t.skipLayerIds&&t.skipLayerIds.has(e.id)||t.onlyLayerIds&&!t.onlyLayerIds.has(e.id))}function K(e,t,n,r,i){let a=r.width,o=r.height,c=s(a,o),l=c.getContext(`2d`);X(e,n,r,i);let u=q(e,r,i);u&&l.drawImage(u,0,0);for(let e of t)G(e,i)&&Z(e,l,r,i,{clipBase:u});u&&(l.globalCompositeOperation=`destination-in`,l.drawImage(u,0,0),l.globalCompositeOperation=`source-over`),Q(n,c,e.blendMode,Y(e),r)}function q(t,n,r){if(t.type===e.GROUP)return J(t,n,r);if(t.type===e.ADJUSTMENT)return null;let o=N.get(t.id)||t.canvas;if(!o)return null;let c=!r.ignoreEffects&&a(t),l=t.mask&&t.maskEnabled,u=t.fillOpacity==null?1:t.fillOpacity;if(!c&&!l&&u>=1)return o;let d=s(n.width,n.height),f=d.getContext(`2d`);if(c?i(f,o,t,n,u,{skipBelow:!0}):(f.globalAlpha=u,f.drawImage(o,0,0),f.globalAlpha=1),l){let e=t.maskAlphaCanvas();e&&(f.globalCompositeOperation=`destination-in`,f.drawImage(e,0,0),f.globalCompositeOperation=`source-over`)}return d}function J(e,t,n){let r=s(t.width,t.height),i=r.getContext(`2d`);if(W(e.children||[],i,t,n),e.mask&&e.maskEnabled){let t=e.maskAlphaCanvas();t&&(i.globalCompositeOperation=`destination-in`,i.drawImage(t,0,0),i.globalCompositeOperation=`source-over`)}return r}function Y(e){return e.opacity==null?1:e.opacity}function X(t,n,i,o){if(o.ignoreEffects||!a(t)||t.type===e.GROUP||t.type===e.ADJUSTMENT)return;let c=N.get(t.id)||t.canvas;if(!c)return;let l=r(c,t,i,i.width,i.height);if(!l.length)return;let u=Y(t),d=t.mask&&t.maskEnabled?t.maskAlphaCanvas():null;for(let e of l){let t=e.canvas;if(d){let e=s(i.width,i.height),n=e.getContext(`2d`);n.drawImage(t,0,0),n.globalCompositeOperation=`destination-in`,n.drawImage(d,0,0),t=e}Q(n,t,e.mode,e.opacity*u,i)}}function Z(n,r,i,s,c={}){if(n.type===e.ADJUSTMENT){oe(n,r,i,c);return}if(n.type===e.GROUP){let e=n.blendMode===`pass-through`;if(e&&Y(n)>=1&&!(n.mask&&n.maskEnabled)){W(n.children||[],r,i,s);return}Q(r,J(n,i,s),e?`normal`:n.blendMode,Y(n),i);return}X(n,r,i,s);let l=n.tile;if(l&&(s.ignoreEffects||!a(n))&&!(n.mask&&n.maskEnabled)&&(n.fillOpacity==null||n.fillOpacity>=1)&&o(n.blendMode===`pass-through`?`normal`:n.blendMode)){let e=Y(n);if(e<=0)return;r.save(),r.globalAlpha=e,r.globalCompositeOperation=t(n.blendMode===`pass-through`?`normal`:n.blendMode),r.drawImage(l.canvas,l.x,l.y),r.restore();return}let u=q(n,i,s);u&&Q(r,u,n.blendMode,Y(n),i)}function oe(e,n,r,i={}){let a=e.adjustment;if(!a)return;let c=n.canvas.width,l=n.canvas.height;if(c<1||l<1)return;let u=n.getImageData(0,0,c,l),d=new ImageData(new Uint8ClampedArray(u.data),c,l);k(a.kind,d,a.params||{});let f=s(c,l);f.getContext(`2d`).putImageData(d,0,0);let p=f.getContext(`2d`);if(e.mask&&e.maskEnabled){let t=e.maskAlphaCanvas();t&&(p.globalCompositeOperation=`destination-in`,p.drawImage(t,0,0),p.globalCompositeOperation=`source-over`)}i.clipBase&&(p.globalCompositeOperation=`destination-in`,p.drawImage(i.clipBase,0,0),p.globalCompositeOperation=`source-over`);let m=Y(e),h=e.blendMode===`pass-through`?`normal`:e.blendMode;o(h)?(n.save(),n.globalAlpha=m,n.globalCompositeOperation=t(h),n.drawImage(f,0,0),n.restore()):Q(n,f,h,m,r)}function Q(e,r,i,a,s){if(a<=0)return;let c=i===`pass-through`?`normal`:i;if(o(c)){e.save(),e.globalAlpha=a,e.globalCompositeOperation=t(c),e.drawImage(r,0,0),e.restore();return}if(te(e,r,c,a))return;let l=e.canvas.width,u=e.canvas.height,d=e.getImageData(0,0,l,u),f=r.getContext(`2d`,{willReadFrequently:!0}).getImageData(0,0,l,u);n(d,f,c,a),e.putImageData(d,0,0)}function se(e,t){let n=new Set(t.map(e=>e.id)),r=s(e.width,e.height),i=r.getContext(`2d`);return W($(e.layers,n),i,e,{}),r}function $(e,t){let n=[];for(let r of e)if(t.has(r.id))n.push(r);else if(r.children){let e=$(r.children,t);if(e.length){let t=Object.create(Object.getPrototypeOf(r));Object.assign(t,r,{children:e}),n.push(t)}}return n}export{O as _,se as a,M as b,R as c,ae as d,k as f,re as g,j as h,W as i,U as l,A as m,L as n,F as o,ie as p,P as r,V as s,Q as t,z as u,ne as v,D as y};