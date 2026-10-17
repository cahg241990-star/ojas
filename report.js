/* OJAS report page — reads YOUR rows from the online database (after login) and draws the numbers.
   Everything is measured from the logs; nothing is typed in by hand here. The private space is never shown. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r0 = n => Math.round(n||0), r1 = n => Math.round((n||0)*10)/10;
const fmtN = n => r0(n).toLocaleString('en-IN');
const pk = k => { const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d); };
const dk = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const add = (k,n) => { const d=pk(k); d.setDate(d.getDate()+n); return dk(d); };
const fmtD = k => pk(k).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
const wkStart = k => { const d=pk(k); d.setDate(d.getDate()-((d.getDay()+6)%7)); return dk(d); };
const today = dk(new Date());
const app = $('#app');

/* ---------- login ---------- */
function login(step, email, msg){
  app.innerHTML = `<div class="card" style="max-width:420px;margin:40px auto"><h1>📊 Ojas report</h1><div class="muted small">Private — log in with the same email and password you use in the Ojas app.</div>
   <form id="lf"><input class="inp" id="em" type="email" autocomplete="username" placeholder="you@gmail.com" value="${esc(email||'')}"><input class="inp" id="pw" type="password" autocomplete="current-password" placeholder="Password"><button class="btn" id="go" type="submit">Log in</button></form>
   ${msg?`<p class="small st-c">${esc(msg)}</p>`:''}</div>`;
  $('#lf').onsubmit = async ev => { ev.preventDefault(); const e=$('#em').value.trim().toLowerCase(); try{ await Cloud.signIn(e, $('#pw').value); load(); }catch(er){ login('in', e, /invalid/i.test(er.message)?'Wrong email or password.':/confirm/i.test(er.message)?'Confirm your email first (link in the Supabase email).':'Could not log in: '+er.message); } };
}

/* ---------- data ---------- */
async function fetchAll(){
  const st = await Cloud.rest('ojas_state?select=state,report,updated_at,app_version');
  let rows=[], from=0; for(;;){ const p=await Cloud.rest('ojas_days?select=day,data,updated_at&order=day.asc',{headers:{Range:`${from}-${from+499}`}}); rows=rows.concat(p||[]); if(!p||p.length<500) break; from+=500; }
  return {st:(st&&st[0])||null, rows}; }
const stepsOf = v => +String(v||'').replace(/[^\d]/g,'') || 0;
function sleepH(sl){ if(!sl||!sl.bed||!sl.wake) return null; const [bh,bm]=sl.bed.split(':').map(Number), [wh,wm]=sl.wake.split(':').map(Number); let m=(wh*60+wm)-(bh*60+bm); if(m<=0) m+=1440; return m/60; }
function metrics(d){ const f=d.food||[]; const sum=k=>f.reduce((s,e)=>s+(+e[k]||0),0);
  return {logged:f.length>0, kcal:sum('k'), p:sum('p'), c:sum('c'), fat:sum('f'), steps:stepsOf(d.steps), water:d.waterMl!=null?+d.waterMl:(+d.water||0)*250,
    sleep:sleepH(d.sl), weight:parseFloat(d.weight)>30?parseFloat(d.weight):null, waist:parseFloat(d.waist)>20?parseFloat(d.waist):null,
    workouts:(d.ex||[]).length, wmin:(d.ex||[]).reduce((s,e)=>s+(+e.mins||0),0), kegel:+d.kegel||0}; }

/* ---------- tooltip ---------- */
const tip=$('#tip');
function showTip(ev, html){ tip.innerHTML=html; tip.style.display='block'; const w=tip.offsetWidth, h=tip.offsetHeight; let x=ev.clientX+12, y=ev.clientY-h-10; if(x+w>innerWidth-8) x=ev.clientX-w-12; if(y<8) y=ev.clientY+14; tip.style.left=x+'px'; tip.style.top=y+'px'; }
const hideTip = () => { tip.style.display='none'; };
document.addEventListener('scroll', hideTip, {passive:true});

