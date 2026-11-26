import test from 'node:test';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {chromium,expect} = require('@playwright/test');
const base = process.env.FRAME_TEST_URL ?? 'http://127.0.0.1:4311';
const image = name => fileURLToPath(new URL('../assets/'+name,import.meta.url));
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

test('SpektraLab opens originals, develops on demand and compares both views', {timeout:60000}, async () => {
  const browser = await chromium.launch({executablePath:process.env.FRAME_TEST_CHROMIUM || (existsSync(chrome) ? chrome : undefined)});
  try {
    const context = await browser.newContext({viewport:{width:1280,height:800}});
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    context.on('request', request => requests.push(request.url()));
    page.on('pageerror',error => errors.push(error.message));
    await page.goto(base+'/ai-web/spektralab/index.html');
    await page.locator('#files').setInputFiles([image('photo-0.jpg'),image('photo-1.jpg')]);
    const start = page.getByRole('button',{name:'开始冲洗'});
    const compare = page.getByRole('button',{name:'并排对比'});
    await expect(page.getByRole('img',{name:'原始照片'})).toBeVisible();
    await expect(page.locator('#status')).toContainText('未冲洗');
    await expect(start).toBeEnabled();
    await expect(compare).toBeDisabled();
    // Selecting a stock before starting can change the recipe, but only the original is displayed.
    await page.getByRole('button',{name:'Kodak Gold 200',exact:true}).click();
    await page.getByRole('button',{name:'放大预览'}).click();
    await expect(page.locator('#zoom-value')).toHaveText(/%/);
    const zoom = await page.locator('#zoom-value').innerText();
    await page.getByRole('button',{name:'缩小预览'}).click();
    await expect(page.locator('#zoom-value')).not.toHaveText(zoom);
    await page.getByRole('button',{name:'向右旋转视图'}).click();
    await expect(page.locator('#original')).toHaveCSS('--view-rotation','90deg');
    await expect(page.locator('#preview')).toBeHidden();
    expect(requests.some(url=>url.includes('spektrafilm_wasm_bg.wasm'))).toBe(false);

    await start.click();
    await expect(compare).toBeEnabled({timeout:22000});
    await compare.click();
    const pair = page.getByRole('region',{name:'照片并排对照'});
    await expect(pair.getByText('原图',{exact:true})).toBeVisible();
    await expect(pair.getByText('冲洗成片',{exact:true})).toBeVisible();
    await expect(pair.locator('#original')).toBeVisible();
    await expect(pair.locator('#preview')).toBeVisible();
    await expect(pair.locator('#preview')).toHaveCSS('--view-rotation','90deg');
    await page.getByRole('button',{name:'向左旋转视图'}).click();
    await expect(pair.locator('#original')).toHaveCSS('--view-rotation','0deg');
    await expect(pair.locator('#preview')).toHaveCSS('--view-rotation','0deg');
    await page.getByRole('button',{name:'photo-1.jpg',exact:true}).click();
    await expect(page.locator('#status')).toContainText('未冲洗');
    await expect(start).toBeEnabled();
    await expect(pair).toBeHidden();
    await expect(page.locator('#original')).toBeVisible();
    await expect(page.locator('#preview')).toBeHidden();

    // The same tools are reachable in both modes and carry the photo's
    // settings across the mode switch. Geometry edits do not start development.
    const tools = page.getByRole('group',{name:'照片工具',exact:true});
    await expect(tools.getByRole('button',{name:'尺寸与方向'})).toBeVisible();
    await page.locator('#edit-tab').click();
    await expect(tools.getByRole('button',{name:'向右旋转视图'})).toBeVisible();
    await tools.getByRole('button',{name:'尺寸与方向'}).click();
    await page.locator('#output-size').selectOption('640');
    await page.locator('#turn').click();
    await expect(page.locator('#turn-value')).toHaveText('90°');
    await expect(page.locator('#original')).toHaveCSS('--view-rotation','90deg');
    await expect(page.locator('#preview')).toBeHidden();
    await page.locator('#develop-tab').click();
    await expect(page.locator('#output-size')).toBeVisible();
    await expect(page.locator('#output-size')).toHaveValue('640');
    await start.click();
    await expect(page.getByRole('button',{name:'导出',exact:true})).toBeEnabled({timeout:22000});
    await expect(page.locator('#preview')).toHaveCSS('--view-rotation','0deg');
    await page.getByRole('button',{name:'导出',exact:true}).click();
    await expect(page.locator('#export-size')).toHaveValue('640');
    const download = page.waitForEvent('download');
    await page.getByRole('button',{name:'导出照片',exact:true}).click();
    const png = await readFile(await (await download).path());
    const [width,height] = [png.readUInt32BE(16),png.readUInt32BE(20)];
    expect(Math.max(width,height)).toBeLessThanOrEqual(640);
    const sourceIsPortrait = await page.locator('#original').evaluate(img=>img.naturalHeight>img.naturalWidth);
    expect(height>width).not.toBe(sourceIsPortrait);
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});

test('SpektraLab presets apply the specified materials and render on the selected photo', {timeout:90000}, async () => {
  const browser = await chromium.launch({executablePath:process.env.FRAME_TEST_CHROMIUM || (existsSync(chrome) ? chrome : undefined)});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:800}});
    const presets = page.locator('#develop-preset');
    const apply = page.locator('#apply-preset');
    const start = page.locator('#develop-photo');
    const download = page.locator('#download');
    const stock = page.locator('#stock-info');
    await page.goto(base+'/ai-web/spektralab/index.html');
    await expect(presets).toBeDisabled();
    await page.locator('#files').setInputFiles([image('photo-0.jpg'), image('photo-1.jpg')]);
    await expect(presets).toBeEnabled();
    await page.locator('#crop-button').click();
    await page.locator('#output-size').selectOption('640');
    await page.locator('#turn').click();

    const expected = [
      ['日光人像','Portra 160','Portra Endura',56,2,2],
      ['街头纪实','Portra 400','Supra Endura',35,0,3],
      ['城市暮色','Pro 400H','Crystal Archive Type II',35,2,0],
      ['夜景电影','Vision3 500T','Vision 2383',35,2,3],
      ['黑白建筑','Acros II','Multigrade RC Deluxe',35,0,3],
      ['反转片风景','Velvia 100','直接扫描',35,0,4]
    ];
    for (const [index,[label,film,paper,format,shadows,blacks]] of expected.entries()) {
      await presets.selectOption({label});
      await expect(page.locator('#preset-materials')).toContainText(film);
      await apply.click();
      await expect(stock).toContainText(film);
      await expect(stock).toContainText(paper);
      await expect(page.locator(`[data-format="${format}"]`)).toHaveAttribute('aria-pressed','true');
      await expect(page.locator('#value-shadows')).toHaveValue(String(shadows));
      await expect(page.locator('#value-blacks')).toHaveValue(String(blacks));
      if (index === 0) {
        await expect(page.locator('#original')).toBeVisible();
        await expect(page.locator('#preview')).toBeHidden();
        await expect(page.locator('#status')).toContainText('未冲洗');
        await start.click();
      }
      await expect(download).toBeEnabled({timeout:20000});
    }
    await expect(page.locator('#output-size')).toHaveValue('640');
    await expect(page.locator('#turn-value')).toHaveText('90°');
    await page.getByRole('button',{name:'photo-1.jpg',exact:true}).click();
    await expect(stock).toContainText('Portra 400');
    await expect(page.locator('#value-blacks')).toHaveValue('0');
    await page.getByRole('button',{name:'photo-0.jpg',exact:true}).click();
    await expect(stock).toContainText('Velvia 100');
    await expect(page.locator('#value-blacks')).toHaveValue('4');
    await expect(page.locator('#preview')).toBeHidden();
  } finally {
    await browser.close();
  }
});
