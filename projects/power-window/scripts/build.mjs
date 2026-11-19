import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
const assets={};
for(const [file,type] of [['index.html','text/html; charset=utf-8'],['style.css','text/css'],['app.js','text/javascript'],['planner.js','text/javascript']]){
  assets[file==='index.html'?'/':'/'+file]={type,body:await readFile('web/'+file,'utf8')};
}
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
const prices=(await readFile('worker/prices.js','utf8')).replaceAll('export ','');
const handler=(await readFile('worker/index.js','utf8')).replace(/^import .*;$/gm,'');
await writeFile('dist/server/index.js','const assets = '+JSON.stringify(assets)+';\n'+prices+'\n'+handler);
