import {cpSync,copyFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{cwd:new URL('./vendor/pikado/',import.meta.url),stdio:'inherit'});
cpSync(new URL('./vendor/pikado/dist/',import.meta.url),new URL('./editor/',import.meta.url),{recursive:true});
copyFileSync(new URL('./vendor/pikado/LICENSE',import.meta.url),new URL('./editor/LICENSE.txt',import.meta.url));
copyFileSync(new URL('./vendor/pikado/node_modules/libheif-js/LICENSE',import.meta.url),new URL('./editor/libheif-LICENSE.txt',import.meta.url));
