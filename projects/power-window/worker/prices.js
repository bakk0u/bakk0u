const zoneDay = new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Berlin', year:'numeric', month:'2-digit', day:'2-digit' });
export function day(timestamp) {
  return zoneDay.format(new Date(timestamp * 1000));
}
export function normalize(payload) {
  const {unix_seconds: starts, price: prices} = payload;
  if (!Array.isArray(starts) || !Array.isArray(prices) || starts.length !== prices.length ||
      starts.length > 220 || payload.unit !== 'EUR / MWh' || !/CC BY 4.0/.test(payload.license_info)) {
    throw new Error('Unexpected price feed');
  }
  const intervals = [];
  for (let i=0; i<starts.length; i++) {
    const t = starts[i], p = prices[i];
    if (!Number.isSafeInteger(t) || t % 900 || (i && t <= starts[i-1])) throw new Error('Invalid delivery time');
    if (p === null) continue;
    if (!Number.isFinite(p)) throw new Error('Invalid price');
    intervals.push({start:t, price:p});
  }
  return intervals;
}
export async function readPrices(env, now = Date.now(), fetcher = fetch) {
  const start = day(now/1000);
  const end = new Date(Date.parse(start+'T12:00:00Z')+86400000).toISOString().slice(0,10);
  const hasWarehouse = [env.DBX_HOST,env.DBX_TOKEN,env.DBX_WAREHOUSE_ID,env.DBX_INTERVAL_TABLE].some(Boolean);
  let intervals, source;
  if (hasWarehouse) {
    const table = env.DBX_INTERVAL_TABLE || '';
    if (!/^[a-zA-Z_]\w*\.[a-zA-Z_]\w*\.[a-zA-Z_]\w*$/.test(table) ||
        !/^https:\/\/[a-z0-9.-]+$/i.test(env.DBX_HOST) || !env.DBX_TOKEN || !env.DBX_WAREHOUSE_ID) throw new Error('Warehouse configuration incomplete');
    const res = await fetcher(env.DBX_HOST+'/api/2.0/sql/statements', {
      method:'POST', headers:{Authorization:'Bearer '+env.DBX_TOKEN,'Content-Type':'application/json'},
      body: JSON.stringify({warehouse_id:env.DBX_WAREHOUSE_ID,wait_timeout:'10s',on_wait_timeout:'CANCEL',
        statement:'SELECT start_epoch, eur_mwh FROM '+table+" WHERE zone = 'DE-LU' AND delivery_date BETWEEN :start AND :end ORDER BY start_epoch LIMIT 221",
        parameters:[{name:'start',value:start,type:'DATE'},{name:'end',value:end,type:'DATE'}]}),signal:AbortSignal.timeout(15000)});
    if (!res.ok) throw new Error('Warehouse unavailable');
    const result = await res.json();
    if (result.status?.state !== 'SUCCEEDED') throw new Error('Warehouse query failed');
    const rows = result.result?.data_array ?? [];
    intervals = normalize({unit:'EUR / MWh',license_info:'CC BY 4.0',unix_seconds:rows.map(r=>Number(r[0])),price:rows.map(r=>r[1]===null?null:Number(r[1]))});
    source = 'Databricks SQL';
  } else {
    const url = 'https://api.energy-charts.info/price?'+new URLSearchParams({bzn:'DE-LU',start,end});
    const res = await fetcher(url,{signal:AbortSignal.timeout(10000)});
    if (!res.ok) throw new Error('Price feed unavailable');
    intervals = normalize(await res.json());
    source = 'Energy-Charts';
  }
  if (!intervals.some(x=>x.start+900>now/1000)) throw new Error('No current prices');
  return {intervals,source,checkedAt:new Date(now).toISOString()};
}
