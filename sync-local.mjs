import {mkdirSync,copyFileSync,cpSync,existsSync} from 'node:fs';
const target=new URL('../../outputs/FrameLab-R11/',import.meta.url);
const backup=new URL('../../outputs/R11-before-sync-'+new Date().toISOString().replace(/[:.]/g,'-')+'/',import.meta.url);
mkdirSync(backup,{recursive:true});mkdirSync(target,{recursive:true});
for(const name of ['app.js','interactions.js','ps-system.js','pikado-host.js','context-ui.js','context-ui.css','style.css','index.html','sw.js','server.mjs','PIKADO-INTEGRATION.md']){
 if(existsSync(new URL(name,target)))copyFileSync(new URL(name,target),new URL(name,backup));
 copyFileSync(new URL(name,import.meta.url),new URL(name,target));
}
if(existsSync(new URL('editor/',target)))cpSync(new URL('editor/',target),new URL('editor/',backup),{recursive:true});
cpSync(new URL('./editor/',import.meta.url),new URL('editor/',target),{recursive:true});
console.log('Local and LAN runtime updated:',target.pathname);
