export function windowsFor(rows, minutes, now, date, dayOf, deadline = Infinity) {
  if (![30,60,90,120,180,240].includes(minutes)) return [];
  const count=minutes/15, windows=[];
  for(let i=0;i+count<=rows.length;i++){
    const slice=rows.slice(i,i+count), first=slice[0].start;
    if(first+minutes*60>deadline || first<now || dayOf(first)!==date || slice.some((r,j)=>r.start!==first+j*900 || dayOf(r.start)!==date)) continue;
    windows.push({start:first,end:first+minutes*60,average:slice.reduce((s,r)=>s+r.price,0)/count});
  }
  return windows.sort((a,b)=>a.average-b.average || a.start-b.start);
}

export function parsePower(value) {
  if (typeof value !== 'string') return null;
  const decimal = value.trim();
  if (!/^(?:\d+(?:[.,]\d{0,2})?|[.,]\d{1,2})$/.test(decimal)) return null;
  const power = Number(decimal.replace(',', '.'));
  return Number.isFinite(power) && power > 0 ? power : null;
}