/* ---------- charts (inline SVG) ---------- */
function niceMax(v){ if(v<=0) return 1; const p=Math.pow(10,Math.floor(Math.log10(v))); const n=v/p; return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p; }
function bars(id, pts, {target, unit='', fmt=fmtN, label='', tlabel='target'}){
  const W=520,Hh=180,L=38,R=8,T=10,B=22, n=pts.length, mx=niceMax(Math.max(target||0,...pts.map(p=>p.v||0))*1.05);
  const bw=(W-L-R)/n, y=v=>T+(Hh-T-B)*(1-v/mx);
  const ticks=[0,mx/2,mx];
  let s=`<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esc(label)}">`;
  for(const t of ticks) s+=`<line class="grid-l" x1="${L}" x2="${W-R}" y1="${y(t)}" y2="${y(t)}"/><text class="ax" x="${L-4}" y="${y(t)+3}" text-anchor="end">${fmt(t)}</text>`;
  pts.forEach((p,i)=>{ const x=L+i*bw+1, w=Math.max(2,bw-2); if(p.v!=null && p.v>0){ const yy=y(p.v), h=Hh-B-yy; s+=`<path class="bar" d="M${x},${Hh-B} v${-(h-Math.min(4,h))} q0,-${Math.min(4,h)} ${Math.min(4,w/2)},-${Math.min(4,h)} h${w-2*Math.min(4,w/2)} q${Math.min(4,w/2)},0 ${Math.min(4,w/2)},${Math.min(4,h)} v${h-Math.min(4,h)} z"/>`; }
    s+=`<rect x="${L+i*bw}" y="${T}" width="${bw}" height="${Hh-T-B}" fill="transparent" data-i="${i}"/>`;
    if(i%7===0) s+=`<text class="ax" x="${x+w/2}" y="${Hh-6}" text-anchor="middle">${fmtD(p.k)}</text>`; });
  if(target) s+=`<line class="tgt" x1="${L}" x2="${W-R}" y1="${y(target)}" y2="${y(target)}"/><text class="ax" x="${W-R}" y="${y(target)-4}" text-anchor="end">${tlabel} ${fmt(target)}</text>`;
  s+='</svg>';
  setTimeout(()=>{ const el=document.getElementById(id); if(!el) return; el.querySelectorAll('rect[data-i]').forEach(r=>{ const p=pts[+r.dataset.i];
    r.addEventListener('pointermove',ev=>showTip(ev,`<b>${p.v==null||p.v===0?'not logged':fmt(p.v)+unit}</b><br>${pk(p.k).toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}${target?`<br><span class="muted">${tlabel} ${fmt(target)}${unit}</span>`:''}`)); r.addEventListener('pointerleave',hideTip); }); },0);
  return `<div id="${id}">${s}</div>`; }
