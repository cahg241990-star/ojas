/* OJAS app logic. All personal data stays in this phone's browser storage (localStorage key "ojas.v1"). */
(() => {
'use strict';
const VERSION = '1.2.0';
const KEY = 'ojas.v1';

/* ---------------- storage ---------------- */
const DEFAULT_SETTINGS = {kcal:2000, protein:90, carbs:235, fat:60, water:12, waterMl:3000, steps:8000, heightCm:170, kg:'', theme:'auto', voice:'en', rest:45, avatar:'flame', onboarded:false};
function freshState(){ return {v:1, settings:{...DEFAULT_SETTINGS}, days:{}, customDishes:[], customIngs:[], customEx:[], links:{}, favs:[], bottles:[], photo:'', rungs:{push:1,pull:1,squat:1,hip:1,core:1}}; }
function load(){
  try{ const raw = localStorage.getItem(KEY); if(!raw) return freshState();
    const s = JSON.parse(raw); const f = freshState();
    return {...f, ...s, settings:{...f.settings, ...(s.settings||{})}, rungs:{...f.rungs, ...(s.rungs||{})}};
  }catch(e){ return freshState(); }
}
let S = load();
let storageOK = true;
function save(quiet){ try{ localStorage.setItem(KEY, JSON.stringify(S)); storageOK = true; }catch(e){ storageOK = false; toast('⚠️ Could not save — storage blocked'); } if(!quiet && typeof queueBadges==='function') queueBadges(); }

/* ---------------- helpers ---------------- */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r0 = n => Math.round(n||0);
const r1 = n => Math.round((n||0)*10)/10;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30) || 'item';
function dkey(d){ const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
function parseKey(k){ const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d); }
const todayKey = () => dkey(new Date());
let cur = todayKey();
let tab = 'today';
let foodCat = 'All', exCat = 'All', foodQ = '', exQ = '';
function addDays(k,n){ const d=parseKey(k); d.setDate(d.getDate()+n); return dkey(d); }
function niceDate(k){
  const t = todayKey(); if(k===t) return 'Today'; if(k===addDays(t,-1)) return 'Yesterday'; if(k===addDays(t,1)) return 'Tomorrow';
  return parseKey(k).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
}
function nowHM(){ const d=new Date(); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
function day(k=cur){
  if(!S.days[k]) S.days[k] = {food:[], ex:[], water:0, steps:'', sleep:'', weight:'', waist:'', kegel:0, ticks:{}, energy:''};
  const d = S.days[k]; d.food ||= []; d.ex ||= []; d.ticks ||= {}; d.waterLog ||= []; if(d.waterMl==null) d.waterMl=(d.water||0)*250; return d;
}
const peekDay = k => S.days[k];
const SLOTS = [['early','Early morning'],['breakfast','Breakfast'],['mid','Mid-morning'],['lunch','Lunch'],['snack','Evening snack'],['dinner','Dinner'],['late','Bedtime']];
function slotFor(hm){ const [h,m]=hm.split(':').map(Number); const x=h+m/60;
  if(x<7.5) return 'early'; if(x<10.5) return 'breakfast'; if(x<12.5) return 'mid'; if(x<15.5) return 'lunch'; if(x<19) return 'snack'; if(x<21.5) return 'dinner'; return 'late'; }
const slotName = id => (SLOTS.find(s=>s[0]===id)||[,id])[1];
function bodyKg(){ const v = parseFloat(S.settings.kg); if(v>30) return v;
  const ks = Object.keys(S.days).sort().reverse(); for(const k of ks){ const w=parseFloat(S.days[k].weight); if(w>30) return w; } return 75; }

/* ---------------- toast & confetti ---------------- */
let toastT;
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),2200); }
function confetti(){
  const cols=['#ffb347','#ff6a3d','#ff3d7f','#7b5cff','#12b886','#38bdf8'];
  for(let i=0;i<40;i++){ const c=document.createElement('div'); c.className='confetti';
    c.style.left=Math.random()*100+'vw'; c.style.background=cols[i%cols.length];
    c.style.animationDuration=(1.6+Math.random()*1.6)+'s'; c.style.animationDelay=(Math.random()*.4)+'s';
    c.style.transform=`rotate(${Math.random()*360}deg)`; document.body.appendChild(c); setTimeout(()=>c.remove(),3800); }
}

/* ---------------- nutrition ---------------- */
function ingMap(){ const m=new Map(); for(const a of INGREDIENTS) m.set(a[0],a); for(const a of S.customIngs) m.set(a[0],a); return m; }
let ING = ingMap();
function allDishes(){ return [...DISHES, ...S.customDishes]; }
function dishById(id){ return allDishes().find(d=>d.id===id); }
function dishMacros(d){
  if(d.macros) return {k:+d.macros.k||0,p:+d.macros.p||0,c:+d.macros.c||0,f:+d.macros.f||0};
  let k=0,p=0,c=0,f=0;
  for(const [id,g] of (d.ing||[])){ const a=ING.get(id); if(!a) continue; const x=g/100; k+=a[3]*x; p+=a[4]*x; c+=a[5]*x; f+=a[6]*x; }
  return {k,p,c,f};
}
function servingGrams(d){
  if(d.g) return d.g;
  const u=(d.unit||'').toLowerCase();
  if(u.includes('katori')) return 150; if(u.includes('bowl')) return 200; if(u.includes('glass')) return 250; if(u.includes('cup')) return 200;
  const raw=(d.ing||[]).reduce((s,[,g])=>s+g,0); return raw||100;
}
function dayTotals(k=cur){ const d=peekDay(k); const t={k:0,p:0,c:0,f:0,burn:0};
  if(!d) return t; for(const e of d.food){ t.k+=e.k; t.p+=e.p; t.c+=e.c; t.f+=e.f; } for(const e of d.ex) t.burn+=e.kcal||0; return t; }

/* ---------------- exercises ---------------- */
function allEx(){ return [...EXERCISES, ...S.customEx]; }
const exById = id => allEx().find(e=>e.id===id);
function exKcal(ex, sets, reps, mins){
  const minutes = ex.type==='time' ? mins : sets*2;
  return (ex.met||4) * bodyKg() * minutes/60;
}

/* ---------------- YouTube ---------------- */
const yt = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
function ytLinks(kind, item){
  const own = S.links[kind+':'+item.id] || {};
  const base = item.yt || {};
  let hi, en;
  if(kind==='dish'){ hi = own.hi || base.hi || yt(`${item.hi} ${item.en} recipe in hindi`); en = own.en || base.en || yt(`${item.en} recipe healthy indian`); }
  else { hi = own.hi || base.hi || yt(`${item.en} ${item.hi} kaise kare hindi`); en = own.en || base.en || yt(`how to do ${item.en} correct form`); }
  return {hi, en, ownHi:!!(own.hi||base.hi), ownEn:!!(own.en||base.en)};
}
const isYT = u => /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(u||'');

/* ---------------- figure animation engine ---------------- */
const FIGS = new Set(); let figObs = null; let figRAF = 0;
function figSVG(animKey, cls='fig'){
  const a = ANIMS[animKey] || ANIMS.sit; const gid='g'+uid();
  return `<svg class="${cls}" viewBox="0 -12 200 204" data-anim="${esc(animKey)}" aria-hidden="true">
  <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset=".5" stop-color="#ff6a3d"/><stop offset="1" stop-color="#ff3d7f"/></linearGradient></defs>
  ${propSVG(a.prop)}
  <line x1="8" y1="181" x2="192" y2="181" stroke="currentColor" stroke-opacity=".12" stroke-width="2"/>
  <circle class="p-glow" cx="100" cy="100" r="0" fill="#ff6a3d" opacity="0"/>
  <g class="limb" stroke="#7b5cff" stroke-opacity=".55" stroke-width="8"><polyline class="p-bl"/><polyline class="p-ba"/></g>
  <line class="p-t limb" stroke="url(#${gid})" stroke-width="11"/>
  <g class="limb" stroke="url(#${gid})" stroke-width="8.5"><polyline class="p-fl"/><polyline class="p-fa"/></g>
  <circle class="p-h" r="11" fill="#ffd9a8" stroke="#ff3d7f" stroke-width="3"/>
  <g class="p-db"></g><line class="p-cable" stroke="currentColor" stroke-opacity=".35" stroke-width="2"/>
  </svg>`;
}
function propSVG(p){
  const c='currentColor';
  switch(p){
    case 'bar': return `<line x1="50" y1="20" x2="150" y2="20" stroke="${c}" stroke-opacity=".5" stroke-width="5" stroke-linecap="round"/><line x1="54" y1="20" x2="54" y2="181" stroke="${c}" stroke-opacity=".15" stroke-width="4"/><line x1="146" y1="20" x2="146" y2="181" stroke="${c}" stroke-opacity=".15" stroke-width="4"/>`;
    case 'lowbar': return `<line x1="118" y1="100" x2="176" y2="100" stroke="${c}" stroke-opacity=".5" stroke-width="5" stroke-linecap="round"/><line x1="170" y1="100" x2="170" y2="181" stroke="${c}" stroke-opacity=".2" stroke-width="4"/>`;
    case 'wall': return `<rect x="162" y="30" width="10" height="151" rx="3" fill="${c}" fill-opacity=".15"/>`;
    case 'counter': return `<rect x="156" y="100" width="40" height="81" rx="6" fill="${c}" fill-opacity=".12"/>`;
    case 'chair': return `<rect x="48" y="132" width="40" height="7" rx="3" fill="${c}" fill-opacity=".25"/><line x1="52" y1="139" x2="52" y2="181" stroke="${c}" stroke-opacity=".25" stroke-width="4"/><line x1="84" y1="139" x2="84" y2="181" stroke="${c}" stroke-opacity=".25" stroke-width="4"/><line x1="50" y1="134" x2="50" y2="96" stroke="${c}" stroke-opacity=".25" stroke-width="4"/>`;
    case 'mat': return `<rect x="12" y="180" width="176" height="6" rx="3" fill="#7b5cff" fill-opacity=".35"/>`;
    case 'box': return `<rect x="104" y="157" width="46" height="24" rx="4" fill="${c}" fill-opacity=".16"/>`;
    case 'bench': return `<rect x="26" y="139" width="96" height="8" rx="3" fill="${c}" fill-opacity=".25"/><line x1="40" y1="147" x2="40" y2="181" stroke="${c}" stroke-opacity=".22" stroke-width="4"/><line x1="108" y1="147" x2="108" y2="181" stroke="${c}" stroke-opacity=".22" stroke-width="4"/>`;
    default: return '';
  }
}
const ease = t => 0.5 - Math.cos(Math.PI*t)/2;
function poseAt(a, t){
  const names = a.poses; let seq;
  if(a.cycle) seq = [...names, names[0]];
  else seq = [...names, ...names.slice(0,-1).reverse()];
  const segs = seq.length-1; const total = segs * a.ms; const tt = t % total;
  const i = Math.min(segs-1, Math.floor(tt / a.ms)); let f = (tt - i*a.ms)/a.ms;
  const hold = a.breath ? 0.1 : 0.18; f = f<hold ? 0 : f>1-hold ? 1 : (f-hold)/(1-2*hold);
  const A = POSE[seq[i]], B = POSE[seq[i+1]]; const e = ease(f);
  return {pt: A.map((v,j)=>v+(B[j]-v)*e), f:e, i};
}
function drawFig(svg, t){
  const a = ANIMS[svg.dataset.anim] || ANIMS.sit; const {pt} = poseAt(a, t);
  const P = n => pt[n*2]+','+pt[n*2+1];
  const H=0,N=1,HIP=2,BK=3,BF=4,FK=5,FF=6,BE=7,BH=8,FE=9,FH=10;
  const q = s => svg.querySelector(s);
  q('.p-bl').setAttribute('points', `${P(HIP)} ${P(BK)} ${P(BF)}`);
  q('.p-fl').setAttribute('points', `${P(HIP)} ${P(FK)} ${P(FF)}`);
  q('.p-ba').setAttribute('points', `${P(N)} ${P(BE)} ${P(BH)}`);
  q('.p-fa').setAttribute('points', `${P(N)} ${P(FE)} ${P(FH)}`);
  const tl=q('.p-t'); tl.setAttribute('x1',pt[N*2]); tl.setAttribute('y1',pt[N*2+1]); tl.setAttribute('x2',pt[HIP*2]); tl.setAttribute('y2',pt[HIP*2+1]);
  const h=q('.p-h'); h.setAttribute('cx',pt[0]); h.setAttribute('cy',pt[1]);
  const g=q('.p-glow');
  if(a.breath || a.pulse){ const ph=(Math.sin(t/(a.pulse?240:a.ms/Math.PI))+1)/2;
    if(a.pulse){ g.setAttribute('cx',pt[HIP*2]); g.setAttribute('cy',pt[HIP*2+1]+6); g.setAttribute('r', 8+ph*12); g.setAttribute('opacity', .15+ph*.35); }
    else { g.setAttribute('cx',(pt[N*2]+pt[HIP*2])/2); g.setAttribute('cy',(pt[N*2+1]+pt[HIP*2+1])/2); g.setAttribute('r', 22+ph*16); g.setAttribute('opacity', .08+ph*.14); }
  }
  if(a.prop==='db'){ q('.p-db').innerHTML = [BH,FH].map(n=>`<rect x="${pt[n*2]-9}" y="${pt[n*2+1]-4}" width="18" height="8" rx="3" fill="#1b1a22" fill-opacity="${n===BH?.35:.75}"/>`).join(''); }
  const cb=q('.p-cable');
  if(a.prop==='cable'){ cb.setAttribute('x1',100); cb.setAttribute('y1',-12); cb.setAttribute('x2',(pt[BH*2]+pt[FH*2])/2); cb.setAttribute('y2',pt[FH*2+1]);
    q('.p-db').innerHTML=`<line x1="${pt[BH*2]}" y1="${pt[BH*2+1]}" x2="${pt[FH*2]}" y2="${pt[FH*2+1]}" stroke="#1b1a22" stroke-opacity=".7" stroke-width="5" stroke-linecap="round"/>`; }
}
function loop(ts){
  let any=false;
  for(const svg of FIGS){ if(!svg.isConnected){ FIGS.delete(svg); continue; } if(svg._vis){ drawFig(svg, ts + (svg._off||0)); any=true; } }
  figRAF = (any || FIGS.size) ? requestAnimationFrame(loop) : 0;
}
function mountFigs(root=document){
  if(!figObs && 'IntersectionObserver' in window) figObs = new IntersectionObserver(es=>es.forEach(e=>e.target._vis=e.isIntersecting),{rootMargin:'40px'});
  $$('svg.fig[data-anim]', root).forEach(svg=>{ if(svg._m) return; svg._m=1; svg._off=Math.random()*3000; svg._vis = !figObs; drawFig(svg,0); FIGS.add(svg); if(figObs) figObs.observe(svg); });
  if(!figRAF && FIGS.size) figRAF=requestAnimationFrame(loop);
}

/* ---------------- sheet ---------------- */
let sheetEl=null, overlayEl=null, sheetOnClose=null;
function openSheet(html, onMount){
  if(!sheetEl){
    overlayEl=document.createElement('div'); overlayEl.className='overlay'; overlayEl.dataset.act='closeSheet';
    sheetEl=document.createElement('div'); sheetEl.className='sheet'; sheetEl.setAttribute('role','dialog');
    sheetEl.innerHTML=`<div class="grab"></div><button class="sx" data-act="closeSheet" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button><div class="body"></div>`;
    $('#sheetRoot').append(overlayEl, sheetEl);
    requestAnimationFrame(()=>{ overlayEl.classList.add('show'); sheetEl.classList.add('show'); });
  }
  const b=$('.body',sheetEl); b.innerHTML=html; b.scrollTop=0; mountFigs(sheetEl); onMount && onMount(b);
}
function closeSheet(){
  if(!sheetEl) return; const s=sheetEl,o=overlayEl; sheetEl=overlayEl=null;
  s.classList.remove('show'); o.classList.remove('show'); setTimeout(()=>{s.remove();o.remove();},420);
  const cb=sheetOnClose; sheetOnClose=null; cb && cb();
}

