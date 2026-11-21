const sourceRevision = 'a1709044efe115640dde1dee17d4185fc059af0d';

export const OPEN_LUTS = [
  { id: 'slay-amber', name: 'slay Amber · 日落暖调', file: 'slay-01-amber.cube', description: '暖高光与柔和反差，适合黄昏地景和户外人像。' },
  { id: 'slay-fade', name: 'slay Fade · 哑光胶片', file: 'slay-02-fade.cube', description: '提起黑位，压低饱和与高光，适合街景和室内照片。' },
  { id: 'slay-neon', name: 'slay Neon · 城市霓虹', file: 'slay-03-neon.cube', description: '青色暗部与洋红高光，适合夜间街道与灯牌。' },
  { id: 'slay-portrait', name: 'slay Portrait · 柔暖人像', file: 'slay-05-portrait.cube', description: '偏暖的肤色与柔和高光，适合人物特写。' },
].map(look => ({
  ...look,
  url: new URL(look.file, import.meta.url).href,
  author: 'slay',
  authorUrl: 'https://www.slaycamera.com/',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  sourceUrl: `https://github.com/slaycamera/luts/blob/${sourceRevision}/luts/${look.file}`,
}));
