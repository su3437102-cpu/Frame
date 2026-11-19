import './build-ai.mjs';
import {mkdirSync,cpSync,existsSync} from 'node:fs';
const target=new URL('../../outputs/FrameLab-R11/',import.meta.url);
const backup=new URL('../../outputs/R11-before-sync-'+new Date().toISOString().replace(/[:.]/g,'-')+'/',import.meta.url);
const paths=[
  'assets/', 'editor/', 'ai-web/', 'device-store.js', 'app.js', 'ai-color.js', 'ai-browser.js',
  'ai-service.mjs', 'ai-worker.py', 'interactions.js', 'ps-system.js', 'pikado-host.js',
  'context-ui.js', 'task-board.js', 'image-layout.js', 'context-ui.css', 'style.css',
  'grade-workbench.css', 'server.mjs', 'Start-R11.cmd', 'AI-COLOR-INTEGRATION.md',
  'PIKADO-INTEGRATION.md', 'sw.js', 'index.html',
];

mkdirSync(target,{recursive:true});
const existing=paths.filter(name=>existsSync(new URL(name,target)));
if(existing.length){
  mkdirSync(backup,{recursive:true});
  for(const name of existing)cpSync(new URL(name,target),new URL(name,backup),{recursive:true});
}

for(const name of paths){
  cpSync(new URL(name,import.meta.url),new URL(name,target),{
    recursive:true,
    filter:source=>!source.endsWith('.test.mjs'),
  });
}
console.log('Local runtime files prepared:',target.pathname);
