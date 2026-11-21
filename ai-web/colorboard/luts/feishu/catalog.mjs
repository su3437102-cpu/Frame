const crop = name => new URL('../../assets/feishu-grade/crops/' + name + '.jpg', import.meta.url).href;
const table = name => new URL(name + '.cube', import.meta.url).href;
const reference = (file, label) => ({ src: crop(file), label });
const comparison = (id, title, analysis) => ({
  id, title, analysis, before: crop(id + '-before'), after: crop(id + '-after')
});

export const NIGHT_GLOW = Object.freeze({
  amount: 28, threshold: 81, radius: 49, warmth: 30, streak: 66, angle: 0
});

export const FEISHU_LOOKS = [
  {
    id: 'feishu-night-glow', name: '夜灯辉光', category: '夜景 · 光效',
    method: '辉光预设', cover: '07', glow: NIGHT_GLOW,
    description: '让柱廊灯和车尾灯向外溢出暖光，带出横向光带。',
    cases: [],
    references: [reference('07', '07 · 夜灯辉光参考')]
  },
  {
    id: 'feishu-subject-color', name: '主体留色', category: '主体 · 黑白背景',
    method: '框选蒙版', cover: '07',
    thumbnail: new URL('../../assets/feishu-grade/subject-color-preview.jpg', import.meta.url).href,
    subjectColor: true,
    description: '大致框住想保留颜色的物体，AI 沿边缘选出主体，背景变为黑白。',
    cases: [],
    references: [reference('07', '07 · 用黄色汽车练习框选')]
  },
  {
    id: 'feishu-golden-olive', file: 'golden-olive', name: '绿金窗光', category: '建筑 · 街景',
    method: '前后案例', strength: 100, cover: '03-after',
    description: '明部奶油黄，暗部带橄榄绿，适合有窗光或树荫的建筑。',
    cases: [comparison('03', '03 · 楼梯窗光', '墙面由冷白转为奶油黄，灰暗处偏青绿，窗边与叶片高光更亮。参考里的光晕属于局部效果。')],
    references: [reference('17-01', '17 · 楼梯'), reference('17-02', '17 · 走廊'), reference('17-03', '17 · 树影'), reference('17-04', '17 · 窗前'), reference('18', '18 · 街道逆光')]
  },
  {
    id: 'feishu-forest-clarity', file: 'forest-clarity', name: '深绿林光', category: '植物 · 森林',
    method: '前后案例', strength: 100, cover: '10-after',
    description: '压深树荫，拉开日照与阴影，突出自然黄绿色。',
    cases: [comparison('10', '10 · 草地与耳机', '原来的雾灰暗部被压深，草地的黄绿色更集中，逆光天空形成更强亮暗对比。参考里的柔焦和光晕属于局部效果。')],
    references: [reference('01', '01 · 林中亭'), reference('12', '12 · 林间廊道'), reference('13', '13 · 叶丛与彩蓝'), reference('15', '15 · 叶丛高光')]
  },
  {
    id: 'feishu-ice-cyan', file: 'ice-cyan', name: '冰青留色', category: '水景 · 冷调',
    method: '样本归纳', strength: 100, cover: '04',
    description: '保留青蓝水色，压低周围黄绿和暖色的饱和度，形成黑白衬底。',
    cases: [],
    references: [reference('02', '02 · 水面近景'), reference('04', '04 · 同一水景另一角度')]
  }
].map(look => ({
  ...look, cover: crop(look.cover), url: look.file ? table(look.file) : null,
  sourceCount: new Set([...look.cases.map(item => item.id), ...look.references.map(item => item.label.slice(0, 2))]).size
}));
