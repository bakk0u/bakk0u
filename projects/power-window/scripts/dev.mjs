import http from 'node:http';
import { spawnSync } from 'node:child_process';
const result=spawnSync(process.execPath,['scripts/build.mjs'],{stdio:'inherit'});
if(result.status!==0)process.exit(1);
const {default:worker}=await import('../dist/server/index.js');
const i=process.argv.indexOf('--port'),port=Number(process.env.PORT || (i>=0?process.argv[i+1]:5173));
http.createServer(async(req,res)=>{
  try{
    const response=await worker.fetch(new Request(new URL(req.url,'http://localhost'),{method:req.method}),process.env,{waitUntil(){}});
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end('Preview unavailable');}
}).listen(port,'0.0.0.0');
