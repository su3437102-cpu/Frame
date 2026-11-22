export const Collage = (() => {
  const designs = [
    {
      id: 'dada', name: '达达解构', title: '错版练习', work: '《用厨房刀切割》', artist: '汉娜·赫赫 · 1919',
      image: 'ref-hoch', source: 'https://search.smb.museum/object/obj-961048', imageSource: 'https://smarthistory.org/hannah-hoch-cut-kitchen-knife-dada-weimar-beer-belly-germany/',
      analysis: '赫赫把报刊人像、机械零件和印刷字母摆在一起。悬殊的比例和交错的阅读方向，让熟悉的符号突然失序。',
      rule: '放大一片当主角，用倾斜纸片穿过画面，再把小而亮的碎片插入空隙。',
      action: '一大一小，保留斜向冲突与醒目的强调色。',
      background: '#e8dcc1', palette: ['#f24d23', '#24201c', '#c4ad82', '#e9d5aa']
    },
    {
      id: 'cubist', name: '立体纸构', title: '斜面与回声', work: '《吉他》', artist: '巴勃罗·毕加索 · 1913',
      image: 'ref-picasso', source: 'https://www.moma.org/collection/works/38359', imageSource: 'https://www.moma.org/collection/works/38359',
      analysis: '报纸、墙纸与炭笔线条在同一平面上指向不同物体。看似无关的碎片彼此遮挡，逐步拼出一把吉他的轮廓。',
      rule: '用两三张偏暖的纸片交叠，让相邻切边互相接续，再用一个圆面打断直线。',
      action: '用暖色斜切面相互遮挡，让轮廓在缝隙里出现。',
      background: '#d5bb96', palette: ['#b5744b', '#322622', '#ece0c3', '#9d9f85']
    },
    {
      id: 'cutout', name: '色块剪纸', title: '折返的颜色', work: '《蜗牛》', artist: '亨利·马蒂斯 · 1953',
      image: 'ref-matisse', source: 'https://www.tate.org.uk/art/artworks/matisse-the-snail-t00540', imageSource: 'https://www.museumsmadeeasy.com/tate-modern-highlights',
      analysis: '马蒂斯用近似螺旋的动线组织粗剪的彩纸，色块的重量和相邻色的反差，让视线沿着留白转弯。',
      rule: '让色纸围着偏心的空白转弯。交替安排冷暖与大小，留出能看见底纸的间距。',
      action: '用大色块和明显间距，沿偏心环线组织视线。',
      background: '#f2e7cf', palette: ['#ee5931', '#293da0', '#edb934', '#53785c', '#652b63', '#26241d']
    },
    {
      id: 'montage', name: '街区蒙太奇', title: '街面切片', work: '《鸽子》', artist: '罗马尔·比尔登 · 1964',
      image: 'ref-bearden', source: 'https://www.moma.org/collection/works/36572', imageSource: 'https://www.moma.org/collection/works/36572',
      analysis: '比尔登让人物、门窗和街道的碎片以不同尺度出现。建筑线条提供连续性，突然放大的局部打断街景节奏。',
      rule: '把大的灰阶纹理铺成底层，用矩形碎片重复垂直边线，只让少数前景突破边界。',
      action: '用矩形影像建立街景结构，再让近景片段打破它。',
      background: '#d8d2c4', palette: ['#242623', '#f2e9d4', '#b39e77', '#777668', '#a33122']
    }
  ];

  const library = [
    {id: 'head', name: '大理石头像', file: 'head.webp', source: 'https://www.metmuseum.org/art/collection/search/468716'},
    {id: 'bridge', name: '吊桥版画', file: 'bridge.webp', source: 'https://www.metmuseum.org/art/collection/search/337060'},
    {id: 'wave', name: '神奈川冲浪里', file: 'wave.webp', source: 'https://www.metmuseum.org/art/collection/search/45434'},
    {id: 'horse', name: '运动摄影', file: 'horse.webp', source: 'https://www.metmuseum.org/art/collection/search/266439'}
  ];

  let nextId = 0;
  const uid = () => ++nextId;
  const base = (kind, name, x, y, w, h, props) => ({
    id: uid(), kind, name, x, y, w, h, rotation: 0, scale: 100,
    opacity: 100, mask: 'rect', blend: 'source-over', tone: 'original', hidden: false, ...props
  });
  const paper = (name, color, x, y, w, h, mask = 'rect', rotation = 0, extra) =>
    base('paper', name, x, y, w, h, {color, mask, rotation, ...extra});
  const photo = (asset, x, y, w, h, props) =>
    base('photo', asset.name, x, y, w, h, {
      asset: asset.id, ...props,
      ...(asset.kind === 'cutout' ? {fit: 'contain', mask: 'rect'} : {})
    });
  const label = (text, color, x, y, w, h, rotation = 0, props) =>
    base('type', text.replaceAll('\n', ' / '), x, y, w, h, {text, color, rotation, ...props});
  const print = (text, color, x, y, w, rotation = 0) =>
    label(text, color, x, y, w, 30, rotation, {mono: true});

  function random(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function sample(id) {
    const [head, bridge, wave, horse] = library;
    switch (id) {
      case 'cubist': return [
        paper('深褐底片', '#55352a', 650, 412, 1045, 580, 'cut', -9),
        paper('纸板', '#b7774b', 815, 415, 580, 625, 'tear', 13, {grain: true}),
        photo(bridge, 429, 434, 520, 595, {mask: 'cut', rotation: -21, tone: 'warm', opacity: 90}),
        paper('灰绿棱面', '#838d75', 844, 289, 360, 283, 'cut', -14, {grain: true}),
        photo(wave, 776, 533, 575, 358, {mask: 'cut', rotation: -17, tone:'warm', opacity: 91}),
        paper('浅色圆面', '#e5cc9e', 660, 375, 295, 295, 'circle', 0, {grain: true}),
        paper('音孔', '#2d221d', 659, 375, 124, 124, 'circle'),
        photo(horse, 451, 536, 443, 167, {mask: 'tear', rotation: 9, tone: 'mono', opacity: 90}),
        label('PLANES', '#f9ebce', 666, 645, 511, 105, -9),
        print('STUDY IN PAPER  /  02', '#34231d', 838, 742, 510, 0)
      ];
      case 'cutout': return [
        paper('橘红纸片', '#e95031', 612, 225, 510, 240, 'cut', 15, {grain: true}),
        paper('群青纸片', '#263d9b', 941, 427, 315, 410, 'cut', 29, {grain: true}),
        paper('金黄纸片', '#dfa62d', 708, 634, 454, 228, 'tear', -15, {grain: true}),
        paper('梅紫纸片', '#60275f', 410, 585, 231, 175, 'cut', 12, {grain: true}),
        paper('叶绿色纸片', '#487258', 280, 379, 253, 339, 'cut', -19, {grain: true}),
        photo(wave, 572, 474, 310, 266, {mask: 'cut', rotation: 15}),
        paper('圆形色纸', '#ed744b', 794, 374, 138, 138, 'circle', 0, {grain: true}),
        paper('深色碎片', '#26291f', 972, 625, 94, 88, 'cut', -23),
        label('CHROMA', '#25231d', 270, 111, 359, 82, -2),
        print('PAPER MOVES  /  03', '#2b281e', 946, 751, 392)
      ];
      case 'montage': return [
        photo(bridge, 601, 397, 1068, 663, {tone: 'mono', opacity: 75}),
        photo(wave, 862, 462, 590, 475, {tone: 'mono', mask: 'tear', rotation: -6}),
        paper('墨黑栏杆', '#242725', 371, 510, 603, 213, 'rect', -4, {grain: true}),
        photo(horse, 300, 583, 474, 220, {tone: 'mono', rotation: 4}),
        paper('朱红窗格', '#a33122', 934, 257, 312, 153, 'rect', 5, {grain: true}),
        photo(head, 734, 463, 391, 526, {tone: 'mono', fit: 'contain', rotation: -8}),
        label('STREET', '#f2e5c9', 373, 312, 504, 131, -3),
        paper('浅色底条', '#e8deca', 889, 691, 484, 59, 'tear', 4),
        print('FRAGMENTS OF A CITY  /  04', '#231e1a', 897, 690, 404, 4)
      ];
      default: return [
        paper('粗纤维纸', '#c4ae84', 312, 625, 587, 358, 'tear', -12, {grain: true, opacity: 82}),
        paper('黑色斜角', '#292623', 860, 617, 787, 243, 'cut', -13, {grain: true}),
        photo(wave, 924, 676, 605, 261, {mask: 'tear', rotation: -12, tone: 'mono', opacity: 87}),
        paper('朱红圆纸', '#ee4c25', 777, 355, 542, 542, 'circle', 0, {grain: true}),
        paper('同心印纹', '#252520', 777, 355, 592, 592, 'circle', 0, {ring: true, opacity: 64}),
        photo(bridge, 291, 580, 510, 321, {mask: 'tear', rotation: -11, tone: 'warm'}),
        label('CUT', '#231f1c', 270, 208, 402, 180, -7),
        label('PASTE', '#231f1c', 262, 355, 411, 139, -7),
        photo(head, 770, 372, 494, 600, {fit: 'contain', rotation: -9, tone: 'mono'}),
        paper('橙色纸带', '#e64a25', 854, 626, 403, 83, 'tear', -7, {grain: true}),
        print('ASSEMBLAGE / STUDY 01', '#231b15', 855, 622, 357, -7),
        paper('版号底纸', '#f1e4c7', 180, 709, 232, 54, 'tear', -5, {opacity: 96}),
        print('CUT & PASTE STUDIO', '#2c2822', 181, 709, 195, -5),
        print('FIG. A', '#2b2521', 1082, 87, 135, 0)
      ];
    }
  }

  function uploadLayout(style, assets, seed, amount) {
    const colors = style.palette;
    const rng = random(seed);
    const layers = [];
    const add = (...items) => layers.push(...items.filter(Boolean));
    const image = (i, x, y, w, h, mask, rotation, extra) => {
      const asset = assets[i];
      return asset ? photo(asset, x, y, w, h, {mask, rotation, ...extra}) : null;
    };
    const card = (i, x, y, w, h, mask, rotation, extra) =>
      paper('色纸', colors[i % colors.length], x, y, w, h, mask, rotation, {grain:true, ...extra});
    if (style.id === 'dada') {
      add(card(0, 738, 377, 600, 600, 'circle', 0), card(1, 425, 545, 705, 289, 'cut', -16),
        image(0, 760, 354, 626, 531, 'tear', -9),
        image(1, 335, 549, 492, 266, 'cut', 13, {tone:'mono'}),
        image(2, 295, 222, 298, 198, 'circle', -15),
        card(0, 864, 630, 425, 66, 'tear', -10));
    } else if (style.id === 'cubist') {
      add(card(1, 604, 415, 1005, 570, 'cut', -12), card(0, 820, 389, 640, 550, 'tear', 13),
        image(0, 435, 386, 544, 503, 'cut', -19, {tone:'warm'}),
        image(1, 784, 464, 493, 323, 'cut', 15, {tone:'warm', opacity:91}),
        card(2, 660, 319, 235, 235, 'circle', 0), image(2, 665, 539, 301, 221, 'tear', -12));
    } else if (style.id === 'cutout') {
      add(card(0, 582, 197, 502, 218, 'cut', 12), card(1, 916, 405, 297, 365, 'cut', 23),
        card(2, 679, 644, 444, 196, 'tear', -13), card(3, 303, 440, 251, 325, 'cut', -22),
        image(0, 611, 457, 326, 268, 'cut', 11), image(1, 255, 255, 210, 136, 'cut', -10),
        image(2, 949, 644, 182, 127, 'circle', 12), card(4, 414, 666, 124, 120, 'cut', 7));
    } else {
      add(image(0, 596, 398, 1081, 664, 'rect', 0, {tone:'mono', opacity:74}),
        card(0, 600, 470, 949, 172, 'rect', 0), card(4, 952, 281, 308, 214, 'rect', 0),
        image(1, 347, 524, 459, 349, 'rect', -3, {tone:'mono'}),
        image(2, 766, 375, 456, 450, 'rect', 5, {tone:'mono'}),
        image(3, 952, 621, 279, 152, 'tear', -4, {tone:'warm'}));
    }
    for (let i = style.id === 'montage' ? 4 : 3; i < assets.length; i++) {
      const x = 145 + rng() * 910;
      const y = 155 + rng() * 490;
      const w = 135 + rng() * 150;
      add(image(i, x, y, w, w * (0.53 + rng() * 0.34), ['tear','cut','rect'][i % 3],
        (rng() - 0.5) * 31, {opacity: 93, tone: style.id === 'montage' ? 'mono' : 'original'}));
    }
    return vary(layers, style.id, seed, amount);
  }

  function vary(layers, id, seed, amount) {
    const rng = random(seed);
    const intensity = amount / 100;
    const range = id === 'montage' ? 0.53 : 1;
    return layers.map(layer => {
      const move = layer.kind === 'type' ? 0.48 : 1;
      return {
        ...layer,
        x: layer.x + (rng() - .5) * 238 * intensity * range * move,
        y: layer.y + (rng() - .5) * 166 * intensity * range * move,
        rotation: layer.rotation + (rng() - .5) * 61 * intensity * range * move,
        scale: Math.round(layer.scale * (1 + (rng() - .5) * .62 * intensity * move))
      };
    });
  }

  return {designs, library, random, sample, uploadLayout, vary, paper, photo, label, uid};
})();
