import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import fs from 'node:fs';
const dir=fileURLToPath(new URL('.',import.meta.url));fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:900}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const results=[];
const check=(name,ok,detail)=>{results.push({name,passed:!!ok,detail});if(!ok)console.error('FAIL',name,detail)};
const pause=()=>page.waitForTimeout(350);const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('framelab:r11:v1:desk')));
await page.goto('http://127.0.0.1:4311');await page.waitForFunction(()=>[...document.querySelectorAll('#world img')].every(i=>i.complete));
check('30 initial photo projects',await page.locator('#world .image').count()===30);
check('all photos loaded',await page.evaluate(()=>[...document.querySelectorAll('#world img')].every(i=>i.naturalWidth>0)));
await page.screenshot({path:dir+'/desktop-light.png'});
const p=page.locator('[data-id="project-0"]');let b=await p.boundingBox();let x=b.x+b.width/2,y=b.y+b.height/2;
await page.mouse.click(x,y);check('click selects',await p.evaluate(e=>e.classList.contains('selected')));
let left=await p.evaluate(e=>parseFloat(e.style.left));await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+100,y+30,{steps:8});await page.waitForTimeout(180);check('stationary held drag resets perspective',await p.evaluate(e=>e.style.getPropertyValue('--tilt'))==='0deg');await page.mouse.up();await pause();let moved=await p.evaluate(e=>parseFloat(e.style.left));check('drag maps screen to world',Math.abs(moved-left-100/.85)<1,{left,moved});
await page.keyboard.press('Control+z');await pause();check('undo restores position',Math.abs(await p.evaluate(e=>parseFloat(e.style.left))-left)<.1);
await page.keyboard.press('Control+Shift+z');await pause();check('redo restores move',Math.abs(await p.evaluate(e=>parseFloat(e.style.left))-moved)<.1);
b=await p.boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.keyboard.press('Delete');await pause();check('delete moves to trash',await page.locator('#world .image').count()===29);await page.keyboard.press('Control+z');await pause();check('undo restores deleted photo',await page.locator('#world .image').count()===30);
let before=await read(),bar=await page.locator('.topbar').boundingBox();await page.mouse.move(680,450);await page.keyboard.down('Control');await page.mouse.wheel(0,-200);await page.keyboard.up('Control');await pause();let after=await read();check('ctrl wheel zoom',after.camera.z>before.camera.z);check('zoom anchored pointer',Math.abs((602-before.camera.x)/before.camera.z-(602-after.camera.x)/after.camera.z)<.1);check('fixed topbar sizing',bar.height===(await page.locator('.topbar').boundingBox()).height);
await page.mouse.move(1020,800);await page.keyboard.down('Space');await page.mouse.down();await page.mouse.move(1090,830,{steps:5});await page.mouse.up();await page.keyboard.up('Space');await pause();let pan=await read();check('Space drag pans',Math.abs(pan.camera.x-after.camera.x-70)<1);
await page.mouse.move(1020,800);await page.mouse.down({button:'middle'});await page.mouse.move(1050,820,{steps:3});await page.mouse.up({button:'middle'});await pause();check('middle drag pans',Math.abs((await read()).camera.x-pan.camera.x-30)<1);
await page.locator('[data-action="home"]').first().click();await page.waitForTimeout(800);
await page.mouse.move(190,140);await page.mouse.down();await page.mouse.move(760,590,{steps:8});await page.mouse.up();check('blank drag marquee selects multiple',await page.locator('.object.selected').count()>1);
await page.keyboard.press('Escape');b=await p.boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);let size=await p.evaluate(e=>parseFloat(e.style.width));let h=await p.locator('.resize').boundingBox();await page.mouse.move(h.x+9,h.y+9);await page.mouse.down();await page.mouse.move(h.x+60,h.y+38,{steps:5});await page.mouse.up();await pause();check('corner resize changes size',await p.evaluate(e=>parseFloat(e.style.width))>size);
await page.locator('[data-action="more"]').click();await page.locator('[data-action="theme"]').click();check('dark theme toggles',await page.locator('body').evaluate(e=>e.classList.contains('dark')));await page.keyboard.press('Escape');await page.waitForTimeout(1600);await page.screenshot({path:dir+'/desktop-dark.png'});
await page.locator('[data-add="note"]').click();await pause();check('note creation',await page.locator('#world .note').count()===2);await page.locator('[data-action="edit"]').click();await page.locator('#editname').fill('QA note');await page.locator('#edittext').fill('Persistent note content');await page.locator('[data-save-object]').click();await pause();await page.reload();await page.waitForTimeout(300);check('reload persistence',await page.getByRole('group',{name:'QA note',exact:true}).count()===1);check('theme persists',await page.locator('body').evaluate(e=>e.classList.contains('dark')));
const downloaded=page.waitForEvent('download');await page.locator('[data-action="more"]').click();await page.locator('#popover [data-action="export"]').click();const dl=await downloaded;await dl.saveAs(dir+'/test-backup.json');check('backup JSON export',JSON.parse(fs.readFileSync(dir+'/test-backup.json','utf8')).version===1);
await page.locator('[data-action="more"]').click();await page.locator('#popover [data-action="theme"]').click();
for(const width of [320,375,390,414,768]){await page.setViewportSize({width,height:900});await page.waitForTimeout(150);check('no horizontal overflow '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(width===390||width===768)await page.screenshot({path:dir+`/viewport-${width}.png`})}
await page.setViewportSize({width:390,height:844});check('phone 30 projects',await page.locator('.mobilecard').count()===30);await page.locator('.mobilecard').first().click();check('phone project opens',await page.locator('dialog').evaluate(e=>e.open));await page.keyboard.press('Escape');
await page.setViewportSize({width:1440,height:900});
await page.locator('#fileinput').setInputFiles('assets/photo-0.jpg');await page.waitForTimeout(700);check('local photo upload',await page.locator('#world .image').count()===31);check('uploaded photo embedded for backup',(await read()).objects.some(o=>o.src?.startsWith('data:image/jpeg')));await page.keyboard.press('Control+z');await pause();
await page.locator('#backupinput').setInputFiles(dir+'/test-backup.json');await page.locator('#confirmImport').waitFor();check('import review shows before commit',await page.locator('dialog').evaluate(e=>e.open));const oldBackup=page.waitForEvent('download');await page.locator('#confirmImport').click();await oldBackup;await pause();check('validated backup restores objects',await page.locator('#world .image').count()===30);
await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);await context.setOffline(true);await page.reload();await page.waitForTimeout(500);check('offline reload',await page.locator('#world .image').count()===30);await context.setOffline(false);
check('zero JS runtime errors',errors.length===0,errors);fs.writeFileSync(dir+'/test-results.json',JSON.stringify({date:new Date().toISOString(),browser:browser.version(),results},null,2));await browser.close();console.log(JSON.stringify({passed:results.filter(r=>r.passed).length,total:results.length,failed:results.filter(r=>!r.passed)},null,2));





