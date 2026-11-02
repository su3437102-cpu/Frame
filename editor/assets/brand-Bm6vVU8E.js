var e={name:`Pikado`,tagline:`Image studio`,violet:`#7C6AF6`,violetDeep:`#4B3BD6`,violetLift:`#9B7CFF`,cyan:`#35D0E8`,cyanLift:`#5FDCEA`},t={accent:`#7C6AF6`,accentHi:`#9B8CFF`,accentSoft:`rgba(124, 106, 246, 0.75)`,handleFill:`#FFFFFF`,handleStroke:`rgba(10, 10, 14, 0.9)`,guide:`#35D0E8`,smartGuide:`#FF4D9D`,warn:`#FFC46B`},n=0;function r({size:t=24,className:r=``,title:i=``}={}){let a=`pk${++n}`;return`<svg class="pk-mark ${r}" width="${t}" height="${t}" viewBox="0 0 32 32" role="${i?`img`:`presentation`}"${i?` aria-label="${i}"`:` aria-hidden="true"`}>
  <defs>
    <linearGradient id="${a}a" x1="0" y1="0" x2=".85" y2="1">
      <stop offset="0" stop-color="${e.violet}"/><stop offset="1" stop-color="${e.violetDeep}"/>
    </linearGradient>
    <linearGradient id="${a}b" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="${e.cyanLift}"/><stop offset="1" stop-color="${e.violetLift}"/>
    </linearGradient>
    <mask id="${a}m">
      <rect width="32" height="32" fill="#fff"/>
      <path d="M16 10.4 L21.6 16 L16 21.6 L10.4 16z" fill="#000"/>
    </mask>
  </defs>
  <g mask="url(#${a}m)">
    <path d="M16 2.6 L29.4 16 L16 29.4 L2.6 16z" fill="url(#${a}a)"/>
    <path d="M16 2.6 L29.4 16 L16 16z" fill="url(#${a}b)" opacity=".92"/>
  </g>
</svg>`}function i({size:t=22,wordSize:n=15,className:i=``}={}){return`<span class="pk-brand ${i}">${r({size:t,title:e.name})}<span class="pk-wordmark" style="font-size:${n}px">${e.name}</span></span>`}function a(){let t=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<defs>
<linearGradient id="a" x1="0" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="${e.violet}"/><stop offset="1" stop-color="${e.violetDeep}"/></linearGradient>
<linearGradient id="b" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${e.cyanLift}"/><stop offset="1" stop-color="${e.violetLift}"/></linearGradient>
<mask id="m"><rect width="32" height="32" fill="#fff"/><path d="M16 10.4 L21.6 16 L16 21.6 L10.4 16z" fill="#000"/></mask>
</defs>
<g mask="url(#m)"><path d="M16 2.6 L29.4 16 L16 29.4 L2.6 16z" fill="url(#a)"/><path d="M16 2.6 L29.4 16 L16 16z" fill="url(#b)" opacity=".92"/></g>
</svg>`;return`data:image/svg+xml,${encodeURIComponent(t)}`}function o(){let e=document.querySelector(`link[rel="icon"]`);e||(e=document.createElement(`link`),e.rel=`icon`,document.head.appendChild(e)),e.type=`image/svg+xml`,e.href=a()}export{o as a,r as i,t as n,i as r,e as t};