const zoneDay = new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Berlin', year:'numeric', month:'2-digit', day:'2-digit' });
export function day(timestamp) {
  const parts = Object.fromEntries(zoneDay.formatToParts(new Date(timestamp * 1000)).map(p => [p.type, p.value]));
  return [parts.year, parts.month, parts.day].join('-');
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
async function fetchJson(fetcher, url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetcher(url, {...options, signal:controller.signal});
    if (!response.ok) throw new Error('Source HTTP ' + response.status);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function smardPrices(fetcher, start, end) {
  const base = 'https://www.smard.de/app/chart_data/4169/DE/';
  const {timestamps} = await fetchJson(fetcher, base+'index_quarterhour.json');
  const noon = date => Date.parse(date+'T12:00:00Z');
  const weeks = [start, end].map(date => Math.max(...timestamps.filter(t => t <= noon(date))));
  const periods = await Promise.all([...new Set(weeks)].map(week =>
    fetchJson(fetcher, base+'4169_DE_quarterhour_'+week+'.json')));
  const rows = periods.flatMap(data => data.series).filter(([ms]) => {
    const delivery = day(ms/1000);
    return delivery >= start && delivery <= end;
  });
  return normalize({unix_seconds:rows.map(r=>r[0]/1000), price:rows.map(r=>r[1]),
    unit:'EUR / MWh', license_info:'CC BY 4.0'});
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
    const result = await fetchJson(fetcher, env.DBX_HOST+'/api/2.0/sql/statements', {
      method:'POST', headers:{Authorization:'Bearer '+env.DBX_TOKEN,'Content-Type':'application/json'},
      body: JSON.stringify({warehouse_id:env.DBX_WAREHOUSE_ID,wait_timeout:'10s',on_wait_timeout:'CANCEL',
        statement:'SELECT start_epoch, eur_mwh FROM '+table+" WHERE zone = 'DE-LU' AND delivery_date BETWEEN :start AND :end ORDER BY start_epoch LIMIT 221",
        parameters:[{name:'start',value:start,type:'DATE'},{name:'end',value:end,type:'DATE'}]})});
    if (result.status?.state !== 'SUCCEEDED') throw new Error('Warehouse query failed');
    const rows = result.result?.data_array ?? [];
    intervals = normalize({unit:'EUR / MWh',license_info:'CC BY 4.0',unix_seconds:rows.map(r=>Number(r[0])),price:rows.map(r=>r[1]===null?null:Number(r[1]))});
    source = 'Databricks SQL';
  } else {
    const query = new URLSearchParams({bzn:'DE-LU',start,end});
    const energyCharts = 'https://api.energy-charts.info';
    const upstreamOptions = {cache:'no-store'};
    const sources = [
      ['Energy-Charts v2', async () => {
        const payload = await fetchJson(fetcher, energyCharts+'/v2/price?'+query, upstreamOptions);
        if (payload.bidding_zone !== 'DE-LU' || payload.interval_minutes !== 15 || !Array.isArray(payload.data)) {
          throw new Error('Unexpected quarter-hour price feed');
        }
        return normalize({
          unix_seconds: payload.data.map(row => Date.parse(row.timestamp)/1000),
          price: payload.data.map(row => row.values?.day_ahead_price),
          unit: payload.unit,
          license_info: payload.license,
        });
      }],
      ['Energy-Charts', async () =>
        normalize(await fetchJson(fetcher, energyCharts+'/price?'+query, upstreamOptions))],
      ['SMARD', () => smardPrices(fetcher, start, end)],
    ];
    const failures = [];
    for (const [name, read] of sources) {
      try {
        const rows = await read();
        if (!rows.some(row => row.start+900 > now/1000)) throw new Error('No current prices');
        intervals = rows;
        source = name;
        break;
      } catch (error) {
        failures.push(name+': '+error.message);
      }
    }
    if (!intervals) throw new Error(failures.join('; '));
  }
  if (!intervals.some(x=>x.start+900>now/1000)) throw new Error('No current prices');
  return {intervals,source,checkedAt:new Date(now).toISOString()};
}