function weightChart(id, pts, goal){ // pts [{k,v}] with gaps; 7-day average line
  if(pts.length<2) return '<div class="small muted">Needs at least 2 weigh-ins.</div>';
  const W=1000,Hh=260,L=40,R=12,T=14,B=24; const ks=pts.map(p=>p.k); const k0=ks[0], k1=ks[ks.length-1]; const span=Math.max(1,(pk(k1)-pk(k0))/864e5);
  const vals=pts.map(p=>p.v).concat(goal?[goal]:[]); let lo=Math.floor(Math.min(...vals)-1), hi=Math.ceil(Math.max(...vals)+1);
  const x=k=>L+(W-L-R)*((pk(k)-pk(k0))/864e5)/span, y=v=>T+(Hh-T-B)*(1-(v-lo)/(hi-lo));
  const avg=pts.map((p,i)=>{ const w=pts.filter(q=>(pk(p.k)-pk(q.k))/864e5>=0 && (pk(p.k)-pk(q.k))/864e5<7); return {k:p.k, v:w.reduce((s,q)=>s+q.v,0)/w.length}; });
  let s=`<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Weight trend">`;
  const step=hi-lo>12?4:2; for(let v=Math.ceil(lo/step)*step; v<=hi; v+=step) s+=`<line class="grid-l" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L-5}" y="${y(v)+3}" text-anchor="end">${v}</text>`;
  if(goal) s+=`<line class="tgt" x1="${L}" x2="${W-R}" y1="${y(goal)}" y2="${y(goal)}"/><text class="ax" x="${W-R}" y="${y(goal)-5}" text-anchor="end">function target ${goal} kg</text>`;
  const nT=Math.min(6,pts.length); for(let i=0;i<nT;i++){ const p=pts[Math.round(i*(pts.length-1)/Math.max(1,nT-1))]; s+=`<text class="ax" x="${x(p.k)}" y="${Hh-6}" text-anchor="middle">${fmtD(p.k)}</text>`; }
  for(const p of pts) s+=`<circle class="dot" cx="${x(p.k)}" cy="${y(p.v)}" r="4"/>`;
  s+=`<path class="ln" d="${avg.map((p,i)=>(i?'L':'M')+x(p.k).toFixed(1)+','+y(p.v).toFixed(1)).join(' ')}"/>`;
  s+=`<line id="${id}-x" x1="0" x2="0" y1="${T}" y2="${Hh-B}" stroke="var(--t3)" stroke-width="1" style="display:none"/><rect x="${L}" y="${T}" width="${W-L-R}" height="${Hh-T-B}" fill="transparent" id="${id}-hit"/></svg>`;
  setTimeout(()=>{ const hit=document.getElementById(id+'-hit'), xl=document.getElementById(id+'-x'); if(!hit) return; const svg=hit.ownerSVGElement;
    hit.addEventListener('pointermove',ev=>{ const r=svg.getBoundingClientRect(); const px=(ev.clientX-r.left)/r.width*W; let best=0,bd=1e9; pts.forEach((p,i)=>{ const d=Math.abs(x(p.k)-px); if(d<bd){bd=d;best=i;} });
      const p=pts[best], a=avg[best]; xl.setAttribute('x1',x(p.k)); xl.setAttribute('x2',x(p.k)); xl.style.display='';
      showTip(ev,`<b>${r1(p.v)} kg</b> weighed<br><b>${r1(a.v)} kg</b> 7-day average<br>${pk(p.k).toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}`); });
    hit.addEventListener('pointerleave',()=>{ xl.style.display='none'; hideTip(); }); },0);
  return `<div id="${id}">${s}</div><div class="small muted">Dots = each weigh-in · line = 7-day average (the number that matters) · dashed = target</div>`; }

/* ---------- page ---------- */
function labRows(labs){ if(typeof LAB_MARKERS==='undefined') return ''; const out=[];
  for(const m of LAB_MARKERS){ const s=(labs||{})[m.k]; if(!s||!s.length) continue; const a=s.slice().sort((x,y)=>x[0].localeCompare(y[0])); const last=a[a.length-1], prev=a.length>1?a[a.length-2]:null;
    const v=+last[1]; let st='g'; if((m.hi!=null&&v>m.hi)||(m.lo!=null&&v<m.lo)) st='w'; if((m.whi!=null&&v>m.whi)||(m.wlo!=null&&v<m.wlo)) st='c';
    out.push(`<tr><td>${esc(m.n)}</td><td class="st-${st}"><b>${v}</b> ${esc(m.u)} ${st==='g'?'✓ in range':st==='w'?'▲ watch':'⚠ see doctor'}</td><td>${fmtD(last[0])} ’${last[0].slice(2,4)}</td><td>${prev?prev[1]+' ('+fmtD(prev[0])+')':'—'}</td><td>${m.lo!=null?m.lo:''}${m.lo!=null&&m.hi!=null?'–':''}${m.hi!=null?(m.lo==null?'below ':'')+m.hi:(m.lo!=null?'+':'')}</td></tr>`); }
  return out.join(''); }