/* ---------------- render: shell ---------------- */
function applyTheme(){ const t=S.settings.theme; if(t==='auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme',t); }
function render(){
  $('#dateLabel').textContent = niceDate(cur);
  $('#datenav').style.visibility = (tab==='today') ? 'visible' : 'hidden';
  $$('#tabs button').forEach(b=>b.classList.toggle('on', b.dataset.tab===tab));
  $('#fab').style.display = (tab==='today'||tab==='food') ? '' : 'none';
  const m=$('#main'); const html = ({today:vToday, food:vFood, train:vTrain, progress:vProgress, me:vMe}[tab])();
  m.innerHTML = `<div class="view">${html}</div>`; mountFigs(m); afterRender(m);
}
function afterRender(m){
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ $$('.ring .bar',m).forEach(c=>c.style.strokeDashoffset=c.dataset.off); $$('.wlvl',m).forEach(g=>g.style.transform=`translateY(${g.dataset.ty}px)`); }));
  $$('[data-count]',m).forEach(el=>{ const to=+el.dataset.count; const t0=performance.now(); const dur=900;
    const step=t=>{ const k=Math.min(1,(t-t0)/dur); el.textContent=r0(to*ease(k)).toLocaleString('en-IN'); if(k<1) requestAnimationFrame(step); }; requestAnimationFrame(step); });
}
function ringSVG(val, target, label, unit){
  const R=34, C=2*Math.PI*R; const pct=Math.max(0,Math.min(1, target? val/target : 0)); const off=C*(1-pct);
  return `<div class="ring"><div class="rw"><svg viewBox="0 0 84 84"><circle class="track" cx="42" cy="42" r="${R}" fill="none" stroke-width="8"/>
  <circle class="bar" cx="42" cy="42" r="${R}" fill="none" stroke-width="8" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${off}"/></svg>
  <div class="rv"><span data-count="${r0(val)}">0</span><small>/ ${r0(target)}${unit}</small></div></div><div class="lab">${label}</div></div>`;
}

/* ---------------- TODAY ---------------- */
const TICKS = [['med','🧘 Meditation 10 min'],['breath','🌬️ Pranayama'],['sun','☀️ Sunlight 15 min'],['methi','💧 Methi water'],['walk','🚶 Walk after meals'],['dinner','🥣 Light dinner by 8'],['teeth','🦷 Floss + tongue'],['skin','🧴 Sunscreen'],['side','🛏️ Side-sleeping'],['screens','📵 Screens off 1 h']];
function vToday(){
  const d=day(), t=dayTotals(), st=S.settings;
  const h=new Date().getHours(); const greet = cur!==todayKey() ? niceDate(cur) : h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  const left = st.protein - t.p;
  const headline = d.food.length===0 ? 'Log your first meal 🍽️' : left>0 ? `${r0(left)} g protein to go` : 'Protein target hit! 💪';
  const plan = WEEK_PLAN[parseKey(cur).getDay()];
  const sample = allEx().find(e=>e.cat===plan.cat) || EXERCISES[0];
  // timeline
  const bySlot = {}; for(const e of d.food){ (bySlot[e.slot] ||= []).push(e); }
  let tl='';
  for(const [sid,sn] of SLOTS){ const arr=(bySlot[sid]||[]).sort((a,b)=>a.t.localeCompare(b.t)); if(!arr.length) continue;
    const sk=arr.reduce((s,e)=>s+e.k,0), sp=arr.reduce((s,e)=>s+e.p,0);
    tl+=`<div class="tl-slot"><span>${sn}</span><span>${r0(sk)} kcal · ${r0(sp)} g P</span></div>`;
    tl+=arr.map(e=>`<div class="item" data-act="editEntry" data-id="${e.id}"><div class="emo">${esc(e.e||'🍽️')}</div>
      <div class="txt"><div class="t1">${esc(e.name)}</div><div class="t2">${esc(e.t)} · ${r1(e.qty)} × ${esc(e.unit||'serving')}</div></div>
      <div class="meta"><b>${r0(e.k)}</b>${r0(e.p)} g P</div><button class="x" data-act="delEntry" data-id="${e.id}" aria-label="Delete">×</button></div>`).join('');
  }
  const exList = d.ex.map(e=>`<div class="item" data-act="openEx" data-id="${e.ex}">${exThumb(exById(e.ex))}
    <div class="txt"><div class="t1">${esc(e.name)}</div><div class="t2">${esc(e.t)} · ${e.mins? r0(e.mins)+' min' : `${e.sets} × ${e.reps}`}</div></div>
    <div class="meta"><b>${r0(e.kcal)}</b>kcal</div><button class="x" data-act="delEx" data-id="${e.id}" aria-label="Delete">×</button></div>`).join('');
  const walk = stepStats(d.steps);
  return `
  <section class="hero">
    <button class="hero-av" data-act="tab" data-tab="me" aria-label="Avatar">${avatarHTML()}</button>
    <div class="greet">${greet}</div>
    <div class="big">${headline}</div>
    <div class="rings">
      ${ringSVG(t.k, st.kcal, 'Calories','')}${ringSVG(t.p, st.protein, 'Protein','g')}${ringSVG(t.c, st.carbs, 'Carbs','g')}${ringSVG(t.f, st.fat, 'Fat','g')}
    </div>
    <div class="small" style="position:relative;margin-top:10px;opacity:.92">Eaten ${r0(t.k)} kcal · Burned ~${r0(t.burn+walk.kcal)} (workouts ${r0(t.burn)} + walking ${r0(walk.kcal)}) · Net ${r0(t.k-t.burn-walk.kcal)}</div>
  </section>

  <div class="card session" data-act="goTrain" data-cat="${plan.cat}">
    ${exThumb(sample)}
    <div class="grow"><div class="small muted" style="font-weight:700">TODAY'S SESSION</div><div style="font-weight:800;font-family:var(--font-d)">${esc(plan.title)}</div><div class="small muted">Tap to see exercises →</div></div>
  </div>

  <div class="sec-title">Food log</div>
  ${tl ? `<div class="tl">${tl}</div>` : `<div class="card empty"><span class="ee">🥗</span>Nothing logged yet. Tap <b>+</b> to add what you ate.</div>`}
  <div class="row" style="margin-top:10px"><button class="btn sec grow" data-act="quickAdd">+ Add food</button><button class="btn sec grow" data-act="quickCal">⚡ Quick calories</button></div>

  <div class="sec-title">Workouts</div>
  ${exList ? `<div class="list">${exList}</div>` : `<div class="card empty" style="padding:16px"><span class="ee" style="font-size:30px">🏋️</span>No workout logged.</div>`}
  <button class="btn sec full" style="margin-top:10px" data-act="tab" data-tab="train">+ Log exercise</button>

  <div class="sec-title">Water & steps</div>
  ${waterCard(d)}
  ${stepsCard(d)}
  <div class="sec-title">Body & habits</div>
  <div class="habits">
    <div class="hab"><div class="hl"><span>😴 Sleep (h)</span><span>7–8</span></div><input inputmode="decimal" data-in="sleep" value="${esc(d.sleep)}" placeholder="0"></div>
    <div class="hab"><div class="hl"><span>⚖️ Weight (kg)</span><span>AM</span></div><input inputmode="decimal" data-in="weight" value="${esc(d.weight)}" placeholder="—"></div>
    <div class="hab"><div class="hl"><span>📏 Waist (in)</span><span>2-weekly</span></div><input inputmode="decimal" data-in="waist" value="${esc(d.waist)}" placeholder="—"></div>
    <div class="hab"><div class="hl"><span>🔥 Kegels</span><span>${d.kegel||0}/3</span></div><div class="kg">${[1,2,3].map(n=>`<button class="${d.kegel>=n?'on':''}" data-act="kegel" data-n="${n}">${n}</button>`).join('')}</div></div>
    <div class="hab"><div class="hl"><span>⚡ Energy</span><span>1–10</span></div><input inputmode="numeric" data-in="energy" value="${esc(d.energy)}" placeholder="—"></div>
  </div>
  <div class="sec-title">Daily non-negotiables</div>
  <div class="ticks">${TICKS.map(([k,l])=>`<button class="tick ${d.ticks[k]?'on':''}" data-act="tick" data-k="${k}"><span class="bx">${d.ticks[k]?'✓':''}</span>${l}</button>`).join('')}</div>
  <p class="small muted" style="text-align:center;margin-top:18px">Nutrition numbers are estimates (±10–15%). Coach, not doctor.</p>`;
}

