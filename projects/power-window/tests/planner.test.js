import test from 'node:test';import assert from 'node:assert/strict';
import {normalize,readPrices,day} from '../worker/prices.js';import {windowsFor} from '../web/planner.js';
const feed={price:[5,-30,-10,0,2,3],unix_seconds:[0,900,1800,2700,3600,4500],unit:'EUR / MWh',license_info:'CC BY 4.0'};
test('negative prices and elapsed starts',()=>{const r=windowsFor(normalize(feed),30,901,day(0),day);assert.equal(r[0].start,1800);assert.equal(r[0].average,-5);});
test('gaps never become cheap windows',()=>{const rows=normalize({...feed,price:[null,-30,null,0,2,3]});assert.equal(windowsFor(rows,30,0,day(0),day)[0].start,2700);});
test('malformed feed is rejected',()=>{assert.throws(()=>normalize({...feed,price:[4]}));assert.throws(()=>normalize({...feed,unit:'USD'}));});
test('partial warehouse setup fails closed',async()=>{await assert.rejects(readPrices({DBX_TOKEN:'test'}),/configuration/);});
test('local midnight and DST overlap use actual elapsed time',()=>{const t=Date.parse('2026-10-25T00:30:00Z')/1000;const rows=[0,1,2,3].map(i=>({start:t+i*900,price:i}));assert.equal(windowsFor(rows,60,t,'2026-10-25',day)[0].end-t,3600);});
test('warehouse rows use the same price contract as the public feed',async()=>{
  const env={DBX_HOST:'https://example.test',DBX_TOKEN:'test',DBX_WAREHOUSE_ID:'example',DBX_INTERVAL_TABLE:'main.power_window.gold_market_intervals'};
  const saved=await readPrices(env,0,async(url,opts)=>{
    assert.equal(new URL(url).pathname,'/api/2.0/sql/statements');
    assert.equal(JSON.parse(opts.body).parameters[0].value,'1970-01-01');
    return Response.json({status:{state:'SUCCEEDED'},result:{data_array:[['0','-25.1'],['900','4.7']]}});
  });assert.deepEqual(saved.intervals,[{start:0,price:-25.1},{start:900,price:4.7}]);
});
test('primary feed outage reads actual quarter hours directly from SMARD', async()=>{
  const timestamp=Date.UTC(2026,10,19)/1000;
  const fetcher=async url=>{
    if(url.includes('energy-charts')) return new Response(null,{status:503});
    if(url.includes('index_quarterhour')) return Response.json({timestamps:[timestamp*1000-86400000]});
    return Response.json({series:[[timestamp*1000,167.53],[(timestamp+900)*1000,null]]});
  };
  const data=await readPrices({},timestamp*1000,fetcher);
  assert.equal(data.source,'SMARD');
  assert.deepEqual(data.intervals,[{start:timestamp,price:167.53}]);
});

test('power accepts decimal comma or point and up to two fractional digits', async () => {
  const {parsePower} = await import('../web/planner.js');
  for (const value of ['1000.25', '1000,25']) assert.equal(parsePower(value), 1000.25);
  assert.equal(parsePower(',01'), 0.01);
  for (const value of ['', '0', '-2', '1,000', '2.345', '1e3', '1.2,3', null])
    assert.equal(parsePower(value), null);
});

test('finish time is inclusive and can rule out a cheaper late run', () => {
  const rows = [50, 50, 0, 0].map((price,i)=>({start:i*900,price}));
  const plan = deadline=>windowsFor(rows,30,0,'today',()=> 'today',deadline);
  assert.equal(plan(3600)[0].start,1800);
  assert.equal(plan(1800)[0].start,0);
  assert.deepEqual(plan(1799),[]);
});

test('the live Worker reads current quarter-hour v2 prices in Berlin time', async () => {
  const now = Date.parse('2026-11-20T16:00:00+01:00');
  const data = await readPrices({}, now, async (url, options) => {
    assert.equal(new URL(url).pathname, '/v2/price');
    assert.equal(new URL(url).searchParams.get('start'), '2026-11-20');
    assert.equal(options.cache, 'no-store');
    return Response.json({
      bidding_zone: 'DE-LU', interval_minutes: 15, unit: 'EUR / MWh', license: 'CC BY 4.0',
      data: [
        {timestamp: '2026-11-20T16:15:00+01:00', values: {day_ahead_price: -15}},
        {timestamp: '2026-11-20T16:30:00+01:00', values: {day_ahead_price: null}},
      ],
    });
  });
  assert.equal(data.source, 'Energy-Charts v2');
  assert.deepEqual(data.intervals, [{start: now/1000+900, price: -15}]);
});
