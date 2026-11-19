import {windowsFor, parsePower} from './planner.js';
const el=id=>document.getElementById(id);
const format=(options)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',...options});
const clock=format({hour:'2-digit',minute:'2-digit'}), fullClock=format({hour:'2-digit',minute:'2-digit',timeZoneName:'shortOffset'});
const delivery=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'});
const euros=new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:2});
const day=t=>delivery.format(t*1000);
let data, rows=[],best;
function draw(){
  const canvas=el('plot'), width=canvas.clientWidth, height=150,ratio=window.devicePixelRatio||1;
  canvas.width=width*ratio;canvas.height=height*ratio;
  const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);if(!rows.length)return;
  const high=Math.max(0,...rows.map(r=>r.price)),low=Math.min(0,...rows.map(r=>r.price));
  const y=p=>height-6-(p-low)/(high-low||1)*(height-12);
  const from=rows[0].start,span=rows.at(-1).start+900-from;
  for(const r of rows){ctx.fillStyle=best&&r.start>=best.start&&r.start<best.end?'#497a18':'#73a69b';ctx.fillRect((r.start-from)/span*width,Math.min(y(r.price),y(0)),Math.max(1,900/span*width-1),Math.max(1,Math.abs(y(r.price)-y(0))));}
}
function render(){
  const valid = parsePower(el('power').value) !== null;
  el('power').setAttribute('aria-invalid', String(!valid));
  el('power-help').textContent = valid ? 'Up to 2 decimal places. Use 1.25 or 1,25.' : 'Enter a positive number with up to 2 decimal places and no thousands separators.';
  if(!data)return;
  const date=el('date').value, mins=Number(el('duration').value),kw=parsePower(el('power').value);
  rows=data.intervals.filter(r=>day(r.start)===date);
  const choices=windowsFor(rows,mins,Date.now()/1000,date,day,Number(el('deadline').value) || Infinity);
  el('comparison').hidden=true;
  best=choices[0];el('metrics').replaceChildren();el('detail').textContent='';
  el('best').textContent=best?clock.format(best.start*1000)+' – '+clock.format(best.end*1000):'No available window';
  if(best){
    el('detail').textContent=fullClock.format(best.start*1000)+' to '+fullClock.format(best.end*1000)+' · '+date;
    const metrics=[[(best.average/10).toFixed(2)+' ct/kWh','Average market price']];
    const cost = kw * ((best.average / 1000) * (mins / 60));
    if (valid && Number.isFinite(cost)) {
      metrics.push([euros.format(cost), 'Wholesale energy cost']);
      const first = choices.reduce((a,b)=>a.start<b.start?a:b);
      const saving = (first.average-best.average)/1000*(mins/60)*kw;
      const comparison = el('comparison');
      if (Number.isFinite(saving)) {
        comparison.textContent = first.start === best.start ? 'The earliest available start is already the cheapest.' :
          'Save '+euros.format(saving)+' in wholesale energy compared with starting at '+fullClock.format(first.start*1000)+'.';
        comparison.hidden = false;
      }
    } else if (valid) {
      el('detail').textContent += ' · The cost is too large to display.';
    }
    for(const [value,label] of metrics){const metric=document.createElement('div'),b=document.createElement('b');metric.className='metric';b.textContent=value;metric.append(b,label);el('metrics').append(metric);}
  }else el('detail').textContent='Try a later finish time, a shorter run or another published day.';
  el('rows').replaceChildren(...rows.map(r=>{const tr=document.createElement('tr');for(const v of [fullClock.format(r.start*1000),(r.price/10).toFixed(2)]){tr.insertCell().textContent=v;}return tr;}));
  el('axis').replaceChildren(...[rows[0],rows.at(-1)].filter(Boolean).map(r=>{const s=document.createElement('span');s.textContent=clock.format(r.start*1000);return s;}));draw();
}
async function load(){
  if(el('refresh').disabled)return;
  el('refresh').disabled=true;
  try{
    const res=await fetch('/api/prices',{cache:'no-cache'});if(!res.ok)throw Error();
    data=await res.json();const before=el('date').value,days=[...new Set(data.intervals.map(r=>day(r.start)))];
    el('date').replaceChildren(...days.map(d=>new Option(d,d)));if(days.includes(before))el('date').value=before;else el('deadline').value='';
    updateDeadlines();
    el('status').textContent=data.source+' · Checked '+fullClock.format(new Date(data.checkedAt))+' · All times Europe/Berlin. Only published intervals are shown.';render();
  }catch{el('status').textContent=data?'Refresh failed. Showing prices from '+new Date(data.checkedAt).toLocaleString()+'.':'The market feed is unavailable. Refresh to try again.';if(!data)el('best').textContent='Prices unavailable';}
  finally{el('refresh').disabled=false;}
}
function updateDeadlines() {
  const select = el('deadline');
  const previous = select.value;
  const previousLabel = select.selectedOptions[0]?.textContent;
  const date = el('date').value;
  const ends = data.intervals.filter(r=>day(r.start)===date && r.start+900>Date.now()/1000)
    .map(r=>r.start+900);
  const options = ends.map(end=>new Option(fullClock.format(end*1000), String(end)));
  if (previous && !ends.includes(Number(previous))) options.push(new Option(previousLabel, previous));
  select.replaceChildren(new Option('End of delivery day',''), ...options);
  select.value = previous;
}

const settingsKey = 'power-window.run-settings';
try {
  const saved = JSON.parse(localStorage.getItem(settingsKey));
  if (parsePower(saved?.power) !== null) el('power').value = saved.power;
  if ([...el('duration').options].some(o=>o.value===saved?.duration)) el('duration').value=saved.duration;
} catch { /* Storage can be unavailable in private browsing. */ }
for (const id of ['power','duration']) el(id).addEventListener('input',()=>{
  if (parsePower(el('power').value) !== null) {
    try {
      localStorage.setItem(settingsKey,JSON.stringify({power:el('power').value,duration:el('duration').value}));
    } catch { /* The planner also works without storage. */ }
  }
  render();
});
el('date').addEventListener('change',()=>{
  el('deadline').value='';
  updateDeadlines();
  render();
});
el('deadline').addEventListener('change',render);
el('refresh').onclick=load;
window.addEventListener('resize',draw);setInterval(render,30000);setInterval(load,300000);load();
