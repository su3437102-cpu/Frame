import test from 'node:test';
import {existsSync} from 'node:fs';
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
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});
