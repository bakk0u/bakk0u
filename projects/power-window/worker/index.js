import {readPrices} from './prices.js';
import {assets} from './assets.js';
const json=(value,status=200,ttl=0)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':ttl?'public, max-age='+ttl:'no-store','X-Content-Type-Options':'nosniff'}});
export default {async fetch(req,env,ctx){
  const path=new URL(req.url).pathname;
  if(req.method!=='GET') return new Response('Method not allowed',{status:405,headers:{Allow:'GET'}});
  if(path==='/api/prices'){
    const key=new Request(new URL(path,req.url)),cache=globalThis.caches?.default;
    try{
      const saved=await cache?.match(key).catch(() => undefined);
      if(saved) return saved;
      const response=json(await readPrices(env),200,300);
      if(cache && ctx?.waitUntil) ctx.waitUntil(cache.put(key,response.clone()).catch(() => {}));
      return response;
    } catch (error) {console.warn("Price service:",error.name,String(error.message).slice(0,160));return json({error:'Current market prices are temporarily unavailable.'},503);}
  }
  const asset=assets[path];
  return asset ? new Response(asset.body,{headers:{'Content-Type':asset.type,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"}}) : new Response('Not found',{status:404});
}};
