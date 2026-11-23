import { Collage } from './artwork.mjs';
import { JournalMarks } from './journal-marks.mjs';
export const JournalArt = (() => {
  const design = {
    id: 'journal-auto', name: '野外手记', title: '野外手记',
    background: '#f6f2e8', palette: ['#e0ccab', '#484c3c', '#958a76'],
    aspect: 'journal', action: '主图定调，辅图错开。让胶带和线条跨过照片边缘，把文字和低对比印纹留在纸面空处。'
  };

  const library = [
    {id:'journal-ridge-wide',name:'晨雾全景',file:'journal-ridge-wide.webp'},
    {id:'journal-ferns-tall',name:'溪流竖景',file:'journal-ferns-tall.webp'}
  ];
  const examples = {
    banner:{ids:['journal-ridge-wide','template-ferns','template-pond','template-traveler'],seed:221124},
    column:{ids:['journal-ferns-tall','template-pavilion','template-ridge','template-pond'],seed:221126},
    drift:{ids:['template-ridge','template-ferns','template-pond','template-traveler'],seed:221131}
  };

  const fonts = [
    {id:'zh-brush', family:'"Template Brush", KaiTi, STKaiti, "Noto Serif CJK SC", serif', weight:400, size:1.00},
    {id:'zh-ink', family:'KaiTi, STKaiti, "Noto Serif CJK SC", serif', weight:500, size:.78, italic:true},
    {id:'zh-song', family:'"Songti SC", SimSun, "Noto Serif CJK SC", serif', weight:650, size:.83},
    {id:'en-hand', family:'"Journal Hand", "Segoe Print", cursive', weight:600, size:1.02},
    {id:'en-serif', family:'Georgia, "Times New Roman", serif', weight:500, size:.79, italic:true},
    {id:'en-mono', family:'"Noto Sans Mono", Consolas, monospace', weight:500, size:.73}
  ];

  const labels = {banner:'上图下记', column:'纵向主景', drift:'错落散页'};
  const recipes = {
    banner: {
      hero:[.056,.049,.888,.373],
      rows:[
        [[.474,.624,.469,.239]],
        [[.064,.548,.341,.189],[.512,.677,.431,.226]],
        [[.060,.502,.340,.166],[.550,.602,.392,.204],[.088,.750,.362,.179]],
        [[.060,.501,.321,.162],[.566,.571,.370,.164],[.093,.713,.355,.168],[.563,.817,.360,.124]]
      ],
      title:[.560,.458], detail:[.073,.778]
    },
    column: {
      hero:[.059,.062,.530,.560],
      rows:[
        [[.570,.579,.369,.256]],
        [[.647,.229,.283,.189],[.517,.697,.422,.223]],
        [[.665,.232,.262,.183],[.609,.476,.326,.198],[.129,.750,.400,.168]],
        [[.646,.215,.283,.172],[.625,.438,.311,.211],[.065,.731,.354,.183],[.500,.753,.431,.169]]
      ],
      title:[.635,.060], detail:[.066,.650]
    },
    drift: {
      hero:[.351,.074,.594,.350],
      rows:[
        [[.065,.499,.423,.262]],
        [[.068,.193,.263,.189],[.514,.623,.425,.237]],
        [[.068,.195,.263,.186],[.563,.565,.378,.208],[.077,.698,.398,.203]],
        [[.068,.194,.262,.183],[.605,.519,.335,.178],[.063,.640,.369,.220],[.514,.798,.403,.139]]
      ],
      title:[.501,.445], detail:[.075,.476]
    }
  };

  const overlap = (a,b,pad = 0) => a[0] < b[0] + b[2] + pad && b[0] < a[0] + a[2] + pad &&
    a[1] < b[1] + b[3] + pad && b[1] < a[1] + a[3] + pad;
  const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
  const box = ([x,y,w,h]) => [(x+w/2)*1200,(y+h/2)*800,w*1200,h*1600];

  function measure(image) {
    const iw = image.naturalWidth || image.width;
    const ih = image.naturalHeight || image.height;
    const sample = document.createElement('canvas');
    sample.width = 64;
    sample.height = 64;
    const ctx = sample.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(image,0,0,64,64);
    const pixels = ctx.getImageData(0,0,64,64).data;
    const brightness = new Float32Array(4096);
    let warm = 0;
    for (let i=0;i<brightness.length;i++) {
      const j=i*4;
      brightness[i] = .2126*pixels[j] + .7152*pixels[j+1] + .0722*pixels[j+2];
      warm += pixels[j] - pixels[j+2];
    }
    let total = 0;
    let sx = 0;
    let sy = 0;
    let texture = 0;
    for (let y=3;y<61;y++) {
      for (let x=3;x<61;x++) {
        const i=y*64+x;
        const detail=Math.abs(brightness[i+1]-brightness[i-1])+Math.abs(brightness[i+64]-brightness[i-64]);
        const radius=Math.hypot(x/64-.5,y/64-.49);
        const weight=Math.min(detail,85)*Math.max(.24,1-radius*1.40);
        texture+=Math.min(detail,85);
        total+=weight;
        sx+=x*weight;
        sy+=y*weight;
      }
    }
    return {
      ratio:iw/ih, detail:texture/3364, warm:warm/4096,
      focusX:total ? clamp(.25+.5*sx/(64*total),.32,.68) : .5,
      focusY:total ? clamp(.23+.54*sy/(64*total),.31,.68) : .5
    };
  }

  function chooseLayout(photos, requested, fixed) {
    if (recipes[requested]) return requested;
    if (fixed) return fixed.ratio >= 1.35 ? 'banner' : fixed.ratio <= .94 ? 'column' : 'drift';
    if (photos.filter(p => p.ratio > 1.2).length >= Math.ceil(photos.length*.6)) return 'banner';
    if (photos.filter(p => p.ratio < .94).length >= Math.ceil(photos.length*.6)) return 'column';
    return 'drift';
  }

  function fitRect(rect, ratio, stick) {
    const [x,y,w,h]=rect;
    const target=.75*w/h;
    // Keep at least 84% of the source along the letterboxed axis.
    if (target > ratio*1.18) {
      const width=h*ratio*1.18/.75;
      return [x+(w-width)*stick,y,width,h];
    }
    if (target < ratio/1.18) {
      const height=w*.75*1.18/ratio;
      return [x,y+(h-height)*(stick===.5 ? .5 : 0),w,height];
    }
    return rect;
  }

  const groupList = group => group==='edge' ? JournalMarks.edge : JournalMarks.fill;

  function createMark(group, pattern, rect, rotation, color, opacity, seed, role) {
    const style=groupList(group).find(item=>item.id===pattern) || groupList(group)[0];
    const origin=Collage.paper(style.name,color,...box(rect),'rect',rotation);
    return {...origin,kind:'mark',markGroup:group,pattern:style.id,seed,opacity,journalRole:role};
  }

  function letter(text,rect,color,role) {
    return Collage.label(text,color,...box(rect),0,{font:'zh-brush',align:'left',journalRole:role});
  }

  function findPocket(used,sizes,anchor,preferOuter = false) {
    let best = null;
    let score = Number.NEGATIVE_INFINITY;
    for (const [w,h] of sizes) {
      const test = (x,y) => {
        if (x<.038 || y<.038 || x+w>.964 || y+h>.963) return;
        const candidate=[x,y,w,h];
        if (used.some(rect=>overlap(rect,candidate,preferOuter ? .012 : .015))) return;
        const distance=Math.hypot(x-anchor[0],y-anchor[1]);
        const edge = Math.min(x,1-x-w,y,1-y-h);
        const rank=2.7*Math.sqrt(w*h)-1.05*distance-(preferOuter ? edge*.55 : 0);
        if (rank>score) {score=rank; best=candidate;}
      };
      test(anchor[0],anchor[1]);
      for (let y=.042;y+h<.966;y+=.023) {
        for (let x=.042;x+w<.964;x+=.022) test(x,y);
      }
    }
    return best;
  }

  function cropSize(width,height) {
    const size=Math.min(112,Math.max(28,Math.min(width,height)*.18));
    return [size*1.24,size];
  }

  function edgePlacement(rect,pattern,index,rng) {
    const [x,y,w,h]=rect;
    if (JournalMarks.isCrop(pattern)) {
      const [width,height]=cropSize(w*1200,h*1600);
      const markW=width/1200, markH=height/1600;
      const right=pattern==='crop-right';
      return [[x+(right?w:0)-markW/2,y+(right?h:0)-markH/2,markW,markH],0];
    }
    const width=Math.min(.172,w*.60), height=Math.min(.039,h*.61);
    const swing=(rng()-.5)*14;
    switch (index%4) {
      case 0:return [[x+w*.15-width/2, y-height*.50, width,height], -9+swing];
      case 1:return [[x+w-width*.67, y+h*.78-height/2,width,height], -22+swing];
      case 2:return [[x+w*.68-width/2, y+h-height*.50,width,height], -3+swing];
      default:return [[x-width*.28,y+h*.32-height/2,width,height], 28+swing];
    }
  }

  function compose(assets,settings = {},seed = 1) {
    const photos=assets.map(asset=>({asset,...asset.journal}));
    if (photos.length<2 || photos.length>5) throw new Error('请选择 2–5 张照片。');
    const rng=Collage.random(seed);
    const fixed=photos.find(photo=>photo.asset.id===settings.hero);
    const profile=chooseLayout(photos,settings.layout,fixed);
    const recipe=recipes[profile];
    const detailSlots=recipe.rows[photos.length-2];
    const target=.75*recipe.hero[2]/recipe.hero[3];
    const main=fixed || [...photos].sort((a,b)=>{
      const score = photo => -Math.abs(Math.log(photo.ratio/target))+.31*Math.min(photo.detail/38,1);
      return score(b)-score(a);
    })[0];
    const remaining=photos.filter(photo=>photo!==main);
    const arranged=[{photo:main,rect:fitRect(recipe.hero,main.ratio,profile==='drift' ? 1 : profile==='column' ? 0 : .5)}];
    detailSlots.forEach(slot=>{
      const target=.75*slot[2]/slot[3];
      remaining.sort((a,b)=>Math.abs(Math.log(a.ratio/target))-Math.abs(Math.log(b.ratio/target)));
      const photo=remaining.shift();
      const nudge=(rng()-.5)*.020;
      arranged.push({photo,rect:fitRect([slot[0]+nudge,slot[1]-nudge/2,slot[2],slot[3]],photo.ratio,slot[0]>.46?1:0)});
    });

    const background=main.warm>6 ? '#f6f0e2' : '#f1f2e9';
    const ink=main.warm>6 ? '#362c22' : '#2c382c';
    const secondary=main.warm>6 ? '#6b5c48' : '#576256';
    const paper=main.warm>6 ? '#c5a875' : '#c5bb9b';
    const rich=settings.density==='rich';
    const quiet=settings.density==='quiet';
    const used=arranged.map(item=>item.rect);
    const imageLayers = arranged.map(({photo,rect},index)=>{
      const slot=index===0?'主照片':'辅照片 '+index;
      return Collage.photo(photo.asset,...box(rect),{
        name:slot+' · '+photo.asset.name,slot,journalRole:'photo-'+photo.asset.id,
        focusX:photo.focusX,focusY:photo.focusY
      });
    });

    const typography=[];
    const title=profile==='column'?'山间早信':'风从山间过';
    const titleSpot=findPocket(used, [[.392,.083],[.320,.078],[.277,.068],[.209,.078]],recipe.title);
    if (titleSpot) {
      used.push(titleSpot);
      typography.push(letter(title, titleSpot,ink,'text-main'));
    }
    const adjacent=titleSpot ? [titleSpot[0],titleSpot[1]+titleSpot[3]+.017] : recipe.title;
    const subtitleSpot=findPocket(used,[[.314,.046],[.262,.042],[.207,.043],[.170,.040]],adjacent);
    if (subtitleSpot) {
      used.push(subtitleSpot);
      typography.push(letter('Letters from the hills',subtitleSpot,secondary,'text-en'));
    }
    const detailSpot=findPocket(used,[[.278,.082],[.238,.066],[.189,.066],[.148,.053]],recipe.detail);
    if (detailSpot) {
      used.push(detailSpot);
      typography.push(letter('沿着溪水\n往山里走',detailSpot,ink,'text-note'));
    }
    const last=findPocket(used,[[.267,.026],[.184,.027]], [.062,.917],true);
    if (last) {
      used.push(last);
      typography.push(letter('FIELD NOTES  /  ON FOOT',last,secondary,'text-meta'));
    }

    const edges=[];
    const kinds=JournalMarks.edge;
    const start=Math.floor(rng()*kinds.length);
    for (const [index,{rect}] of arranged.entries()) {
      const pattern=index===0?'tape':kinds[(start+index)%kinds.length].id;
      const [position,rotation]=edgePlacement(rect,pattern,index,rng);
      edges.push(createMark('edge',pattern,position,rotation,pattern==='tape'?paper:secondary,
        pattern==='tape'?78:66,Math.floor(rng()*1e7),'edge-'+arranged[index].photo.asset.id));
      used.push(position);
    }
    if (rich) {
      const [position,rotation]=edgePlacement(arranged[0].rect,'seam',2,rng);
      edges.push(createMark('edge','seam',position,rotation,secondary,65,Math.floor(rng()*1e7),'edge-main-accent'));
      used.push(position);
    }

    const fills=[];
    const fillCount=quiet ? 1 : rich ? 3 : 2;
    const available=JournalMarks.fill;
    const chosen=available.find(item=>item.id===settings.print);
    const focalX=arranged[0].rect[0]+arranged[0].rect[2]/2;
    const anchors=focalX>.52 ? [[.053,.74],[.737,.060],[.678,.865]] : [[.72,.72],[.059,.748],[.68,.055]];
    const manualIndex=Math.floor(rng()*available.length);
    for (let i=0;i<fillCount;i++) {
      const signature={banner:'code',column:'coordinates',drift:'contours'}[profile];
      const alternatives=available.filter(item=>item.id!==signature);
      const id=chosen?.id || (i===0 ? signature : alternatives[(manualIndex+i*2)%alternatives.length].id);
      const shapes=[[.205,.072],[.163,.066],[.224,.042],[.132,.053],[.113,.043]];
      if (id==='code') shapes.unshift([.232,.193],[.120,.274],[.188,.157]);
      else if (id==='coordinates') shapes.unshift([.108,.171],[.139,.119]);
      const target=findPocket(used,shapes,anchors[i],true);
      if (!target) continue;
      used.push(target);
      const opacity=id==='code' ? (quiet?64:rich?81:74) : (quiet?49:rich?67:57);
      fills.push(createMark('fill',id,target,0,secondary,opacity,Math.floor(rng()*1e7),'fill-'+i));
    }

    const layers=[...fills,...imageLayers,...edges,...typography];
    return {layers,background,profile,hero:main.asset.id};
  }

  function manual(group,index = 0) {
    if (group==='type') {
      return {...letter('沿途手记 / Field notes',[.31,.51,.40,.09],'#373629'),journalManual:true};
    }
    const list=groupList(group);
    const {id}=list[index%list.length];
    const rect=group==='edge' ? [.41,.49,.18,.049] : id==='code' ? [.32,.38,.36,.23] : [.38,.45,.25,.12];
    const opacity=group==='edge' ? 80 : id==='code' ? 88 : 61;
    const mark=createMark(group,id,rect,group==='edge'?-9:0,'#7a715e',opacity,Date.now()%10000000);
    return {...mark,journalManual:true};
  }

  return {design,library,examples,fonts,labels,measure,compose,manual,cropSize};
})();
