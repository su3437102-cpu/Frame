import { Collage } from './artwork.mjs';
import { MontageArt } from './montage.mjs';
import { FilmFrames } from './film-frames.mjs';
export const CollageTemplates = (() => {
  const groups = [
    {
      id: 'montage', title: '轮廓拼贴', source: '参考 · 新建文件夹 (5) · 4 张作品',
      description: '建筑篇以方形和竖条为底，城镇碎片托住横展的树冠。人物篇用圆红块与方格衬托侧脸，山水篇让圆片叠出远近，第四张用枝条串起石纹和房舍。图形先建立秩序，照片的错落和跨界剪影再决定外轮廓。',
      rules: [
        '主体从同一题材取材，用两到三块大图定重心，再用同题材短片、窄条或肌理连接它们。',
        '用竖条、半圆、重叠圆或对角线建立骨架。让裁片错开，留下几处清晰的纸面缺口。',
        '在轮廓断开处放一到两种跨界元素。大的剪影连起上下或两组碎片，小的剪影让视线转向。',
        '黑白灰承担大面积。赭金、朱红或暖橘只集中在少量色块；网格、细线和纹理退到接缝或留白。'
      ],
      composer: true,
      references: [
        {name: 'Colla · 先分解轮廓，再安排图像片段', url: 'https://github.com/Dongee-W/Colla'},
        {name: 'image-collage · 照片可独立裁切和移动', url: 'https://github.com/jo56/image-collage'},
        {name: '美国国会图书馆 · 透明剪影叠贴实验', url: 'https://github.com/LibraryOfCongress/collaging-space-time'}
      ]
    },
    FilmFrames.group
  ];

  const designs = [
    {
      id: 'city-canopy', group: 'montage', name: '树冠下的黑白山城', title: '树冠下的黑白山城', aspect: 'journal',
      background: '#080808', palette: ['#b89358', '#ba785d', '#f7f4e8'],
      description: '大树、错层山城和小行人形成纵向动线，金褐色纸只在建筑接缝里露出。使用独立生成的摄影素材。',
      action: '打开示例后可替换建筑照片，保留各片的裁切和叠放关系。',
      slots: ['阔冠树剪影', '山城照片裁片', '金褐与旧红色纸', '行人剪影', '细线与点阵']
    },
    ...MontageArt.designs,
    ...FilmFrames.designs
  ];

  // Saved projects and the journal import flow still use these layout IDs.
  const legacyDesigns = [
    {
      id: 'field-notes', group: 'field', name: '山野手记', title: '山野手记', aspect: 'journal',
      background: '#faf8f1', palette: ['#ded2b8', '#51614b', '#243342'],
      action: '三张照片有一个观看顺序。上方用于定场，细节与题记在留白中错开。',
      slots: ['横幅主景', '左侧细节', '右下细节']
    },
    {
      id: 'yellow-pass', group: 'field', name: '黄纸旅签', title: '黄纸旅签', aspect: 'journal',
      background: '#e4c321', palette: ['#244553', '#a63c29', '#f1d981'],
      action: '用芥末黄统一底色，把鲜明的主体收在中央，给上、下题字留下空间。',
      slots: ['人物主图', '边缘小图', '底部小图']
    },
    {
      id: 'garden-window', group: 'garden', name: '夜园灯窗', title: '夜园灯窗', aspect: 'square',
      background: '#080a08', palette: ['#263729', '#aa7950', '#ede0c8'],
      action: '用直切相片安排明暗，再让一个浅色抠图跨过黑缝。',
      slots: ['上左园林', '中右灯窗', '下方倒影', '跨缝前景']
    },
    {
      id: 'pond-flow', group: 'garden', name: '池影鱼行', title: '池影鱼行', aspect: 'square',
      background: '#070907', palette: ['#354a38', '#bd684e', '#dac9a1'],
      action: '让透明素材沿弯曲路线几次重复，用大小变化带动视线。',
      slots: ['左侧树影', '右侧水面', '沿曲线重复的透明元素']
    }
  ];

  const library = [
    {id: 'template-ridge', name: '晨雾山脊', file: 'template-ridge.webp'},
    {id: 'template-ferns', name: '溪边蕨叶', file: 'template-ferns.webp'},
    {id: 'template-traveler', name: '山间旅人', file: 'template-traveler.webp'},
    {id: 'template-pavilion', name: '夜色园亭', file: 'template-pavilion.webp'},
    {id: 'template-window', name: '庭院灯窗', file: 'template-window.webp'},
    {id: 'template-pond', name: '池面灯影', file: 'template-pond.webp'},
    {id: 'template-lotus', name: '浅色荷花', file: 'template-lotus.webp', kind: 'cutout'},
    {id: 'template-fish', name: '锦鲤剪影', file: 'template-fish.webp', kind: 'cutout'}
  ];
  const [ridge, ferns, traveler, pavilion, windowView, pond, lotus, fish] = library;
  const city = {};
  for (const [key, name, kind] of [
    ['mountain', '山背与谷地'], ['arcades', '临街柱廊'], ['street', '石板窄巷'],
    ['church', '白石钟楼'], ['hillside', '坡地民居'], ['court', '老城拱门'],
    ['roofs', '旧城区屋顶'], ['pavement', '街巷远景'], ['stone', '石砌门墙'],
    ['tree', '阔冠树剪影', 'cutout'], ['walker', '背向行人剪影', 'cutout']
  ]) {
    const id = 'city-' + key;
    city[key] = {id, name, file: id + '.webp', kind};
    library.push(city[key]);
  }
  library.push(...MontageArt.library);
  const assetById = new Map(library.map(asset=>[asset.id,asset]));
  const demo = {
    'field-notes': [ridge, ferns, ridge],
    'yellow-pass': [traveler, ferns, ridge],
    'garden-window': [pavilion, windowView, pond, lotus],
    'pond-flow': [ferns, pond, fish]
  };
  const byId = new Map([...designs, ...legacyDesigns].map(design => [design.id, design]));

  function cityMontage(materials) {
    const drawing = [];
    const photographs = materials?.filter(asset => asset.kind !== 'cutout') || [];
    const silhouettes = materials?.filter(asset => asset.kind === 'cutout') || [];
    const box = ([left, top, width, height]) => [
      (left + width / 2) * 1200 / 648, (top + height / 2) * 800 / 864,
      width * 1200 / 648, height * 1600 / 864
    ];
    const paper = (name, color, rect, options) =>
      drawing.push(Collage.paper(name, color, ...box(rect), 'rect', 0, options));
    const photo = (source, slot, rect, options) =>
      drawing.push(Collage.photo(source, ...box(rect), {name: slot, slot, tone: 'mono', montageRole: 'subject', ...options}));
    let next = 0;
    const fragment = (key, slot, rect, options) => {
      const asset = photographs.length ? photographs[next++ % photographs.length] : city[key];
      photo(asset, slot, rect, options);
    };

    paper('暖白衬纸', '#f7f4e8', [49, 62, 551, 736], {montageRole:'paper'});
    fragment('mountain', '左上山脊', [80, 363, 196, 141], {mask: 'polygon', points: [[0,.18],[.09,.11],[.23,.045],[.35,.09],[.46,.13],[.60,.045],[.73,.015],[.84,.06],[1,.17],[1,1],[0,1]], focusY:.54});
    paper('竖向金褐色纸', '#b89a60', [315, 246, 64, 219], {montageRole:'color', montageColor:0, grain: true});
    paper('旧砖红细带', '#b9745a', [272, 309, 24, 140], {montageRole:'color', montageColor:1, grain: true, opacity: 75});
    paper('左侧旧红纸片', '#c78a6a', [96, 490, 113, 39], {montageRole:'color', montageColor:1, grain: true, opacity: 75});
    photo(silhouettes[0] || city.tree, '跨界阔冠树', [92, 93, 435, 338], {montageRole:'accent', montageSlot:0});
    fragment('hillside', '上右山城细条', [379, 354, 40, 170], {focusX:.72});
    fragment('court', '右侧建筑长条', [422, 393, 41, 129], {focusX:.25});
    fragment('stone', '最右石墙窄条', [466, 447, 13, 125], {focusX:.32});
    paper('中缝密纹碎片', '#e8e4d7', [274, 423, 24, 88]);
    fragment('roofs', '中缝屋顶短片', [275, 448, 22, 42], {focusX:.10});
    fragment('hillside', '中心民居竖片', [299, 428, 46, 146], {focusX:.44});
    paper('左中台阶色块', '#b99a61', [215, 428, 58, 76], {montageRole:'color', montageColor:0, grain: true});
    paper('右中旧红纸片', '#bf795f', [346, 430, 29, 119], {montageRole:'color', montageColor:1, grain: true, opacity: 82});
    fragment('arcades', '左下柱廊大块', [80, 489, 114, 229], {focusX:.32});
    fragment('pavement', '左中街道', [195, 498, 100, 220], {focusX:.41});
    fragment('roofs', '左下窄幅屋顶', [204, 719, 65, 33], {focusY:.53});
    fragment('street', '中心石板巷', [320, 503, 98, 209], {focusX:.68});
    fragment('court', '右中住宅截面', [422, 523, 40, 82], {focusX:.67});
    fragment('stone', '右下石墙长条', [422, 602, 40, 160], {focusX:.52});
    fragment('church', '右侧钟楼大块', [480, 430, 92, 236], {mask: 'polygon', points: [[0,.489],[.095,.522],[.159,.51],[.176,.46],[.215,.417],[.239,.423],[.277,.403],[.288,.251],[.262,.187],[.327,.153],[.36,.118],[.437,.085],[.482,.045],[.488,.008],[.537,.008],[.55,.046],[.589,.088],[.655,.102],[.723,.151],[.769,.186],[.743,.231],[.736,.402],[.804,.417],[.85,.483],[.898,.511],[1,.515],[1,1],[0,1]], focusX:.55});
    fragment('hillside', '左中细小建筑切片', [194, 493, 18, 94], {focusX:.86, opacity:65});
    fragment('roofs', '中央浅灰接缝', [298, 541, 25, 116], {focusX:.12, opacity:42});
    fragment('stone', '右边淡灰碎片', [464, 576, 16, 94], {opacity:46});
    fragment('court', '赭金边缘的石墙碎片', [265, 594, 19, 47], {opacity:37});
    fragment('hillside', '右侧微缩屋顶', [448, 547, 14, 33], {opacity:64});
    paper('下垂赭金长条', '#bd9d61', [272, 661, 24, 113], {montageRole:'color', montageColor:0, grain: true});
    paper('浅灰建筑细线', '#b8b3a6', [164, 661, 105, 1], {montageRole:'detail', opacity:58});
    paper('右侧竖向分界线', '#aaa698', [461, 484, 1, 150], {montageRole:'detail', opacity:55});
    drawing.push(Collage.label('·  ·  ·  ·\n·  ·  ·  ·\n·  ·  ·  ·\n·  ·  ·  ·', '#524d45', ...box([300, 553, 19, 47]), 0,
      {montageRole:'detail', name:'浅灰点阵', mono: true, opacity: 55}));
    photo(silhouettes[1] || city.walker, '下部行人', [315, 644, 56, 153], {montageRole:'accent', montageSlot:1});
    return drawing;
  }

  function layout(id, materials = null, seed = 0, amount = 0) {
    if (id === 'city-canopy') return cityMontage(materials);
    const design = byId.get(id);
    if (design.group === FilmFrames.group.id) return FilmFrames.layout(design,materials?.[0]);
    if (design.group === 'montage') {
      const layers = MontageArt.layout(id);
      return materials?.length ? MontageArt.compose(layers,{...MontageArt.defaults,theme:id,shape:id},materials,
        assetId=>assetById.get(assetId)) : layers;
    }
    const drawing = [];
    const random = Collage.random(seed);
    const movement = amount / 100;
    const units = design.aspect === 'journal' ? 1600 : 1200;
    const assets = materials ? [...materials] : demo[id];
    if (materials && design.group === 'garden') {
      assets.sort((a, b) => Number(a.kind === 'cutout') - Number(b.kind === 'cutout'));
    }
    const box = ([left, top, w, h]) => [
      (left + w / 2) * 1200, (top + h / 2) * 800, w * 1200, h * units
    ];
    const shift = ([left, top, w, h], value = .025) => [
      left + (random() - .5) * movement * value, top + (random() - .5) * movement * value, w, h
    ];
    const photo = (index, rect, properties = {}, wiggle) => {
      const asset = assets[index];
      if (!asset) return;
      const slot = design.slots[index];
      drawing.push(Collage.photo(asset, ...box(wiggle ? shift(rect, wiggle) : rect),
        {mask: 'rect', ...(slot && {name: slot + ' · ' + asset.name, slot}), ...properties}));
    };
    const paper = (name, fill, rect, rotation = 0, properties = {}) => {
      drawing.push(Collage.paper(name, fill, ...box(rect), 'rect', rotation, properties));
    };
    const text = (letters, fill, rect, properties = {}, rotation = 0) => {
      drawing.push(Collage.label(letters, fill, ...box(rect), rotation, properties));
    };
    const note = (letters, rect, rotation = 0) =>
      text(letters, '#272b20', rect, {style: 'brush', align: 'left'}, rotation);
    const margin = (letters, rect, align = 'left', color = '#666653') =>
      text(letters, color, rect, {mono: true, align});

    if (id === 'field-notes') {
      photo(0, [0, 0, 1, .392]);
      paper('纸面分界', '#d9d4c1', [.078, .434, .849, .0014]);
      margin('FIELD NOTES   /   EARLY LIGHT', [.078, .404, .54, .025]);
      margin('A WALK IN THE HILLS', [.66, .404, .266, .025], 'right');
      photo(1, [.079, .482, .308, .156], {}, .025);
      paper('半透明胶带', '#d9c7a0', [.157, .465, .155, .024], -7, {opacity: 73});
      note('山雨刚歇\n松风从石上过', [.452, .473, .430, .139], -4);
      margin('1 / STREAM STUDY', [.08, .653, .34, .023]);
      photo(2, [.443, .690, .467, .218], {}, .03);
      note('水声留在\n页角', [.086, .713, .322, .116], 4);
      margin('FIELD OBSERVATIONS', [.083, .908, .36, .022]);
      margin('2 / HIGH RIDGE', [.446, .922, .46, .022], 'right');
    } else if (id === 'yellow-pass') {
      note('去有风的地方', [.236, .067, .63, .102], -5);
      margin('TRAVEL LOG\nMOUNTAIN PASS\nA QUIET MORNING', [.055, .197, .26, .050]);
      paper('浅黄票根', '#f0d858', [.193, .253, .614, .494], -4);
      photo(0, [.209, .273, .594, .438], {}, .018);
      paper('深绿小纸片', '#283e36', [.095, .547, .192, .159], 3);
      photo(1, [.106, .558, .167, .138], {}, .020);
      paper('蓝色票根', '#32595d', [.593, .681, .219, .106], 2);
      photo(2, [.612, .687, .188, .090], {}, .022);
      note('把风折进\n这张票里', [.239, .808, .52, .127], 3);
      margin('ROUTE / HILLSIDE\nWEATHER / SUN AND RAIN', [.052, .940, .275, .043]);
      margin('ONE AFTERNOON\nFIELD RECORD', [.713, .857, .229, .062], 'right');
    } else if (id === 'garden-window') {
      const foreground = materials
        ? (() => {
          const transparent = assets.findIndex(asset => asset.kind === 'cutout');
          return transparent >= 0 && assets.length > 1 ? transparent : assets.length > 3 ? 3 : -1;
        })() : 3;
      const windows = assets.map((_, i) => i).filter(i => i !== foreground);
      const slots = ['上左园林', '中右灯窗', '下方倒影'];
      const rectangles = [[.083, .098, .518, .474], [.478, .427, .459, .415], [.130, .623, .351, .233]];
      windows.slice(0, 3).forEach((index, order) => photo(index, rectangles[order],
        {name: slots[order] + ' · ' + assets[index].name, slot: slots[order]}, .024));
      if (foreground >= 0) photo(foreground, [.270, .460, .238, .496],
        {rotation: -11, fit: 'contain', name: '跨缝前景 · ' + assets[foreground].name, slot: '跨缝前景'}, .04);
      margin('AFTER THE RAIN', [.694, .171, .241, .025], 'right', '#aaa390');
    } else {
      const moving = materials ? (assets.findIndex(asset => asset.kind === 'cutout')) : 2;
      const windows = assets.map((_, i) => i).filter(i => i !== moving);
      const movementIndex = moving < 0 || assets.length === 1 ? -1 : moving;
      photo(movementIndex === -1 ? 0 : windows[0], [.105, .096, .378, .651], {}, .018);
      photo(windows[1], [.554, .263, .377, .646], {}, .025);
      if (movementIndex >= 0) {
        const flow = [
          [.260, .792, .273, .173, -16], [.430, .723, .215, .147, 22],
          [.477, .590, .258, .175, -68], [.398, .492, .170, .118, -25],
          [.430, .392, .167, .108, -57], [.533, .347, .137, .100, -14],
          [.619, .275, .127, .083, -39], [.669, .218, .101, .075, -60],
          [.701, .157, .087, .061, -36]
        ];
        for (const [left, top, w, h, rotation] of flow) {
          photo(movementIndex, [left, top, w, h],
            {rotation, fit: 'contain', name: '沿曲线的透明元素 · ' + assets[movementIndex].name, slot: '动线元素'}, .035);
        }
      } else if (windows.length > 2) photo(windows[2], [.408, .648, .238, .218], {}, .02);
      margin('A POND IN SHADOW', [.117, .810, .269, .032], 'left', '#a79775');
    }

    if (materials) {
      const used = new Set(drawing.filter(layer => layer.kind === 'photo').map(layer => layer.asset));
      const extra = assets.map((asset, index) => used.has(asset.id) ? null : index).filter(index => index !== null);
      for (const [order, index] of extra.entries()) {
        const top = .88 + Math.floor(order / 8) * .055;
        const left = .07 + (order % 8) * .108;
        photo(index, [left, top, .094, .052]);
      }
    }
    return drawing;
  }

  return {groups, designs, library, byId, layout};
})();