async function load(){
  if(!Cloud.user) return login('email');
  app.innerHTML='<div class="card">Loading your data…</div>';
  let data; try{ data=await fetchAll(); }catch(e){ if(e.status===401) return login('email', '', 'Please log in again.'); app.innerHTML=`<div class="card st-c">Could not load: ${esc(e.message)}</div>`; return; }
  const {st, rows}=data; const S=(st&&st.state)||{}; const rep=(st&&st.report)||{}; const set=S.settings||{}; const goal=S.goal||{};
  const M={}; for(const r of rows) M[r.day]=metrics(r.data||{});
  const days=Object.keys(M).sort();
  const last28=[...Array(28)].map((_,i)=>add(today,i-27));
  const wPts=days.filter(k=>M[k].weight).map(k=>({k, v:M[k].weight}));
  const lastW=wPts.length?wPts[wPts.length-1].v:null; const avg7=(()=>{ const w=wPts.filter(p=>(pk(today)-pk(p.k))/864e5<7); return w.length?w.reduce((s,p)=>s+p.v,0)/w.length:null; })();
  const startW=+goal.startWeight||(S.profile&&+S.profile.weight)||(wPts[0]&&wPts[0].v)||null;
  const waists=days.filter(k=>M[k].waist).map(k=>({k,v:M[k].waist})); const lastWaist=waists.length?waists[waists.length-1]:null;
  const ev=goal.event; const evLeft=ev&&ev.date?Math.round((pk(ev.date)-pk(today))/864e5):null;
  const overall=(rep.habits||[]).find(h=>h.id==='allmusts');
  const weekLog=last28.slice(-7).filter(k=>M[k]&&M[k].logged).length;
  // week table
  const wk=[]; let ws=wkStart(today); for(let i=0;i<12;i++){ const ks=[...Array(7)].map((_,j)=>add(ws,j)).filter(k=>k<=today); const ms=ks.map(k=>M[k]).filter(Boolean); const lg=ms.filter(m=>m.logged);
    const av=(arr,f)=>arr.length?arr.reduce((s,m)=>s+f(m),0)/arr.length:null; const sl=ms.filter(m=>m.sleep!=null); const ww=ms.filter(m=>m.weight);
    if(ms.length) wk.push({ws, n:lg.length, kcal:av(lg,m=>m.kcal), p:av(lg,m=>m.p), steps:av(ms.filter(m=>m.steps),m=>m.steps), sleep:av(sl,m=>m.sleep), wo:ms.filter(m=>m.workouts).length, w:ww.length?ww.reduce((s,m)=>s+m.weight,0)/ww.length:null, water:av(ms.filter(m=>m.water),m=>m.water)});
    ws=add(ws,-7); }
  const rep_at=rep.at?new Date(rep.at):null;
  app.innerHTML=`
  <div class="row" style="margin-bottom:10px"><div><h1>📊 Ojas report${S.profile&&S.profile.name?' · '+esc(S.profile.name):''}</h1><div class="small muted">${rows.length} days stored online · phone last copied ${st?new Date(st.updated_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'—'}${st&&st.app_version?' · app v'+esc(st.app_version):''}</div></div><div class="sp"></div>
    <button class="btn sec" id="csv">⬇ Download daily numbers (CSV)</button><button class="btn sec" id="out">Log out</button></div>
  <div class="grid g4">
    <div class="card tile"><span>Weight · 7-day average</span><b>${avg7?r1(avg7)+' kg':'—'}</b><span>${startW&&avg7?`${r1(startW-avg7)>0?'−'+r1(startW-avg7):'+'+r1(avg7-startW)} kg since start (${startW})`:'log weight daily'}</span></div>
    <div class="card tile"><span>Waist</span><b>${lastWaist?lastWaist.v+'″':'—'}</b><span>${lastWaist?'measured '+fmtD(lastWaist.k):'measure every 2 weeks'}${goal.waist?` · goal ${goal.waist}″`:''}</span></div>
    <div class="card tile"><span>${ev?esc(ev.name||'Function'):'Goal'}</span><b>${evLeft!=null&&evLeft>=0?evLeft+' days':goal.weight?goal.weight+' kg':'—'}</b><span>${ev&&ev.weight?`target ${ev.weight} kg${avg7?` · ${r1(avg7-ev.weight)} kg to go`:''}`:''}</span></div>
    <div class="card tile"><span>Overall habit level</span><b style="font-size:20px">${overall?esc(overall.level):'—'}</b><span>${overall?esc(overall.status):'opens after the first full week'}</span></div>
    <div class="card tile"><span>Food logged this week</span><b>${weekLog}/7 days</b><span>streak ${rep.streak??'—'} days all musts</span></div>
  </div>
  <div class="card"><h2>⚖️ Weight</h2>${weightChart('wc', wPts, ev&&ev.weight?+ev.weight:(goal.weight?+goal.weight:null))}</div>
  <div class="grid g2">
    <div class="card"><h2>🔥 Calories — last 28 days</h2>${bars('b1', last28.map(k=>({k, v:M[k]&&M[k].logged?M[k].kcal:null})), {target:+set.kcal||null, unit:' kcal', label:'Calories per day'})}</div>
    <div class="card"><h2>💪 Protein — last 28 days</h2>${bars('b2', last28.map(k=>({k, v:M[k]&&M[k].logged?M[k].p:null})), {target:+set.protein||null, unit:' g', label:'Protein per day'})}</div>
    <div class="card"><h2>👣 Steps — last 28 days</h2>${bars('b3', last28.map(k=>({k, v:M[k]?M[k].steps:null})), {target:+set.stepsMin||+set.steps||null, unit:' steps', label:'Steps per day', tlabel:'minimum'})}</div>
    <div class="card"><h2>😴 Sleep — last 28 days</h2>${bars('b4', last28.map(k=>({k, v:M[k]?M[k].sleep:null})), {target:7, unit:' h', fmt:v=>r1(v), label:'Sleep hours', tlabel:'goal'})}</div>
  </div>
  <div class="card"><h2>📆 Week by week <span class="small muted">(averages over logged days)</span></h2><div class="tw"><table><tr><th>Week of</th><th>Days logged</th><th>kcal/day</th><th>Protein g</th><th>Steps</th><th>Sleep h</th><th>Water L</th><th>Workout days</th><th>Avg weight</th></tr>
    ${wk.map(w=>`<tr><td>${fmtD(w.ws)}</td><td>${w.n}/7</td><td>${w.kcal!=null?fmtN(w.kcal):'—'}</td><td>${w.p!=null?r0(w.p):'—'}</td><td>${w.steps!=null?fmtN(w.steps):'—'}</td><td>${w.sleep!=null?r1(w.sleep):'—'}</td><td>${w.water!=null?r1(w.water/1000):'—'}</td><td>${w.wo}</td><td>${w.w?r1(w.w):'—'}</td></tr>`).join('')||'<tr><td colspan="9">No weeks yet</td></tr>'}</table></div>
    <div class="small muted" style="margin-top:6px">Targets: ${fmtN(set.kcal)} kcal · ${set.protein||'—'} g protein · ${fmtN(set.stepsMin||set.steps)} steps minimum · 7 h sleep · ${r1((+set.waterMl||3000)/1000)} L water</div></div>
  <div class="card"><h2>🧭 Habit levels <span class="small muted">calculated on the phone from your whole history${rep_at?' · '+rep_at.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):''}</span></h2>
    ${(rep.habits||[]).length?`<div class="tw"><table><tr><th>Habit</th><th>Level</th><th>Best ever</th><th>Last 7 days</th><th>Last 30 days</th><th style="text-align:left">Recent weeks</th><th style="text-align:left">What it means</th></tr>
      ${rep.habits.map(h=>`<tr><td>${esc(h.e)} ${esc(h.n)}</td><td><span class="lv">${esc(h.level)}</span></td><td>${esc(h.best)}</td><td>${h.r7==null?'—':r0(h.r7*100)+'%'}</td><td>${h.r30==null?'—':r0(h.r30*100)+'%'}</td><td style="text-align:left"><span class="strip">${(h.weeks||[]).map(w=>`<i class="${esc(w.c)}" title="${esc(w.ws)}"></i>`).join('')}</span></td><td style="text-align:left;white-space:normal;min-width:220px" class="small muted">${esc(h.status)}</td></tr>`).join('')}</table></div>
      <div class="small muted" style="margin-top:6px">Squares: green = good week · amber = mixed (level holds) · red = weak · grey = not recorded. A level moves up only after good weeks in a row.</div>`:'<div class="small muted">Opens after the phone copies its first summary.</div>'}</div>
  ${(()=>{ const ex={}; for(const r of rows){ for(const x of ((r.data||{}).ex||[])){ if(!x.log||!x.log.length) continue; const timed=x.target&&x.target.timed; const best=Math.max(...x.log.map(l=>timed?+l.s||0:+l.r||0)); const kg=Math.max(0,...x.log.map(l=>+l.kg||0)); (ex[x.ex] ||= {n:x.name.replace(' (chat)',''), timed, s:[]}).s.push({k:r.day, best, kg, sets:x.log.length}); } }
    const nx={}; for(const q of (rep.prog||[])) nx[q.id]=q.next; const ids=Object.keys(ex); if(!ids.length) return '';
    const f=(v,t)=>t?(v>=60?r1(v/60)+' min':v+' s'):v;
    return `<div class="card"><h2>🏋️ Exercise progress <span class="small muted">best set per session · first → latest</span></h2><div class="tw"><table><tr><th>Exercise</th><th>Sessions</th><th>First</th><th>Latest</th><th>Best ever</th><th>Next target</th></tr>${ids.map(id=>{ const E=ex[id], a=E.s[0], z=E.s[E.s.length-1], b=Math.max(...E.s.map(x=>x.best)); return `<tr><td>${esc(E.n)}</td><td>${E.s.length}</td><td>${f(a.best,E.timed)}${a.kg?' @ '+a.kg+' kg':''} (${fmtD(a.k)})</td><td>${f(z.best,E.timed)}${z.kg?' @ '+z.kg+' kg':''} (${fmtD(z.k)})</td><td>${f(b,E.timed)}</td><td>${esc(nx[id]||'—')}</td></tr>`; }).join('')}</table></div><div class="small muted" style="margin-top:6px">Targets rise a small step after a session where every set was hit (max one step a week); they ease back after two short sessions.</div></div>`; })()}
  ${(rep.weekly||[]).length?`<div class="card"><h2>📅 This week's goals</h2><div class="tw"><table><tr><th>Goal</th><th>Done</th><th>Target</th><th>%</th></tr>${rep.weekly.map(g=>`<tr><td>${esc(g.e)} ${esc(g.n)}</td><td>${fmtN(g.done)}</td><td>${fmtN(g.tgt)} ${esc(g.unit)}</td><td>${r0(Math.min(1,g.done/(g.tgt||1))*100)}%</td></tr>`).join('')}</table></div><div class="small muted" style="margin-top:6px">Treats this week: ${rep.treats??'—'} of ${rep.treatBudget??2}</div></div>`:''}
  ${labRows(S.labs)?`<div class="card"><h2>🩸 Blood results <span class="small muted">latest vs previous</span></h2><div class="tw"><table><tr><th>Marker</th><th>Latest</th><th>Date</th><th>Previous</th><th>Healthy range</th></tr>${labRows(S.labs)}</table></div><div class="small muted" style="margin-top:6px">Coach, not doctor — amber and red items go to your doctor.</div></div>`:''}
  <p class="small muted" style="text-align:center">Only you can open this page’s data (login + row-level security). The private space is never shown here.</p>`;
  $('#out').onclick=()=>{ Cloud.logout(); login('email'); };
  $('#csv').onclick=()=>{ const head=['date','kcal','protein_g','carbs_g','fat_g','steps','water_ml','sleep_h','weight_kg','waist_in','workouts','workout_min','kegel_sets'];
    const lines=[head.join(',')].concat(days.map(k=>{ const m=M[k]; return [k, m.logged?r0(m.kcal):'', m.logged?r1(m.p):'', m.logged?r1(m.c):'', m.logged?r1(m.fat):'', m.steps||'', m.water||'', m.sleep!=null?r1(m.sleep):'', m.weight??'', m.waist??'', m.workouts, m.wmin, m.kegel].join(','); }));
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/csv'})); a.download=`ojas-daily-${today}.csv`; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500); };
}
load();
})();
