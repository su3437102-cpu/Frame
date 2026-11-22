import { Collage } from './artwork.mjs';
export const MontageArt = (() => {
  const designs = [
    {id:'profile-grid', name:'侧影与朱红', description:'人像依次从侧脸到全身，朱红半圆打开左侧，鸟与马把重心拉向对角。', slots:['人像', '半圆与方格', '鸟与马']},
    {id:'orbital-ridges', name:'圆片里的山脊', description:'半透明圆、白色山褶和近景黑山层层叠压，远处的飞鸟把视线带向右侧。', slots:['山脊', '重叠圆片', '树与人物']},
    {id:'weathered-village', name:'枯枝与石村', description:'用一枝枯木串联石瓦、山村和拓印，陶罐与石块为两端加上重量。', slots:['石瓦与民居', '对角错层', '枯枝与陶罐']}
  ].map(design => ({
    ...design, title:design.name, group:'montage', aspect:'journal', background:'#080808',
    palette:['#b38d57','#bb6750','#e9e5dc'], action:'点选任意裁片可修改图层，或在规则生成器中换用其他主体与造型。'
  }));

  const entries = [
    ['profile', '侧脸人像', true], ['satin', '缎面人像', true], ['traveler', '旅行者剪影', true],
    ['flight', '飞鸦', true], ['horse', '马匹剪影', true], ['perched', '停栖的鸟', true],
    ['portrait-print', '石版人像照片'], ['portrait-contact', '人像印样'],
    ['desert', '橘色远山'], ['folds', '浅灰山褶'], ['peak', '深灰山脊'], ['shore', '浅金岸线'],
    ['wind-tree', '细枝风树', true], ['gown', '长裙人物剪影', true], ['flock', '远处的鸟群', true], ['boulders', '岸边石群', true],
    ['slate', '青灰石瓦'], ['village', '山麓村落'], ['rubbing', '矿物拓印'], ['lichen', '苔痕肌理'],
    ['branch', '斜向枯枝', true], ['vessel', '旧陶罐', true], ['block', '粗凿石块', true], ['moss', '苔石剪片', true]
  ];
  const library = entries.map(([key,name,transparent]) => ({
    id:'montage-'+key, name, file:'montage-'+key+'.webp', ...(transparent && {kind:'cutout'})
  }));
  const assets = new Map(entries.map(([key],index)=>[key,library[index]]));

  const arch = 'city-canopy';
  const defaults = {theme:arch, shape:arch, first:'auto', second:'auto', detail:'auto', palette:'auto'};
  const choices = {
    theme:[[arch,'建筑街景'],['profile-grid','人像写真'],['orbital-ridges','山水地貌'],['weathered-village','石瓦与村落']],
    shape:[[arch,'竖条错层'],['profile-grid','半圆与网格'],['orbital-ridges','重叠圆片'],['weathered-village','对角错层']],
    first:[['auto','随造型'],['none','无'],['tree','阔冠树'],['wind-tree','细枝风树'],['birds','飞鸟'],['person','行人'],['gown','长裙人物'],['horse','马'],['branch','枯枝'],['jar','陶罐'],['block','石块']],
    detail:[['auto','随造型'],['none','无'],['lines','点阵与细线'],['grid','网格与图线'],['gold','拓印与碎金线']],
    palette:[['auto','随造型'],['mono','黑白灰'],['ochre','赭金与旧红'],['red','朱红一点'],['orange','暖橘一点'],['fog','雾灰与淡金']]
  };
  choices.second = choices.first;

  const palettes = {
    mono:{paper:'#f1eee7', colors:['#93918b','#b8b5ae','#d0cdc4'], tone:'mono'},
    ochre:{paper:'#f7f4e8', colors:['#b89a60','#bf795f','#d6c3a0'], tone:'mono'},
    red:{paper:'#eae6df', colors:['#b83221','#943f32','#d3c9ba'], tone:'mono'},
    orange:{paper:'#fbfaf7', colors:['#e78331','#bd6234','#e7c492'], tone:'mono'},
    fog:{paper:'#dfded9', colors:['#c0ae84','#91867a','#d4c8b0'], tone:'warm'}
  };

  const box = ([x,y,w,h]) => [(x+w/2)*1200/444,(y+h/2)*800/592,w*1200/444,h*1600/592];
  const frame = (name,color,rect,props) => Collage.paper(name,color,...box(rect),'rect',0,props);
  const plate = (asset,name,rect,props) => Collage.photo(asset,...box(rect),{
    name, slot:name, tone:'mono', montageRole:'subject', ...props
  });
  const circle = (name,color,rect,props) => frame(name,color,rect,{mask:'circle',...props});
  const half = Array.from({length:33},(_,index)=>{
    const angle = Math.PI/2 + index/32*Math.PI;
    return [1+Math.cos(angle),.5+.5*Math.sin(angle)];
  });

  function mark(name, pattern, rect, color, opacity = 66) {
    return {
      ...frame(name,color,rect,{opacity,montageRole:'detail'}),
      kind:'mark', markGroup:'fill', pattern, seed:47009
    };
  }

  function details(type, rect) {
    const [x,y,w,h] = rect;
    const ink = '#5b564e';
    const line = (name,ax,ay,aw,ah,opacity) =>
      frame(name,ink,[x+ax*w,y+ay*h,aw*w,ah*h],{opacity,montageRole:'detail'});
    if (type==='grid') return [
      mark('浅灰方格','grid',[x,y,w,h],ink,47),
      line('网格水平轴',-.18,.22,1.32,.008,68),
      line('网格垂直轴',.26,0,.009,1,52)
    ];
    if (type==='gold') return [
      plate(assets.get('rubbing'),'矿物拓印',[x,y,w,h],{opacity:27,montageRole:'detail'}),
      ...[0,1,2,3,4,5,6].map((n)=>frame('碎金划线','#bca267',
        [x+w*(.02+n*.105),y+h*(.12+(n%3)*.14),w*(.53-n*.027),Math.max(.55,(n%2)*1.0)],
        {rotation:35+n*2,opacity:60,montageRole:'detail'}))
    ];
    return [
      mark('细小网点','halftone',[x,y,w*.36,h*.49],ink,39),
      line('延伸水平线',.15,.72,.96,.009,71),
      line('第二条细线',.36,.80,.72,.006,45),
      circle('墨点',ink,[x+w*.88,y+h*.18,2.6,2.6],{opacity:77,montageRole:'detail'})
    ];
  }

  function profiles(add) {
    const {paper,picture,accent,ink,color} = add;
    paper('灰米色衬纸','#eae6de',[33,44,380,506],{montageRole:'paper'});
    color('左侧朱红半圆','#b83221',[82,143,57,108],0,{mask:'polygon',points:half});
    paper('顶部浅灰方块','#dad9d0',[211,144,52,80],{opacity:42});
    paper('右上雾灰矩形','#c7c6bd',[293,159,63,70],{opacity:83});
    paper('下部铅灰底片','#a6a49a',[117,378,177,74],{opacity:79});
    paper('左侧薄灰方块','#bac0b8',[83,314,65,46],{opacity:55});
    color('红色细条','#b33422',[149,250,9,29],0);
    color('右上红点','#b33422',[347,242,24,24],0,{mask:'circle'});
    color('右下红点','#b33422',[319,324,29,29],0,{mask:'circle'});
    color('下左红点','#b33422',[115,375,39,43],1,{mask:'circle'});
    paper('上端淡红标记','#b68b80',[191,105,9,15],{opacity:62});
    ink('grid',[309,317,92,113]);
    ink('grid',[50,365,36,95]);
    picture('portrait-print','灰调印样碎片',[110,286,115,78],{focusY:.55,opacity:59});
    picture('portrait-contact','下部人像碎片',[151,356,54,65],{focusX:.71});
    picture('rubbing','马匹背后的灰色地面',[201,390,87,97],{focusY:.80,opacity:78,montageRole:'fixed'});
    accent('horse','下方动物底片',[209,370,81,114],1);
    picture('profile','左侧大幅人像',[141,132,88,174],{fit:'contain'});
    picture('satin','中央缎面人像',[203,236,85,157],{fit:'contain'});
    picture('traveler','右侧长幅人像',[269,196,77,223],{fit:'contain'});
    paper('发际半透明接缝','#ddd9d0',[198,171,20,37],{opacity:64});
    paper('人像前的浅灰键线','#4e4c47',[201,179,94,.9],{opacity:64,montageRole:'detail'});
    paper('横向标引线','#5d564b',[55,384,268,.8],{opacity:64,montageRole:'detail'});
    paper('右侧标引线','#625c51',[285,290,118,.7],{opacity:69,montageRole:'detail'});
    accent('flight','左侧展开的鸟翼',[78,253,62,75],0);
    accent('perched','人像上方停栖的鸟',[152,113,54,29],0);
    accent('flock','右上飞鸟',[286,110,33,29],0);
  }

  function mountains(add) {
    const {paper,picture,accent,ink,color} = add;
    paper('纯白衬纸','#fbfaf7',[33,44,379,506],{montageRole:'paper'});
    paper('竖向铅灰色片','#aeb0aa',[199,106,35,301],{opacity:73});
    color('右下浅杏圆','#df9f79',[195,280,121,120],2,{mask:'circle',opacity:60});
    color('圆片边缘暖橘','#d9773d',[260,303,53,91],0,{mask:'circle',opacity:82});
    picture('desert','橘色远山圆片',[36,143,173,176],{mask:'circle',tone:'original',montageTint:true,focusY:.49});
    paper('左下浅灰圆片','#d0cec7',[35,265,148,126],{mask:'circle',grain:true,opacity:75});
    picture('folds','前置白灰圆片',[117,194,132,129],{mask:'circle',focusY:.30});
    color('底部浅金竖片','#dcb88a',[217,355,49,146],2,{grain:true,opacity:82});
    picture('shore','浅金岸线',[218,368,187,66],{tone:'warm',montageTint:true, mask:'polygon',
      points:[[0,.20],[.16,.13],[.28,.19],[.49,.08],[.68,.14],[1,.06],[.94,.40],[.77,.63],[.52,.76],[.32,.96],[0,1]]});
    picture('peak','暗面山脚圆片',[134,284,151,132],{mask:'circle',focusY:.93});
    accent('wind-tree','跨过圆片的细枝树',[238,127,138,235],0);
    picture('peak','破开圆形的近景山脊',[144,290,196,127],{mask:'polygon',focusY:.59,
      points:[[0,.43],[.06,.33],[.13,.23],[.20,.16],[.24,.04],[.28,.08],[.31,.015],[.33,.07],[.37,.055],[.43,.18],[.49,.29],[.55,.31],[.64,.41],[.71,.45],[.79,.59],[.89,.67],[1,.80],[.92,.88],[.81,.91],[.74,.97],[.63,1],[.55,.93],[.41,.96],[.29,.94],[.17,.85],[.09,.73]]});
    accent('gown','右侧长裙人物',[328,273,36,103],1);
    accent('flock','高处的飞鸟',[160,123,115,94],1);
    picture('boulders','近岸小石群',[270,426,34,35],{montageRole:'fixed'});
    picture('boulders','右岸几块石头',[351,357,39,18],{montageRole:'fixed'});
    ink('lines',[232,425,167,40]);
    paper('岸线的水平延伸','#625e55',[239,375,165,1],{opacity:75,montageRole:'detail'});
  }

  function stones(add) {
    const {paper,picture,accent,ink,color,text} = add;
    paper('雾灰色衬纸','#deddd9',[33,44,382,508],{montageRole:'paper'});
    color('上部沙色拓片','#b8a184',[77,96,63,60],0,{grain:true,opacity:75});
    ink('lines',[78,98,56,47]);
    picture('slate','左上石瓦方片',[101,137,111,97],{tone:'original'});
    picture('village','右上山村方片',[247,122,129,162],{tone:'original',focusX:.65});
    picture('rubbing','中部竖向拓印',[181,208,67,243],{opacity:53,focusX:.40});
    picture('rubbing','右下浅灰矿纹',[241,286,118,147],{opacity:67,focusY:.81});
    picture('lichen','小幅苔纹裁片',[214,197,87,78],{opacity:40,tone:'warm'});
    picture('moss','左侧苔石碎片',[77,196,48,90],{tone:'original',montageRole:'fixed'});
    picture('block','左下粗石',[61,362,89,156],{tone:'original',montageRole:'fixed'});
    ink('gold',[281,420,91,92]);
    accent('branch','纵贯画面的枯枝',[120,93,183,421],0,{tone:'original'});
    accent('vessel','右侧陶罐',[323,321,61,69],1,{tone:'original'});
    text('石瓦留着雨的颜色。\n木纹沿着石缝折回，\n远处的房子藏进山里。','#514d46',[55,296,139,42],{font:'zh-song',align:'left',opacity:74,montageRole:'detail'});
  }

  const scenes = {'profile-grid':profiles,'orbital-ridges':mountains,'weathered-village':stones};

  function layout(id) {
    const layers = [];
    scenes[id]({
      paper:(...args)=>layers.push(frame(...args)),
      picture:(key,...args)=>layers.push(plate(assets.get(key),...args)),
      accent:(key,name,rect,slot,props)=>layers.push(plate(assets.get(key),name,rect,{
        montageRole:'accent',montageSlot:slot,...props
      })),
      color:(name,value,rect,index,props)=>layers.push(frame(name,value,rect,{
        montageRole:'color',montageColor:index,...props
      })),
      ink:(type,rect)=>layers.push(...details(type,rect)),
      text:(words,value,rect,props)=>layers.push(Collage.label(words,value,...box(rect),0,props))
    });
    return layers;
  }

  const subjectAssets = {
    [arch]: ['city-arcades','city-street','city-hillside','city-church','city-mountain','city-roofs','city-court'],
    'profile-grid':['portrait-print','portrait-contact','profile','satin','traveler'],
    'orbital-ridges':['folds','peak','shore','desert'],
    'weathered-village':['slate','village','rubbing','lichen']
  };
  const accentAssets = {
    tree:'city-tree','wind-tree':'wind-tree',birds:'flight',person:'city-walker',gown:'gown',
    horse:'horse',branch:'branch',jar:'vessel',block:'block'
  };
  const slantedPortrait = [[.20,0],[.83,.06],[1,.42],[.90,.96],[.17,1],[0,.63],[.06,.21]];
  const detailZones = {
    [arch]:[193,297,42,52],'profile-grid':[300,320,88,99],
    'orbital-ridges':[242,427,145,45],'weathered-village':[283,418,90,90]
  };

  function getAsset(id, lookup) {
    return assets.get(id) || lookup(id);
  }

  function replaceAsset(layer, asset, asAccent = false) {
    const transparent = asset.kind==='cutout';
    return {
      ...layer, asset:asset.id, name:layer.slot+' · '+asset.name,
      fit:asAccent || transparent ? 'contain' : 'cover',
      mask:asAccent ? 'rect' : layer.mask
    };
  }

  function compose(layers, settings, materials, lookup) {
    const palette = palettes[settings.palette];
    const rolePool = subjectAssets[settings.theme].map(id=>getAsset(id,lookup)).filter(Boolean);
    const photos = materials.filter(asset=>asset.kind!=='cutout');
    const cutouts = materials.filter(asset=>asset.kind==='cutout');
    const pool = photos.length ? photos : (cutouts.length ? cutouts : rolePool.filter(asset=>asset.kind!=='cutout'));
    const people = materials.length ? cutouts : rolePool.filter(asset=>asset.kind==='cutout');
    const changeSubject = materials.length>0 || settings.theme!==settings.shape;
    const output = [];
    let subject = 0, contour = 0;
    const placed = new Set();

    for (let layer of layers) {
      const role = layer.montageRole;
      if (role==='detail' && settings.detail!=='auto') continue;
      if (role==='accent') {
        const choice = layer.montageSlot===0 ? settings.first : settings.second;
        if (choice==='none') continue;
        if (choice!=='auto') {
          if (placed.has(layer.montageSlot)) continue;
          const replacement = getAsset(accentAssets[choice],lookup);
          layer = replaceAsset(layer,replacement,true);
          placed.add(layer.montageSlot);
        }
      }
      if (role==='subject') {
        if (changeSubject && pool.length) {
          const original = lookup(layer.asset);
          const replacement = original?.kind==='cutout' && people.length
            ? people[contour++ % people.length] : pool[subject++ % pool.length];
          layer = replaceAsset(layer,replacement);
          if (original?.kind==='cutout' && replacement.kind!=='cutout') {
            layer.mask = 'polygon';
            layer.points = slantedPortrait;
          }
        }
        if (changeSubject && settings.palette==='auto') layer.tone = 'mono';
      }
      if (palette && role==='paper') layer.color = palette.paper;
      if (palette && role==='color') layer.color = palette.colors[layer.montageColor ?? 0];
      if (palette && layer.kind==='photo') layer.tone = palette.tone;
      output.push(layer);
      if (palette && settings.palette!=='mono' && layer.montageTint) {
        output.push({
          ...layer, id:Collage.uid(), kind:'paper', asset:undefined, name:'照片色罩',
          color:palette.colors[0], blend:'color', opacity:48, montageRole:'color'
        });
      }
    }
    if (settings.detail!=='none' && settings.detail!=='auto') {
      output.push(...details(settings.detail,detailZones[settings.shape]));
    }
    if (settings.palette==='mono') {
      for (const layer of output) {
        if (layer.kind==='photo') layer.tone = 'mono';
        if (!layer.color) continue;
        const [r,g,b] = layer.color.slice(1).match(/../g).map(byte=>parseInt(byte,16));
        const gray = Math.round(.213*r+.715*g+.072*b).toString(16).padStart(2,'0');
        layer.color = '#'+gray.repeat(3);
      }
    }
    return output;
  }

  return {designs, library, layout, choices, defaults, compose};
})();