/* ---------------- FOOD ---------------- */
function dishCard(d){
  const m=dishMacros(d);
  return `<div class="item" data-act="openDish" data-id="${esc(d.id)}"><div class="emo">${esc(d.e||'🍽️')}<span class="dot ${d.dot||'g'}"></span></div>
  <div class="txt"><div class="t1">${esc(d.en)}</div><div class="t2"><span class="hi">${esc(d.hi||'')}</span> · ${esc(d.unit||'1 serving')}</div></div>
  <div class="meta"><b>${r0(m.k)}</b><span class="pill p">${r0(m.p)} g P</span></div></div>`;
}
function filterDishes(q, cat){
  q=(q||'').trim().toLowerCase();
  return allDishes().filter(d=>{
    if(cat==='Mine' && !d.mine) return false; if(cat==='★ Saved' && !S.favs.includes(d.id)) return false;
    if(cat==='High protein' && dishMacros(d).p<12) return false;
    if(!['All','Mine','★ Saved','High protein'].includes(cat) && d.cat!==cat) return false;
    if(!q) return true;
    const hay=(d.en+' '+(d.hi||'')+' '+(d.cat||'')+' '+(d.reg||'')+' '+(d.ing||[]).map(([id])=>{const a=ING.get(id);return a?a[1]+' '+a[2]:''}).join(' ')).toLowerCase();
    return q.split(/\s+/).every(w=>hay.includes(w));
  });
}
function vFood(){
  const cats=['All','★ Saved','High protein','Mine',...FOOD_CATS];
  const list=filterDishes(foodQ, foodCat);
  return `
  <div class="search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity=".5"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
    <input id="foodSearch" placeholder="Search dish or ingredient — e.g. moong, paneer, दाल" value="${esc(foodQ)}" autocomplete="off"></div>
  <div class="chips">${cats.map(c=>`<button class="chip ${c===foodCat?'on':''}" data-act="foodCat" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
  <div class="row" style="margin:4px 0 12px"><button class="btn pri grow" data-act="newDish">+ New dish</button><button class="btn sec" data-act="newIng">+ Ingredient</button></div>
  <div class="small muted" style="margin:0 4px 8px">${list.length} dishes · <span class="dot g"></span> everyday <span class="dot y"></span> sometimes <span class="dot r"></span> treat · numbers per serving</div>
  <div class="list" id="foodList">${list.map(dishCard).join('') || `<div class="card empty"><span class="ee">🔎</span>No match. Try another word, or create it with “+ New dish”.</div>`}</div>`;
}

function dishSheet(id){
  const d=dishById(id); if(!d) return;
  const m=dishMacros(d); const L=ytLinks('dish',d); const fav=S.favs.includes(d.id);
  const dotLabel={g:'Everyday',y:'Sometimes',r:'Treat — rarely'}[d.dot||'g'];
  const rows=(d.ing||[]).map(([iid,g])=>{const a=ING.get(iid); if(!a) return ''; return `<tr><td><span class="hi">${esc(a[2])}</span><div class="small muted">${esc(a[1])}</div></td><td>${r1(g)} g</td></tr>`;}).join('');
  openSheet(`
    <div class="dish-hero"><span>${esc(d.e||'🍽️')}</span></div>
    <h2>${esc(d.en)}</h2><div class="hih">${esc(d.hi||'')}</div>
    <div class="row wrap" style="gap:6px;margin-bottom:12px"><span class="pill"><span class="dot ${d.dot||'g'}"></span>${dotLabel}</span><span class="pill">${esc(d.cat||'')}</span>${d.reg?`<span class="pill">${esc(d.reg)}</span>`:''}${d.mine?'<span class="pill p">My dish</span>':''}</div>
    <div class="card" style="padding:12px"><div class="small muted" style="margin-bottom:8px;font-weight:700">PER SERVING · ${esc(d.unit||'1 serving')}</div>
      <div class="mac"><div><b style="color:var(--kcal)">${r0(m.k)}</b><span>kcal</span></div><div><b style="color:var(--prot)">${r1(m.p)}</b><span>protein g</span></div><div><b style="color:var(--carb)">${r1(m.c)}</b><span>carbs g</span></div><div><b style="color:var(--fat)">${r1(m.f)}</b><span>fat g</span></div></div></div>
    <div class="row" style="margin-bottom:10px"><button class="btn pri grow" data-act="logDish" data-id="${esc(d.id)}">+ Log this</button><button class="btn sec" data-act="fav" data-id="${esc(d.id)}">${fav?'★ Saved':'☆ Save'}</button></div>
    <div class="row" style="margin-bottom:16px"><a class="btn yt" href="${esc(L.hi)}" target="_blank" rel="noopener">▶ ${L.ownHi?'Your video':'Watch'} · हिंदी</a><a class="btn yt en" href="${esc(L.en)}" target="_blank" rel="noopener">▶ ${L.ownEn?'Your video':'Watch'} · English</a></div>
    ${rows?`<div class="card"><h3>Ingredients <span class="sub">हिंदी · English · one serving</span></h3><table class="tbl">${rows}</table></div>`:''}
    ${(d.steps||[]).length?`<div class="card"><h3>How to make</h3><ol class="steps">${d.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></div>`:''}
    ${d.tip?`<div class="tip">💡 ${esc(d.tip)}</div>`:''}
    <details class="card" style="margin-top:14px"><summary style="font-weight:700;cursor:pointer">🎬 Add my own YouTube video</summary>
      <label class="f">Hindi video link</label><input class="inp" id="lkHi" placeholder="https://youtube.com/..." value="${esc((S.links['dish:'+d.id]||{}).hi||'')}">
      <label class="f">English video link</label><input class="inp" id="lkEn" placeholder="https://youtube.com/..." value="${esc((S.links['dish:'+d.id]||{}).en||'')}">
      <button class="btn sec full" style="margin-top:12px" data-act="saveLinks" data-kind="dish" data-id="${esc(d.id)}">Save links</button></details>
    <div class="row" style="margin-top:12px">${d.mine?`<button class="btn sec grow" data-act="editDish" data-id="${esc(d.id)}">✏️ Edit</button><button class="btn sec grow" data-act="delDish" data-id="${esc(d.id)}" style="color:var(--crit)">Delete</button>`:`<button class="btn sec grow" data-act="copyDish" data-id="${esc(d.id)}">✏️ Make my own version</button>`}</div>
  `);
}

let logDraft=null;
function logSheet(dishId, entryId){
  const d=dishById(dishId); const ex = entryId ? day().food.find(e=>e.id===entryId) : null;
  if(!d && !ex) return;
  const base = d ? dishMacros(d) : {k:ex.k/ex.qty, p:ex.p/ex.qty, c:ex.c/ex.qty, f:ex.f/ex.qty};
  const sg = d ? servingGrams(d) : 100;
  logDraft = {dish:dishId, entryId, qty: ex?ex.qty:1, mode:'serv', grams: r0(sg*(ex?ex.qty:1)), sg, base, t: ex?ex.t:(cur===todayKey()?nowHM():'13:00'), slot: ex?ex.slot:null,
    name: d?d.en:ex.name, e: d?d.e:ex.e, unit: d?(d.unit||'serving'):(ex.unit||'serving')};
  if(!logDraft.slot) logDraft.slot=slotFor(logDraft.t);
  drawLog();
}
function drawLog(){
  const L=logDraft; const q=L.mode==='serv'?L.qty:L.grams/L.sg;
  const m={k:L.base.k*q,p:L.base.p*q,c:L.base.c*q,f:L.base.f*q};
  openSheet(`
    <div class="row" style="margin:6px 0 4px"><div class="emo" style="width:56px;height:56px;font-size:30px">${esc(L.e||'🍽️')}</div><div><h2 style="font-size:19px">${esc(L.name)}</h2><div class="small muted">1 serving = ${esc(L.unit)} (~${r0(L.sg)} g)</div></div></div>
    <label class="f">How much?</label>
    <div class="seg" style="margin-bottom:8px"><button class="${L.mode==='serv'?'on':''}" data-act="logMode" data-m="serv">Servings</button><button class="${L.mode==='g'?'on':''}" data-act="logMode" data-m="g">Grams</button></div>
    ${L.mode==='serv'
      ? `<div class="stepper"><button data-act="qty" data-d="-0.5">−</button><div class="v">${r1(L.qty)} <span class="small muted">× ${esc(L.unit)}</span></div><button data-act="qty" data-d="0.5">+</button></div>
         <div class="chips" style="margin-top:8px">${[0.5,1,1.5,2,3].map(v=>`<button class="chip ${L.qty===v?'on':''}" data-act="qtySet" data-v="${v}">${v}×</button>`).join('')}</div>`
      : `<input class="inp" id="logGrams" inputmode="numeric" value="${r0(L.grams)}"><div class="small muted" style="margin-top:6px">= ${r1(L.grams/L.sg)} servings</div>`}
    <div class="row" style="margin-top:4px"><div class="grow"><label class="f">Time</label><input type="time" class="inp" id="logTime" value="${esc(L.t)}"></div>
      <div class="grow"><label class="f">Meal</label><select class="inp" id="logSlot">${SLOTS.map(([id,n])=>`<option value="${id}" ${id===L.slot?'selected':''}>${n}</option>`).join('')}</select></div></div>
    <div class="card" style="margin-top:14px;padding:12px"><div class="mac" id="logMac"><div><b style="color:var(--kcal)">${r0(m.k)}</b><span>kcal</span></div><div><b style="color:var(--prot)">${r1(m.p)}</b><span>protein g</span></div><div><b style="color:var(--carb)">${r1(m.c)}</b><span>carbs g</span></div><div><b style="color:var(--fat)">${r1(m.f)}</b><span>fat g</span></div></div></div>
    <button class="btn pri full" data-act="logSave">${L.entryId?'Update':'Add to '+esc(niceDate(cur))}</button>
  `, b=>{
    const g=$('#logGrams',b); if(g) g.addEventListener('input',()=>{ L.grams=Math.max(0,+g.value||0); updLogMac(); g.nextElementSibling.textContent=`= ${r1(L.grams/L.sg)} servings`; });
    $('#logTime',b).addEventListener('change',e=>{ L.t=e.target.value||L.t; L.slot=slotFor(L.t); $('#logSlot',b).value=L.slot; });
    $('#logSlot',b).addEventListener('change',e=>L.slot=e.target.value);
  });
}
function updLogMac(){ const L=logDraft; const q=L.mode==='serv'?L.qty:L.grams/L.sg; const el=$('#logMac'); if(!el) return;
  const v=[r0(L.base.k*q), r1(L.base.p*q), r1(L.base.c*q), r1(L.base.f*q)]; $$('b',el).forEach((b,i)=>b.textContent=v[i]); }
function saveLog(){
  const L=logDraft; const q = L.mode==='serv'?L.qty:L.grams/L.sg; if(!(q>0)){ toast('Enter an amount'); return; }
  const d=day(); const before=dayTotals().p;
  const entry={id:L.entryId||uid(), t:L.t, slot:L.slot, dish:L.dish, name:L.name, e:L.e, unit:L.unit, qty:r1(q*100)/100,
    k:r1(L.base.k*q), p:r1(L.base.p*q), c:r1(L.base.c*q), f:r1(L.base.f*q)};
  if(L.entryId){ const i=d.food.findIndex(e=>e.id===L.entryId); if(i>=0) d.food[i]=entry; } else d.food.push(entry);
  save(); closeSheet(); tab='today'; render();
  const after=dayTotals().p;
  toast(`${L.entryId?'Updated':'Added'} · ${r0(entry.k)} kcal · ${r1(entry.p)} g protein`);
  if(before<S.settings.protein && after>=S.settings.protein){ setTimeout(()=>{ confetti(); toast('🎉 Protein target hit!'); },500); }
}

function quickAddSheet(){
  const recentIds=[]; const keys=Object.keys(S.days).sort().reverse().slice(0,14);
  for(const k of keys) for(const e of [...S.days[k].food].reverse()) if(e.dish && !recentIds.includes(e.dish) && dishById(e.dish)) recentIds.push(e.dish);
  const rec=recentIds.slice(0,6).map(dishById);
  const favs=S.favs.map(dishById).filter(Boolean);
  openSheet(`<h2>Log food</h2><div class="small muted" style="margin-bottom:10px">Adding to ${esc(niceDate(cur))}</div>
    <div class="search"><input id="qaSearch" placeholder="Search — roti, dal, paneer, केला…" autocomplete="off"></div>
    <div id="qaRes">
      ${favs.length?`<div class="sec-title" style="margin-top:4px">★ Saved</div><div class="list">${favs.slice(0,6).map(d=>dishCard(d).replace('data-act="openDish"','data-act="logDish"')).join('')}</div>`:''}
      ${rec.length?`<div class="sec-title">Recent</div><div class="list">${rec.map(d=>dishCard(d).replace('data-act="openDish"','data-act="logDish"')).join('')}</div>`:''}
      ${!favs.length&&!rec.length?`<div class="empty"><span class="ee">🔎</span>Start typing to find a dish.</div>`:''}
    </div>
    <div class="row" style="margin-top:14px"><button class="btn sec grow" data-act="newDish">+ New dish</button><button class="btn sec grow" data-act="quickCal">⚡ Quick calories</button></div>`,
  b=>{ const inp=$('#qaSearch',b); setTimeout(()=>inp.focus(),350);
    inp.addEventListener('input',()=>{ const r=filterDishes(inp.value,'All').slice(0,30);
      $('#qaRes',b).innerHTML = inp.value.trim() ? (`<div class="list">${r.map(d=>dishCard(d).replace('data-act="openDish"','data-act="logDish"')).join('')}</div>` || '') + (r.length?'':`<div class="empty"><span class="ee">🤔</span>Not found. Create it with “+ New dish”.</div>`) : ''; }); });
}
function quickCalSheet(){
  openSheet(`<h2>⚡ Quick calories</h2><div class="small muted">For restaurant or packaged food — type the numbers from the label or your best guess.</div>
    <label class="f">What did you eat?</label><input class="inp" id="qcName" placeholder="e.g. Office canteen thali">
    <div class="row"><div class="grow"><label class="f">Calories</label><input class="inp" id="qcK" inputmode="decimal"></div><div class="grow"><label class="f">Protein g</label><input class="inp" id="qcP" inputmode="decimal"></div></div>
    <div class="row"><div class="grow"><label class="f">Carbs g</label><input class="inp" id="qcC" inputmode="decimal"></div><div class="grow"><label class="f">Fat g</label><input class="inp" id="qcF" inputmode="decimal"></div></div>
    <div class="row"><div class="grow"><label class="f">Time</label><input type="time" class="inp" id="qcT" value="${cur===todayKey()?nowHM():'13:00'}"></div></div>
    <button class="btn pri full" style="margin-top:16px" data-act="qcSave">Add</button>`);
}

/* ----- add / edit dish ----- */
let dishDraft=null;
function newDishSheet(src, editing){
  dishDraft = src ? {id: editing?src.id:null, en: editing?src.en:src.en+' (my version)', hi:src.hi||'', e:src.e||'🍽️', cat:src.cat||'Breakfast', unit:src.unit||'1 serving', dot:src.dot||'g',
      ing:(src.ing||[]).map(x=>[...x]), steps:(src.steps||[]).join('\n'), tip:src.tip||'', mode:src.macros?'mac':'ing', macros:src.macros?{...src.macros}:{k:'',p:'',c:'',f:''}, g:src.g||''}
    : {id:null,en:'',hi:'',e:'🍽️',cat:'Breakfast',unit:'1 katori',dot:'g',ing:[],steps:'',tip:'',mode:'ing',macros:{k:'',p:'',c:'',f:''},g:''};
  drawDishForm();
}
function draftMacros(){ const D=dishDraft; return D.mode==='mac' ? {k:+D.macros.k||0,p:+D.macros.p||0,c:+D.macros.c||0,f:+D.macros.f||0} : dishMacros({ing:D.ing}); }
function drawDishForm(){
  const D=dishDraft; const m=draftMacros();
  const EMO=['🍽️','🥞','🫓','🍚','🍛','🍲','🥗','🥘','🥣','🧀','🥬','🫘','🥔','🍆','🥕','🍄','🥪','🍞','🥛','☕','🍵','🥤','🍌','🍎','🥭','🍉','🍪','🍩','🍕','🍜','🌮','🥟'];
  openSheet(`<h2>${D.id?'Edit dish':'New dish'}</h2><div class="small muted">Add ingredients with grams — the app calculates calories, protein, carbs and fat for you.</div>
    <label class="f">Dish name (English)</label><input class="inp" data-dd="en" value="${esc(D.en)}" placeholder="e.g. Methi Paneer">
    <label class="f">Name in Hindi (optional)</label><input class="inp hi" data-dd="hi" value="${esc(D.hi)}" placeholder="मेथी पनीर">
    <label class="f">Icon</label><div class="chips">${EMO.map(e=>`<button class="chip ${D.e===e?'on':''}" data-act="ddEmo" data-e="${e}" style="font-size:20px;padding:5px 9px">${e}</button>`).join('')}</div>
    <div class="row"><div class="grow"><label class="f">Category</label><select class="inp" data-dd="cat">${FOOD_CATS.map(c=>`<option ${c===D.cat?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="grow"><label class="f">Type</label><select class="inp" data-dd="dot"><option value="g" ${D.dot==='g'?'selected':''}>🟢 Everyday</option><option value="y" ${D.dot==='y'?'selected':''}>🟡 Sometimes</option><option value="r" ${D.dot==='r'?'selected':''}>🔴 Treat</option></select></div></div>
    <div class="row"><div class="grow"><label class="f">One serving is…</label><input class="inp" data-dd="unit" value="${esc(D.unit)}" placeholder="1 katori / 2 pieces"></div>
      <div style="width:120px"><label class="f">Cooked g (optional)</label><input class="inp" data-dd="g" inputmode="numeric" value="${esc(D.g)}" placeholder="auto"></div></div>
    <label class="f">Nutrition from</label>
    <div class="seg"><button class="${D.mode==='ing'?'on':''}" data-act="ddMode" data-m="ing">Ingredients (auto)</button><button class="${D.mode==='mac'?'on':''}" data-act="ddMode" data-m="mac">I know the numbers</button></div>
    ${D.mode==='ing' ? `
      <div class="card" style="margin-top:10px;padding:12px"><h3>Ingredients for ONE serving</h3>
        <div id="ingRows">${D.ing.map(([id,g],i)=>{const a=ING.get(id); return `<div class="ing-row"><div class="n">${esc(a?a[1]:id)}<small>${esc(a?a[2]:'')}</small></div><input class="inp" inputmode="decimal" data-ig="${i}" value="${g}"><span class="small muted">g</span><button class="x" data-act="ddDelIng" data-i="${i}">×</button></div>`;}).join('') || '<div class="small muted" style="padding:6px 0">No ingredients yet.</div>'}</div>
        <input class="inp" id="ingSearch" placeholder="+ Add ingredient — type moong, paneer, आटा…" style="margin-top:10px" autocomplete="off"><div id="ingSug"></div>
        <button class="btn ghost" data-act="newIng">Missing an ingredient? Create it →</button>
      </div>` : `
      <div class="row" style="margin-top:6px"><div class="grow"><label class="f">kcal</label><input class="inp" data-dm="k" inputmode="decimal" value="${esc(D.macros.k)}"></div><div class="grow"><label class="f">Protein g</label><input class="inp" data-dm="p" inputmode="decimal" value="${esc(D.macros.p)}"></div></div>
      <div class="row"><div class="grow"><label class="f">Carbs g</label><input class="inp" data-dm="c" inputmode="decimal" value="${esc(D.macros.c)}"></div><div class="grow"><label class="f">Fat g</label><input class="inp" data-dm="f" inputmode="decimal" value="${esc(D.macros.f)}"></div></div>`}
    <div class="card" style="margin-top:12px;padding:12px"><div class="small muted" style="font-weight:700;margin-bottom:6px">PER SERVING</div><div class="mac" id="ddMac"><div><b style="color:var(--kcal)">${r0(m.k)}</b><span>kcal</span></div><div><b style="color:var(--prot)">${r1(m.p)}</b><span>protein g</span></div><div><b style="color:var(--carb)">${r1(m.c)}</b><span>carbs g</span></div><div><b style="color:var(--fat)">${r1(m.f)}</b><span>fat g</span></div></div></div>
    <label class="f">Steps (one per line, optional)</label><textarea class="inp" data-dd="steps" placeholder="Soak dal 4 hours&#10;Grind…">${esc(D.steps)}</textarea>
    <label class="f">Tip (optional)</label><input class="inp" data-dd="tip" value="${esc(D.tip)}">
    <button class="btn pri full" style="margin-top:16px" data-act="ddSave">Save dish</button>`,
  b=>{
    $$('[data-dd]',b).forEach(el=>el.addEventListener('input',()=>{ D[el.dataset.dd]=el.value; }));
    $$('[data-dm]',b).forEach(el=>el.addEventListener('input',()=>{ D.macros[el.dataset.dm]=el.value; updDD(); }));
    $$('[data-ig]',b).forEach(el=>el.addEventListener('input',()=>{ D.ing[+el.dataset.ig][1]=Math.max(0,+el.value||0); updDD(); }));
    const s=$('#ingSearch',b); if(s) s.addEventListener('input',()=>{
      const q=s.value.trim().toLowerCase(); const box=$('#ingSug',b); if(!q){box.innerHTML='';return;}
      const res=[...ING.values()].filter(a=>(a[1]+' '+a[2]+' '+a[0]).toLowerCase().includes(q)).slice(0,10);
      box.innerHTML = res.length ? `<div class="sug">${res.map(a=>`<div data-act="ddAddIng" data-id="${esc(a[0])}">${esc(a[1])}<small>${esc(a[2])}</small><span class="small muted" style="float:right">${a[4]} g P /100 g</span></div>`).join('')}</div>` : `<div class="small muted" style="padding:8px">No match — create it below.</div>`;
    });
  });
}
function updDD(){ const m=draftMacros(); const el=$('#ddMac'); if(!el) return; const v=[r0(m.k),r1(m.p),r1(m.c),r1(m.f)]; $$('b',el).forEach((b,i)=>b.textContent=v[i]); }
function saveDish(){
  const D=dishDraft; if(!D.en.trim()){ toast('Give the dish a name'); return; }
  if(D.mode==='ing' && !D.ing.length){ toast('Add at least one ingredient'); return; }
  const obj={id:D.id||('my-'+slug(D.en)+'-'+uid().slice(-4)), en:D.en.trim(), hi:D.hi.trim(), e:D.e, cat:D.cat, reg:'My kitchen', dot:D.dot, unit:D.unit||'1 serving', mine:true,
    steps:D.steps.split('\n').map(s=>s.trim()).filter(Boolean), tip:D.tip.trim()};
  if(+D.g>0) obj.g=+D.g;
  if(D.mode==='ing') obj.ing=D.ing.filter(([,g])=>g>0); else obj.macros={k:+D.macros.k||0,p:+D.macros.p||0,c:+D.macros.c||0,f:+D.macros.f||0};
  const i=S.customDishes.findIndex(x=>x.id===obj.id); if(i>=0) S.customDishes[i]=obj; else S.customDishes.push(obj);
  save(); toast('Saved ✓ — it now works like every other dish'); dishSheet(obj.id); if(tab==='food') render();
}
function newIngSheet(){
  openSheet(`<h2>New ingredient</h2><div class="small muted">Values per 100 g — copy them from the pack label (“per 100 g” column).</div>
    <label class="f">Name (English)</label><input class="inp" id="niEn" placeholder="e.g. Quinoa">
    <label class="f">Name (Hindi, optional)</label><input class="inp hi" id="niHi" placeholder="क्विनोआ">
    <div class="row"><div class="grow"><label class="f">kcal / 100 g</label><input class="inp" id="niK" inputmode="decimal"></div><div class="grow"><label class="f">Protein g</label><input class="inp" id="niP" inputmode="decimal"></div></div>
    <div class="row"><div class="grow"><label class="f">Carbs g</label><input class="inp" id="niC" inputmode="decimal"></div><div class="grow"><label class="f">Fat g</label><input class="inp" id="niF" inputmode="decimal"></div></div>
    <button class="btn pri full" style="margin-top:16px" data-act="niSave">Save ingredient</button>`);
}

/* ---------------- TRAIN ---------------- */
function exCard(e){
  return `<div class="item" data-act="openEx" data-id="${esc(e.id)}">${exThumb(e)}
  <div class="txt"><div class="t1">${esc(e.en)}</div><div class="t2"><span class="hi">${esc(e.hi||'')}</span> · ${esc(e.mus||'')}</div></div>
  <div class="meta exm"><b>${esc(e.dose||'')}</b>${e.rung?`<span class="pill p">${esc(e.rung.replace(/^\w+ · /,''))}</span>`:''}</div></div>`;
}
function vTrain(){
  const plan=WEEK_PLAN[new Date().getDay()];
  const cats=['All','Mine',...EX_CATS];
  const q=exQ.trim().toLowerCase();
  const list=allEx().filter(e=>(exCat==='All'||(exCat==='Mine'?e.mine:e.cat===exCat)) && (!q || (e.en+' '+(e.hi||'')+' '+(e.mus||'')+' '+e.cat).toLowerCase().includes(q)));
  return `
  <div class="hero" style="padding:16px"><div class="greet">Today's plan · ${new Date().toLocaleDateString('en-IN',{weekday:'long'})}</div><div class="big" style="font-size:20px;margin-bottom:4px">${esc(plan.title)}</div>
   <div class="small" style="position:relative;opacity:.9">Mix of gym, calisthenics, yoga, breath — if the gym stops, use the Calisthenics ladder.</div></div>
  <div class="search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity=".5"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
    <input id="exSearch" placeholder="Search — squat, plank, सूर्य…" value="${esc(exQ)}" autocomplete="off"></div>
  <div class="chips">${cats.map(c=>`<button class="chip ${c===exCat?'on':''}" data-act="exCat" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
  ${coachBanner(EX_CATS.includes(exCat)?exCat:null)}
  <button class="btn sec full" style="margin:4px 0 12px" data-act="newEx">+ New exercise</button>
  <div class="list" id="exList">${list.map(exCard).join('') || `<div class="card empty"><span class="ee">🤸</span>No match.</div>`}</div>`;
}
function exSheet(id){
  const e=exById(id); if(!e) return; const L=ytLinks('ex',e);
  openSheet(`
    ${exStage(e)}
    <h2>${esc(e.en)}</h2><div class="hih">${esc(e.hi||'')}</div>
    <div class="row wrap" style="gap:6px;margin-bottom:12px"><span class="pill">${esc(e.cat)}</span>${e.rung?`<span class="pill p">${esc(e.rung)}</span>`:''}<span class="pill">🎯 ${esc(e.dose||'')}</span>${e.mine?'<span class="pill p">My exercise</span>':''}</div>
    <div class="small muted" style="margin-bottom:12px"><b>Works:</b> ${esc(e.mus||'')}</div>
    <button class="btn pri full" style="margin-bottom:8px" data-act="play" data-id="${esc(e.id)}">▶ Start with coach voice</button>
    <button class="btn sec full" style="margin-bottom:10px" data-act="logEx" data-id="${esc(e.id)}">✓ Just log it (did it already)</button>
    <div class="row" style="margin-bottom:16px"><a class="btn yt" href="${esc(L.hi)}" target="_blank" rel="noopener">▶ ${L.ownHi?'Your video':'Watch'} · हिंदी</a><a class="btn yt en" href="${esc(L.en)}" target="_blank" rel="noopener">▶ ${L.ownEn?'Your video':'Watch'} · English</a></div>
    ${(e.steps||[]).length?`<div class="card"><h3>How to do it</h3><ol class="steps">${e.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></div>`:''}
    ${e.tip?`<div class="tip ${/hold|only|until|below/i.test(e.tip)?'warn':''}">💡 ${esc(e.tip)}</div>`:''}
    <details class="card" style="margin-top:14px"><summary style="font-weight:700;cursor:pointer">🎬 Add my own YouTube video</summary>
      <label class="f">Hindi video link</label><input class="inp" id="lkHi" value="${esc((S.links['ex:'+e.id]||{}).hi||'')}" placeholder="https://youtube.com/...">
      <label class="f">English video link</label><input class="inp" id="lkEn" value="${esc((S.links['ex:'+e.id]||{}).en||'')}" placeholder="https://youtube.com/...">
      <button class="btn sec full" style="margin-top:12px" data-act="saveLinks" data-kind="ex" data-id="${esc(e.id)}">Save links</button></details>
    ${e.mine?`<div class="row" style="margin-top:12px"><button class="btn sec grow" data-act="editEx" data-id="${esc(e.id)}">✏️ Edit</button><button class="btn sec grow" data-act="delCustomEx" data-id="${esc(e.id)}" style="color:var(--crit)">Delete</button></div>`:''}
  `);
}
let exDraft=null;
function logExSheet(id){
  const e=exById(id); if(!e) return;
  exDraft={id, sets:3, reps:12, mins: e.type==='time'?15:0, t: cur===todayKey()?nowHM():'07:00'};
  const m=/(\d+)\s*×\s*(\d+)/.exec(e.dose||''); if(m){ exDraft.sets=+m[1]; exDraft.reps=+m[2]; }
  const mm=/(\d+)\s*(?:–|-)?\s*\d*\s*min/.exec(e.dose||''); if(e.type==='time' && mm) exDraft.mins=+mm[1];
  drawLogEx();
}
function drawLogEx(){
  const X=exDraft, e=exById(X.id); const kcal=exKcal(e,X.sets,X.reps,X.mins);
  const st=(lab,key,step,unit)=>`<label class="f">${lab}</label><div class="stepper"><button data-act="exStep" data-k="${key}" data-d="${-step}">−</button><div class="v">${X[key]} <span class="small muted">${unit}</span></div><button data-act="exStep" data-k="${key}" data-d="${step}">+</button></div>`;
  openSheet(`<div class="row" style="margin:6px 0">${exThumb(e,'style="width:64px;height:64px"')}<div><h2 style="font-size:19px">${esc(e.en)}</h2><div class="small muted">Suggested: ${esc(e.dose||'')}</div></div></div>
    ${e.type==='time' ? st('Minutes','mins',5,'min') : st('Sets','sets',1,'sets')+st('Reps per set','reps',1,'reps')}
    <label class="f">Time</label><input type="time" class="inp" id="exTime" value="${esc(X.t)}">
    <div class="card" style="margin-top:14px;padding:12px;text-align:center"><div class="small muted">Estimated burn (at ${r0(bodyKg())} kg)</div><div style="font-family:var(--font-d);font-size:26px;font-weight:800;color:var(--kcal)">~${r0(kcal)} kcal</div></div>
    <button class="btn pri full" data-act="exSave">Add to ${esc(niceDate(cur))}</button>`,
  b=>$('#exTime',b).addEventListener('change',ev=>X.t=ev.target.value||X.t));
}
function newExSheet(src){
  const E = src ? {...src, steps:(src.steps||[]).join('\n')} : {id:null,en:'',hi:'',cat:'Calisthenics',mus:'',type:'reps',dose:'3 × 10',met:4,anim:'squat',steps:'',tip:''};
  exDraft={form:E};
  openSheet(`<h2>${E.id?'Edit exercise':'New exercise'}</h2>
    <div class="fig-stage" id="nePrev">${figSVG(E.anim)}</div>
    <label class="f">Name (English)</label><input class="inp" data-ne="en" value="${esc(E.en)}" placeholder="e.g. Pike push-up">
    <label class="f">Name (Hindi, optional)</label><input class="inp hi" data-ne="hi" value="${esc(E.hi)}">
    <div class="row"><div class="grow"><label class="f">Category</label><select class="inp" data-ne="cat">${EX_CATS.map(c=>`<option ${c===E.cat?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="grow"><label class="f">Counted by</label><select class="inp" data-ne="type"><option value="reps" ${E.type==='reps'?'selected':''}>Sets × reps</option><option value="time" ${E.type==='time'?'selected':''}>Minutes</option></select></div></div>
    <label class="f">Animation (closest movement)</label><select class="inp" data-ne="anim">${Object.keys(ANIMS).map(k=>`<option ${k===E.anim?'selected':''}>${k}</option>`).join('')}</select>
    <label class="f">Muscles / benefit</label><input class="inp" data-ne="mus" value="${esc(E.mus)}" placeholder="Shoulders, triceps">
    <div class="row"><div class="grow"><label class="f">Target dose</label><input class="inp" data-ne="dose" value="${esc(E.dose)}"></div>
      <div style="width:130px"><label class="f">Effort (MET 1–10)</label><input class="inp" data-ne="met" inputmode="decimal" value="${esc(E.met)}"></div></div>
    <label class="f">Steps (one per line)</label><textarea class="inp" data-ne="steps">${esc(E.steps)}</textarea>
    <label class="f">Tip (optional)</label><input class="inp" data-ne="tip" value="${esc(E.tip||'')}">
    <div class="small muted" style="margin-top:8px">Effort guide: walking 3–4 · gym weights 5 · brisk circuits 7–8 · skipping 10.</div>
    <button class="btn pri full" style="margin-top:16px" data-act="neSave">Save exercise</button>`,
  b=>{ $$('[data-ne]',b).forEach(el=>el.addEventListener('input',()=>{ E[el.dataset.ne]=el.value;
      if(el.dataset.ne==='anim'){ $('#nePrev',b).innerHTML=figSVG(el.value); mountFigs(b); } })); });
}

/* ---------------- PROGRESS ---------------- */
function lastNDays(n){ const out=[]; for(let i=n-1;i>=0;i--) out.push(addDays(todayKey(),-i)); return out; }
function lineChart(pts, color, unit){
  if(pts.length<2) return `<div class="empty"><span class="ee">📈</span>Log at least 2 days to see your trend.</div>`;
  const W=320,H=150,P={l:34,r:12,t:12,b:24}; const ys=pts.map(p=>p.y); let lo=Math.min(...ys), hi=Math.max(...ys); if(hi-lo<2){ lo-=1; hi+=1; }
  const pad=(hi-lo)*.15; lo-=pad; hi+=pad;
  const t0=parseKey(pts[0].x).getTime(), t1=parseKey(pts[pts.length-1].x).getTime()||t0+1;
  const X=k=>P.l+(W-P.l-P.r)*((parseKey(k).getTime()-t0)/((t1-t0)||1)); const Y=v=>P.t+(H-P.t-P.b)*(1-(v-lo)/(hi-lo));
  const path=pts.map((p,i)=>(i?'L':'M')+X(p.x).toFixed(1)+','+Y(p.y).toFixed(1)).join(' ');
  const area=path+` L${X(pts[pts.length-1].x).toFixed(1)},${H-P.b} L${X(pts[0].x).toFixed(1)},${H-P.b} Z`;
  const gid='lg'+uid(); const ticks=[lo+(hi-lo)*.15, (lo+hi)/2, hi-(hi-lo)*.15];
  const last=pts[pts.length-1], first=pts[0]; const ch=last.y-first.y;
  return `<div class="row" style="justify-content:space-between;margin-bottom:4px"><div><span style="font-family:var(--font-d);font-size:24px;font-weight:800">${r1(last.y)}</span> <span class="muted small">${unit}</span></div>
   <span class="pill" style="color:${ch<=0?'var(--good)':'var(--crit)'}">${ch<=0?'▼':'▲'} ${r1(Math.abs(ch))} ${unit} since ${niceDate(first.x)}</span></div>
  <svg class="chart" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
   ${ticks.map(v=>`<line class="gl" x1="${P.l}" x2="${W-P.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${P.l-6}" y="${Y(v)+3}" text-anchor="end">${r1(v)}</text>`).join('')}
   <path d="${area}" fill="url(#${gid})"/><path class="ln" d="${path}" stroke="${color}"/>
   ${pts.map(p=>`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3.5" fill="var(--surface)" stroke="${color}" stroke-width="2"/>`).join('')}
   <text x="${P.l}" y="${H-6}">${niceDate(first.x)}</text><text x="${W-P.r}" y="${H-6}" text-anchor="end">${niceDate(last.x)}</text></svg>`;
}
function barChart(keys, valFn, target, color, unit){
  const W=320,H=140,P={l:30,r:8,t:14,b:22}; const vals=keys.map(valFn); const mx=Math.max(target*1.25, ...vals, 1);
  const bw=(W-P.l-P.r)/keys.length; const Y=v=>P.t+(H-P.t-P.b)*(1-v/mx);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">
   <line class="gl" x1="${P.l}" x2="${W-P.r}" y1="${H-P.b}" y2="${H-P.b}"/>
   ${vals.map((v,i)=>{ const hit=v>=target*0.9; const h=(H-P.b)-Y(v); return `<rect class="bar" style="animation-delay:${i*40}ms" x="${P.l+i*bw+bw*.18}" y="${Y(v)}" width="${bw*.64}" height="${Math.max(0,h)}" rx="${Math.min(5,bw*.3)}" fill="${color}" fill-opacity="${v? (hit?1:.45):.12}"/>`; }).join('')}
   <line x1="${P.l}" x2="${W-P.r}" y1="${Y(target)}" y2="${Y(target)}" stroke="${color}" stroke-dasharray="4 4" stroke-width="1.5"/>
   <text x="${P.l-4}" y="${Y(target)+3}" text-anchor="end">${r0(target)}</text>
   ${keys.map((k,i)=> (i%2===keys.length%2? '' : `<text x="${P.l+i*bw+bw/2}" y="${H-7}" text-anchor="middle">${parseKey(k).getDate()}</text>`)).join('')}
  </svg><div class="small muted">Dashed line = your target (${r0(target)} ${unit}). Solid bars = within 10% of target.</div>`;
}
const RUNGS = {
  push:['Wall','Counter','Knee','Full','Diamond'], pull:['Hang 20 s','Table row bent','Row straight','Negatives','Pull-up'],
  squat:['Chair','Squat','Split','Bulgarian','1-leg box'], hip:['Bridge','3-s hold','1-leg','Bench lift','1-leg bench'], core:['Dead bug','Plank','Side plank','Hollow','Knee raise']
};
function vProgress(){
  const keys14=lastNDays(14); const st=S.settings;
  const wPts=Object.keys(S.days).sort().filter(k=>parseFloat(S.days[k].weight)>0).map(k=>({x:k,y:parseFloat(S.days[k].weight)}));
  const waPts=Object.keys(S.days).sort().filter(k=>parseFloat(S.days[k].waist)>0).map(k=>({x:k,y:parseFloat(S.days[k].waist)}));
  // streak = consecutive days (ending today or yesterday) with any food logged
  let streak=0; let k=todayKey(); if(!(peekDay(k)?.food?.length)) k=addDays(k,-1);
  while(peekDay(k)?.food?.length){ streak++; k=addDays(k,-1); }
  const last7=lastNDays(7); const logged=last7.filter(k=>peekDay(k)?.food?.length);
  const pHit=last7.filter(k=>dayTotals(k).p>=st.protein*0.9).length;
  const avgK=logged.length? logged.reduce((s,k)=>s+dayTotals(k).k,0)/logged.length : 0;
  const avgP=logged.length? logged.reduce((s,k)=>s+dayTotals(k).p,0)/logged.length : 0;
  const workouts=last7.reduce((s,k)=>s+(peekDay(k)?.ex?.length?1:0),0);
  return `
  <div class="hero" style="padding:16px"><div class="greet">Last 7 days — measured, not guessed</div>
   <div class="rings" style="grid-template-columns:repeat(4,1fr);margin-top:8px">
    <div class="ring"><div class="rv" style="position:static;font-size:26px">${streak}</div><div class="lab">day streak 🔥</div></div>
    <div class="ring"><div class="rv" style="position:static;font-size:26px">${pHit}/7</div><div class="lab">protein days</div></div>
    <div class="ring"><div class="rv" style="position:static;font-size:26px">${workouts}/7</div><div class="lab">workout days</div></div>
    <div class="ring"><div class="rv" style="position:static;font-size:26px">${r0(avgK)}</div><div class="lab">avg kcal</div></div>
   </div></div>
  ${journeyCard()}
  ${badgesCard()}
  <div class="card"><h3>⚖️ Weight <span class="sub">target 78 kg · log on Today tab</span></h3>${lineChart(wPts,'#ff6a3d','kg')}</div>
  <div class="card"><h3>📏 Waist <span class="sub">target 32.5"</span></h3>${lineChart(waPts,'#7b5cff','in')}</div>
  <div class="card"><h3>🔥 Calories — 14 days <span class="sub">avg ${r0(avgK)}</span></h3>${barChart(keys14,k=>dayTotals(k).k,st.kcal,'#ff6a3d','kcal')}</div>
  <div class="card"><h3>💪 Protein — 14 days <span class="sub">avg ${r0(avgP)} g</span></h3>${barChart(keys14,k=>dayTotals(k).p,st.protein,'#12b886','g')}</div>
  <div class="card"><h3>🧗 Calisthenics ladder <span class="sub">tap your current rung</span></h3>
   ${Object.entries(RUNGS).map(([p,names])=>`<div style="margin-bottom:12px"><div class="row" style="justify-content:space-between;margin-bottom:5px"><b style="text-transform:capitalize">${p}</b><span class="small muted">${esc(names[S.rungs[p]-1])}</span></div>
     <div class="rung">${names.map((n,i)=>`<button class="${S.rungs[p]>=i+1?'on':''}" data-act="rung" data-p="${p}" data-n="${i+1}" title="${esc(n)}">${i+1}</button>`).join('')}</div></div>`).join('')}
   <div class="small muted">Move up when you can do 3 sets of the target reps with clean form.</div></div>`;
}

/* ---------------- ME ---------------- */
let resetArm=false;
function vMe(){
  const st=S.settings; const nDays=Object.keys(S.days).length;
  const f=(k,l,unit)=>`<div class="grow"><label class="f">${l}</label><input class="inp" inputmode="decimal" data-set="${k}" value="${esc(st[k])}" placeholder="${unit||''}"></div>`;
  return `
  <div class="card"><h3>🎯 Daily targets</h3>
    <div class="row">${f('kcal','Calories')}${f('protein','Protein g')}</div>
    <div class="row">${f('carbs','Carbs g')}${f('fat','Fat g')}</div>
    <div class="row"><div class="grow"><label class="f">Water (litres)</label><input class="inp" inputmode="decimal" data-set="waterL" value="${r1((+st.waterMl||3000)/1000)}"></div>${f('steps','Steps')}</div>
    <div class="row">${f('kg','Body weight kg','kg')}${f('heightCm','Height cm (for stride)','cm')}</div>
    <div class="small muted" style="margin-top:8px">Current plan: ~2,000 kcal and ~90 g protein from food (no powder until the kidney recheck).</div></div>
  <div class="card"><h3>🧑 My avatar <span class="sub">shown on Today</span></h3>${avatarPicker()}</div>
  <div class="card"><h3>🔊 Coach voice</h3><div class="seg">${[['en','English'],['hi','हिंदी']].map(([k,l])=>`<button class="${(st.voice||'en')===k?'on':''}" data-act="voiceLang" data-l="${k}">${l}</button>`).join('')}</div>
    <div class="row" style="margin-top:8px">${f('rest','Rest between gym sets (s)')}<div class="grow" style="display:flex;align-items:flex-end"><button class="btn sec full" data-act="testVoice">🔈 Test voice</button></div></div>
    <div class="small muted" style="margin-top:6px">Hindi needs a Hindi voice on the phone (iPhone: Settings → Accessibility → Spoken Content → Voices → Hindi).</div></div>
  <div class="card"><h3>👣 Steps from iPhone</h3><div class="small muted" style="margin-bottom:10px">Use a free Shortcut to copy today's steps, then tap 📋 Paste on Today.</div><button class="btn sec full" data-act="shortcutHelp">How to set it up</button></div>
  <div class="card"><h3>🍶 My bottles</h3>${(S.bottles||[]).length?(S.bottles.map(b=>`<div class="row" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span>${esc(b.e)} ${esc(b.name)} · ${fmtMl(b.ml)}</span><button class="x" data-act="delBottle" data-id="${esc(b.id)}" aria-label="Delete">×</button></div>`).join('')):'<div class="small muted">None yet. On Today → Water → Other → “Save as my bottle”.</div>'}</div>
  <div class="card"><h3>🎨 Look</h3><div class="seg">${['auto','light','dark'].map(t=>`<button class="${st.theme===t?'on':''}" data-act="theme" data-t="${t}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</div></div>
  <div class="card"><h3>💾 Backup <span class="sub">${nDays} days logged</span></h3>
    <div class="small muted" style="margin-bottom:10px">Your data lives only on this phone. Save a backup file every Sunday (to Files / Google Drive / WhatsApp to yourself).</div>
    <div class="row"><button class="btn pri grow" data-act="export">⬇ Save backup</button><label class="btn sec grow" style="cursor:pointer">⬆ Restore<input type="file" id="importFile" accept="application/json,.json" hidden></label></div></div>
  <div class="card"><h3>🧺 My additions</h3><div class="kv"><span>My dishes</span><span>${S.customDishes.length}</span><span>My ingredients</span><span>${S.customIngs.length}</span><span>My exercises</span><span>${S.customEx.length}</span><span>My video links</span><span>${Object.keys(S.links).length}</span></div></div>
  <div class="card"><h3>ℹ️ About</h3><div class="small muted">Ojas v${VERSION}. A tracker and coach — not a medical device. Nutrition values are estimates from Indian food tables (±10–15%). Red/orange health items need a doctor.${storageOK?'':' <b style="color:var(--crit)">Storage is blocked in this browser — data will not be kept.</b>'}</div></div>
  <button class="btn sec full" data-act="reset" style="color:var(--crit)">${resetArm?'Tap again to erase everything':'Erase all data'}</button>`;
}

/* ---------------- onboarding ---------------- */
function onboard(){
  openSheet(`<div class="dish-hero"><span>🔥</span></div><h2>Welcome to Ojas</h2><div class="hih">ओजस् — vital energy</div>
    <p>Log what you eat and the app works out calories, protein, carbs and fat. Tap any dish for its recipe, or any exercise for a moving demo and YouTube videos.</p>
    <label class="f">Your weight today (kg) — used for workout calories</label><input class="inp" id="obKg" inputmode="decimal" placeholder="e.g. 99">
    <div class="tip" style="margin-top:14px">🔒 Everything stays on this phone. No account, nothing uploaded. Use <b>Me → Save backup</b> weekly.</div>
    <button class="btn pri full" style="margin-top:16px" data-act="obDone">Let's start</button>`);
  sheetOnClose=()=>{ if(!S.settings.onboarded){ S.settings.onboarded=true; save(); } };
}

/* =====================================================================
   v1.1 — coach pictures, guided player with voice, steps journey,
          water in ml with bottles, achievements, avatar
   ===================================================================== */
const HAS_MEDIA = typeof AI_FRAMES!=='undefined';

/* ---------- exercise pictures ---------- */
function exMedia(e){
  if(!HAS_MEDIA || !e) return {kind:'fig', coach:'anaya'};
  const af=AI_FRAMES[e.id]; const coach=(af&&af.coach)||COACH_FOR_CAT[e.cat]||'anaya';
  if(af) return {kind:'ai', f:af.f, coach, tempo:af.tempo, cue:af.cue, say:af.say};
  const fx=FX[e.id];
  if(fx) return {kind:'real', f:[0,1].map(i=>`frames/real/${fx}_${i}.jpg`), alt:[0,1].map(i=>`${FX_BASE}${fx}/${i}.jpg`), coach};
  return {kind:'fig', coach};
}
function mImg(m,i,cls=''){ return `<img class="${cls}" src="${esc(m.f[i])}"${m.alt?` data-alt="${esc(m.alt[i])}"`:''} alt="" loading="lazy" decoding="async">`; }
function exThumb(e, style=''){ if(!e) return `<div class="fig-thumb" ${style}>${figSVG('stand')}</div>`; const m=exMedia(e);
  return m.kind==='fig' ? `<div class="fig-thumb" ${style}>${figSVG(e.anim)}</div>` : `<div class="fig-thumb media" data-anim="${esc(e.anim)}" ${style}>${mImg(m,0)}</div>`; }
function coachOf(e){ return HAS_MEDIA ? COACHES[exMedia(e).coach] : null; }
function exStage(e){
  const m=exMedia(e); const c=coachOf(e);
  if(m.kind==='fig') return `<div class="fig-stage">${figSVG(e.anim)}</div>`;
  const n=m.f.length, two=n===2;
  const imgs = n>2 ? m.f.map((_,i)=>mImg(m,i,'sq'+(i?'':' on'))).join('') : mImg(m,0,'f0')+(two?mImg(m,1,'f1'):'');
  return `<div class="photo-stage media ${n>2?'seq':two?'two':'one'}" data-anim="${esc(e.anim)}">${imgs}
    ${c&&m.kind==='ai'?`<div class="coach-chip"><img src="${esc(c.img)}" alt="">${esc(c.name)}</div>`:''}
    <span class="ph-tag">${m.kind==='ai'?'Ojas coach':'Trainer photo'}</span></div>`;
}
// picture fallback: local file -> internet copy -> moving stick figure
document.addEventListener('error',ev=>{
  const im=ev.target; if(!im || im.tagName!=='IMG') return;
  if(im.dataset.alt){ const a=im.dataset.alt; delete im.dataset.alt; im.src=a; return; }
  if(im.closest('.coach-chip,.av,.coach-face')){ im.style.visibility='hidden'; return; }
  const box=im.closest('.media'); if(box && !box.dataset.fell){ box.dataset.fell='1'; box.classList.remove('media','photo-stage','two','one');
    if(!box.classList.contains('fig-thumb') && !box.classList.contains('pl-stage')) box.classList.add('fig-stage');
    box.innerHTML=figSVG(box.dataset.anim||'stand'); mountFigs(box); }
}, true);

setInterval(()=>{ document.querySelectorAll('.photo-stage.seq').forEach(st=>{ const ims=[...st.querySelectorAll('img.sq')]; if(!ims.length) return;
  const i=ims.findIndex(x=>x.classList.contains('on')); ims[i<0?0:i].classList.remove('on'); ims[(i+1)%ims.length].classList.add('on'); }); }, 1700);

/* ---------- voice ---------- */
let VOICES=[]; const loadVoices=()=>{ try{ VOICES=speechSynthesis.getVoices()||[]; }catch(e){} };
if('speechSynthesis' in window){ loadVoices(); try{ speechSynthesis.addEventListener('voiceschanged',loadVoices); }catch(e){} }
function speak(text,{lang, rate=1, flush=false, onend}={}){
  let done=false; const fin=()=>{ if(done) return; done=true; onend&&onend(); };
  lang = lang || (P&&P.lang) || S.settings.voice || 'en';
  if(!('speechSynthesis' in window) || (P&&P.muted) || !text){ if(onend) setTimeout(fin,60); return; }
  try{ if(flush) speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(String(text)); const hi=lang==='hi';
    const L=v=>v.lang.toLowerCase().replace('_','-');
    const v=VOICES.find(v=>L(v).startsWith(hi?'hi':'en-in'))||VOICES.find(v=>L(v).startsWith(hi?'hi':'en'));
    if(v) u.voice=v; u.lang=hi?'hi-IN':'en-IN'; u.rate=rate; if(onend){ u.onend=fin; u.onerror=fin; } speechSynthesis.speak(u);
  }catch(e){ fin(); }
}

/* ---------- guided player ---------- */
const TEMPO = {Gym:3000, Calisthenics:2400, Cardio:1400, Yoga:5000, Breath:6000, Meditation:6000, Mobility:3000, Pelvic:10000};
const T = {
  en:{sets:(s,r,t)=>t?`${s} ${s>1?'sets':'set'} of ${t}.`:`${s} ${s>1?'sets':'set'} of ${r} reps.`, ready:'Get ready.', go:'Go!', rest:s=>`Rest. ${s} seconds.`, set:n=>`Set ${n}. Go!`,
      half:'Halfway.', left10:'10 seconds left.', minLeft:m=>`${m} ${m>1?'minutes':'minute'} left.`, done:'Great work! Well done.', next:'Next set coming.'},
  hi:{sets:(s,r,t)=>t?`${s} सेट, हर सेट ${t}।`:`${s} सेट, हर सेट में ${r} बार।`, ready:'तैयार हो जाइए।', go:'शुरू!', rest:s=>`आराम कीजिए। ${s} सेकंड।`, set:n=>`सेट ${n}। शुरू!`,
      half:'आधा हो गया।', left10:'दस सेकंड बाकी।', minLeft:m=>`${m} मिनट बाकी।`, done:'शाबाश! बहुत बढ़िया।', next:'अगला सेट आ रहा है।'}
};
function fmtSecs(s, lang='en'){ if(s>=60 && s%60===0){ const m=s/60; return lang==='hi'?`${m} मिनट`:`${m} ${m>1?'minutes':'minute'}`; }
  return lang==='hi'?`${s} सेकंड`:`${s} seconds`; }
const mmss = s => s>=60 ? `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}` : String(s);
function parseDose(e){
  const s=e.dose||''; const timed=e.type==='time'; let sets=timed?1:3, reps=10, secs=30, m;
  if(/a day/i.test(s) && (m=/(\d+)\s*×/.exec(s))){ sets=1; reps=+m[1]; }
  else if((m=/(\d+)\s*×\s*(\d+)(?:\s*[–-]\s*\d+)?\s*(min|s|m)?\b/i.exec(s))){
    sets=+m[1]; const u=(m[3]||'').toLowerCase();
    if(timed){ secs = u==='min' ? +m[2]*60 : u==='m' ? 40 : +m[2]; } else reps=+m[2]; }
  else if((m=/(\d+)\s*(?:[–→-]\s*\d+\s*)?min/i.exec(s))){ secs=+m[1]*60; }
  else if((m=/(\d+)\s*(?:[–-]\s*\d+\s*)?s\b/i.exec(s))){ secs=+m[1]; if(/each/i.test(s)) sets=2; }
  else if((m=/(\d+)\s*(?:→\s*\d+\s*)?(?:slow\s*)?rounds?/i.exec(s))){ sets=1; reps=+m[1]; }
  if(timed && /each side/i.test(s) && !/×/.test(s)) sets=2;
  return {sets:Math.max(1,sets), reps:Math.max(1,reps), secs:Math.max(5,secs)};
}
const restFor = e => ['Yoga','Breath','Meditation','Mobility','Pelvic'].includes(e.cat) ? 20 : (+S.settings.rest||45);

let P0=null, P=null;
function playerSetup(id){
  const e=exById(id); if(!e) return; const d=parseDose(e);
  P0={id, sets:d.sets, reps:d.reps, secs:d.secs, rest:restFor(e), lang:S.settings.voice||'en'}; drawSetup();
}
function drawSetup(){
  const X=P0, e=exById(X.id), c=coachOf(e), timed=e.type==='time';
  const secStep = X.secs>=120 ? 60 : X.secs>=60 ? 15 : 5;
  const st=(lab,key,step,val)=>`<label class="f">${lab}</label><div class="stepper"><button data-act="ps" data-k="${key}" data-d="${-step}">−</button><div class="v">${val}</div><button data-act="ps" data-k="${key}" data-d="${step}">+</button></div>`;
  openSheet(`${exStage(e)}
    <h2>${esc(e.en)}</h2><div class="hih">${esc(e.hi||'')}</div>
    ${c?`<div class="coach-line"><img class="coach-face" src="${esc(c.img)}" alt=""><div><b>${esc(c.name)} will guide you</b><div class="small muted">“${esc(c.line)}”</div></div></div>`:''}
    <div class="row">${'<div class="grow">'+st('Sets','sets',1,X.sets)+'</div>'}<div class="grow">${timed ? st('Time per set','secs',secStep,mmss(X.secs)+(X.secs<60?' s':'')) : st('Reps per set','reps',1,X.reps)}</div></div>
    ${X.sets>1?st('Rest between sets','rest',15,X.rest+' s'):''}
    <label class="f">Coach voice</label><div class="seg"><button class="${X.lang==='en'?'on':''}" data-act="psLang" data-l="en">English</button><button class="${X.lang==='hi'?'on':''}" data-act="psLang" data-l="hi">हिंदी</button></div>
    <button class="btn pri full" style="margin-top:16px" data-act="psStart">▶ Start — the coach counts for you</button>
    <div class="small muted" style="text-align:center;margin-top:8px">Turn the sound on. The screen stays awake. It logs itself when you finish.</div>`);
}
function plMount(){
  const e=P.e, m=P.m, c=coachOf(e);
  const stage = m.kind==='fig' ? `<div class="pl-stage fig">${figSVG(e.anim)}</div>`
    : `<div class="pl-stage media" data-anim="${esc(e.anim)}">${m.f.map((_,i)=>mImg(m,i,'fr'+(i?'':' f0'))).join('')}</div>`;
  const el=document.createElement('div'); el.className='player'; el.id='player';
  el.innerHTML=`<div class="pl-top">${stage}<div class="pl-shade"></div>
      <button class="pl-x" data-act="plStop" aria-label="End">✕</button>
      <button class="pl-mute" data-act="plMute" id="plMute" aria-label="Sound">🔊</button>
      ${c?`<div class="coach-chip pl-chip"><img src="${esc(c.img)}" alt="">${esc(c.name)}</div>`:''}
      <div class="pl-count" id="plCount"></div><div class="pl-unit" id="plUnit"></div></div>
    <div class="pl-info"><div class="pl-set" id="plSet"></div><h2>${esc(e.en)} <span class="hi">${esc(e.hi||'')}</span></h2>
      <div class="pl-cue" id="plCue"></div><div class="pl-bar"><i id="plBar"></i></div>
      <div class="pl-ctl"><button class="btn sec" data-act="plPause" id="plPause">⏸ Pause</button><button class="btn sec" data-act="plSkip">⏭ Skip</button><button class="btn pri" data-act="plStop">■ Finish</button></div></div>`;
  document.body.appendChild(el); mountFigs(el); requestAnimationFrame(()=>el.classList.add('show'));
}
const plEl = id => document.getElementById(id);
function plFrame(i){ const ims=$$('#player .pl-stage img.fr'); if(ims.length<2) return; const k=((i%ims.length)+ims.length)%ims.length; ims.forEach((im,j)=>im.style.opacity = j===k ? 1 : 0); }
function plShow(big, unit, cue){ if(big!=null){ const c=plEl('plCount'); if(c){ c.textContent=big; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); } }
  if(unit!=null && plEl('plUnit')) plEl('plUnit').textContent=unit; if(cue!=null && plEl('plCue')) plEl('plCue').textContent=cue; }
function plBar(p){ const b=plEl('plBar'); if(b) b.style.width=Math.max(0,Math.min(100,p*100))+'%'; }
function plSetLabel(txt){ const s=plEl('plSet'); if(s) s.textContent=txt; }
function plAfter(ms, fn){ if(!P) return; clearTimeout(P.t); const g=P.gen; P.next=fn; P.due=Date.now()+ms;
  P.t=setTimeout(()=>{ if(!P || P.gen!==g || P.paused) return; P.next=null; fn(); }, ms); }
async function plWake(){ try{ if(navigator.wakeLock) P.wl = await navigator.wakeLock.request('screen'); }catch(e){} }

function plStart(){
  const e=exById(P0.id); if(!e) return;
  P={...P0, e, m:exMedia(e), set:1, rep:0, h:0, left:0, worked:0, doneSets:0, phase:'intro', gen:1, paused:false, muted:false, t:null};
  closeSheet(); plMount(); plWake();
  const L=T[P.lang], timed=e.type==='time';
  const steps=(e.steps||[]).slice(0,3).join(' ');
  const dose=L.sets(P.sets, P.reps, timed?fmtSecs(P.secs,P.lang):null);
  const intro = P.lang==='hi' ? `${e.hi||e.en}. ${dose} ${L.ready}` : `${e.en}. ${steps} ${dose} ${L.ready}`;
  plSetLabel(`Set 1 of ${P.sets}`); plShow('', '', (e.steps||[]).slice(0,3).join(' • ') || dose);
  const g=P.gen; const go=()=>{ if(P && P.gen===g && P.phase==='intro') plCountdown(); };
  speak(intro,{flush:true, onend:()=>setTimeout(go,300)});
  plAfter(Math.min(16000, 2000+intro.length*70), go);
}
function plCountdown(){ P.phase='count'; let n=3;
  const step=()=>{ plShow(n,'get ready'); speak(String(n),{flush:true}); n--; plAfter(1000, n>0?step:plWork); }; step(); }
function plWork(){
  const e=P.e, L=T[P.lang], timed=e.type==='time'; P.phase='work'; P.h=0; P.rep=0; plFrame(0); plBar(0);
  plSetLabel(`Set ${P.set} of ${P.sets}`);
  const cue=P.m.cue && P.m.cue[P.lang];
  if(!timed){
    const n=(P.m.f||[]).length, steps=Math.max(2,n), say=P.m.say && P.m.say[P.lang];
    const half=(P.m.tempo||TEMPO[e.cat]||2400)/steps;
    const first = say ? say[0] : cue ? cue[0] : '';
    plShow(0, `of ${P.reps}`, first);
    speak(first || L.go,{flush:true});
    const tick=()=>{ P.h++; plFrame(P.h);
      if(P.h%steps===0){ P.rep++; plShow(P.rep,`of ${P.reps}`, first); plBar(P.rep/P.reps);
        speak(String(P.rep),{flush:!(cue||say), rate:1.1});
        if(P.rep>=P.reps){ plAfter(800, plEndSet); return; }
        if(first) speak(first);
      } else if(say){ const w=say[P.h%steps]; plShow(null,null,w); speak(w,{flush:true}); plBar((P.rep+(P.h%steps)/steps)/P.reps); }
      else if(cue){ plShow(null,null,cue[1]); speak(cue[1],{flush:true}); }
      plAfter(half, tick); };
    plAfter(half, tick);
  } else {
    const countMode = (e.met||0)>=6 && P.secs<=120;      // fast cardio: count every second aloud
    const flip = P.m.tempo ? Math.max(1, Math.round(P.m.tempo/2000)) : (countMode?1:3);
    P.left=P.secs; let el=0;
    plShow(countMode?0:mmss(P.left), countMode?`${P.secs} s`:'seconds left', cue?cue[0]:'Keep breathing');
    speak(L.go,{flush:true});
    const tick=()=>{ P.left--; el++; P.worked++; plBar(el/P.secs);
      if(el%flip===0) plFrame(el/flip);
      if(countMode){ plShow(el); speak(String(el),{flush:true, rate:1.2}); }
      else { plShow(mmss(P.left));
        if(cue && P.m.tempo && el%Math.max(1,Math.round(P.m.tempo/2000))===0){ const c=cue[(el/Math.round(P.m.tempo/2000))%2]; plShow(null,null,c); speak(c,{flush:true}); }
        else if(P.secs>120){ if(P.left>0 && P.left%60===0) speak(L.minLeft(P.left/60),{flush:true}); }
        else if(P.left===10 && P.secs>=30) speak(L.left10,{flush:true});
        else if(P.left<=3 && P.left>0) speak(String(P.left),{flush:true});
        else if(el===Math.floor(P.secs/2) && P.secs>=20) speak(L.half,{flush:true}); }
      if(P.left<=0){ plAfter(600, plEndSet); return; }
      plAfter(1000, tick); };
    plAfter(1000, tick);
  }
}
function plEndSet(){
  P.doneSets++; const L=T[P.lang];
  if(P.set>=P.sets){ plFinish(); return; }
  P.phase='rest'; P.left=P.rest; plFrame(0);
  plSetLabel(`Rest · then set ${P.set+1} of ${P.sets}`); plShow(P.left,'rest', 'Shake out, sip water, breathe slowly.'); plBar(0);
  speak(L.rest(P.rest),{flush:true});
  const tick=()=>{ P.left--; plShow(P.left); plBar(1-P.left/P.rest);
    if(P.left===10 && P.rest>15) speak(L.next,{flush:true});
    if(P.left<=3 && P.left>0) speak(String(P.left),{flush:true});
    if(P.left<=0){ P.set++; speak(L.set(P.set),{flush:true}); plAfter(900, plWork); return; }
    plAfter(1000, tick); };
  plAfter(1000, tick);
}
function plFinish(partial){
  const e=P.e, timed=e.type==='time';
  if(partial && P.phase==='work' && (P.rep>0 || (timed && P.left<P.secs))) P.doneSets++;
  const sets=P.doneSets;
  if(sets<1){ plClose(); return; }
  P.phase='done'; P.gen++; clearTimeout(P.t);
  const mins = timed ? Math.max(1, Math.round(P.worked/60*10)/10) : 0;
  const kcal = r0(exKcal(e, sets, P.reps, mins));
  const d=day();
  d.ex.push({id:uid(), t:cur===todayKey()?nowHM():'07:00', ex:e.id, name:e.en, cat:e.cat, sets:timed?0:sets, reps:timed?0:P.reps, mins, kcal, guided:true});
  if(e.id==='kegel') d.kegel=Math.min(3,(d.kegel||0)+1);
  if(e.cat==='Meditation') d.ticks.med=true; if(e.cat==='Breath') d.ticks.breath=true;
  save();
  const what = timed ? `${mins} min` : `${sets} × ${P.reps}`;
  const box=$('#player .pl-info');
  if(box) box.innerHTML=`<div class="pl-done"><div class="big">✅</div><h2>${esc(e.en)} done!</h2><div class="muted">${what} · ~${kcal} kcal · logged to ${esc(niceDate(cur))}</div>
    <button class="btn pri full" style="margin-top:16px" data-act="plClose">Done</button></div>`;
  plShow('🎉','',''); plBar(1); confetti(); speak(T[P.lang].done,{flush:true});
}
function plClose(){
  if(!P) return; P.gen++; clearTimeout(P.t); try{ speechSynthesis.cancel(); }catch(e){} try{ P.wl && P.wl.release(); }catch(e){}
  const el=$('#player'); P=null; if(el){ el.classList.remove('show'); setTimeout(()=>el.remove(),300); }
  render(); checkBadges(); if(pendingCele.length) setTimeout(()=>celebrate(pendingCele.splice(0)), 350);
}
function plPause(){
  if(!P || P.phase==='done') return; const b=plEl('plPause');
  if(!P.paused){ P.paused=true; clearTimeout(P.t); P.leftMs=Math.max(0,(P.due||Date.now())-Date.now()); try{ speechSynthesis.cancel(); }catch(e){} if(b) b.textContent='▶ Resume'; $('#player').classList.add('paused'); }
  else { P.paused=false; if(b) b.textContent='⏸ Pause'; $('#player').classList.remove('paused'); if(P.next) plAfter(P.leftMs||300, P.next); }
}
function plSkip(){
  if(!P || P.phase==='done') return; P.paused=false; const b=plEl('plPause'); if(b) b.textContent='⏸ Pause'; $('#player')?.classList.remove('paused');
  P.gen++; clearTimeout(P.t); try{ speechSynthesis.cancel(); }catch(e){}
  if(P.phase==='intro'||P.phase==='count') plWork();
  else if(P.phase==='work') plEndSet();
  else if(P.phase==='rest'){ P.set++; plWork(); }
}

/* ---------- steps & journey ---------- */
const strideM = () => (+S.settings.heightCm||170)*0.415/100;
function stepsOf(v){ return +String(v||'').replace(/[^\d]/g,'') || 0; }
function stepStats(v){ const n=stepsOf(v); const km=n*strideM()/1000; return {n, km, kcal:0.5*bodyKg()*km}; }
function totalStepsAll(){ let t=0; for(const k in S.days) t+=stepsOf(S.days[k].steps); return t; }
function journeyAt(km){
  if(!HAS_MEDIA) return null; const L=JOURNEY[JOURNEY.length-1].km; const lap=Math.floor(km/L); const x=km-lap*L;
  let i=0; while(i<JOURNEY.length-1 && JOURNEY[i+1].km<=x) i++;
  const a=JOURNEY[i], b=JOURNEY[i+1]||null; return {lap, x, i, a, b, pct:b?(x-a.km)/(b.km-a.km):1, toGo:b?b.km-x:0};
}
const fmtKm = km => km>=100 ? r0(km).toLocaleString('en-IN') : r1(km);
function stepsCard(d){
  const st=S.settings, s=stepStats(d.steps), tgt=+st.steps||8000; const tot=totalStepsAll()*strideM()/1000; const j=journeyAt(tot);
  return `<div class="card steps-card">
    <div class="row" style="justify-content:space-between;margin-bottom:8px"><b style="font-family:var(--font-d)">👣 Steps</b><span class="small muted">goal ${tgt.toLocaleString('en-IN')}</span></div>
    <div class="row"><input class="inp big" inputmode="numeric" data-in="steps" id="stepsIn" value="${esc(d.steps)}" placeholder="0"><button class="btn sec" data-act="pasteSteps" style="white-space:nowrap">📋 Paste</button></div>
    <div class="pbar"><i id="stBar" style="width:${Math.min(100,s.n/tgt*100)}%"></i></div>
    <div class="kv3"><div><b id="stKm">${r1(s.km)}</b><small>km</small></div><div><b id="stKcal">${r0(s.kcal)}</b><small>kcal walked</small></div><div><b id="stPct">${r0(s.n/tgt*100)}%</b><small>of goal</small></div></div>
    ${j?`<button class="jmini" data-act="tab" data-tab="progress"><span class="walker">🚶</span><span class="grow">Journey: <b>${fmtKm(tot)} km</b> from Gurgaon${j.b?` · <b>${fmtKm(j.toGo)} km</b> to ${esc(j.b.name.split(',')[0])} ${j.b.e}`:''}</span><span>›</span></button>`:''}
  </div>`;
}
function updStepsUI(){ const d=day(); const s=stepStats(d.steps), tgt=+S.settings.steps||8000;
  const set=(id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  set('stKm',r1(s.km)); set('stKcal',r0(s.kcal)); set('stPct',r0(s.n/tgt*100)+'%'); const b=document.getElementById('stBar'); if(b) b.style.width=Math.min(100,s.n/tgt*100)+'%'; }
function journeyCard(){
  const steps=totalStepsAll(), km=steps*strideM()/1000, j=journeyAt(km); if(!j) return '';
  const from=Math.max(0,j.i-1), to=Math.min(JOURNEY.length-1, j.i+3);
  let rows='';
  for(let i=from;i<=to;i++){ const s=JOURNEY[i]; const passed=i<=j.i;
    rows+=`<div class="jstop ${passed?'on':''}"><span class="jdot">${passed?s.e:'○'}</span><span class="grow">${esc(s.name)}</span><span class="small muted">${s.km.toLocaleString('en-IN')} km</span></div>`;
    if(i===j.i && j.b) rows+=`<div class="jnow"><span class="walker">🚶</span><div class="grow"><div class="pbar"><i style="width:${r0(j.pct*100)}%"></i></div><div class="small">${fmtKm(j.toGo)} km to ${esc(j.b.name.split(',')[0])}</div></div></div>`;
  }
  return `<div class="card"><h3>🗺️ Walking journey <span class="sub">Gurgaon → Kanyakumari${j.lap?` · lap ${j.lap+1}`:''}</span></h3>
    <div class="jhead"><div><b data-count="${r0(km)}">0</b><small>km walked</small></div><div><b>${steps.toLocaleString('en-IN')}</b><small>total steps</small></div></div>
    ${from>0?'<div class="small muted" style="margin:4px 0 2px 34px">⋮</div>':''}${rows}${to<JOURNEY.length-1?'<div class="small muted" style="margin:2px 0 0 34px">⋮ all the way to Kanyakumari 🌅 (3,720 km)</div>':''}
    <div class="small muted" style="margin-top:8px">Distance from your steps × stride (${r0(strideM()*100)} cm, from height ${+S.settings.heightCm||170} cm). Road distances are approximate.</div></div>`;
}
function shortcutSheet(){
  openSheet(`<h2>📲 Steps from iPhone in 1 tap</h2><div class="hih">One-time setup · about 3 minutes</div>
    <div class="small muted" style="margin-bottom:10px">A web app can't read Apple Health directly. This free iPhone Shortcut copies today's steps, then you tap <b>📋 Paste</b> in Ojas.</div>
    <div class="card"><h3>Make the Shortcut</h3><ol class="steps">
      <li>Open the <b>Shortcuts</b> app → tap <b>+</b> → name it <b>Ojas steps</b>.</li>
      <li>Add action <b>Find Health Samples</b> → Type: <b>Steps</b> → add filter <b>Start Date is Today</b>.</li>
      <li>Add action <b>Calculate Statistics</b> → <b>Sum</b> of Health Samples.</li>
      <li>Add action <b>Round Number</b> (to Ones).</li>
      <li>Add action <b>Copy to Clipboard</b>.</li>
      <li>Run it once — allow Health access when asked.</li></ol></div>
    <div class="card"><h3>Every evening</h3><ol class="steps"><li>Run <b>Ojas steps</b> (from the widget, or say “Hey Siri, Ojas steps”).</li><li>Open Ojas → Today → <b>📋 Paste</b>. Done.</li></ol></div>
    <div class="tip">💡 If the number looks double (iPhone + watch both counting), add a filter <b>Source is</b> your iPhone in step 2.</div>`);
}

/* ---------- water ---------- */
const DEF_BOTTLES=[{id:'glass',name:'Glass',ml:250,e:'🥛'},{id:'b500',name:'Small bottle',ml:500,e:'🧴'},{id:'b1l',name:'Bottle',ml:1000,e:'🍶'}];
const bottles = () => [...DEF_BOTTLES, ...(S.bottles||[])];
const wml = d => d ? (d.waterMl!=null ? d.waterMl : (d.water||0)*250) : 0;
const fmtMl = ml => ml>=1000 ? `${r1(ml/1000)} L` : `${r0(ml)} ml`;
let lastWater=null;
function waterCard(d){
  const tgt=+S.settings.waterMl||3000, ml=wml(d), pct=Math.min(1,ml/tgt);
  const prev = lastWater && lastWater.k===cur ? lastWater.p : pct; lastWater={k:cur,p:pct};
  const ty = p => 8 + 102*(1-p);
  const last=(d.waterLog||[]).slice(-1)[0];
  return `<div class="card water-card"><div class="wbottle"><svg viewBox="0 0 70 120" aria-hidden="true"><defs><clipPath id="wclip"><path d="M24 4h22v10c0 4 12 8 12 20v76a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8V34c0-12 12-16 12-20z"/></clipPath></defs>
      <g clip-path="url(#wclip)"><rect x="0" y="0" width="70" height="120" fill="var(--surface-2)"/>
      <g class="wlvl" data-ty="${ty(pct)}" style="transform:translateY(${ty(prev)}px)"><path class="wave" d="M-70 6 Q-52 0 -35 6 T0 6 T35 6 T70 6 T105 6 T140 6 V130 H-70z" fill="#38bdf8"/><rect x="-70" y="10" width="210" height="130" fill="#38bdf8"/></g></g>
      <path d="M24 4h22v10c0 4 12 8 12 20v76a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8V34c0-12 12-16 12-20z" fill="none" stroke="var(--border)" stroke-width="2.5"/></svg>
      <div class="wpct">${r0(pct*100)}%</div></div>
    <div class="grow" style="min-width:0"><div class="row" style="justify-content:space-between"><b style="font-family:var(--font-d)">💧 Water</b><span class="small muted">goal ${fmtMl(tgt)}</span></div>
      <div class="wbig"><b>${fmtMl(ml)}</b> <span class="small muted">${ml<tgt?fmtMl(tgt-ml)+' to go':'goal done 🎉'}</span></div>
      <div class="wbtns">${bottles().map(b=>`<button class="wbtn" data-act="addWater" data-ml="${b.ml}" data-n="${esc(b.name)}"><span>${esc(b.e)}</span><b>${esc(b.name)}</b><small>${fmtMl(b.ml)}</small></button>`).join('')}
        <button class="wbtn" data-act="waterOther"><span>➕</span><b>Other</b><small>any amount</small></button></div>
      ${last?`<button class="btn ghost" style="padding:6px 0 0" data-act="waterUndo">↶ Undo last (${fmtMl(last.ml)} at ${esc(last.t)})</button>`:''}</div></div>`;
}
function addWater(ml, label){
  const d=day(); const before=wml(d); d.waterMl=before+ml; d.waterLog.push({ml, t:nowHM(), n:label||''}); save(); render();
  const tgt=+S.settings.waterMl||3000; if(before<tgt && d.waterMl>=tgt){ confetti(); toast(`💧 ${fmtMl(tgt)} done! Great hydration.`); } else toast(`💧 +${fmtMl(ml)}`);
}
function waterOtherSheet(){
  openSheet(`<h2>💧 Add water</h2><div class="hih">Any amount</div>
    <div class="chips" style="margin-bottom:6px">${[100,150,200,300,750].map(n=>`<button class="chip" data-act="woQuick" data-ml="${n}">${n} ml</button>`).join('')}</div>
    <label class="f">Amount (ml)</label><input class="inp" id="woMl" inputmode="numeric" placeholder="e.g. 350">
    <details class="card" style="margin-top:12px"><summary style="font-weight:700;cursor:pointer">⭐ Save as my bottle (one-tap button)</summary>
      <label class="f">Name</label><input class="inp" id="woName" placeholder="e.g. Steel bottle">
      <label class="f">Icon</label><div class="chips">${['🍶','🧴','🥤','🫗','☕','🥥','🍵'].map((e,i)=>`<button class="chip ${i===0?'on':''}" data-act="woEmo" data-e="${e}">${e}</button>`).join('')}</div>
      <button class="btn sec full" style="margin-top:10px" data-act="woSaveBottle">Save bottle</button></details>
    <button class="btn pri full" style="margin-top:14px" data-act="woAdd">Add</button>`, b=>{ A._woEmo='🍶'; setTimeout(()=>$('#woMl',b)?.focus(),250); });
}

/* ---------- achievements ---------- */
function statsAll(){
  const st=S.settings; const keys=Object.keys(S.days).sort();
  let foodDays=0, proteinDays=0, waterDays=0, maxSteps=0, totalSteps=0, workouts=0;
  for(const k of keys){ const d=S.days[k];
    if(d.food && d.food.length){ foodDays++; if(dayTotals(k).p>=st.protein*0.9) proteinDays++; }
    if(wml(d)>=(+st.waterMl||3000)) waterDays++;
    const n=stepsOf(d.steps); totalSteps+=n; if(n>maxSteps) maxSteps=n;
    if(d.ex && d.ex.length) workouts++; }
  let streak=0, k=todayKey(); if(!(peekDay(k)?.food?.length)) k=addDays(k,-1);
  while(peekDay(k)?.food?.length){ streak++; k=addDays(k,-1); }
  const ws=keys.map(k=>parseFloat(S.days[k].weight)).filter(w=>w>30);
  const kgLost = ws.length>1 ? Math.max(0, Math.max(...ws.slice(0,3)) - ws[ws.length-1]) : 0;
  return {foodDays, streak, proteinDays, waterDays, maxSteps, totalSteps, workouts, kgLost, totalKm: totalSteps*strideM()/1000};
}
let badgeT=0, pendingCele=[];
function checkBadges(){
  if(!HAS_MEDIA) return; const s=statsAll(); const first=!S.badges; if(first) S.badges={};
  const fresh=[]; for(const b of BADGES){ if(!S.badges[b.id] && b.test(s)){ S.badges[b.id]=todayKey(); fresh.push(b); } }
  if(first){ save(true); return; }
  if(fresh.length){ save(true); celebrate(fresh); if(tab==='progress') render(); }
}
const queueBadges = () => { clearTimeout(badgeT); badgeT=setTimeout(checkBadges, 700); };
function celebrate(list){
  if(P){ pendingCele.push(...list); return; }
  const b=list[0]; const more=list.length-1;
  const msg = b.journey ? `You have walked all the way to ${b.name.replace('Walked to ','')}! Keep going 🚶` : 'Earned by showing up. Keep the streak alive!';
  $('.cele')?.remove();
  const el=document.createElement('div'); el.className='cele'; el.dataset.act='celeClose';
  el.innerHTML=`<div class="cele-card"><div class="cele-rays"></div><div class="cele-emo">${b.e}</div><div class="small" style="font-weight:800;letter-spacing:.08em;opacity:.8">ACHIEVEMENT UNLOCKED</div>
    <h2>${esc(b.name)}</h2><p>${esc(msg)}</p>${more?`<div class="small">+ ${more} more: ${list.slice(1).map(x=>x.e+' '+esc(x.name)).join(', ')}</div>`:''}
    <button class="btn pri full" style="margin-top:14px" data-act="celeClose">Yay! 🎉</button></div>`;
  document.body.appendChild(el); requestAnimationFrame(()=>el.classList.add('show')); confetti(); setTimeout(confetti,700);
  try{ navigator.vibrate && navigator.vibrate([60,40,120]); }catch(e){}
}
function badgesCard(){
  if(!HAS_MEDIA) return ''; const got=S.badges||{}; const list=BADGES.filter(b=>!b.journey); const jn=BADGES.filter(b=>b.journey);
  const n=BADGES.filter(b=>got[b.id]).length;
  const tile=b=>`<div class="badge ${got[b.id]?'on':''}" title="${esc(b.name)}"><span>${b.e}</span><b>${esc(b.name)}</b>${got[b.id]?`<small>${esc(niceDate(got[b.id]))}</small>`:''}</div>`;
  return `<div class="card"><h3>🏅 Achievements <span class="sub">${n} of ${BADGES.length} earned</span></h3><div class="badges">${list.map(tile).join('')}</div>
    <div class="small muted" style="margin:12px 0 6px;font-weight:700">Journey stops</div><div class="badges">${jn.map(tile).join('')}</div></div>`;
}

/* ---------- avatar ---------- */
function avatarHTML(cls='av'){
  const a=S.settings.avatar||'flame';
  if(a==='photo' && S.photo) return `<span class="${cls}"><img src="${S.photo}" alt="Me"></span>`;
  if(HAS_MEDIA && COACHES[a]) return `<span class="${cls}"><img src="${esc(COACHES[a].img)}" alt="${esc(COACHES[a].name)}"></span>`;
  return `<span class="${cls} flame">🔥</span>`;
}
function avatarPicker(){
  const a=S.settings.avatar||'flame';
  const opt=(id,inner,label)=>`<button class="avopt ${a===id?'on':''}" data-act="avatar" data-a="${id}">${inner}<small>${label}</small></button>`;
  return `<div class="avrow">${opt('flame','<span class="av flame">🔥</span>','Flame')}
    ${HAS_MEDIA?Object.entries(COACHES).map(([id,c])=>opt(id,`<span class="av"><img src="${esc(c.img)}" alt=""></span>`,c.name)).join(''):''}
    ${S.photo?opt('photo',`<span class="av"><img src="${S.photo}" alt=""></span>`,'My photo'):''}
    <label class="avopt"><span class="av flame">📷</span><small>${S.photo?'New photo':'My photo'}</small><input type="file" id="avatarFile" accept="image/*" hidden></label></div>`;
}
function readAvatar(file){
  const rd=new FileReader(); rd.onload=()=>{ const im=new Image(); im.onload=()=>{ const c=document.createElement('canvas'); c.width=c.height=200; const x=c.getContext('2d');
      const s=Math.min(im.width,im.height); x.drawImage(im,(im.width-s)/2,(im.height-s)/2,s,s,0,0,200,200);
      S.photo=c.toDataURL('image/jpeg',.82); S.settings.avatar='photo'; save(); render(); toast('Avatar updated ✓'); };
    im.onerror=()=>toast('Could not read that picture'); im.src=rd.result; }; rd.readAsDataURL(file);
}
function coachBanner(cat){
  if(!HAS_MEDIA) return '';
  if(cat && COACH_FOR_CAT[cat]){ const c=COACHES[COACH_FOR_CAT[cat]];
    return `<div class="coach-banner"><img class="coach-face" src="${esc(c.img)}" alt=""><div class="grow"><b>${esc(c.name)}</b> <span class="small muted">· ${esc(c.role)}</span><div class="small">“${esc(c.line)}”</div></div></div>`; }
  return `<div class="coach-row">${Object.values(COACHES).map(c=>`<div><img class="coach-face" src="${esc(c.img)}" alt=""><b>${esc(c.name)}</b><small>${esc(c.role)}</small></div>`).join('')}</div>`;
}

/* ---------------- actions ---------------- */
const A = {
  tab:el=>{ tab=el.dataset.tab; closeSheet(); render(); window.scrollTo({top:0}); },
  day:el=>{ cur=addDays(cur,+el.dataset.d); render(); },
  closeSheet:()=>closeSheet(),
  quickAdd:()=>quickAddSheet(),
  quickCal:()=>quickCalSheet(),
  qcSave:()=>{ const n=$('#qcName').value.trim()||'Quick add'; const k=+$('#qcK').value||0; if(!k){ toast('Enter calories'); return; }
    const t=$('#qcT').value||nowHM(); const before=dayTotals().p;
    day().food.push({id:uid(),t,slot:slotFor(t),dish:null,name:n,e:'⚡',unit:'entry',qty:1,k,p:+$('#qcP').value||0,c:+$('#qcC').value||0,f:+$('#qcF').value||0});
    save(); closeSheet(); tab='today'; render(); toast('Added ✓'); if(before<S.settings.protein && dayTotals().p>=S.settings.protein) confetti(); },
  openDish:el=>dishSheet(el.dataset.id),
  logDish:el=>logSheet(el.dataset.id),
  editEntry:el=>{ const e=day().food.find(x=>x.id===el.dataset.id); if(!e) return; if(e.dish && dishById(e.dish)) logSheet(e.dish,e.id); else logSheet(null,e.id); },
  delEntry:(el,ev)=>{ ev.stopPropagation(); const d=day(); const i=d.food.findIndex(x=>x.id===el.dataset.id); if(i<0) return; const [rm]=d.food.splice(i,1); save(); render(); toast(`Removed ${rm.name}`); },
  delEx:(el,ev)=>{ ev.stopPropagation(); const d=day(); d.ex=d.ex.filter(x=>x.id!==el.dataset.id); save(); render(); },
  logMode:el=>{ const L=logDraft; if(L.mode===el.dataset.m) return; if(el.dataset.m==='g') L.grams=r0(L.qty*L.sg); else L.qty=Math.max(0.5,Math.round((L.grams/L.sg)*2)/2); L.mode=el.dataset.m; drawLog(); },
  qty:el=>{ logDraft.qty=Math.max(0.5,Math.min(20,r1(logDraft.qty+(+el.dataset.d)))); drawLog(); },
  qtySet:el=>{ logDraft.qty=+el.dataset.v; drawLog(); },
  logSave:()=>saveLog(),
  fav:el=>{ const id=el.dataset.id; const i=S.favs.indexOf(id); if(i>=0) S.favs.splice(i,1); else S.favs.unshift(id); save(); el.textContent=i>=0?'☆ Save':'★ Saved'; toast(i>=0?'Removed from saved':'Saved ★'); if(tab==='food') render(); },
  saveLinks:el=>{ const hi=$('#lkHi').value.trim(), en=$('#lkEn').value.trim();
    if((hi && !isYT(hi)) || (en && !isYT(en))){ toast('Please paste a YouTube link (youtube.com or youtu.be)'); return; }
    const key=el.dataset.kind+':'+el.dataset.id; if(!hi && !en) delete S.links[key]; else S.links[key]={hi,en}; save(); toast('Video links saved ✓');
    el.dataset.kind==='dish'?dishSheet(el.dataset.id):exSheet(el.dataset.id); },
  foodCat:el=>{ foodCat=el.dataset.c; render(); },
  newDish:()=>newDishSheet(null),
  copyDish:el=>newDishSheet(dishById(el.dataset.id),false),
  editDish:el=>newDishSheet(dishById(el.dataset.id),true),
  delDish:el=>{ if(el.dataset.armed!=='1'){ el.dataset.armed='1'; el.textContent='Tap again to delete'; return; }
    S.customDishes=S.customDishes.filter(d=>d.id!==el.dataset.id); S.favs=S.favs.filter(x=>x!==el.dataset.id); save(); closeSheet(); render(); toast('Dish deleted'); },
  ddEmo:el=>{ dishDraft.e=el.dataset.e; $$('[data-act="ddEmo"]').forEach(b=>b.classList.toggle('on',b===el)); },
  ddMode:el=>{ dishDraft.mode=el.dataset.m; drawDishForm(); },
  ddAddIng:el=>{ const id=el.dataset.id; if(dishDraft.ing.some(x=>x[0]===id)){ toast('Already added — change its grams'); return; } dishDraft.ing.push([id,50]); drawDishForm(); setTimeout(()=>{ const ins=$$('[data-ig]'); const last=ins[ins.length-1]; if(last){ last.focus(); last.select(); } },60); },
  ddDelIng:el=>{ dishDraft.ing.splice(+el.dataset.i,1); drawDishForm(); },
  ddSave:()=>saveDish(),
  newIng:()=>{ const back=dishDraft&&sheetEl&&$('#ingRows')?dishDraft:null; newIngSheet(); A._ingBack=back; },
  niSave:()=>{ const en=$('#niEn').value.trim(); if(!en){ toast('Name it'); return; } const k=+$('#niK').value||0;
    const id='my-ing-'+slug(en)+'-'+uid().slice(-3); S.customIngs.push([id,en,$('#niHi').value.trim(),k,+$('#niP').value||0,+$('#niC').value||0,+$('#niF').value||0]); ING=ingMap(); save(); toast('Ingredient saved ✓');
    if(A._ingBack){ dishDraft=A._ingBack; dishDraft.ing.push([id,50]); A._ingBack=null; drawDishForm(); } else closeSheet(); },
  goTrain:el=>{ exCat=el.dataset.cat||'All'; tab='train'; render(); window.scrollTo({top:0}); },
  exCat:el=>{ exCat=el.dataset.c; render(); },
  openEx:el=>exSheet(el.dataset.id),
  logEx:el=>logExSheet(el.dataset.id),
  exStep:el=>{ const k=el.dataset.k; exDraft[k]=Math.max(k==='mins'?5:1, exDraft[k]+(+el.dataset.d)); drawLogEx(); },
  exSave:()=>{ const X=exDraft, e=exById(X.id); const d=day();
    d.ex.push({id:uid(),t:X.t,ex:e.id,name:e.en,cat:e.cat,sets:e.type==='time'?0:X.sets,reps:e.type==='time'?0:X.reps,mins:e.type==='time'?X.mins:0,kcal:r0(exKcal(e,X.sets,X.reps,X.mins))});
    if(e.id==='kegel') d.kegel=Math.min(3,(d.kegel||0)+1);
    if(e.cat==='Meditation') d.ticks.med=true; if(e.cat==='Breath') d.ticks.breath=true;
    save(); closeSheet(); toast(`💪 ${e.en} logged`); tab='today'; render(); },
  newEx:()=>newExSheet(null),
  editEx:el=>newExSheet(exById(el.dataset.id)),
  delCustomEx:el=>{ if(el.dataset.armed!=='1'){ el.dataset.armed='1'; el.textContent='Tap again to delete'; return; } S.customEx=S.customEx.filter(x=>x.id!==el.dataset.id); save(); closeSheet(); render(); },
  neSave:()=>{ const E=exDraft.form; if(!String(E.en).trim()){ toast('Name it'); return; }
    const obj={id:E.id||('my-ex-'+slug(E.en)+'-'+uid().slice(-3)), en:String(E.en).trim(), hi:String(E.hi||'').trim(), cat:E.cat, mus:E.mus, type:E.type, dose:E.dose, met:+E.met||4, anim:E.anim,
      steps:String(E.steps||'').split('\n').map(s=>s.trim()).filter(Boolean), tip:String(E.tip||'').trim(), mine:true};
    const i=S.customEx.findIndex(x=>x.id===obj.id); if(i>=0) S.customEx[i]=obj; else S.customEx.push(obj); save(); toast('Exercise saved ✓'); exSheet(obj.id); if(tab==='train') render(); },
  addWater:el=>addWater(+el.dataset.ml, el.dataset.n),
  waterOther:()=>waterOtherSheet(),
  waterUndo:()=>{ const d=day(); const x=d.waterLog.pop(); if(!x) return; d.waterMl=Math.max(0,wml(d)-x.ml); save(true); render(); toast(`Removed ${fmtMl(x.ml)}`); },
  woQuick:el=>{ $('#woMl').value=el.dataset.ml; },
  woEmo:el=>{ A._woEmo=el.dataset.e; $$('[data-act="woEmo"]').forEach(b=>b.classList.toggle('on',b===el)); },
  woAdd:()=>{ const ml=+$('#woMl').value; if(!(ml>0&&ml<=5000)){ toast('Enter ml (e.g. 350)'); return; } closeSheet(); addWater(ml,'Other'); },
  woSaveBottle:()=>{ const ml=+$('#woMl').value, n=$('#woName').value.trim(); if(!(ml>0&&ml<=5000)){ toast('Enter the ml first'); return; } if(!n){ toast('Give it a name'); return; }
    S.bottles=[...(S.bottles||[]), {id:uid(), name:n, ml, e:A._woEmo||'🍶'}]; save(true); closeSheet(); render(); toast(`Saved “${n}” — tap it any time`); },
  delBottle:el=>{ S.bottles=(S.bottles||[]).filter(b=>b.id!==el.dataset.id); save(true); render(); },
  pasteSteps:async()=>{ try{ const t=await navigator.clipboard.readText(); const m=/\d[\d,]*/.exec(t||''); const n=m?+m[0].replace(/,/g,''):0;
      if(!n){ toast('No number on the clipboard — run the Shortcut first'); return; }
      day().steps=String(n); save(); render(); toast(`👣 ${n.toLocaleString('en-IN')} steps added`); }
    catch(e){ const i=$('#stepsIn'); if(i) i.focus(); toast('Long-press the box and tap Paste'); } },
  shortcutHelp:()=>shortcutSheet(),
  play:el=>playerSetup(el.dataset.id),
  ps:el=>{ const k=el.dataset.k, dd=+el.dataset.d; const lim={sets:[1,10],reps:[1,100],secs:[5,3600],rest:[0,300]}[k]; P0[k]=Math.max(lim[0],Math.min(lim[1],P0[k]+dd)); drawSetup(); },
  psLang:el=>{ P0.lang=el.dataset.l; S.settings.voice=el.dataset.l; save(true); drawSetup(); },
  psStart:()=>plStart(),
  plPause:()=>plPause(), plSkip:()=>plSkip(), plStop:()=>{ if(P && P.phase==='done') plClose(); else if(P) plFinish(true); }, plClose:()=>plClose(),
  plMute:el=>{ if(!P) return; P.muted=!P.muted; el.textContent=P.muted?'🔇':'🔊'; if(P.muted) try{ speechSynthesis.cancel(); }catch(e){} },
  celeClose:(el,ev)=>{ if(el.classList.contains('cele') && ev.target.closest('.cele-card') && !ev.target.closest('button')) return; const c=$('.cele'); if(c){ c.classList.remove('show'); setTimeout(()=>c.remove(),300); } },
  avatar:el=>{ S.settings.avatar=el.dataset.a; save(true); render(); },
  voiceLang:el=>{ S.settings.voice=el.dataset.l; save(true); render(); speak(el.dataset.l==='hi'?'नमस्ते! मैं आपका ओजस कोच हूँ।':'Hello! I am your Ojas coach.',{lang:el.dataset.l, flush:true}); },
  testVoice:()=>{ const l=S.settings.voice||'en'; speak(l==='hi'?'एक, दो, तीन। शाबाश!':'One, two, three. Great work!',{lang:l, flush:true}); },
  kegel:el=>{ const d=day(); const n=+el.dataset.n; d.kegel = d.kegel===n ? n-1 : n; save(); render(); },
  tick:el=>{ const d=day(); const k=el.dataset.k; d.ticks[k]=!d.ticks[k]; save(); el.classList.toggle('on',d.ticks[k]); $('.bx',el).textContent=d.ticks[k]?'✓':'';
    if(TICKS.every(([x])=>d.ticks[x])){ confetti(); toast('🌟 All non-negotiables done!'); } },
  rung:el=>{ S.rungs[el.dataset.p]=+el.dataset.n; save(); render(); },
  theme:el=>{ S.settings.theme=el.dataset.t; save(); applyTheme(); render(); },
  export:()=>{ try{ const blob=new Blob([JSON.stringify(S,null,1)],{type:'application/json'}); const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download=`ojas-backup-${todayKey()}.json`; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500); toast('Backup file saved ✓'); }catch(e){ toast('Could not create the file'); } },
  reset:()=>{ if(!resetArm){ resetArm=true; render(); setTimeout(()=>{resetArm=false; if(tab==='me') render();},4000); return; } S=freshState(); S.settings.onboarded=true; save(); ING=ingMap(); resetArm=false; render(); toast('All data erased'); },
  obDone:()=>{ const kg=parseFloat($('#obKg').value); if(kg>30){ S.settings.kg=kg; day(todayKey()).weight = day(todayKey()).weight || String(kg); } S.settings.onboarded=true; save(); closeSheet(); render(); }
};
document.addEventListener('click',ev=>{
  const tb=ev.target.closest('#tabs button'); if(tb){ A.tab(tb,ev); return; }
  const el=ev.target.closest('[data-act]'); if(!el) return;
  if(el.tagName==='A') return; const fn=A[el.dataset.act]; if(fn){ if(el.tagName!=='LABEL') ev.preventDefault(); fn(el,ev); }
});
document.addEventListener('input',ev=>{
  const t=ev.target;
  if(t.id==='foodSearch'){ foodQ=t.value; const list=filterDishes(foodQ,foodCat); $('#foodList').innerHTML=list.map(dishCard).join('')||`<div class="card empty"><span class="ee">🔎</span>No match. Try another word, or create it with “+ New dish”.</div>`; return; }
  if(t.id==='exSearch'){ exQ=t.value; const q=exQ.toLowerCase(); const list=allEx().filter(e=>(exCat==='All'||(exCat==='Mine'?e.mine:e.cat===exCat))&&(e.en+' '+(e.hi||'')+' '+(e.mus||'')+' '+e.cat).toLowerCase().includes(q)); $('#exList').innerHTML=list.map(exCard).join('')||`<div class="card empty"><span class="ee">🤸</span>No match.</div>`; mountFigs($('#exList')); return; }
  if(t.dataset.in){ day()[t.dataset.in]=t.value.trim(); save(true); if(t.dataset.in==='steps') updStepsUI(); return; }
  if(t.dataset.set==='waterL'){ const v=parseFloat(t.value); if(v>0.3&&v<10){ S.settings.waterMl=Math.round(v*1000); save(true); } return; }
  if(t.dataset.set){ const v=t.value.trim(); S.settings[t.dataset.set] = t.dataset.set==='kg' ? v : (+v>0 ? +v : DEFAULT_SETTINGS[t.dataset.set]); save(); return; }
});
document.addEventListener('change',ev=>{
  const t=ev.target;
  if(t.id==='importFile' && t.files[0]){ const rd=new FileReader(); rd.onload=()=>{ try{ const s=JSON.parse(rd.result); if(!s || typeof s.days!=='object') throw 0;
      const f=freshState(); S={...f,...s,settings:{...f.settings,...(s.settings||{})},rungs:{...f.rungs,...(s.rungs||{})}}; ING=ingMap(); save(); applyTheme(); render(); toast(`Restored ✓ ${Object.keys(S.days).length} days`); }catch(e){ toast('That file is not an Ojas backup'); } }; rd.readAsText(t.files[0]); }
  if(t.id==='avatarFile' && t.files[0]) readAvatar(t.files[0]);
  if(t.dataset.in==='weight' || t.dataset.in==='waist') { if(tab==='today') toast('Saved ✓'); }
  if(t.dataset.in==='steps' && tab==='today') render();
  if(t.dataset.in || t.dataset.set) queueBadges();
});

/* ---------------- start ---------------- */
applyTheme(); render(); checkBadges();
if(!S.settings.onboarded) setTimeout(onboard,400);
window.__ojas = {S:()=>S, dishMacros, allDishes, allEx, ING:()=>ING, version:VERSION, parseDose, exMedia, statsAll, journeyAt, stepStats, P:()=>P, plFinish, checkBadges};
})();
