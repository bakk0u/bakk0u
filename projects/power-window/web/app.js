import {windowsFor} from './planner.js';
const el=id=>document.getElementById(id);
const format=(options)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',...options});
const clock=format({hour:'2-digit',minute:'2-digit'}), fullClock=format({hour:'2-digit',minute:'2-digit',timeZoneName:'shortOffset'});
const delivery=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'});
const euros=new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',minimumFractionDigits:3});
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
  if(!data)return;
  const date=el('date').value, mins=Number(el('duration').value),kw=Number(el('power').value);
  rows=data.intervals.filter(r=>day(r.start)===date);
  const choices=windowsFor(rows,mins,Date.now()/1000,date,day);
  best=choices[0];el('metrics').replaceChildren();el('detail').textContent='';
  el('best').textContent=best?clock.format(best.start*1000)+' – '+clock.format(best.end*1000):'No available window';
  if(best){
    el('detail').textContent=fullClock.format(best.start*1000)+' to '+fullClock.format(best.end*1000)+' · '+date;
    const metrics=[[(best.average/10).toFixed(2)+' ct/kWh','Average market price']];
    const cost = kw * ((best.average / 1000) * (mins / 60));
    if (!Number.isFinite(kw) || kw <= 0) {
      el('detail').textContent += ' · Enter a positive power draw in kW.';
    } else if (Number.isFinite(cost)) {
      metrics.push([euros.format(cost), 'Wholesale energy cost']);
    } else {
      el('detail').textContent += ' · The cost is too large to display.';
    }
    for(const [value,label] of metrics){const metric=document.createElement('div'),b=document.createElement('b');metric.className='metric';b.textContent=value;metric.append(b,label);el('metrics').append(metric);}
  }else el('detail').textContent='Try a shorter run or another published day.';
  el('rows').replaceChildren(...rows.map(r=>{const tr=document.createElement('tr');for(const v of [fullClock.format(r.start*1000),(r.price/10).toFixed(3)]){tr.insertCell().textContent=v;}return tr;}));
  el('axis').replaceChildren(...[rows[0],rows.at(-1)].filter(Boolean).map(r=>{const s=document.createElement('span');s.textContent=clock.format(r.start*1000);return s;}));draw();
}
async function load(){
  el('refresh').disabled=true;
  try{
    const res=await fetch('/api/prices',{cache:'no-cache'});if(!res.ok)throw Error();
    data=await res.json();const before=el('date').value,days=[...new Set(data.intervals.map(r=>day(r.start)))];
    el('date').replaceChildren(...days.map(d=>new Option(d,d)));if(days.includes(before))el('date').value=before;
    el('status').textContent=data.source+' · Checked '+fullClock.format(new Date(data.checkedAt))+' · All times Europe/Berlin. Only published intervals are shown.';render();
  }catch{el('status').textContent=data?'Refresh failed. Showing prices from '+new Date(data.checkedAt).toLocaleString()+'.':'The market feed is unavailable. Refresh to try again.';if(!data)el('best').textContent='Prices unavailable';}
  finally{el('refresh').disabled=false;}
}
el('refresh').onclick=load;for(const id of ['date','duration','power'])el(id).addEventListener('input',render);
window.addEventListener('resize',draw);setInterval(render,30000);setInterval(load,300000);load();
