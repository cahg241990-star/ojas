/* OJAS app logic. All personal data stays in this phone's browser storage (localStorage key "ojas.v1"). */
(() => {
'use strict';
const VERSION = '2.6.0';
const DEMO = /[?&]demo=1\b/.test(location.search);
const KEY = DEMO ? 'ojas.demo' : 'ojas.v1';
const CLOUD_ON = () => !DEMO && typeof Cloud!=='undefined';

/* ---------------- storage ---------------- */
const DEFAULT_SETTINGS = {kcal:2000, protein:90, carbs:235, fat:60, water:12, waterMl:3000, steps:8000, heightCm:170, kg:'', theme:'dark', voice:'en', rest:45, avatar:'flame', onboarded:false};
function freshState(){ return {v:1, settings:{...DEFAULT_SETTINGS}, days:{}, customDishes:[], customIngs:[], customEx:[], links:{}, favs:[], bottles:[], photo:'', meas:[], labs:{}, retest:null, mealPick:{}, ui:{}, rungs:{push:1,pull:1,squat:1,hip:1,core:1}}; }
function load(){
  try{ const raw = localStorage.getItem(KEY); if(!raw) return freshState();
    const s = JSON.parse(raw); const f = freshState();
    return {...f, ...s, settings:{...f.settings, ...(s.settings||{})}, rungs:{...f.rungs, ...(s.rungs||{})}};
  }catch(e){ return freshState(); }
}
let S = load();
if(!S.ui) S.ui={}; if(!S.ui.bright21){ S.ui.bright21=true; }
if(!S.ui.ocean25){ S.ui.ocean25=true; S.settings.theme='dark'; } /* v2.5: Ocean Calm dark look chosen by the user */
let storageOK = true; let SAVE_N = 0;
function save(quiet){ SAVE_N++; try{ localStorage.setItem(KEY, JSON.stringify(S)); storageOK = true; }catch(e){ storageOK = false; toast('⚠️ Could not save — storage blocked'); } if(!quiet && typeof queueBadges==='function') queueBadges(); }

/* ---------------- helpers ---------------- */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const HI = s => (S && S.settings && S.settings.hindi) ? (s||'') : '';
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
  const cols=['#38bdf8','#2563eb','#60a5fa','#6366f1','#14b8a6','#f59e0b'];
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
function unitG(d){ const u=d.unit||'1 serving'; return /\d\s*(g|ml)\b/i.test(u) ? u : `${u} (${r0(servingGrams(d))} g)`; }
function amountG(d,q){ if(q===1) return unitG(d); const g=r0(servingGrams(d)*q), u=d.unit||'1 serving'; return /^1\s/.test(u) ? `${r1(q)} ${u.slice(2).replace(/\s*\(.*\)/,'')} = ${g} g` : `${r1(q)} × ${u} = ${g} g`; }
function servingGrams(d){
  if(d.g) return d.g;
  const u=(d.unit||'').toLowerCase();
  if(u.includes('katori')) return 150; if(u.includes('bowl')) return 250; if(u.includes('glass')) return 250; if(u.includes('cup')) return 200;
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
  <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset=".5" stop-color="#2563eb"/><stop offset="1" stop-color="#1e40af"/></linearGradient></defs>
  ${propSVG(a.prop)}
  <line x1="8" y1="181" x2="192" y2="181" stroke="currentColor" stroke-opacity=".12" stroke-width="2"/>
  <circle class="p-glow" cx="100" cy="100" r="0" fill="#38bdf8" opacity="0"/>
  <g class="limb" stroke="#6366f1" stroke-opacity=".55" stroke-width="8"><polyline class="p-bl"/><polyline class="p-ba"/></g>
  <line class="p-t limb" stroke="url(#${gid})" stroke-width="11"/>
  <g class="limb" stroke="url(#${gid})" stroke-width="8.5"><polyline class="p-fl"/><polyline class="p-fa"/></g>
  <circle class="p-h" r="11" fill="#ffd9a8" stroke="#2563eb" stroke-width="3"/>
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
    case 'mat': return `<rect x="12" y="180" width="176" height="6" rx="3" fill="#6366f1" fill-opacity=".35"/>`;
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
  const m=$('#main'); const html = ({today:vToday, food:vFood, train:vTrain, progress:vProgress, health:vHealth, me:vMe}[tab])();
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
const TICKS = [['warm','🫖 Warm water on waking'],['nosugar','🚫 No sugar / sweets'],['med','🧘 Meditation 10 min'],['breath','🌬️ Pranayama'],['sun','☀️ Sunlight 15 min'],['methi','💧 Methi water'],['walk','🚶 Walk after meals'],['dinner','🥣 Light dinner by 8'],['kegel3','🔥 Kegels ×3'],['protein','💪 Protein ~90 g']];
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
    tl+=`<div class="tl-slot"><span>${sn} <button class="mini" data-act="mealSaveOpen" data-s="${sid}">⭐ save</button></span><span>${r0(sk)} kcal · ${r0(sp)} g P</span></div>`;
    tl+=arr.map(e=>`<div class="item" data-act="editEntry" data-id="${e.id}"><div class="emo">${esc(e.e||'🍽️')}</div>
      <div class="txt"><div class="t1">${esc(e.name)}</div><div class="t2">${esc(e.t)} · ${r1(e.qty)} × ${esc(e.unit||'serving')}${e.est?' · <span class="chat-est">estimate</span>':''}</div></div>
      <div class="meta"><b>${r0(e.k)}</b>${r0(e.p)} g P</div><button class="x" data-act="delEntry" data-id="${e.id}" aria-label="Delete">×</button></div>`).join('');
  }
  const exList = d.ex.map(e=>`<div class="item" data-act="openEx" data-id="${e.ex}">${exThumb(exById(e.ex))}
    <div class="txt"><div class="t1">${esc(e.name)}</div><div class="t2">${esc(e.t)} · ${e.mins? r0(e.mins)+' min' : `${e.sets} × ${e.reps}`}</div></div>
    <div class="meta"><b>${r0(e.kcal)}</b>kcal</div><button class="x" data-act="delEx" data-id="${e.id}" aria-label="Delete">×</button></div>`).join('');
  const walk = stepStats(d.steps);
  const HERO=`  <section class="hero">
    <button class="hero-av" data-act="tab" data-tab="me" aria-label="Avatar">${avatarHTML()}</button>
    <div class="greet">${greet}</div>
    <div class="big">${headline}</div>
    <div class="rings">
      ${ringSVG(t.k, st.kcal, 'Calories','')}${ringSVG(t.p, st.protein, 'Protein','g')}${ringSVG(t.c, st.carbs, 'Carbs','g')}${ringSVG(t.f, st.fat, 'Fat','g')}
    </div>
    <div class="small" style="position:relative;margin-top:10px;opacity:.92">Eaten ${r0(t.k).toLocaleString('en-IN')} of ${(+st.kcal).toLocaleString('en-IN')} kcal · ${r0(t.p)} of ${st.protein} g protein</div>
    <div class="small" style="position:relative;margin-top:4px;opacity:.92">${bankLine()}</div>
  </section>
`;
  if(S.settings.simple!==false && !(S.ui&&S.ui.todayAll)) return heroSimple()+simpleToday(d);
  return HERO+`
  <button class="btn ghost full" data-act="todaySimple">▲ Back to simple view</button>
  ${setupPrompt()}
  ${reviewCard()}
  ${eventCard()}
  ${chatCard()}
  ${mustsCard()}
  ${habAlertsCard()}
  <button class="btn sec full" style="margin:-4px 0 14px" data-act="sxStart" data-wd="7">⚡ Busy day? Do the 15-min minimum</button>
  ${weeklyCard()}
  ${mindCard(d)}
  ${(()=>{ const ts=treatsIn(weekKeys(cur)); return ts.length?`<div class="next-up">🍩 Treats this week: <b>${ts.length}/${TREAT_BUDGET()}</b></div>`:''; })()}

  <div class="card session" data-act="goTrain" data-cat="${plan.cat}">
    ${exThumb(sample)}
    <div class="grow"><div class="small muted" style="font-weight:700">TODAY'S SESSION</div><div style="font-weight:800;font-family:var(--font-d)">${esc(plan.title)}</div><div class="small muted">Tap to see exercises →</div></div>
  </div>

  ${(()=>{ if(cur===todayKey()&&inQuiet()) return `<div class="next-up">🌙 Quiet hours until ${fmt12(quietTo())}</div>`; const r=cur===todayKey()&&nextReminder(); return r?`<div class="next-up">⏰ Next up · <b>${fmt12(r[0])}</b> ${esc(r[1])}</div>`:''; })()}
  ${workoutCard(parseKey(cur).getDay(), true)}
  ${mealPlanCard(d)}
  <div class="sec-title">Food log</div>
  ${tl ? `<div class="tl">${tl}</div>` : `<div class="card empty"><span class="ee">🥗</span>Nothing logged yet. Tap <b>+</b> to add what you ate.</div>`}
  <div class="row" style="margin-top:10px"><button class="btn sec grow" data-act="quickAdd">+ Add food</button><button class="btn sec grow" data-act="quickCal">⚡ Quick calories</button></div>

  <div class="sec-title">Workouts</div>
  ${exList ? `<div class="list">${exList}</div>` : `<div class="card empty" style="padding:16px"><span class="ee" style="font-size:30px">🏋️</span>No workout logged.</div>`}
  <button class="btn sec full" style="margin-top:10px" data-act="tab" data-tab="train">+ Log exercise</button>

  <div class="sec-title">Water & steps</div>
  ${waterCard(d)}
  ${stepsCard(d)}
  <div class="sec-title">Sleep & care</div>
  ${sleepCard(d)}
  ${careCard(d)}
  <div class="sec-title">Body & habits</div>
  <div class="habits">
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
  <div class="txt"><div class="t1">${esc(d.en)}</div><div class="t2">${HI(d.hi)?`<span class="hi">${esc(HI(d.hi))}</span> · `:''}${esc(unitG(d))}</div></div>
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
  ${bankCard(todayKey())}
  ${treatCard(todayKey())}
  ${portionGuideCard()}
  <div class="search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity=".5"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
    <input id="foodSearch" placeholder="Search dish or ingredient — e.g. moong, paneer, dal" value="${esc(foodQ)}" autocomplete="off"></div>
  <div class="chips">${cats.map(c=>`<button class="chip ${c===foodCat?'on':''}" data-act="foodCat" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
  <div class="row" style="margin:4px 0 12px"><button class="btn pri grow" data-act="newDish">+ New dish</button><button class="btn sec" data-act="newIng">+ Ingredient</button></div>
  <div class="small muted" style="margin:0 4px 8px">${list.length} dishes · <span class="dot g"></span> everyday <span class="dot y"></span> sometimes <span class="dot r"></span> treat · numbers per serving</div>
  <div class="list" id="foodList">${list.map(dishCard).join('') || `<div class="card empty"><span class="ee">🔎</span>No match. Try another word, or create it with “+ New dish”.</div>`}</div>`;
}

function dishSheet(id){
  const d=dishById(id); if(!d) return;
  const m=dishMacros(d); const L=ytLinks('dish',d); const fav=S.favs.includes(d.id);
  const dotLabel={g:'Everyday',y:'Sometimes',r:'Treat — rarely'}[d.dot||'g'];
  const rows=(d.ing||[]).map(([iid,g])=>{const a=ING.get(iid); if(!a) return ''; return `<tr><td>${esc(a[1])}${HI(a[2])?`<div class="small muted hi">${esc(a[2])}</div>`:''}</td><td>${r1(g)} g</td></tr>`;}).join('');
  openSheet(`
    <div class="dish-hero"><span>${esc(d.e||'🍽️')}</span></div>
    <h2>${esc(d.en)}</h2>${HI(d.hi)?`<div class="hih">${esc(HI(d.hi))}</div>`:''}
    <div class="row wrap" style="gap:6px;margin-bottom:12px"><span class="pill"><span class="dot ${d.dot||'g'}"></span>${dotLabel}</span><span class="pill">${esc(d.cat||'')}</span>${d.reg?`<span class="pill">${esc(d.reg)}</span>`:''}${d.mine?'<span class="pill p">My dish</span>':''}</div>
    <div class="card" style="padding:12px"><div class="small muted" style="margin-bottom:8px;font-weight:700">PER SERVING · ${esc(unitG(d))}${d.ing&&d.ing.length&&!/cup|glass|ml/i.test(d.unit||'')?' cooked':''}</div>
      <div class="mac"><div><b style="color:var(--kcal)">${r0(m.k)}</b><span>kcal</span></div><div><b style="color:var(--prot)">${r1(m.p)}</b><span>protein g</span></div><div><b style="color:var(--carb)">${r1(m.c)}</b><span>carbs g</span></div><div><b style="color:var(--fat)">${r1(m.f)}</b><span>fat g</span></div></div></div>
    <div class="row" style="margin-bottom:10px"><button class="btn pri grow" data-act="logDish" data-id="${esc(d.id)}">+ Log this</button><button class="btn sec" data-act="fav" data-id="${esc(d.id)}">${fav?'★ Saved':'☆ Save'}</button></div>
    <div class="row" style="margin-bottom:16px"><a class="btn yt" href="${esc(L.hi)}" target="_blank" rel="noopener">▶ ${L.ownHi?'Your video':'Watch'} · Hindi</a><a class="btn yt en" href="${esc(L.en)}" target="_blank" rel="noopener">▶ ${L.ownEn?'Your video':'Watch'} · English</a></div>
    <div class="tip" style="margin-bottom:12px">🍽️ <b>How much to eat:</b> ${esc(unitG(d))} ${/cup|glass|ml/i.test(d.unit||'')?'in your cup / glass.':'on your plate.'} ${/katori/i.test(d.unit||'')?'1 katori = 150 g ≈ ¾ cup.':/bowl/i.test(d.unit||'')?'1 bowl = 250 g ≈ 1¼ cups.':/plate/i.test(d.unit||'')?'Fill the plate once, no second helping.':''} Weigh your katori and bowl once on a kitchen scale (Me → My katori).</div>
    ${rows?`<div class="card"><h3>Ingredients <span class="sub">raw weights for ONE serving</span></h3><table class="tbl">${rows}</table><div class="small muted" style="margin-top:6px">Cooking for 2–3 people? Multiply every number. Raw dal/grain swells 3–4× when cooked.</div></div>`:''}
    ${(d.steps||[]).length?`<div class="card"><h3>How to make</h3><ol class="steps">${d.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></div>`:''}
    ${d.tip?`<div class="tip">💡 ${esc(d.tip)}</div>`:''}
    ${d.cat==='Ayurvedic drinks'?'<div class="small muted" style="margin-top:6px">A traditional home drink that supports good habits — not a medicine or treatment. Keep taking what your doctor prescribed.</div>':''}
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
  const OM = (!d && ex && ex.out) ? OUT_F : {k:1,p:1,c:1,f:1};
  const base = d ? dishMacros(d) : {k:ex.k/ex.qty/OM.k, p:ex.p/ex.qty/OM.p, c:ex.c/ex.qty/OM.c, f:ex.f/ex.qty/OM.f};
  const sg = d ? servingGrams(d) : 100;
  logDraft = {dish:dishId, entryId, qty: ex?ex.qty:1, mode:'serv', grams: r0(sg*(ex?ex.qty:1)), sg, base, t: ex?ex.t:(cur===todayKey()?nowHM():'13:00'), slot: ex?ex.slot:null,
    name: d?d.en:ex.name, e: d?d.e:ex.e, unit: d?(d.unit||'serving'):(ex.unit||'serving'), out: !!(ex&&ex.out), treat: ex&&ex.treat!=null?ex.treat:null};
  if(!logDraft.slot) logDraft.slot=slotFor(logDraft.t);
  drawLog();
}
function drawLog(){
  const L=logDraft; const q=L.mode==='serv'?L.qty:L.grams/L.sg; const M=logMult(L);
  const m={k:L.base.k*q*M.k,p:L.base.p*q*M.p,c:L.base.c*q*M.c,f:L.base.f*q*M.f}; const tr=L.treat!=null?L.treat:isTreat({dish:L.dish});
  openSheet(`
    <div class="row" style="margin:6px 0 4px"><div class="emo" style="width:56px;height:56px;font-size:30px">${esc(L.e||'🍽️')}</div><div><h2 style="font-size:19px">${esc(L.name)}</h2><div class="small muted">1 serving = ${esc(L.unit)} (~${r0(L.sg)} g)</div></div></div>
    <label class="f">How much?</label>
    <div class="seg" style="margin-bottom:8px"><button class="${L.mode==='serv'?'on':''}" data-act="logMode" data-m="serv">Servings</button><button class="${L.mode==='g'?'on':''}" data-act="logMode" data-m="g">Grams</button></div>
    ${L.mode==='serv'
      ? `<div class="stepper"><button data-act="qty" data-d="-0.5">−</button><div class="v">${r1(L.qty)} <span class="small muted">× ${esc(L.unit)}</span></div><button data-act="qty" data-d="0.5">+</button></div>
         <div class="chips" style="margin-top:8px">${[0.5,1,1.5,2,3].map(v=>`<button class="chip ${L.qty===v?'on':''}" data-act="qtySet" data-v="${v}">${v}×</button>`).join('')}</div>`
      : `<input class="inp" id="logGrams" inputmode="numeric" value="${r0(L.grams)}"><div class="small muted" style="margin-top:6px">= ${r1(L.grams/L.sg)} servings</div>`}
    ${portionChips()}
    <div class="chips" style="margin-top:6px"><button class="chip ${L.out?'on':''}" data-act="logOut">🍽️ Restaurant / dhaba (+30%)</button><button class="chip ${tr?'on':''}" data-act="logTreat">🍩 Treat</button></div>
    ${L.out?'<div class="small muted">Estimate: home recipe + extra oil and a bigger portion (calories ×1.3, fat ×1.5).</div>':''}
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
function updLogMac(){ const L=logDraft; const q=L.mode==='serv'?L.qty:L.grams/L.sg; const el=$('#logMac'); if(!el) return; const M=logMult(L);
  const v=[r0(L.base.k*q*M.k), r1(L.base.p*q*M.p), r1(L.base.c*q*M.c), r1(L.base.f*q*M.f)]; $$('b',el).forEach((b,i)=>b.textContent=v[i]); }
function saveLog(){
  const L=logDraft; const q = L.mode==='serv'?L.qty:L.grams/L.sg; if(!(q>0)){ toast('Enter an amount'); return; }
  const d=day(); const before=dayTotals().p;
  const entry={id:L.entryId||uid(), t:L.t, slot:L.slot, dish:L.dish, name:L.name, e:L.e, unit:L.unit, qty:r1(q*100)/100,
    k:r1(L.base.k*q*logMult(L).k), p:r1(L.base.p*q*logMult(L).p), c:r1(L.base.c*q*logMult(L).c), f:r1(L.base.f*q*logMult(L).f)};
  if(L.out) entry.out=true; if(L.treat!=null) entry.treat=L.treat;
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
    <div class="search"><input id="qaSearch" placeholder="Search — roti, dal, paneer, banana…" autocomplete="off"></div>
    ${mealsChips()}
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
  <div class="txt"><div class="t1">${esc(e.en)}</div><div class="t2">${HI(e.hi)?`<span class="hi">${esc(HI(e.hi))}</span> · `:''}${esc(e.mus||'')}</div></div>
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
    <input id="exSearch" placeholder="Search — squat, plank, surya…" value="${esc(exQ)}" autocomplete="off"></div>
  <div class="chips">${cats.map(c=>`<button class="chip ${c===exCat?'on':''}" data-act="exCat" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
  ${workoutCard(new Date().getDay(), true)}
  ${voiceCard()}
  <details class="card" style="margin-bottom:12px"><summary style="font-weight:800;cursor:pointer">📅 Other days' workouts</summary>${[1,2,3,4,5,6,0].filter(w=>w!==new Date().getDay()).map(w=>workoutCard(w,false)).join('')}</details>
  ${coachBanner(EX_CATS.includes(exCat)?exCat:null)}
  <button class="btn sec full" style="margin:4px 0 12px" data-act="newEx">+ New exercise</button>
  <div class="list" id="exList">${list.map(exCard).join('') || `<div class="card empty"><span class="ee">🤸</span>No match.</div>`}</div>`;
}
function exSheet(id){
  const e=exById(id); if(!e) return; const L=ytLinks('ex',e);
  openSheet(`
    ${exStage(e)}${stepStrip(e)}
    <h2>${esc(e.en)}</h2>${HI(e.hi)?`<div class="hih">${esc(HI(e.hi))}</div>`:''}
    <div class="row wrap" style="gap:6px;margin-bottom:12px"><span class="pill">${esc(e.cat)}</span>${e.rung?`<span class="pill p">${esc(e.rung)}</span>`:''}<span class="pill">🎯 ${esc(e.dose||'')}</span>${e.mine?'<span class="pill p">My exercise</span>':''}</div>
    <div class="small muted" style="margin-bottom:12px"><b>Works:</b> ${esc(e.mus||'')}</div>
    <button class="btn pri full" style="margin-bottom:8px" data-act="play" data-id="${esc(e.id)}">▶ Start with coach voice</button>
    <button class="btn sec full" style="margin-bottom:10px" data-act="axOne" data-id="${esc(e.id)}">✍️ Log my sets (did it already)</button>
    ${exProgressHTML(e.id)}
    <div class="row" style="margin-bottom:16px"><a class="btn yt" href="${esc(L.hi)}" target="_blank" rel="noopener">▶ ${L.ownHi?'Your video':'Watch'} · Hindi</a><a class="btn yt en" href="${esc(L.en)}" target="_blank" rel="noopener">▶ ${L.ownEn?'Your video':'Watch'} · English</a></div>
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
  <button class="btn pri full" style="margin-bottom:14px" data-act="report">📤 Weekly report for your coach</button>
  ${goalCard()}
  <div class="card"><h3>⚖️ Weight <span class="sub">7-day trend matters, not single days</span></h3>${lineChart(wPts,'#4f8ff7','kg')}</div>
  <div class="card"><h3>📏 Waist <span class="sub">target ${S.goal&&S.goal.waist?S.goal.waist:32.5}"</span></h3>${lineChart(waPts,'#38bdf8','in')}</div>
  ${habitsCard()}
  ${exProgressCard()}
  ${weeklyCard(todayKey(), true)}
  ${historyCard()}
  ${eventCard()}
  <div class="card"><h3>🔥 Calories — 14 days <span class="sub">avg ${r0(avgK)}</span></h3>${barChart(keys14,k=>dayTotals(k).k,st.kcal,'#4f8ff7','kcal')}</div>
  <div class="card"><h3>💪 Protein — 14 days <span class="sub">avg ${r0(avgP)} g</span></h3>${barChart(keys14,k=>dayTotals(k).p,st.protein,'#12b886','g')}</div>
  <details class="card"><summary style="font-weight:800;cursor:pointer">🏅 Badges, walking journey & ladder</summary>${journeyCard()}${badgesCard()}<div class="card"><h3>🧗 Calisthenics ladder <span class="sub">tap your current rung</span></h3>
   ${Object.entries(RUNGS).map(([p,names])=>`<div style="margin-bottom:12px"><div class="row" style="justify-content:space-between;margin-bottom:5px"><b style="text-transform:capitalize">${p}</b><span class="small muted">${esc(names[S.rungs[p]-1])}</span></div>
     <div class="rung">${names.map((n,i)=>`<button class="${S.rungs[p]>=i+1?'on':''}" data-act="rung" data-p="${p}" data-n="${i+1}" title="${esc(n)}">${i+1}</button>`).join('')}</div></div>`).join('')}
   <div class="small muted">Move up when you can do 3 sets of the target reps with clean form.</div></div></details>`;
}

/* ---------------- ME ---------------- */
let resetArm=false;
function vMe(){
  const st=S.settings; const nDays=Object.keys(S.days).length;
  const f=(k,l,unit)=>`<div class="grow"><label class="f">${l}</label><input class="inp" inputmode="decimal" data-set="${k}" value="${esc(st[k])}" placeholder="${unit||''}"></div>`;
  return `
  ${cloudCard()}
  ${dataCard()}
  ${CLOUD_ON()?`<div class="card"><h3>🧠 AI coach (Riya)</h3><div class="small muted" style="margin-bottom:8px">When on, questions and unusual messages go to the AI with a short summary of today (no photos, no private space). Everyday logging stays on the phone.</div>
    <label class="row small" style="gap:8px"><input type="checkbox" data-set-bool="ai" ${S.settings.ai!==false?'checked':''}> AI coach on</label>
    <label class="row small" style="gap:8px;margin-top:6px"><input type="checkbox" data-set-bool="aiLabs" ${S.settings.aiLabs!==false?'checked':''}> Let the AI see my latest blood results (better food advice)</label></div>`:''}
  ${meSetupCard()}
  <div class="card"><h3>🎯 Daily targets</h3>
    <div class="row">${f('kcal','Calories')}${f('protein','Protein g')}</div>
    <div class="row">${f('carbs','Carbs g')}${f('fat','Fat g')}</div>
    <div class="row"><div class="grow"><label class="f">Water (litres)</label><input class="inp" inputmode="decimal" data-set="waterL" value="${r1((+st.waterMl||3000)/1000)}"></div>${f('steps','Steps')}</div>
    <div class="row">${f('kg','Body weight kg','kg')}${f('heightCm','Height cm (for stride)','cm')}</div>
    <div class="row">${f('katoriMl','My katori (ml)','150')}${f('stepsMin','Daily minimum steps','8000')}</div>
    <div class="small muted" style="margin-top:8px">${S.plan?`Set by your plan on ${fmtD(S.plan.made)} — you can still fine-tune here.`:'Set up your starting point above to get these calculated for you.'}</div></div>
  <div class="card"><h3>🧑 My avatar <span class="sub">shown on Today</span></h3>${avatarPicker()}</div>
  <div class="card"><h3>🔊 Coach voice</h3><div class="seg">${[['en','English'],['hi','Hindi']].map(([k,l])=>`<button class="${(st.voice||'en')===k?'on':''}" data-act="voiceLang" data-l="${k}">${l}</button>`).join('')}</div>
    <div class="row" style="margin-top:8px">${f('rest','Rest between gym sets (s)')}<div class="grow" style="display:flex;align-items:flex-end"><button class="btn sec full" data-act="testVoice">🔈 Test voice</button></div></div>
    <div class="small muted" style="margin-top:6px">Hindi needs a Hindi voice on the phone (iPhone: Settings → Accessibility → Spoken Content → Voices → Hindi).</div></div>
  <div class="card"><h3>👣 Steps from iPhone</h3><div class="small muted" style="margin-bottom:10px">Use a free Shortcut to copy today's steps, then tap 📋 Paste on Today.</div><button class="btn sec full" data-act="shortcutHelp">How to set it up</button></div>
  <div class="card"><h3>⏰ Nudges & quiet hours</h3><div class="small muted" style="margin-bottom:10px">${NUDGES().length} anchored nudges a day, none in quiet hours. Chat stays silent and asks nothing in quiet hours.</div>
    <div class="row"><div class="grow"><label class="f">Quiet from</label><input type="time" class="inp" data-quiet="quietFrom" value="${esc(quietFrom())}"></div><div class="grow"><label class="f">Quiet until</label><input type="time" class="inp" data-quiet="quietTo" value="${esc(quietTo())}"></div></div>
    <div class="row" style="margin-top:10px"><button class="btn sec grow" data-act="remHelp">Set up nudges</button><button class="btn sec grow" data-act="mcHelp">☀️ 7 am card</button></div>
    <div class="row" style="margin-top:8px"><button class="btn ghost grow" data-act="morning">Show today’s morning card</button></div></div>
  ${privateCard()}
  <div class="card"><h3>🔒 Health data</h3><div class="small muted" style="margin-bottom:10px">Blood results and photos stay on this phone. Backups include them.</div><label class="btn sec full" style="cursor:pointer">⬆ Load my health file<input type="file" id="healthFile" accept="application/json,.json" hidden></label></div>
  <div class="card"><h3>🍶 My bottles</h3>${(S.bottles||[]).length?(S.bottles.map(b=>`<div class="row" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span>${esc(b.e)} ${esc(b.name)} · ${fmtMl(b.ml)}</span><button class="x" data-act="delBottle" data-id="${esc(b.id)}" aria-label="Delete">×</button></div>`).join('')):'<div class="small muted">None yet. On Today → Water → Other → “Save as my bottle”.</div>'}</div>
  <div class="card"><h3>🎨 Look</h3><div class="seg">${['auto','light','dark'].map(t=>`<button class="${st.theme===t?'on':''}" data-act="theme" data-t="${t}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</div></div>
  <div class="card"><h3>💾 Backup <span class="sub">${nDays} days logged</span></h3>
    <div class="small muted" style="margin-bottom:10px">Your data lives only on this phone. Save a backup file every Sunday (to Files / Google Drive / WhatsApp to yourself).</div>
    <div class="row"><button class="btn pri grow" data-act="export">⬇ Save backup</button><label class="btn sec grow" style="cursor:pointer">⬆ Restore<input type="file" id="importFile" accept="application/json,.json" hidden></label></div></div>
  <div class="card"><h3>🧺 My additions</h3><div class="kv"><span>My dishes</span><span>${S.customDishes.length}</span><span>My ingredients</span><span>${S.customIngs.length}</span><span>My exercises</span><span>${S.customEx.length}</span><span>My video links</span><span>${Object.keys(S.links).length}</span></div></div>
  <div class="card"><h3>ℹ️ About</h3><div class="small muted">Ojas v${VERSION}. A tracker and coach — not a medical device. Nutrition values are estimates from Indian food tables (±10–15%). Red/orange health items need a doctor.${storageOK?'':' <b style="color:var(--crit)">Storage is blocked in this browser — data will not be kept.</b>'}</div></div>
  <button class="btn sec full" data-act="reset" style="color:var(--crit)">${resetArm?'Tap again to erase this phone’s copy':'Erase all data on this phone'}</button>`;
}

/* ---------------- onboarding ---------------- */
function onboard(){
  openSheet(`<div class="dish-hero"><span>🔥</span></div><h2>Welcome to Ojas</h2><div class="hih">Vital energy</div>
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
let VIDS=null, VPACK=null;
fetch('videos/videos.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(j=>{ if(j){ VIDS=j; if(tab==='train'||tab==='today') render(); } }).catch(()=>{});
fetch('voices/voices.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(j=>{ if(j) VPACK=j; }).catch(()=>{});
function exMedia(e){
  if(!HAS_MEDIA || !e) return {kind:'fig', coach:'anaya'};
  const af=AI_FRAMES[e.id]; const coach=(af&&af.coach)||COACH_FOR_CAT[e.cat]||'anaya';
  const vd=VIDS&&VIDS[e.id];
  if(vd) return {kind:'video', v:vd, coach, f:af?af.f:null, tempo:af&&af.tempo, cue:af&&af.cue, say:af&&af.say};
  if(af) return {kind:'ai', f:af.f, coach, tempo:af.tempo, cue:af.cue, say:af.say};
  const fx=FX[e.id];
  if(fx) return {kind:'real', f:[0,1].map(i=>`frames/real/${fx}_${i}.jpg`), alt:[0,1].map(i=>`${FX_BASE}${fx}/${i}.jpg`), coach};
  return {kind:'fig', coach};
}
function mImg(m,i,cls=''){ return `<img class="${cls}" src="${esc(m.f[i])}"${m.alt?` data-alt="${esc(m.alt[i])}"`:''} alt="" loading="lazy" decoding="async">`; }
function exThumb(e, style=''){ if(!e) return `<div class="fig-thumb" ${style}>${figSVG('stand')}</div>`; const m=exMedia(e);
  if(m.kind==='video') return `<div class="fig-thumb media vthumb" data-anim="${esc(e.anim)}" ${style}><img src="${esc(m.v.poster)}" alt="" loading="lazy"><span class="play">▶</span></div>`;
  return m.kind==='fig' ? `<div class="fig-thumb" ${style}>${figSVG(e.anim)}</div>` : `<div class="fig-thumb media" data-anim="${esc(e.anim)}" ${style}>${mImg(m,0)}</div>`; }
function coachOf(e){ return HAS_MEDIA ? COACHES[exMedia(e).coach] : null; }
function exStage(e){
  const m=exMedia(e); const c=coachOf(e);
  if(m.kind==='fig') return `<div class="fig-stage">${figSVG(e.anim)}</div>`;
  if(m.kind==='video') return `<div class="photo-stage media vid" data-anim="${esc(e.anim)}"><video class="vd" src="${esc(m.v.file)}" poster="${esc(m.v.poster)}" muted loop playsinline autoplay preload="auto"></video>
    <span class="ph-tag">Video${m.v.by?' · '+esc(m.v.by):''} · ${esc(m.v.src||'Pexels')}</span></div>`;
  const n=m.f.length, two=n===2;
  const imgs = n>2 ? m.f.map((_,i)=>mImg(m,i,'sq'+(i?'':' on'))).join('') : mImg(m,0,'f0')+(two?mImg(m,1,'f1'):'');
  return `<div class="photo-stage media ${n>2?'seq':two?'two':'one'}" data-anim="${esc(e.anim)}">${imgs}
    ${c&&m.kind==='ai'?`<div class="coach-chip"><img src="${esc(c.img)}" alt="">${esc(c.name)}</div>`:''}
    <span class="ph-tag">${m.kind==='ai'?'Ojas coach':'Trainer photo'}</span></div>`;
}
// picture fallback: local file -> internet copy -> moving stick figure
document.addEventListener('error',ev=>{
  const im=ev.target; if(!im || (im.tagName!=='IMG' && im.tagName!=='VIDEO')) return;
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
const AQ={el:null, q:[], busy:false};
function aStop(){ AQ.q=[]; AQ.busy=false; if(AQ.el){ try{ AQ.el.onended=AQ.el.onerror=null; AQ.el.pause(); }catch(e){} } }
function aNext(){ if(AQ.busy || !AQ.q.length) return; const it=AQ.q.shift(); AQ.busy=true; AQ.el ||= new Audio();
  const end=()=>{ AQ.busy=false; it.fin&&it.fin(); aNext(); };
  AQ.el.onended=end; AQ.el.onerror=end; AQ.el.src=it.src; const pr=AQ.el.play(); if(pr&&pr.catch) pr.catch(end); }
function stopVoice(){ try{ speechSynthesis.cancel(); }catch(e){} aStop(); }
/* the phone's own voice is only a back-up for the recorded coach voice — always pick a FEMALE one for the female coach */
const FEM=/veena|isha|lekha|kiyara|neerja|swara|samantha|karen|moira|tessa|serena|kate|fiona|victoria|allison|\bava\b|susan|zira|heera|female|woman/i, MAL=/rishi|daniel|alex\b|aaron|fred|arthur|gordon|oliver|thomas|prabhat|madhur|ravi|\bmale\b/i;
function pickVoice(lang, g){ const L=v=>(v.lang||'').toLowerCase().replace('_','-'); const loc=lang==='hi'?'hi':'en-in', any=lang==='hi'?'hi':'en';
  const want=g==='m'?MAL:FEM, avoid=g==='m'?FEM:MAL;
  return VOICES.find(v=>L(v).startsWith(loc)&&want.test(v.name)) || VOICES.find(v=>L(v).startsWith(any)&&want.test(v.name))
    || VOICES.find(v=>L(v).startsWith(loc)&&!avoid.test(v.name)) || VOICES.find(v=>L(v).startsWith(any)&&!avoid.test(v.name)) || null; }
function speak(text,{lang, rate=1, flush=false, onend, g}={}){
  let done=false; const fin=()=>{ if(done) return; done=true; onend&&onend(); };
  lang = lang || (P&&P.lang) || S.settings.voice || 'en';
  if((P&&P.muted) || !text){ if(onend) setTimeout(fin,60); return; }
  g = g || (P && typeof VOICE!=='undefined' && VOICE.gender[P.m.coach]) || 'f';
  const file = VPACK && typeof VOICE!=='undefined' && VPACK[VOICE.ids[lang][g]+'|'+String(text)];
  if(file){ if(flush) stopVoice(); AQ.q.push({src:'voices/'+file, fin}); aNext(); return; }
  if(!('speechSynthesis' in window)){ if(onend) setTimeout(fin,60); return; }
  if(flush) aStop();
  try{ if(flush) speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(String(text)); const hi=lang==='hi';
    const v=pickVoice(hi?'hi':'en', g);
    if(v) u.voice=v; u.lang=v?v.lang:(hi?'hi-IN':'en-IN'); u.rate=rate*0.95; u.pitch=(g==='m')?1:1.08; if(onend){ u.onend=fin; u.onerror=fin; } speechSynthesis.speak(u);
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
if(typeof VOICE!=='undefined') for(const l of ['en','hi']){ const P_=VOICE.phrase[l];
  Object.assign(T[l],{ready:P_.ready, go:P_.go, rest:()=>P_.rest, set:VOICE.setGo[l], half:P_.half, left10:P_.left10, minLeft:VOICE.minLeft[l], done:P_.done, next:P_.next}); }
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
  const e=exById(id); if(!e) return; const it=findPlanItem(id)||{id}; const t=progTarget(it);
  P0={id, sets:t.sets, reps:t.reps, secs:t.secs, kg:t.kg||null, target:t, it, rest:restFor(e), lang:S.settings.voice||'en'}; drawSetup();
}
function drawSetup(){
  const X=P0, e=exById(X.id), c=coachOf(e), timed=e.type==='time';
  const secStep = X.secs>=120 ? 60 : X.secs>=60 ? 15 : 5;
  const st=(lab,key,step,val)=>`<label class="f">${lab}</label><div class="stepper"><button data-act="ps" data-k="${key}" data-d="${-step}">−</button><div class="v">${val}</div><button data-act="ps" data-k="${key}" data-d="${step}">+</button></div>`;
  openSheet(`${exStage(e)}
    <h2>${esc(e.en)}</h2>${HI(e.hi)?`<div class="hih">${esc(HI(e.hi))}</div>`:''}
    ${c?`<div class="coach-line"><img class="coach-face" src="${esc(c.img)}" alt=""><div><b>${esc(c.name)} will guide you</b><div class="small muted">“${esc(c.line)}”</div></div></div>`:''}
    <div class="row">${'<div class="grow">'+st('Sets','sets',1,X.sets)+'</div>'}<div class="grow">${timed ? st('Time per set','secs',secStep,mmss(X.secs)+(X.secs<60?' s':'')) : st('Reps per set','reps',1,X.reps)}</div></div>
    ${X.sets>1?st('Rest between sets','rest',15,X.rest+' s'):''}
    <label class="f">Coach voice</label><div class="seg"><button class="${X.lang==='en'?'on':''}" data-act="psLang" data-l="en">English</button><button class="${X.lang==='hi'?'on':''}" data-act="psLang" data-l="hi">हिंदी</button></div>
    <button class="btn pri full" style="margin-top:16px" data-act="psStart">▶ Start — the coach counts for you</button>
    <div class="small muted" style="text-align:center;margin-top:8px">Turn the sound on. The screen stays awake. It logs itself when you finish.</div>`);
}
function plMount(){
  const e=P.e, m=P.m, c=coachOf(e);
  const stage = m.kind==='video' ? `<div class="pl-stage media vid" data-anim="${esc(e.anim)}"><video class="vd" src="${esc(m.v.file)}" poster="${esc(m.v.poster)}" muted loop playsinline autoplay preload="auto"></video></div>`
    : m.kind==='fig' ? `<div class="pl-stage fig">${figSVG(e.anim)}</div>`
    : `<div class="pl-stage media" data-anim="${esc(e.anim)}">${m.f.map((_,i)=>mImg(m,i,'fr'+(i?'':' f0'))).join('')}</div>`;
  const el=document.createElement('div'); el.className='player'; el.id='player';
  el.innerHTML=`<div class="pl-top">${stage}<div class="pl-shade"></div>
      <button class="pl-x" data-act="plStop" aria-label="End">✕</button>
      <button class="pl-mute" data-act="plMute" id="plMute" aria-label="Sound">🔊</button>
      ${c&&m.kind!=='video'?`<div class="coach-chip pl-chip"><img src="${esc(c.img)}" alt="">${esc(c.name)}</div>`:''}
      <div class="pl-count" id="plCount"></div><div class="pl-unit" id="plUnit"></div></div>
    <div class="pl-info"><div class="pl-set" id="plSet"></div><h2>${esc(e.en)}${HI(e.hi)?` <span class="hi">${esc(HI(e.hi))}</span>`:''}</h2>
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
  const intro = typeof VOICE!=='undefined' ? VOICE.intro(e,P.lang) : (P.lang==='hi' ? `${e.hi||e.en}. ${dose} ${L.ready}` : `${e.en}. ${steps} ${dose} ${L.ready}`);
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
  if(sets<1){ if(SESSION){ P.phase='done'; P.gen++; clearTimeout(P.t); sessionBetween(e,'skipped',0); return; } plClose(); return; }
  P.phase='done'; P.gen++; clearTimeout(P.t);
  const mins = timed ? Math.max(1, Math.round(P.worked/60*10)/10) : 0;
  const kcal = r0(exKcal(e, sets, P.reps, mins));
  const d=day();
  const tg=P.target||{sets:P.sets, reps:P.reps, secs:P.secs, timed}; const gEntry={id:uid(), t:cur===todayKey()?nowHM():'07:00', ex:e.id, name:e.en, cat:e.cat, sets:timed?0:sets, reps:timed?0:P.reps, mins, kcal, guided:true, plan:SESSION?SESSION.wd:'lib',
    target:{sets:P.sets, reps:P.reps, secs:P.secs, kg:P.kg||null, timed, kind:tg.kind}, log:[...Array(sets)].map(()=>timed?{s:P.secs}:{r:P.reps, ...(P.kg?{kg:P.kg}:{})})};
  d.ex.push(gEntry); if(SESSION){ (SESSION.prog ||= []).push([e.id, gEntry.id, P.it]); } else progAfter(e.id, gEntry, P.it);
  if(e.id==='kegel') d.kegel=Math.min(3,(d.kegel||0)+1);
  if(e.cat==='Meditation') d.ticks.med=true; if(e.cat==='Breath') d.ticks.breath=true;
  save();
  const what = timed ? `${mins} min` : `${sets} × ${P.reps}`;
  if(SESSION){ sessionBetween(e, what, kcal); return; }
  const box=$('#player .pl-info');
  if(box) box.innerHTML=`<div class="pl-done"><div class="big">✅</div><h2>${esc(e.en)} done!</h2><div class="muted">${what} · ~${kcal} kcal · logged to ${esc(niceDate(cur))}</div>
    <button class="btn pri full" style="margin-top:16px" data-act="plClose">Done</button></div>`;
  plShow('🎉','',''); plBar(1); confetti(); speak(T[P.lang].done,{flush:true});
}
function plClose(){
  if(!P) return; P.gen++; clearTimeout(P.t); stopVoice(); try{ P.wl && P.wl.release(); }catch(e){}
  SESSION=null; const el=$('#player'); P=null; if(el){ el.classList.remove('show'); setTimeout(()=>el.remove(),300); }
  render(); checkBadges(); if(pendingCele.length) setTimeout(()=>celebrate(pendingCele.splice(0)), 350);
}
function plPause(){
  if(!P || P.phase==='done') return; const b=plEl('plPause');
  if(!P.paused){ P.paused=true; clearTimeout(P.t); P.leftMs=Math.max(0,(P.due||Date.now())-Date.now()); stopVoice(); if(b) b.textContent='▶ Resume'; $('#player').classList.add('paused'); $('#player video')?.pause(); }
  else { P.paused=false; if(b) b.textContent='⏸ Pause'; $('#player').classList.remove('paused'); $('#player video')?.play().catch(()=>{}); if(P.next) plAfter(P.leftMs||300, P.next); }
}
function plSkip(){
  if(!P || P.phase==='done') return; P.paused=false; const b=plEl('plPause'); if(b) b.textContent='⏸ Pause'; $('#player')?.classList.remove('paused');
  P.gen++; clearTimeout(P.t); stopVoice();
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

/* =====================================================================
   v1.4 — full guided workout, care routines, sleep & snoring, body photos & measurements,
          blood reports & retest plan, daily meal plan, weekly report, reminders
   ===================================================================== */
const HAS_PLAN = typeof WORKOUTS!=='undefined';
const fmtD = k => parseKey(k).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
const fmtDY = k => parseKey(k).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
const daysBetween = (a,b) => Math.round((parseKey(b)-parseKey(a))/86400000);

/* ---------- 1. full guided workout ---------- */
let SESSION=null;
function workoutFor(wd){ return HAS_PLAN ? WORKOUTS[wd] : null; }
function sessionStart(wd){
  const w=workoutFor(wd); if(!w) return;
  const items=w.items.filter(it=>exById(it.id));
  SESSION={wd, title:w.title, items, i:0, t0:Date.now(), done:[], kcal:0};
  sessionItem(0);
}
function sessionItem(i){
  const it=SESSION.items[i], e=exById(it.id); const t=progTarget(it);
  P0={id:e.id, sets:t.sets, reps:t.reps, secs:t.secs, kg:t.kg||null, target:t, it, rest:restFor(e), lang:S.settings.voice||'en'};
  SESSION.i=i; plStart();
  const lab=plEl('plSet'); if(lab) lab.textContent=`Exercise ${i+1} of ${SESSION.items.length} · set 1 of ${P0.sets}`;
}
function plTeardown(){ if(!P) return; P.gen++; clearTimeout(P.t); stopVoice(); try{ P.wl && P.wl.release(); }catch(e){} $('#player')?.remove(); P=null; }
function sessionBetween(e, what, kcal){
  SESSION.done.push({id:e.id, name:e.en, what, kcal}); SESSION.kcal+=kcal||0;
  const next=SESSION.items[SESSION.i+1];
  if(!next){ sessionEnd(); return; }
  const ne=exById(next.id); let left=20; const g=P.gen;
  const box=$('#player .pl-info');
  const draw=()=>{ if(box) box.innerHTML=`<div class="pl-done"><div class="small" style="opacity:.8">${esc(e.en)} ${what==='skipped'?'skipped':'done ✅ '+esc(what)}</div>
     <h2 style="margin:8px 0 4px">Up next: ${esc(ne.en)}</h2><div class="muted">${HI(ne.hi)?esc(HI(ne.hi))+' · ':''}starts in <b id="sxLeft">${left}</b> s · ${SESSION.i+2} of ${SESSION.items.length}</div>
     <div class="pl-ctl" style="margin-top:14px"><button class="btn pri" data-act="sxGo">▶ Start now</button><button class="btn sec" data-act="sxSkip">⏭ Skip it</button><button class="btn sec" data-act="sxEnd">■ End</button></div></div>`; };
  draw(); plShow(left,'rest',''); speak(typeof VOICE!=='undefined'?VOICE.phrase[P.lang].nextEx:'Next exercise.', {flush:true});
  const tick=()=>{ if(!P||P.gen!==g) return; left--; const el=document.getElementById('sxLeft'); if(el) el.textContent=left; plShow(left);
    if(left<=3 && left>0) speak(String(left),{flush:true});
    if(left<=0){ sessionGo(); return; } P.t=setTimeout(tick,1000); };
  clearTimeout(P.t); P.t=setTimeout(tick,1000);
}
function sessionGo(skip){
  if(!SESSION) return; let n=SESSION.i+1;
  if(skip){ SESSION.done.push({id:SESSION.items[n].id, name:exById(SESSION.items[n].id).en, what:'skipped', kcal:0}); n++; }
  plTeardown();
  if(n>=SESSION.items.length){ sessionEndScreen(); return; }
  sessionItem(n);
}
function sessionEnd(){ plTeardown(); sessionEndScreen(); }
function sessionEndScreen(){
  const s=SESSION; if(!s) return; const mins=Math.round((Date.now()-s.t0)/60000); const did=s.done.filter(x=>x.what!=='skipped');
  const el=document.createElement('div'); el.className='player show'; el.id='player';
  el.innerHTML=`<div class="pl-top" style="display:grid;place-items:center;background:var(--grad)"><div style="text-align:center"><div style="font-size:84px">🏆</div><h2 style="font-family:var(--font-d);margin:4px 0">Workout complete!</h2><div>${esc(s.title)}</div></div></div>
   <div class="pl-info"><div class="kv3" style="margin:4px 0 14px"><div><b>${did.length}</b><small style="color:#ccc">exercises</small></div><div><b>${mins}</b><small style="color:#ccc">minutes</small></div><div><b>~${r0(s.kcal)}</b><small style="color:#ccc">kcal</small></div></div>
   <div class="small" style="opacity:.85;max-height:22vh;overflow:auto">${s.done.map(x=>`${x.what==='skipped'?'⏭️':'✅'} ${esc(x.name)} <span style="opacity:.7">${esc(x.what)}</span>`).join('<br>')}</div>
   <button class="btn pri full" style="margin-top:14px" data-act="sxReview">✍️ Check my sets (reps, kg)</button><button class="btn sec full" style="margin-top:8px" data-act="sxClose">Done — all as target</button></div>`;
  document.body.appendChild(el); confetti(); setTimeout(confetti,600);
  speak(typeof VOICE!=='undefined'?VOICE.phrase[S.settings.voice||'en'].wdone:'Workout complete!',{lang:S.settings.voice||'en',flush:true});
  S.workoutsDone=(S.workoutsDone||0)+1; save();
}
function workoutCard(wd, big){
  const w=workoutFor(wd); if(!w) return '';
  const names=w.items.map(it=>exById(it.id)?.en).filter(Boolean);
  if(big){ const rows=w.items.filter(it=>exById(it.id)).map(it=>{ const e=exById(it.id), t=progTarget(it); return `<div class="wk-tg" data-act="openEx" data-id="${esc(e.id)}"><span>${esc(e.en)}</span><b>${esc(tgtText(t,e))}${t.up?' <span class="up">▲</span>':''}</b></div>`; }).join('');
    return `<div class="card wk-card"><div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px"><div><div class="small muted" style="font-weight:800">TODAY'S FULL WORKOUT · WEEK ${progWeek()}${easyWeek()?' · EASY WEEK':''}</div>
    <div style="font-family:var(--font-d);font-weight:800;font-size:17px">${esc(w.title)}</div><div class="small muted">${names.length} exercises · ~${w.mins} min · voice-guided</div></div>
    <button class="btn pri" data-act="sxStart" data-wd="${wd}" style="white-space:nowrap">▶ Start</button></div>
    <div style="margin-top:8px">${rows}</div><div class="small muted" style="margin-top:4px">▲ = raised because you hit every set last time. ${progWeek()<3?'Weeks 1–2: learn the form; targets start rising in week 3.':''}</div>
    <div class="row" style="margin-top:8px"><button class="btn pri grow" data-act="planDone" data-wd="${wd}">✅ Did it as planned</button><button class="btn sec grow" data-act="axLog" data-wd="${wd}">✍️ Change sets</button></div></div>`; }
  return `<div class="card wk-card"><div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px"><div><div class="small muted" style="font-weight:800">${big?"TODAY'S FULL WORKOUT":esc(['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][wd])}</div>
    <div style="font-family:var(--font-d);font-weight:800;font-size:${big?17:15}px">${esc(w.title)}</div><div class="small muted">${names.length} exercises · ~${w.mins} min · voice-guided</div></div>
    <button class="btn pri" data-act="sxStart" data-wd="${wd}" style="white-space:nowrap">▶ Start</button></div>
    ${big?`<div class="small muted" style="margin-top:8px">${names.map(esc).join(' → ')}</div>`:''}</div>`;
}

/* ---------- 2. care routines ---------- */
function careList(part, k=cur){ const wd=parseKey(k).getDay(); return HAS_PLAN ? CARE[part].filter(c=>!c.days || c.days.includes(wd)) : []; }
function careCard(d){
  if(!HAS_PLAN) return ''; d.care ||= {};
  const part = S.ui?.carePart || (new Date().getHours()<15 ? 'am' : 'pm');
  const list=careList(part); const all=[...careList('am'),...careList('pm')].filter(c=>!c.opt);
  const doneN=all.filter(c=>d.care[c.id]).length;
  return `<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:8px"><b style="font-family:var(--font-d)">✨ Head-to-toe care</b><span class="small muted">${doneN}/${all.length} today</span></div>
   <div class="seg" style="margin-bottom:10px"><button class="${part==='am'?'on':''}" data-act="carePart" data-p="am">☀️ Morning</button><button class="${part==='pm'?'on':''}" data-act="carePart" data-p="pm">🌙 Night</button></div>
   <div class="ticks">${list.map(c=>`<button class="tick ${d.care[c.id]?'on':''}" data-act="careTick" data-k="${c.id}"><span class="bx">${d.care[c.id]?'✓':''}</span>${c.e} ${esc(c.t)}${c.opt?' <span class="small muted">(optional)</span>':''}</button>`).join('')}</div>
   <button class="btn ghost" style="padding:8px 0 0" data-act="careWhy" data-p="${part}">ℹ️ Why each step matters</button></div>`;
}

/* ---------- 3. sleep & snoring ---------- */
const SNORE=[['0','😴 None'],['1','🙂 Light'],['2','😮‍💨 Loud'],['3','⚠️ Gasping / choking']];
function sleepHours(sl){ if(!sl||!sl.bed||!sl.wake) return null; const [bh,bm]=sl.bed.split(':').map(Number), [wh,wm]=sl.wake.split(':').map(Number);
  let m=(wh*60+wm)-(bh*60+bm); if(m<=0) m+=1440; return Math.round(m/6)/10; }
function sleepCard(d){
  const sl=d.sl||{}; const h=sleepHours(sl);
  return `<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:8px"><b style="font-family:var(--font-d)">😴 Last night's sleep</b><span class="small muted">${h!=null?`<b style="color:var(--fg)">${h} h</b> · goal 7–8`:'goal 7–8 h'}</span></div>
   <div class="row"><div class="grow"><label class="f" style="margin-top:0">Went to bed</label><input type="time" class="inp" data-sl="bed" value="${esc(sl.bed||'')}"></div>
     <div class="grow"><label class="f" style="margin-top:0">Woke up</label><input type="time" class="inp" data-sl="wake" value="${esc(sl.wake||'')}"></div></div>
   <label class="f">Snoring (ask your family, or a snore app)</label><div class="chips" style="margin:0;padding:0 0 4px;flex-wrap:wrap">${SNORE.map(([v,l])=>`<button class="chip ${String(sl.snore)===v?'on':''}" data-act="slSet" data-k="snore" data-v="${v}">${l}</button>`).join('')}</div>
   <div class="row" style="margin-top:6px;flex-wrap:wrap;gap:6px"><button class="chip ${sl.side?'on':''}" data-act="slSet" data-k="side" data-v="${sl.side?0:1}">🛏️ Slept on my side</button>
     ${[1,2,3,4,5].map(n=>`<button class="chip ${Number(sl.fresh)===n?'on':''}" data-act="slSet" data-k="fresh" data-v="${n}">${['','😩','😕','😐','🙂','🤩'][n]}</button>`).join('')}<span class="small muted">how fresh</span></div>
   ${String(sl.snore)==='3'?`<div class="tip warn" style="margin-top:10px">⚠️ Gasping or choking in sleep can be sleep apnoea. Tell your doctor and ask about a sleep study — it is very treatable.</div>`:''}</div>`;
}

/* ---------- 4. body measurements & photos ---------- */
const MEAS=[['weight','Weight','kg'],['waist','Waist','in'],['chest','Chest','in'],['arms','Arm (flexed)','in'],['hips','Hips','in'],['neck','Neck','in'],['thigh','Thigh','in']];
const PDB={db:null,
  open(){ return this.db?Promise.resolve(this.db):new Promise((res,rej)=>{ const r=indexedDB.open('ojas-photos',1); r.onupgradeneeded=()=>r.result.createObjectStore('p',{keyPath:'id'}); r.onsuccess=()=>{this.db=r.result;res(this.db);}; r.onerror=()=>rej(r.error); }); },
  tx(mode,fn){ return this.open().then(db=>new Promise((res,rej)=>{ const st=db.transaction('p',mode).objectStore('p'); const rq=fn(st); rq.onsuccess=()=>res(rq.result); rq.onerror=()=>rej(rq.error); })); },
  all(){ return this.tx('readonly',s=>s.getAll()).catch(()=>[]); }, put(o){ return this.tx('readwrite',s=>s.put(o)); }, del(id){ return this.tx('readwrite',s=>s.delete(id)); }
};
let PHOTOS=[]; const loadPhotos=()=>PDB.all().then(a=>{ PHOTOS=a.sort((x,y)=>x.date.localeCompare(y.date)||x.pose.localeCompare(y.pose)); if(tab==='health') render(); });
function resizeImg(file, max=900){ return new Promise((res,rej)=>{ const rd=new FileReader(); rd.onload=()=>{ const im=new Image(); im.onload=()=>{ const s=Math.min(1,max/Math.max(im.width,im.height)); const c=document.createElement('canvas'); c.width=Math.round(im.width*s); c.height=Math.round(im.height*s); c.getContext('2d').drawImage(im,0,0,c.width,c.height); res(c.toDataURL('image/jpeg',.82)); }; im.onerror=rej; im.src=rd.result; }; rd.onerror=rej; rd.readAsDataURL(file); }); }
function measCard(){
  S.meas ||= []; const first=S.meas[0], last=S.meas[S.meas.length-1];
  const rows=MEAS.map(([k,l,u])=>{ const a=first&&first[k], b=last&&last[k]; const dlt=(a&&b&&first!==last)?r1(b-a):null;
    return `<span>${l}</span><span>${b?`<b>${b}</b> ${u}`:'—'}${dlt!=null?` <span class="small" style="color:${dlt<=0?'var(--good)':'var(--crit)'}">${dlt>0?'+':''}${dlt}</span>`:''}</span>`; }).join('');
  return `<div class="card"><h3>📏 Body measurements <span class="sub">${S.meas.length?`${S.meas.length} entries · since ${fmtD(first.date)}`:'monthly'}</span></h3>
   <div class="kv">${rows}</div><button class="btn sec full" style="margin-top:12px" data-act="measAdd">+ Add this month's measurements</button>
   <div class="small muted" style="margin-top:6px">Measure in the morning, before food, tape snug not tight. Change shows vs your first entry.</div></div>`;
}
function measSheet(){
  const k=todayKey(); const prev=(S.meas||[]).slice(-1)[0]||{};
  openSheet(`<h2>📏 Measurements</h2><div class="hih">${fmtDY(k)} · inches (weight in kg)</div>
    ${MEAS.map(([m,l,u])=>`<label class="f">${l} (${u})</label><input class="inp" inputmode="decimal" id="ms_${m}" placeholder="${esc(prev[m]||'')}">`).join('')}
    <div class="tip" style="margin-top:12px">📐 Waist: at the belly button. Neck: just below the Adam's apple. Arm: biggest part, flexed. Thigh: biggest part.</div>
    <button class="btn pri full" style="margin-top:14px" data-act="measSave">Save</button>`);
}
function photosCard(){
  const BODY=PHOTOS.filter(p=>p.pose!=='face'&&p.pose!=='scalp'); const dates=[...new Set(BODY.map(p=>p.date))];
  const thumbs=dates.slice(-6).reverse().map(dt=>`<div class="ph-day"><div class="small muted">${fmtD(dt)}</div><div class="row" style="gap:4px">${BODY.filter(p=>p.date===dt).map(p=>`<img src="${p.data}" alt="" data-act="phView" data-id="${p.id}">`).join('')}</div></div>`).join('');
  return `<div class="card"><h3>📸 Body photos <span class="sub">private · stays on this phone</span></h3>
   <div class="row"><label class="btn sec grow" style="cursor:pointer">📷 Front<input type="file" accept="image/*" capture="user" data-photo="front" hidden></label><label class="btn sec grow" style="cursor:pointer">📷 Side<input type="file" accept="image/*" capture="user" data-photo="side" hidden></label></div>
   ${thumbs?`<div class="ph-strip">${thumbs}</div>`:'<div class="small muted" style="margin-top:10px">Take the first front + side photo today: same spot, same light, same clothes, morning. Repeat once a month.</div>'}
   ${dates.length>=2?`<button class="btn pri full" style="margin-top:10px" data-act="phCompare">↔️ Before / after</button>`:''}</div>`;
}
function compareSheet(){
  const dates=[...new Set(PHOTOS.map(p=>p.date))]; if(dates.length<2) return;
  const pose=S.ui?.phPose||'front'; const pick=(dt)=>PHOTOS.find(p=>p.date===dt&&p.pose===pose)||PHOTOS.find(p=>p.date===dt);
  const a=S.ui?.phA||dates[0], b=S.ui?.phB||dates[dates.length-1];
  openSheet(`<h2>↔️ Before / after</h2><div class="seg" style="margin:6px 0 10px"><button class="${pose==='front'?'on':''}" data-act="phPose" data-p="front">Front</button><button class="${pose==='side'?'on':''}" data-act="phPose" data-p="side">Side</button></div>
    <div class="row"><select class="inp" data-ph="phA">${dates.map(d=>`<option value="${d}" ${d===a?'selected':''}>${fmtDY(d)}</option>`).join('')}</select><select class="inp" data-ph="phB">${dates.map(d=>`<option value="${d}" ${d===b?'selected':''}>${fmtDY(d)}</option>`).join('')}</select></div>
    <div class="cmp" id="cmp"><img src="${pick(b)?.data||''}" alt=""><div class="cmp-top" id="cmpTop"><img src="${pick(a)?.data||''}" alt=""></div><div class="cmp-line" id="cmpLine"></div></div>
    <input type="range" min="0" max="100" value="50" id="cmpR" style="width:100%">
    <div class="row small muted" style="justify-content:space-between"><span>◀ ${fmtD(a)}</span><span>${fmtD(b)} ▶</span></div>`,
  b=>{ const r=$('#cmpR',b); const f=()=>{ $('#cmpTop',b).style.clipPath=`inset(0 ${100-r.value}% 0 0)`; $('#cmpLine',b).style.left=r.value+'%'; }; r.addEventListener('input',f); f();
       $$('[data-ph]',b).forEach(s=>s.addEventListener('change',()=>{ S.ui ||= {}; S.ui[s.dataset.ph]=s.value; compareSheet(); })); });
}

/* ---------- 5. blood reports & retest ---------- */
function labStatus(m, v){ if(v==null||isNaN(v)) return '';
  const out=(m.lo!=null&&v<m.lo)||(m.hi!=null&&v>m.hi); if(!out) return 'g';
  const far=(m.wlo!=null&&v<m.wlo)||(m.whi!=null&&v>m.whi)||(m.lo!=null&&m.wlo==null&&v<m.lo)||(m.hi!=null&&m.whi==null&&v>m.hi); return far?'r':'a'; }
const SDOT={g:'🟢',a:'🟡',r:'🔴','':'⚪'};
function labSeries(k){ return ((S.labs||{})[k]||[]).slice().sort((x,y)=>x[0].localeCompare(y[0])); }
function rangeText(m){ return m.lo!=null&&m.hi!=null?`${m.lo}–${m.hi}`:m.lo!=null?`above ${m.lo}`:`below ${m.hi}`; }
function spark(vals){ if(vals.length<2) return ''; const mn=Math.min(...vals), mx=Math.max(...vals), w=70, h=22, sp=mx-mn||1;
  return `<svg class="spark" viewBox="0 0 ${w} ${h}"><polyline fill="none" stroke="currentColor" stroke-width="2" points="${vals.map((v,i)=>`${(i/(vals.length-1)*w).toFixed(1)},${(h-2-(v-mn)/sp*(h-4)).toFixed(1)}`).join(' ')}"/></svg>`; }
function labsCard(){
  if(!HAS_PLAN) return ''; const has=Object.keys(S.labs||{}).length;
  if(!has) return `<div class="card"><h3>🩸 Blood reports</h3><div class="small muted" style="margin-bottom:10px">Your values are not stored in the app's code (it is public). Load your private file once — it stays only on this phone.</div>
    <label class="btn pri full" style="cursor:pointer">⬆ Load my health file<input type="file" id="healthFile" accept="application/json,.json" hidden></label>
    <label class="btn sec full" style="margin-top:8px;cursor:pointer">📄 Read a lab report (PDF)<input type="file" id="repFile" data-to="health" accept="application/pdf,.pdf" hidden></label>
    <button class="btn sec full" style="margin-top:8px" data-act="labAdd">+ Or type a result</button></div>`;
  const groups={}; let tally={g:0,a:0,r:0};
  for(const m of LAB_MARKERS){ const s=labSeries(m.k); if(!s.length) continue; const last=s[s.length-1], prev=s[s.length-2]; const st=labStatus(m,last[1]); tally[st]=(tally[st]||0)+1;
    const arrow=prev?(last[1]>prev[1]?'↑':last[1]<prev[1]?'↓':'→'):'';
    (groups[m.g] ||= []).push(`<div class="lab-row" data-act="labOpen" data-k="${m.k}"><span class="dot ${st==='g'?'g':st==='a'?'y':'r'}"></span><span class="grow"><b>${esc(m.n)}</b><small><span class="lab-st ${st}">${ST_WORD[st]}</span> · range ${rangeText(m)} · ${fmtDY(last[0])}</small></span><span class="lab-v ${st}">${spark(s.map(x=>x[1]))}<b>${last[1]}</b> <small>${esc(m.u)} ${arrow}</small></span></div>`); }
  return `<div class="card"><h3>Blood reports <span class="sub">${tally.g} within · ${tally.a} slightly out · ${tally.r} out</span></h3><div class="small muted" style="margin:-6px 0 6px">Compared with the lab's own range. Your doctor decides what it means.</div>
    ${Object.entries(groups).map(([g,rows])=>`<div class="small muted" style="font-weight:800;margin:10px 0 4px">${esc(g)}</div>${rows.join('')}`).join('')}
    <div class="row" style="margin-top:12px"><button class="btn sec grow" data-act="labAdd">+ Add a result</button><label class="btn sec grow" style="cursor:pointer">⬆ Load file<input type="file" id="healthFile" accept="application/json,.json" hidden></label></div>
    <label class="btn pri full" style="margin-top:8px;cursor:pointer">📄 Read a new lab report (PDF)<input type="file" id="repFile" data-to="health" accept="application/pdf,.pdf" hidden></label>
    <div class="small muted" style="margin-top:8px">Colours only compare each result with the usual lab range. 🟡/🔴 = show it to your doctor — the app tracks numbers, your doctor decides what they mean.</div></div>`;
}
function labSheet(k){
  const m=LAB_MARKERS.find(x=>x.k===k); const s=labSeries(k);
  openSheet(`<h2>${esc(m.n)}</h2><div class="hih">Healthy: ${rangeText(m)} ${esc(m.u)}</div>
    ${lineChart(s.map(([x,y])=>({x,y})),'#38bdf8',m.u)}
    <table class="tbl" style="margin-top:10px">${s.slice().reverse().map(([dt,v])=>`<tr><td>${fmtDY(dt)}</td><td>${SDOT[labStatus(m,v)]} <b>${v}</b> ${esc(m.u)} <button class="x" data-act="labDel" data-k="${k}" data-d="${dt}" aria-label="Delete">×</button></td></tr>`).join('')}</table>
    <button class="btn pri full" style="margin-top:14px" data-act="labAdd" data-k="${k}">+ Add new value</button>`);
}
function labAddSheet(k){
  openSheet(`<h2>🩸 Add a result</h2><label class="f">Test</label><select class="inp" id="laK">${LAB_MARKERS.map(m=>`<option value="${m.k}" ${m.k===k?'selected':''}>${esc(m.n)} (${esc(m.u)})</option>`).join('')}</select>
    <div class="row"><div class="grow"><label class="f">Date</label><input type="date" class="inp" id="laD" value="${todayKey()}"></div><div class="grow"><label class="f">Value</label><input class="inp" id="laV" inputmode="decimal"></div></div>
    <button class="btn pri full" style="margin-top:14px" data-act="labSave">Save</button>`);
}
function retestCard(){
  const R=S.retest; if(!R||!R.items) return '';
  R.done ||= {};
  return R.items.map(it=>{ const dleft=daysBetween(todayKey(), it.due); const n=it.tests.length, dn=it.tests.filter((t,i)=>R.done[it.id+':'+i]).length;
    const over=dleft<0 && dn<n;
    return `<div class="card ${it.urgent&&dn<n?'urgent':''}"><h3>${it.urgent&&dn<n?'🚨':'🧪'} ${esc(it.title)} <span class="sub">${dn===n?'✅ all done':over?`<b style="color:var(--crit)">${-dleft} days overdue</b>`:`in <b>${dleft}</b> days · ${fmtD(it.due)}`}</span></h3>
     <div class="small muted" style="margin-bottom:8px">${esc(it.why||'')}</div>
     <div class="ticks" style="grid-template-columns:1fr">${it.tests.map((t,i)=>`<button class="tick ${R.done[it.id+':'+i]?'on':''}" data-act="rtTick" data-k="${it.id}:${i}"><span class="bx">${R.done[it.id+':'+i]?'✓':''}</span>${esc(t)}</button>`).join('')}</div>
     ${it.prep?`<details style="margin-top:8px"><summary class="small" style="font-weight:800;cursor:pointer">How to prepare</summary><ul class="small" style="margin:6px 0 0;padding-left:18px">${it.prep.map(p=>`<li>${esc(p)}</li>`).join('')}</ul></details>`:''}</div>`; }).join('');
}

/* ---------- 6. daily meal plan ---------- */
function mealPlanIdx(k=cur){ S.mealPick ||= {}; const i=S.mealPick[k]!=null ? +S.mealPick[k] : parseKey(k).getDay(); return ((i%MEAL_PLANS.length)+MEAL_PLANS.length)%MEAL_PLANS.length; }
function mealPlanCard(d){
  if(!HAS_PLAN) return ''; const idx=mealPlanIdx(); const pl=MEAL_PLANS[idx];
  let K=0,Pr=0; const bySlot={};
  pl.items.forEach(([slot,id,q],i)=>{ const dish=dishById(id); if(!dish) return; const m=dishMacros(dish); K+=m.k*q; Pr+=m.p*q;
    const logged=d.food.some(f=>f.dish===id && f.slot===slot); (bySlot[slot] ||= []).push({i,dish,q,m,logged}); });
  const open=S.ui?.mealOpen;
  const nLog=pl.items.filter(([sl,id])=>d.food.some(f=>f.dish===id&&f.slot===sl)).length;
  return `<details class="card mp-card" ${S.ui?.mealOpen?'open':''}><summary class="row" style="justify-content:space-between;cursor:pointer;list-style:none"><b style="font-family:var(--font-d)">🥗 Today's meal plan · ${esc(pl.name)}</b><span class="small muted">~${r0(K)} kcal · ${r0(Pr)} g · ${nLog}/${pl.items.length} ✓ ▾</span></summary><div style="margin-top:8px">
   <div class="chips" style="margin:0 0 6px;padding:0">${MEAL_PLANS.map((p,i)=>`<button class="chip ${i===idx?'on':''}" data-act="mpPick" data-i="${i}">${esc(p.name)}</button>`).join('')}</div>
   ${SLOTS.filter(([s])=>bySlot[s]).map(([s,sn])=>`<div class="mp-slot"><div class="row" style="justify-content:space-between"><b class="small">${esc(sn)}</b>${bySlot[s].every(x=>x.logged)?'<span class="small" style="color:var(--good)">✓ logged</span>':`<button class="btn ghost" style="padding:2px 0" data-act="mpLogSlot" data-s="${s}">+ log all</button>`}</div>
     ${bySlot[s].map(x=>`<div class="mp-item ${x.logged?'done':''}"><span data-act="openDish" data-id="${esc(x.dish.id)}" style="cursor:pointer">${esc(x.dish.e||'🍽️')} <u>${esc(x.dish.en)}</u><br><small class="muted">${esc(amountG(x.dish,x.q))}</small></span><span class="small muted">${r0(x.m.k*x.q)} kcal · ${r0(x.m.p*x.q)} g P</span>${x.logged?'<span class="small">✓</span>':`<button class="x" data-act="mpLog" data-i="${x.i}" aria-label="Log">＋</button>`}</div>`).join('')}</div>`).join('')}
   <div class="small muted" style="margin-top:6px">Tap any dish for its recipe and ingredients. Swap any dish by logging something else from the Food tab — the totals still count.</div></div></details>`;
}
function logPlanItem(i){
  const pl=MEAL_PLANS[mealPlanIdx()]; const [slot,id,q]=pl.items[i]; const dish=dishById(id); if(!dish) return;
  const m=dishMacros(dish); const times={early:'06:45',breakfast:'08:30',mid:'11:00',lunch:'13:15',snack:'16:45',dinner:'19:45',late:'21:45'};
  day().food.push({id:uid(), dish:id, name:dish.en, e:dish.e, unit:dish.unit, qty:q, t: cur===todayKey()&&slot===slotFor(nowHM())?nowHM():times[slot], slot, k:m.k*q, p:m.p*q, c:m.c*q, f:m.f*q});
}

/* ---------- 7. weekly report ---------- */
function weeklyReport(){
  const keys=lastNDays(7), st=S.settings; const D=keys.map(k=>peekDay(k)||{});
  const ws=keys.map(k=>parseFloat(peekDay(k)?.weight)).filter(x=>x>30), wa=keys.map(k=>parseFloat(peekDay(k)?.waist)).filter(x=>x>10);
  const foodDays=keys.filter(k=>peekDay(k)?.food?.length); const tot=foodDays.map(k=>dayTotals(k));
  const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
  const pHit=tot.filter(t=>t.p>=st.protein*0.9).length;
  const water=D.map(d=>wml(d)); const wDays=water.filter(x=>x>=(+st.waterMl||3000)).length;
  const steps=D.map(d=>stepsOf(d.steps)); const km=steps.reduce((a,b)=>a+b,0)*strideM()/1000;
  const wk=D.filter(d=>d.ex?.length).length, wkK=D.reduce((s,d)=>s+(d.ex||[]).reduce((a,e)=>a+(e.kcal||0),0),0);
  const sl=D.map(d=>sleepHours(d.sl)).filter(x=>x!=null); const sn=[0,0,0,0]; D.forEach(d=>{ if(d.sl&&d.sl.snore!=null&&d.sl.snore!=='') sn[+d.sl.snore]++; }); const side=D.filter(d=>d.sl?.side).length;
  const careAll=keys.reduce((s,k)=>s+[...careList('am',k),...careList('pm',k)].filter(c=>!c.opt).length,0), careDone=keys.reduce((s,k)=>s+Object.values(peekDay(k)?.care||{}).filter(Boolean).length,0);
  const keg=D.reduce((s,d)=>s+(d.kegel||0),0);
  const j=journeyAt(totalStepsAll()*strideM()/1000);
  const L=[`OJAS weekly report — ${fmtD(keys[0])} to ${fmtDY(keys[6])}`,
    `Weight: ${ws.length?`${ws[0]} → ${ws[ws.length-1]} kg (${r1(ws[ws.length-1]-ws[0])>0?'+':''}${r1(ws[ws.length-1]-ws[0])})`:'not logged'}${wa.length?` · Waist ${wa[0]} → ${wa[wa.length-1]}"`:''}`,
    `Food logged: ${foodDays.length}/7 days · avg ${r0(avg(tot.map(t=>t.k)))} kcal · avg protein ${r0(avg(tot.map(t=>t.p)))} g · protein target hit ${pHit}/7`,
    `Water: goal met ${wDays}/7 days · avg ${r1(avg(water)/1000)} L`,
    `Steps: avg ${r0(avg(steps)).toLocaleString('en-IN')}/day · ${r1(km)} km this week${j&&j.b?` · journey ${fmtKm(j.x)} km, next ${j.b.name.split(',')[0]}`:''}`,
    `Workouts: ${wk} days · ~${r0(wkK)} kcal`,
    `Sleep: ${sl.length?`avg ${r1(avg(sl))} h (${sl.length} nights logged)`:'not logged'} · snoring none ${sn[0]}, light ${sn[1]}, loud ${sn[2]}, gasping ${sn[3]} · side-sleep ${side}/7`,
    `Care routine: ${careAll?r0(careDone/careAll*100):0}% · Kegels ${keg}/21`,
    `Energy (1–10): ${D.map(d=>d.energy||'–').join(' ')}`];
  const wk7=lastNDays(7); L.push(`Daily musts all done: ${wk7.filter(k=>peekDay(k)&&mustsDone(k)>=myMusts().length).length}/7 days · streak ${mustStreak()}`);
  L.push('Weekly goals (this week so far): '+myWeekly().map(g=>{ const s=wgStatus(g,todayKey()); return `${g.name} ${g.unit==='steps'?r0(s.done).toLocaleString('en-IN'):r1(s.done)}/${s.tgt}`; }).join(' · '));
  const b=bank(todayKey()); L.push(`Calorie bank: ${r0(b.before+b.today)} of ${b.budget} used · ${r0(b.left)} left for ${b.daysLeft} days`);
  return L.join('\n');
}
function reportSheet(){
  const txt=weeklyReport();
  openSheet(`<h2>📤 Weekly report</h2><div class="hih">Measured from your logs — send it to your coach</div><pre class="report">${esc(txt)}</pre>
    <div class="row"><button class="btn pri grow" data-act="repShare">Share</button><button class="btn sec grow" data-act="repCopy">Copy</button></div>
    <div class="small muted" style="margin-top:8px">Paste it to Claude in your Ojas project every Sunday for coaching on real numbers.</div>`);
}

/* ---------- 8. reminders ---------- */
function nextReminder(){ if(!HAS_PLAN) return null; const now=nowHM(); return NUDGES().find(r=>r[0]>now) || null; }
function remindersSheet(){
  openSheet(`<h2>⏰ Daily nudges</h2><div class="hih">An iPhone web app can't ring by itself — the free Shortcuts app does it. Quiet hours ${fmt12(quietFrom())} – ${fmt12(quietTo())}: nothing then.</div>
   <div class="card"><h3>Your ${NUDGES().length} anchored nudges</h3><table class="tbl">${NUDGES().map(([t,l])=>`<tr><td>${fmt12(t)}</td><td style="text-align:left;color:var(--fg)">${esc(l)}</td></tr>`).join('')}</table></div>
   <div class="card"><h3>Set up once (about 1 minute per reminder)</h3><ol class="steps">
     <li>Open <b>Shortcuts</b> → <b>Automation</b> tab → <b>+</b> (New Automation).</li>
     <li>Choose <b>Time of Day</b> → set the time → <b>Daily</b> → <b>Run Immediately</b> → Next.</li>
     <li>Tap <b>New Blank Automation</b> → Add Action → search <b>Show Notification</b>.</li>
     <li>Type the reminder text (e.g. “💧 Water check — 1 L by now?”) → Done.</li>
     <li>Repeat for the other times. Tap a notification, then open Ojas from the home screen.</li></ol></div>
   <div class="tip">Simpler option: the <b>Reminders</b> app → New Reminder → set time → Repeat <b>Daily</b>. The Ojas Today screen also shows “Next up” all day.</div>`);
}

function vHealth(){
  const sl=lastNDays(14); const pts=sl.map(k=>({k, h:sleepHours(peekDay(k)?.sl), sn:peekDay(k)?.sl?.snore}));
  const logged=pts.filter(p=>p.h!=null); const avgH=logged.length?logged.reduce((a,p)=>a+p.h,0)/logged.length:0; const gasp=pts.some(p=>String(p.sn)==='3');
  const colors=['#12b886','#f2c94c','#ff6a3d','#e03131'];
  const bars=`<div class="sl-bars">${pts.map(p=>`<div class="sl-b" title="${fmtD(p.k)}"><i style="height:${p.h?Math.min(100,p.h/10*100):0}%;background:${p.sn!=null&&p.sn!==''?colors[+p.sn]:'var(--accent-3)'}"></i><small>${parseKey(p.k).getDate()}</small></div>`).join('')}</div>`;
  return `
  ${retestCard()}
  ${labsCard()}
  <div class="card"><h3>😴 Sleep & snoring <span class="sub">14 days · avg ${logged.length?r1(avgH)+' h':'—'}</span></h3>${bars}
    <div class="small muted" style="margin-top:6px">Bar = hours slept · colour = snoring: <span style="color:#12b886">●</span> none <span style="color:#f2c94c">●</span> light <span style="color:#ff6a3d">●</span> loud <span style="color:#e03131">●</span> gasping</div>
    ${gasp?'<div class="tip warn" style="margin-top:10px">⚠️ Gasping/choking was logged. Tell your doctor and ask about a sleep study.</div>':''}
    <div class="small muted" style="margin-top:6px">Log it every morning on the Today tab.</div></div>
  ${measCard()}
  ${photosCard()}
  ${skinCard()}
  <p class="small muted" style="text-align:center">Coach, not doctor — 🟡/🔴 items go to your doctor.</p>`;
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
  delEntry:(el,ev)=>{ ev.stopPropagation(); const d=day(); const i=d.food.findIndex(x=>x.id===el.dataset.id); if(i<0) return; const [rm]=d.food.splice(i,1); (d.del ||= []).push(rm.id); save(); render(); toast(`Removed ${rm.name}`); },
  delEx:(el,ev)=>{ ev.stopPropagation(); const d=day(); (d.del ||= []).push(el.dataset.id); d.ex=d.ex.filter(x=>x.id!==el.dataset.id); save(); render(); },
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
  sxStart:el=>sessionStart(+el.dataset.wd),
  sxGo:()=>sessionGo(false), sxSkip:()=>sessionGo(true), sxEnd:()=>sessionEnd(),
  sxClose:()=>{ const s=SESSION; $('#player')?.remove(); SESSION=null; if(s && s.prog){ const d=day(); const msgs=[]; for(const [id,eid,it] of s.prog){ const en=d.ex.find(x=>x.id===eid); if(en){ const m=progAfter(id,en,it); if(m && /⬆|↘/.test(m)) msgs.push(exById(id).en+': '+m); } } save(); if(msgs.length) setTimeout(()=>openSheet(`<h2>📈 Targets updated</h2><div class="card small" style="line-height:1.6">${msgs.map(esc).join('<br>')}</div><button class="btn pri full" data-act="closeSheet">OK</button>`),400); } render(); checkBadges(); },
  sxReview:()=>{ const s=SESSION; $('#player')?.remove(); SESSION=null; render(); if(s) setTimeout(()=>actualsSheet(s.wd, true),300); },
  carePart:el=>{ S.ui ||= {}; S.ui.carePart=el.dataset.p; save(true); render(); },
  careTick:el=>{ const d=day(); d.care ||= {}; const k=el.dataset.k; d.care[k]=!d.care[k]; save(); el.classList.toggle('on',d.care[k]); $('.bx',el).textContent=d.care[k]?'✓':'';
    const all=[...careList('am'),...careList('pm')].filter(c=>!c.opt); if(all.every(c=>d.care[c.id])){ confetti(); toast('✨ Full head-to-toe care done!'); } },
  careWhy:el=>{ const list=careList(el.dataset.p); openSheet(`<h2>${el.dataset.p==='am'?'☀️ Morning':'🌙 Night'} care — why</h2>${list.map(c=>`<div class="card" style="padding:12px"><b>${c.e} ${esc(c.t)}</b><div class="small muted" style="margin-top:4px">${esc(c.why)}</div></div>`).join('')}`); },
  slSet:el=>{ const d=day(); d.sl ||= {}; const k=el.dataset.k; d.sl[k]= k==='side' ? !!+el.dataset.v : +el.dataset.v; save(); render(); },
  measAdd:()=>measSheet(),
  measSave:()=>{ const o={date:todayKey()}; let n=0; for(const [m] of MEAS){ const v=parseFloat($('#ms_'+m).value); if(v>0){ o[m]=v; n++; } }
    if(!n){ toast('Enter at least one number'); return; } S.meas ||= []; const i=S.meas.findIndex(x=>x.date===o.date); if(i>=0) S.meas[i]={...S.meas[i],...o}; else S.meas.push(o);
    const d=day(todayKey()); if(o.weight) d.weight=String(o.weight); if(o.waist) d.waist=String(o.waist); save(); closeSheet(); render(); toast('Measurements saved ✓'); },
  phView:el=>{ const p=PHOTOS.find(x=>x.id===el.dataset.id); if(!p) return; openSheet(`<h2>${p.pose==='side'?'Side':'Front'} · ${fmtDY(p.date)}</h2><img src="${p.data}" style="width:100%;border-radius:16px" alt=""><button class="btn sec full" style="margin-top:12px;color:var(--crit)" data-act="phDel" data-id="${p.id}">Delete this photo</button>`); },
  phDel:el=>{ if(el.dataset.armed!=='1'){ el.dataset.armed='1'; el.textContent='Tap again to delete'; return; } PDB.del(el.dataset.id).then(()=>{ closeSheet(); loadPhotos(); toast('Photo deleted'); }); },
  phCompare:()=>compareSheet(),
  phPose:el=>{ S.ui ||= {}; S.ui.phPose=el.dataset.p; compareSheet(); },
  labOpen:el=>labSheet(el.dataset.k),
  labAdd:el=>labAddSheet(el.dataset.k),
  labSave:()=>{ const k=$('#laK').value, dt=$('#laD').value, v=parseFloat($('#laV').value); if(!dt||isNaN(v)){ toast('Enter date and value'); return; }
    S.labs ||= {}; const a=(S.labs[k] ||= []); const i=a.findIndex(x=>x[0]===dt); if(i>=0) a[i]=[dt,v]; else a.push([dt,v]); save(); labSheet(k); if(tab==='health') render(); toast('Result saved ✓'); },
  labDel:el=>{ const a=(S.labs||{})[el.dataset.k]||[]; S.labs[el.dataset.k]=a.filter(x=>x[0]!==el.dataset.d); save(); labSheet(el.dataset.k); render(); },
  rtTick:el=>{ S.retest.done ||= {}; const k=el.dataset.k; S.retest.done[k]=!S.retest.done[k]; save(); render(); },
  mpPick:el=>{ S.mealPick ||= {}; S.mealPick[cur]=+el.dataset.i; save(true); render(); },
  mpLog:el=>{ logPlanItem(+el.dataset.i); save(); render(); toast('Logged ✓'); },
  mpLogSlot:el=>{ const pl=MEAL_PLANS[mealPlanIdx()]; const d=day(); let n=0; pl.items.forEach(([s,id],i)=>{ if(s===el.dataset.s && !d.food.some(f=>f.dish===id&&f.slot===s)){ logPlanItem(i); n++; } }); save(); render(); toast(`Logged ${n} item${n>1?'s':''} ✓`); },
  report:()=>reportSheet(),
  repCopy:async()=>{ try{ await navigator.clipboard.writeText(weeklyReport()); toast('Copied — paste it to your coach'); }catch(e){ toast('Long-press the text to copy'); } },
  repShare:async()=>{ const t=weeklyReport(); try{ if(navigator.share) await navigator.share({title:'Ojas weekly report', text:t}); else { await navigator.clipboard.writeText(t); toast('Copied'); } }catch(e){} },
  remHelp:()=>remindersSheet(),
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
  plMute:el=>{ if(!P) return; P.muted=!P.muted; el.textContent=P.muted?'🔇':'🔊'; if(P.muted) stopVoice(); },
  celeClose:(el,ev)=>{ if(el.classList.contains('cele') && ev.target.closest('.cele-card') && !ev.target.closest('button')) return; const c=$('.cele'); if(c){ c.classList.remove('show'); setTimeout(()=>c.remove(),300); } },
  avatar:el=>{ S.settings.avatar=el.dataset.a; save(true); render(); },
  voiceLang:el=>{ S.settings.voice=el.dataset.l; save(true); render(); speak(el.dataset.l==='hi'?'नमस्ते! मैं आपका ओजस कोच हूँ।':'Hello! I am your Ojas coach.',{lang:el.dataset.l, flush:true}); },
  testVoice:()=>{ const l=S.settings.voice||'en'; speak(l==='hi'?'एक, दो, तीन। शाबाश!':'One, two, three. Great work!',{lang:l, flush:true}); },
  kegel:el=>{ const d=day(); const n=+el.dataset.n; d.kegel = d.kegel===n ? n-1 : n; save(); render(); },
  tick:el=>{ const d=day(); const k=el.dataset.k; d.ticks[k]=!d.ticks[k]; save(); el.classList.toggle('on',d.ticks[k]); $('.bx',el).textContent=d.ticks[k]?'✓':'';
    if(TICKS.every(([x])=>d.ticks[x])){ confetti(); toast('🌟 All non-negotiables done!'); } },
  rung:el=>{ S.rungs[el.dataset.p]=+el.dataset.n; save(); render(); },
  theme:el=>{ S.settings.theme=el.dataset.t; save(); applyTheme(); render(); },
  export:async()=>{ try{ const ph=await PDB.all(); const blob=new Blob([JSON.stringify({...S,_photos:ph},null,1)],{type:'application/json'}); const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download=`ojas-backup-${todayKey()}.json`; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500); toast('Backup file saved ✓'); }catch(e){ toast('Could not create the file'); } },
  reset:()=>{ if(!resetArm){ resetArm=true; render(); setTimeout(()=>{resetArm=false; if(tab==='me') render();},4000); return; } if(CLOUD_ON() && Cloud.user){ Cloud.logout(); try{ localStorage.removeItem('ojas.sync'); }catch(e){} SY={h:{},ph:{}}; } S=freshState(); S.settings.onboarded=true; save(); ING=ingMap(); resetArm=false; render(); toast('All data erased'); },
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
document.addEventListener('toggle',ev=>{ if(ev.target.classList&&ev.target.classList.contains('mp-card')){ S.ui ||= {}; S.ui.mealOpen=ev.target.open; save(true); } }, true);
document.addEventListener('change',ev=>{
  const t=ev.target;
  if(t.id==='importFile' && t.files[0]){ const rd=new FileReader(); rd.onload=()=>{ try{ const s=JSON.parse(rd.result); if(!s || typeof s.days!=='object') throw 0;
      const ph=s._photos||[]; delete s._photos; ph.forEach(p=>PDB.put(p)); if(ph.length) setTimeout(loadPhotos,500);
      const f=freshState(); S={...f,...s,settings:{...f.settings,...(s.settings||{})},rungs:{...f.rungs,...(s.rungs||{})}}; ING=ingMap(); save(); applyTheme(); render(); toast(`Restored ✓ ${Object.keys(S.days).length} days`); }catch(e){ toast('That file is not an Ojas backup'); } }; rd.readAsText(t.files[0]); }
  if(t.id==='avatarFile' && t.files[0]) readAvatar(t.files[0]);
  if(t.dataset.photo && t.files[0]){ const pose=t.dataset.photo; resizeImg(t.files[0]).then(data=>PDB.put({id:todayKey()+'-'+pose, date:todayKey(), pose, data})).then(()=>{ loadPhotos(); toast('📸 Photo saved (private, on this phone)'); }).catch(()=>toast('Could not save the photo')); }
  if(t.id==='healthFile' && t.files[0]){ const rd=new FileReader(); rd.onload=()=>{ try{ const h=JSON.parse(rd.result); if(!h || !h.ojas_health) throw 0;
      const r=importHealth(h); if(sheetEl) closeSheet();
      save(); tab=r.sm.length?'today':'health'; render(); toast(r.msg); }catch(e){ toast('That is not an Ojas health file'); } }; rd.readAsText(t.files[0]); }
  if(t.dataset.sl){ const d=day(); d.sl ||= {}; d.sl[t.dataset.sl]=t.value; const h=sleepHours(d.sl); if(h!=null) d.sleep=String(h); save(); render(); }
  if(t.dataset.in==='weight' || t.dataset.in==='waist') { if(tab==='today') toast('Saved ✓'); }
  if(t.dataset.in==='steps' && tab==='today') render();
  if(t.dataset.in || t.dataset.set) queueBadges();
});

/* =====================================================================
   v1.5 — my starting point (setup wizard + report reader), goal → plan,
          daily musts (measured), weekly goals (flexible week), calorie bank
   ===================================================================== */
const ACT_F = {sed:[1.2,'Mostly sitting','desk job, little walking'], light:[1.375,'Lightly active','walks / 1–3 workouts a week'], mod:[1.55,'Active','3–5 workouts a week'], active:[1.725,'Very active','hard training 6–7 days']};
const KEY_LABS = ['hba1c','fbs','bpsys','bpdia','tg','hdl','ldl','alt','ast','uric','creat','tsh','vitd','b12','hb','plt'];
const labMeta = k => (typeof LAB_MARKERS!=='undefined' ? LAB_MARKERS.find(m=>m.k===k) : null) || {k, n:k, u:''};
function latestLab(k){ const s=labSeries(k); return s.length ? s[s.length-1][1] : null; }
function bmrOf(p){ return 10*(+p.weight) + 6.25*(+p.heightCm) - 5*(+p.age||35) + (p.sex==='f'?-161:5); }
const bmiOf = (w,h) => w/((h/100)**2);
function bmiBand(b){ return b<18.5?['Under weight','a']:b<23?['Healthy','g']:b<25?['Overweight (Asian scale)','a']:b<30?['Obese — class 1 (Asian scale)','r']:['Obese — class 2 (Asian scale)','r']; }
function suggestGoal(p){ const h=+p.heightCm||170, w=+p.weight||80;
  return {weight: Math.round(Math.max(24*(h/100)**2, w*0.8)), waist: Math.round(h/2/2.54*2)/2, pace: 0.5}; }
function computePlan(p, goal){
  const bmr=bmrOf(p), tdee=bmr*ACT_F[p.activity||'light'][0];
  const pace=+goal.pace||0.5, floor=p.sex==='f'?1200:1500;
  const deficit=Math.min(pace*7700/7, tdee*0.25);
  const kcal=Math.max(floor, Math.round((tdee-deficit)/50)*50);
  const eg=latestLab('egfr'), kidney=eg!=null && eg<60;
  const gw=+goal.weight||+p.weight;
  const protein=Math.max(60, Math.round((kidney?0.8:1.2)*gw));
  const fat=Math.round(kcal*0.27/9), carbs=Math.max(80, Math.round((kcal-protein*4-fat*9)/4));
  const steps={sed:8000, light:9000, mod:10000, active:10000}[p.activity||'light'];
  const waterMl=Math.min(4000, Math.max(2500, Math.round(35*(+p.weight)/250)*250));
  const toLose=Math.max(0, (+p.weight)-gw), weeks=Math.ceil(toLose/pace);
  return {bmr:Math.round(bmr), tdee:Math.round(tdee), deficit:Math.round(tdee-kcal), kcal, protein, carbs, fat, steps, waterMl, floor, kidney, weeks, toLose:r1(toLose), date:addDays(todayKey(), weeks*7)};
}
function applyPlan(p, goal){ const pl=computePlan(p, goal);
  Object.assign(S.settings, {kcal:pl.kcal, protein:pl.protein, carbs:pl.carbs, fat:pl.fat, steps:pl.steps, waterMl:pl.waterMl, kg:String(p.weight), heightCm:+p.heightCm});
  S.plan={...pl, made:todayKey()};
  const wg=(S.weekly||[]).find(g=>g.id==='steps'); if(wg && wg.auto==='steps') wg.target=pl.steps*7;
  return pl; }

/* ---------- where I stand ---------- */
function standList(){ const out=[];
  if(typeof LAB_MARKERS==='undefined') return out;
  for(const m of LAB_MARKERS){ const v=latestLab(m.k); if(v==null) continue; const st=labStatus(m,v); if(st==='r'||st==='a') out.push({m,v,st}); }
  return out.sort((a,b)=>(a.st==='r'?0:1)-(b.st==='r'?0:1)); }
function standHTML(p){
  const w=+p.weight, h=+p.heightCm, b=bmiOf(w,h), [band,bs]=bmiBand(b);
  const wst=+p.waist, whr=wst? (wst*2.54)/h : null;
  const pl=computePlan(p, S.goal||suggestGoal(p)); const flags=standList();
  return `<div class="stand">
    <div class="st-grid">
      <div class="st"><b class="${bs}">${r1(b)}</b><span>BMI · ${esc(band)}</span></div>
      <div class="st"><b class="${whr==null?'':whr>=0.5?'r':'g'}">${whr==null?'—':whr.toFixed(2)}</b><span>Waist ÷ height · ${whr==null?'add waist':whr>=0.6?'high belly fat':whr>=0.5?'belly fat — risk':'healthy'}</span></div>
      <div class="st"><b>${pl.tdee.toLocaleString('en-IN')}</b><span>kcal your body burns a day</span></div>
    </div>
    ${flags.length?`<div class="small muted" style="font-weight:800;margin:12px 0 4px">Blood numbers to fix (latest)</div>${flags.slice(0,8).map(f=>`<div class="st-flag">${SDOT[f.st]} <b>${esc(f.m.n)}</b> ${f.v} ${esc(f.m.u)} <small>· healthy ${rangeText(f.m)}</small></div>`).join('')}`
      :`<div class="small muted" style="margin-top:10px">No blood results yet — add a report to see what needs fixing.</div>`}
  </div>`; }

/* ---------- setup wizard ---------- */
const WZ_STEPS=['Welcome','About you','Health numbers','Where I stand','My goal','Daily & weekly'];
let WZ=null;
function wizard(step=0){
  const p0=S.profile||{}; const g0=S.goal||{};
  WZ={step, p:{name:p0.name||'', age:p0.age||'', sex:p0.sex||'m', heightCm:p0.heightCm||S.settings.heightCm||'', weight:p0.weight||S.settings.kg||'', waist:p0.waist||'', activity:p0.activity||'light', diet:p0.diet||'veg'},
    labs:{}, labDate:todayKey(), goal:{weight:g0.weight||'', waist:g0.waist||'', pace:g0.pace||''},
    musts:[...(S.musts||DEF_MUSTS)], weekly:JSON.parse(JSON.stringify(S.weekly||defWeekly()))};
  for(const k of KEY_LABS){ const v=latestLab(k); if(v!=null) WZ.labs[k]=v; }
  drawWz();
}
function wzNav(){ const s=WZ.step;
  return `<div class="wz-dots">${WZ_STEPS.map((n,i)=>`<i class="${i<s?'d':i===s?'on':''}"></i>`).join('')}</div>`; }
function wzBtns(next='Next →'){ return `<div class="row" style="margin-top:16px">${WZ.step>0?`<button class="btn sec" data-act="wzBack">← Back</button>`:''}<button class="btn pri grow" data-act="wzNext">${next}</button></div>`; }
function wzIn(path, label, val, ph='', mode='decimal'){ return `<div class="grow"><label class="f">${label}</label><input class="inp" data-wz="${path}" inputmode="${mode}" value="${esc(val??'')}" placeholder="${esc(ph)}"></div>`; }
function drawWz(){ const s=WZ.step, p=WZ.p; let h='';
  if(s===0) h=`<div class="dish-hero"><span>🔥</span></div><h2>My starting point</h2><div class="hih">2 minutes to set up your plan</div>
    <p>Tell the app where you are today and where you want to be. It works out your calories, protein, steps and weekly workouts — and adjusts when your numbers change.</p>
    <div class="tip">🔒 Everything stays on this phone. A lab report you pick is read on the phone itself — nothing is uploaded.</div>
    <button class="btn pri full" style="margin-top:16px" data-act="wzNext">Start setup →</button>
    <label class="btn sec full" style="margin-top:8px;cursor:pointer">📁 I have a setup file from my coach<input type="file" id="healthFile" accept="application/json,.json" hidden></label>
    ${S.settings.onboarded?'':`<button class="btn ghost full" style="margin-top:4px" data-act="wzSkip">Skip for now</button>`}`;
  if(s===1) h=`<h2>About you</h2>${wzIn('p.name','Your name',p.name,'e.g. Himanshu','text')}
    <div class="row">${wzIn('p.age','Age',p.age,'years','numeric')}<div class="grow"><label class="f">Sex</label><div class="seg">${[['m','Male'],['f','Female']].map(([k,l])=>`<button class="${p.sex===k?'on':''}" data-act="wzSet" data-k="p.sex" data-v="${k}">${l}</button>`).join('')}</div></div></div>
    <div class="row">${wzIn('p.heightCm','Height (cm)',p.heightCm,'e.g. 170')}${wzIn('p.weight','Weight today (kg)',p.weight,'e.g. 99')}</div>
    <div class="row">${wzIn('p.waist','Waist at belly button (inches)',p.waist,'e.g. 41')}</div>
    <label class="f">How active are you now?</label>
    <div class="opt-list">${Object.entries(ACT_F).map(([k,[,l,d]])=>`<button class="opt ${p.activity===k?'on':''}" data-act="wzSet" data-k="p.activity" data-v="${k}"><b>${l}</b><small>${d}</small></button>`).join('')}</div>
    <label class="f">Food</label><div class="seg">${[['veg','Vegetarian'],['egg','Eggetarian'],['nonveg','Non-veg']].map(([k,l])=>`<button class="${p.diet===k?'on':''}" data-act="wzSet" data-k="p.diet" data-v="${k}">${l}</button>`).join('')}</div>
    ${wzBtns()}`;
  if(s===2) h=`<h2>Health numbers</h2><div class="hih">From your latest blood report — skip any you don't know</div>
    <label class="btn pri full" style="cursor:pointer">📄 Read my lab report (PDF)<input type="file" id="repFile" data-to="wz" accept="application/pdf,.pdf" hidden></label>
    <div class="small muted" style="margin:6px 2px 4px">Works with typed lab PDFs (Redcliffe, Healthians, Thyrocare, Lal Path…). You check every number before it is saved.</div>
    <label class="f">Report date</label><input type="date" class="inp" data-wz="labDate" value="${esc(WZ.labDate)}">
    <div class="lab-grid">${KEY_LABS.map(k=>{ const m=labMeta(k); const v=WZ.labs[k]; const st=v!=null&&v!==''?labStatus(m,+v):'';
      return `<div class="lg"><label class="f">${SDOT[st]} ${esc(m.n)}</label><input class="inp" data-wz="labs.${k}" inputmode="decimal" value="${esc(v??'')}" placeholder="${esc(m.u)}"></div>`; }).join('')}</div>
    ${wzBtns()}`;
  if(s===3) h=`<h2>Where I stand today</h2><div class="hih">${esc(p.name||'You')} · ${esc(p.weight)} kg · ${esc(p.heightCm)} cm</div>${standHTML(p)}
    <div class="tip" style="margin-top:12px">Plain meaning: ${bmiOf(+p.weight,+p.heightCm)>=25?'your weight is putting load on liver, sugar and joints — losing the first 5–10% brings the biggest health gains.':'your weight is in a reasonable range — focus on waist, strength and the blood numbers.'} 🟡/🔴 items: show your doctor.</div>
    ${wzBtns('Set my goal →')}`;
  if(s===4){ const sg=suggestGoal(p); const g=WZ.goal; g.weight ||= sg.weight; g.waist ||= sg.waist; g.pace ||= sg.pace;
    const big=bmiOf(+p.weight,+p.heightCm)>=30; const pl=computePlan(p,g);
    h=`<h2>My goal</h2><div class="hih">Suggested from your height — change it if you like</div>
    <div class="row">${wzIn('goal.weight','Target weight (kg)',g.weight)}${wzIn('goal.waist','Target waist (in)',g.waist)}</div>
    <label class="f">Speed</label><div class="opt-list">${[[0.5,'Steady · 0.5 kg a week','easiest to keep; muscle stays (recommended)'],[0.75,'Faster · 0.75 kg a week','needs strict food logging'],...(big?[[1,'Fast · 1 kg a week','only while BMI is above 30']]:[])].map(([v,l,d])=>`<button class="opt ${+g.pace===v?'on':''}" data-act="wzSet" data-k="goal.pace" data-v="${v}"><b>${l}</b><small>${d}</small></button>`).join('')}</div>
    <div class="plan-box" id="wzPlan">${planBox(pl)}</div>
    ${wzBtns()}`; }
  if(s===5){ h=`<h2>Daily musts & weekly goals</h2><div class="hih">Daily = small non-negotiables. Weekly = the real target — skip a day, catch up later.</div>
    <div class="small muted" style="font-weight:800;margin:6px 0">Daily musts (measured by the app)</div>
    <div class="ticks">${Object.entries(MUSTS).map(([k,m])=>`<button class="tick ${WZ.musts.includes(k)?'on':''}" data-act="wzMust" data-k="${k}"><span class="bx">${WZ.musts.includes(k)?'✓':''}</span>${m.n}</button>`).join('')}</div>
    <div class="small muted" style="font-weight:800;margin:14px 0 6px">Weekly goals (Mon–Sun)</div>
    ${WZ.weekly.map((g,i)=>`<div class="wz-wg"><span>${g.e} ${esc(g.name)}</span><input class="inp" data-wzwg="${i}" inputmode="numeric" value="${g.id==='steps'?computePlan(p,WZ.goal).steps*7:g.target}"><small>${esc(g.unit)}/week</small></div>`).join('')}
    <div class="small muted" style="margin-top:6px">You can add your own weekly goals later in Me → Goals.</div>
    ${wzBtns('✅ Save my plan')}`; }
  openSheet(wzNav()+h);
}
function planBox(pl){ return `<div class="small muted" style="font-weight:800;margin-bottom:6px">YOUR PLAN</div>
  <div class="kv"><span>🔥 Calories a day</span><span><b>${pl.kcal.toLocaleString('en-IN')}</b> kcal</span>
  <span>💪 Protein</span><span><b>${pl.protein}</b> g${pl.kidney?' (kidney-safe)':''}</span>
  <span>👣 Steps</span><span><b>${pl.steps.toLocaleString('en-IN')}</b> a day</span>
  <span>💧 Water</span><span><b>${r1(pl.waterMl/1000)}</b> L</span>
  <span>📉 To lose</span><span><b>${pl.toLose}</b> kg · ~${pl.weeks} weeks</span>
  <span>🎯 Reach goal by</span><span><b>${fmtDY(pl.date)}</b></span></div>
  <div class="small muted" style="margin-top:6px">Body burns ~${pl.tdee.toLocaleString('en-IN')} kcal/day → eating ${pl.kcal.toLocaleString('en-IN')} gives a ${pl.deficit} kcal daily gap. Never below ${pl.floor} kcal.</div>`; }
function wzValid(){ const p=WZ.p;
  if(WZ.step===1){ if(!(+p.heightCm>120&&+p.heightCm<230)) return 'Enter height in cm'; if(!(+p.weight>30&&+p.weight<300)) return 'Enter weight in kg'; if(!(+p.age>12&&+p.age<100)) return 'Enter your age'; }
  if(WZ.step===4){ const g=WZ.goal; if(!(+g.weight>30)) return 'Enter target weight'; if(+g.weight>+p.weight) return 'Target is above today’s weight — this plan is for fat loss'; }
  return ''; }
function wzSave(){
  const p={...WZ.p, age:+WZ.p.age, heightCm:+WZ.p.heightCm, weight:+WZ.p.weight, waist:+WZ.p.waist||'', date:todayKey()};
  const g={weight:+WZ.goal.weight, waist:+WZ.goal.waist||'', pace:+WZ.goal.pace||0.5, startWeight:(S.goal&&S.goal.startWeight)||p.weight, startDate:(S.goal&&S.goal.startDate)||todayKey(), startWaist:(S.goal&&S.goal.startWaist)||p.waist};
  let n=0; S.labs ||= {};
  for(const [k,v] of Object.entries(WZ.labs)){ const x=parseFloat(v); if(isNaN(x)) continue; if(latestLab(k)===x) continue; const a=(S.labs[k] ||= []); const i=a.findIndex(r=>r[0]===WZ.labDate); if(i>=0) a[i][1]=x; else a.push([WZ.labDate,x]); n++; }
  S.profile=p; S.goal=g; S.musts=WZ.musts; S.weekly=WZ.weekly; applyPlan(p,g);
  const d=day(todayKey()); if(!d.weight) d.weight=String(p.weight); if(p.waist && !d.waist) d.waist=String(p.waist);
  S.settings.onboarded=true; save(); closeSheet(); tab='today'; render(); confetti(); toast(`✅ Plan ready · ${S.settings.kcal} kcal · ${S.settings.protein} g protein${n?` · ${n} results saved`:''}`);
}

/* ---------- report reader (PDF read on the phone) ---------- */
let REP=null;
async function readReport(file, to){
  toast('📄 Reading the report…');
  try{ const R=window.OjasReport; if(!R) throw new Error('reader missing'); const lib=await R.loadLib(); const res=await R.readPdf(file, lib); const out=R.parse(res.lines);
    REP={to, date:out.date||todayKey(), found:out.found, pages:res.pages, name:file.name};
    if(!Object.keys(out.found).length){ toast(res.lines.length<5?'This PDF is a scan/photo — please type the numbers':'No known markers found — please type them'); if(to==='wz') drawWz(); return; }
    repReview();
  }catch(e){ toast('Could not read this PDF — '+(e.message||'try another file')); if(to==='wz') drawWz(); }
}
function repReview(){ const keys=Object.keys(REP.found);
  openSheet(`<h2>📄 Check the numbers</h2><div class="hih">${esc(REP.name)} · ${REP.pages} pages · found ${keys.length} results</div>
    <label class="f">Report date</label><input type="date" class="inp" id="repDate" value="${esc(REP.date)}">
    <div class="small muted" style="margin:8px 2px">Untick anything wrong, or fix the number. The grey line is what the app read.</div>
    ${keys.map(k=>{ const m=labMeta(k), f=REP.found[k]; return `<div class="rr-row"><input type="checkbox" checked data-rr="${k}"><div class="grow"><b>${SDOT[labStatus(m,f.v)]} ${esc(m.n)}</b><small>${esc(f.line)}</small></div><input class="inp rr-v" id="rr_${k}" inputmode="decimal" value="${f.v}"><span class="small muted">${esc(m.u)}</span></div>`; }).join('')}
    <button class="btn pri full" style="margin-top:14px" data-act="repSave">Save these results</button>`);
}
function repSave(){ const dt=$('#repDate').value||todayKey(); let n=0; const got={};
  for(const cb of $$('[data-rr]')){ if(!cb.checked) continue; const k=cb.dataset.rr, v=parseFloat($('#rr_'+k).value); if(isNaN(v)) continue; got[k]=v; }
  if(REP.to==='wz'){ Object.assign(WZ.labs, got); WZ.labDate=dt; REP=null; drawWz(); toast(`✓ ${Object.keys(got).length} numbers filled in`); return; }
  S.labs ||= {}; for(const [k,v] of Object.entries(got)){ const a=(S.labs[k] ||= []); const i=a.findIndex(r=>r[0]===dt); if(i>=0) a[i][1]=v; else a.push([dt,v]); n++; }
  REP=null; save(); closeSheet(); tab='health'; render(); toast(`🩸 Saved ${n} results for ${fmtDY(dt)}`);
}

/* ---------- daily musts (measured, not hand-ticked where possible) ---------- */
const MUSTS = {
  steps:  {n:'👣 Steps (min)', ok:(d,k)=>stepsOf(d.steps)>=stepsMin(), v:d=>`${stepsOf(d.steps).toLocaleString('en-IN')}/${stepsMin().toLocaleString('en-IN')}`},
  yoga:   {n:'🧘 Yoga / breath 15 min', ok:d=>!!d.ticks.breath || (d.ex||[]).some(e=>['Yoga','Breath','Meditation'].includes(exCatOf(e))), v:d=>(d.ticks.breath||(d.ex||[]).some(e=>['Yoga','Breath','Meditation'].includes(exCatOf(e))))?'done':'15-min minimum ▶'},
  water:  {n:'💧 Water', ok:d=>wml(d)>=(+S.settings.waterMl||3000), v:d=>`${r1(wml(d)/1000)}/${r1((+S.settings.waterMl||3000)/1000)} L`},
  protein:{n:'💪 Protein', ok:(d,k)=>dayTotals(k).p>=S.settings.protein*0.9, v:(d,k)=>`${r0(dayTotals(k).p)}/${S.settings.protein} g`},
  kcal:   {n:'🔥 Calories OK', ok:(d,k)=>d.food.length>0 && dayTotals(k).k<=S.settings.kcal+100, v:(d,k)=>d.food.length?`${r0(dayTotals(k).k)}/${S.settings.kcal}`:'not logged'},
  sleep:  {n:'😴 Sleep 7 h+', ok:d=>(sleepHours(d.sl)||0)>=7, v:d=>sleepHours(d.sl)!=null?`${r1(sleepHours(d.sl))} h`:'log it'},
  dinner: {n:'🥣 Dinner by 8', tick:'dinner', ok:d=>!!d.ticks.dinner, v:d=>d.ticks.dinner?'done':'tap when done'},
  walk:   {n:'🚶 Walk after meals', tick:'walk', ok:d=>!!d.ticks.walk, v:d=>d.ticks.walk?'done':'tap when done'},
  med:    {n:'🧘 Meditation', tick:'med', ok:d=>!!d.ticks.med, v:d=>d.ticks.med?'done':'tap when done'},
  workout:{n:'🏋️ Any workout', ok:d=>d.ex.length>0, v:d=>d.ex.length?`${d.ex.length} logged`:'none yet'},
  kegel:  {n:'🔥 Kegels ×3', ok:d=>(d.kegel||0)>=3, v:d=>`${d.kegel||0}/3 sets`},
  weigh:  {n:'⚖️ Weigh-in', ok:d=>parseFloat(d.weight)>30, v:d=>parseFloat(d.weight)>30?`${d.weight} kg`:'not logged'}
};
const DEF_MUSTS=['steps','water','protein','kcal','sleep','dinner','yoga','kegel'];
const stepsMin = () => +S.settings.stepsMin || +S.settings.steps || 8000;
const myMusts = () => (S.musts||DEF_MUSTS).filter(k=>MUSTS[k]);
function mustsDone(k){ const d=peekDay(k); if(!d) return 0; day(k); return myMusts().filter(m=>MUSTS[m].ok(d,k)).length; }
function mustStreak(){ let n=0, k=todayKey(); const all=myMusts().length; if(mustsDone(k)<all) k=addDays(k,-1);
  while(n<400 && peekDay(k) && mustsDone(k)>=all){ n++; k=addDays(k,-1); } return n; }
function mustsCard(k=cur){ const d=day(k), ms=myMusts(), done=ms.filter(m=>MUSTS[m].ok(d,k)).length;
  return `<div class="card"><h3>✅ Daily musts <span class="sub">${done}/${ms.length} · streak ${mustStreak()} 🔥</span></h3>
    <div class="must-grid">${ms.map(m=>{ const M=MUSTS[m], ok=M.ok(d,k); return `<button class="must ${ok?'ok':''}" ${M.tick?`data-act="mustTick" data-k="${M.tick}"`:'data-act="mustHelp" data-k="'+m+'"'}><span class="mi">${ok?'✓':''}</span><b>${M.n}</b><small>${esc(M.v(d,k))}</small></button>`; }).join('')}</div></div>`; }

/* ---------- weekly goals (flexible week, Mon–Sun) ---------- */
function weekStart(k){ const d=parseKey(k); d.setDate(d.getDate()-((d.getDay()+6)%7)); return dkey(d); }
const weekKeys = k => { const s=weekStart(k); return [0,1,2,3,4,5,6].map(i=>addDays(s,i)); };
const exCatOf = e => (exById(e.ex)||{}).cat;
const WG_AUTO = {
  strength: d=>(d.ex||[]).some(e=>['Gym','Calisthenics'].includes(exCatOf(e)))?1:0,
  yoga:     d=>(d.ex||[]).some(e=>['Yoga','Mobility','Breath','Meditation'].includes(exCatOf(e)))?1:0,
  cardio:   d=>(d.ex||[]).filter(e=>exCatOf(e)==='Cardio').reduce((s,e)=>s+(+e.mins||0),0),
  steps:    d=>stepsOf(d.steps),
  pushups:  d=>(d.ex||[]).filter(e=>/pushup/.test(e.ex)).reduce((s,e)=>s+(+e.sets||0)*(+e.reps||0),0),
  workouts: d=>(d.ex||[]).length?1:0
};
function defWeekly(){ const st=+S.settings.steps||8000; return [
  {id:'strength', e:'🏋️', name:'Strength sessions', unit:'sessions', target:4, auto:'strength'},
  {id:'yoga', e:'🧘', name:'Yoga / breathing sessions', unit:'sessions', target:3, auto:'yoga'},
  {id:'steps', e:'👣', name:'Steps', unit:'steps', target:st*7, auto:'steps'},
  {id:'pushups', e:'💪', name:'Push-ups', unit:'reps', target:150, auto:'pushups'},
  {id:'cardio', e:'🏃', name:'Cardio minutes', unit:'min', target:60, auto:'cardio'},
  {id:'protdays', e:'🥗', name:'Protein-target days', unit:'days', target:6, auto:'proteinDays'},
  {id:'seeddays', e:'🌰', name:'Seed-mix days', unit:'days', target:7, auto:'seedDays'},
  {id:'nosugar', e:'🚫', name:'No-sugar days', unit:'days', target:6, auto:'noSugarDays'},
  {id:'kegeldays', e:'🔥', name:'Kegel days (3 sets)', unit:'days', target:7, auto:'kegelDays'}]; }
const myWeekly = () => S.weekly || (S.weekly=defWeekly());
function wgDay(g,k){ const d=peekDay(k); if(!d) return 0; return (g.auto&&WG_AUTO[g.auto]?WG_AUTO[g.auto](d,k):0) + (+((d.wg||{})[g.id])||0); }
function wgStatus(g,k=cur){ const wk=weekKeys(k), i=wk.indexOf(k), done=wk.reduce((s,x)=>s+wgDay(g,x),0);
  const sd=(S.goal&&S.goal.startDate)||'', i0=(sd>wk[0]&&sd<=wk[6])?wk.indexOf(sd):0, part=i0>0;
  const tgt=part? Math.max(1,Math.round((+g.target||1)*(7-i0)/7)) : (+g.target||1);
  const left=Math.max(0,tgt-done), daysLeft=7-i, per=left/daysLeft, exp=tgt*Math.max(1,i-i0+1)/(7-i0), todayV=wgDay(g,k);
  let st, msg; const fmt=n=>g.unit==='steps'?r0(n).toLocaleString('en-IN'):g.unit==='sessions'?Math.ceil(n):r0(n);
  if(done>=tgt){ st='g'; msg='✅ Week goal done!'; }
  else if(done>=exp*0.85){ st='g'; msg=`🟢 On track · ${fmt(left)} ${g.unit} left`; }
  else { st='a'; msg = g.unit==='sessions' ? `🟡 ${Math.ceil(left)} left in ${daysLeft} day${daysLeft>1?'s':''}${Math.ceil(left)>daysLeft?' — tough, but do what you can':''}` : `🟡 Behind · aim ${fmt(per)} a day for ${daysLeft} day${daysLeft>1?'s':''}`; }
  if(part) msg+=' · first week, target scaled';
  return {done, tgt, pct:Math.min(1,done/tgt), st, msg, share: todayV>=(+g.target||1)/7, todayV}; }
const WG_STEP = {sessions:[1], reps:[5,10], min:[10], steps:[], times:[1], days:[]};
function weeklyCard(k=cur, full=false){ const gs=myWeekly(); const wk=weekKeys(k);
  return `<div class="card"><h3>📅 This week <span class="sub">${fmtD(wk[0])} – ${fmtD(wk[6])}</span></h3>
    ${gs.map(g=>{ const s=wgStatus(g,k); const steps=WG_STEP[g.unit]||[1];
      return `<div class="wg">
        <div class="row" style="justify-content:space-between"><b>${g.e} ${esc(g.name)}</b><span class="small"><b>${g.unit==='steps'?r0(s.done).toLocaleString('en-IN'):r1(s.done)}</b> / ${g.unit==='steps'?r0(s.tgt).toLocaleString('en-IN'):s.tgt} ${esc(g.unit)}</span></div>
        <div class="wg-bar"><i class="${s.st}" style="width:${r0(s.pct*100)}%"></i><em style="left:${r0((wk.indexOf(k)+1)/7*100)}%"></em></div>
        <div class="row" style="justify-content:space-between"><span class="small muted">${s.msg}${s.share?' · ⭐ today’s share done':''}</span>
        <span class="row" style="gap:4px">${steps.map(n=>`<button class="mini" data-act="wgAdd" data-id="${esc(g.id)}" data-n="${n}">+${n}</button>`).join('')}${full&&steps.length?`<button class="mini" data-act="wgAdd" data-id="${esc(g.id)}" data-n="-${steps[0]}">−</button>`:''}</span></div>
      </div>`; }).join('')}
    <div class="small muted" style="margin-top:6px">The week is what counts — skip a day, catch up later. Logged workouts count automatically; use + for anything done outside the app. The line = where you should be by today.</div></div>`; }

/* ---------- weekly calorie bank ---------- */
function bank(k=cur){ const st=S.settings, kcal=+st.kcal||2000, floor=(S.plan&&S.plan.floor)||((S.profile&&S.profile.sex==='f')?1200:1500);
  const wk=weekKeys(k), i=wk.indexOf(k), budget=kcal*7; let before=0, unlogged=0, pSum=0, pDays=0;
  for(let j=0;j<i;j++){ const kk=wk[j], d=peekDay(kk); if(d&&d.food&&d.food.length){ const t=dayTotals(kk); before+=t.k; pSum+=t.p; pDays++; } else { before+=kcal; unlogged++; } }
  const today=dayTotals(k), daysLeft=7-i, rest=budget-before;
  const aim=Math.round(Math.min(kcal+150, Math.max(Math.max(floor,kcal-250), rest/daysLeft))/10)*10;
  const pace=before-kcal*i; // + = over pace
  if(peekDay(k)?.food?.length){ pSum+=today.p; pDays++; }
  return {budget, before, unlogged, today:today.k, left:budget-before-today.k, daysLeft, aim, pace, kcal, floor, wk, pAvg:pDays?pSum/pDays:0, pDays}; }
function bankLine(k=cur){ const b=bank(k); return `Week: <b>${r0(Math.max(0,b.left)).toLocaleString('en-IN')}</b> kcal left · aim ~<b>${b.aim.toLocaleString('en-IN')}</b> today`; }
function bankCard(k=cur){ const b=bank(k);
  const msg = b.pace>150 ? `A little above plan this week — that's normal. No need to cut hard or skip meals: just eat your usual ~<b>${b.aim}</b> kcal today (never below ${b.floor}).`
    : b.pace<-300 ? `Below plan this week. You don't need to "use up" the rest — just eat your normal ~<b>${b.kcal}</b> kcal today. Eating too little makes you hungrier later.`
    : `On plan. Aim ~<b>${b.aim}</b> kcal today.`;
  return `<div class="card bank"><h3>🏦 Weekly calorie bank <span class="sub">${fmtD(b.wk[0])} – ${fmtD(b.wk[6])}</span></h3>
    <div class="st-grid"><div class="st"><b>${b.budget.toLocaleString('en-IN')}</b><span>week budget</span></div><div class="st"><b>${r0(b.before+b.today).toLocaleString('en-IN')}</b><span>used so far</span></div><div class="st"><b class="${b.left<0?'r':'g'}">${r0(b.left).toLocaleString('en-IN')}</b><span>left this week</span></div></div>
    <div class="small" style="margin-top:8px">${msg}</div>
    ${b.unlogged?`<div class="small muted" style="margin-top:4px">${b.unlogged} earlier day${b.unlogged>1?'s':''} not logged — counted at target (${b.kcal}).</div>`:''}
    ${barChart(b.wk, kk=>dayTotals(kk).k, b.kcal, '#4f8ff7', 'kcal')}
    <div class="small muted">Protein this week: avg <b>${r0(b.pAvg)} g</b> over ${b.pDays} logged day${b.pDays===1?'':'s'} (target ${S.settings.protein} g)</div></div>`; }

/* ---------- week-by-week history ---------- */
function historyCard(){ const rows=[]; let k=weekStart(todayKey());
  for(let w=0; w<6; w++){ const wk=weekKeys(k); const fd=wk.filter(x=>peekDay(x)?.food?.length); const t=fd.map(x=>dayTotals(x));
    const ws=wk.map(x=>parseFloat(peekDay(x)?.weight)).filter(x=>x>30); const g=myWeekly().map(gg=>{ const done=wk.reduce((s,x)=>s+wgDay(gg,x),0); return Math.min(1,done/(+gg.target||1)); });
    const gp=g.length?r0(g.reduce((a,b)=>a+b,0)/g.length*100):0;
    const HL=habLevel(habById('allmusts')).hist.find(x=>x.ws===wk[0]); const lvTxt=HL&&HL.lv!=null?`${LEVELS[HL.lv].e} ${LEVELS[HL.lv].n}`:(wk[0]===weekStart(todayKey())?'in progress':'—');
    if(fd.length||ws.length||gp) rows.push(`<tr><td>${fmtD(wk[0])}</td><td>${fd.length?r0(t.reduce((s,x)=>s+x.k,0)/fd.length):'—'}</td><td>${fd.length?r0(t.reduce((s,x)=>s+x.p,0)/fd.length):'—'}</td><td>${ws.length?ws[ws.length-1]:'—'}</td><td>${gp}%</td><td style="white-space:nowrap">${lvTxt}</td></tr>`);
    k=addDays(k,-7); }
  return `<div class="card"><h3>📆 Week by week <span class="sub">measured from your logs</span></h3>${rows.length?`<table class="tbl"><tr><th>Week of</th><th>kcal/day</th><th>Protein</th><th>Weight</th><th>Goals</th><th>Level</th></tr>${rows.join('')}</table>`:'<div class="small muted">Starts filling after your first logged week.</div>'}<div class="small muted" style="margin-top:6px">Goals % = that week alone. Level = your history: it moves up only after good weeks in a row, so one good week after a bad one does not turn green.</div></div>`; }

/* ---------- goal progress + setup prompt ---------- */
function eventCard(){ const ev=S.goal&&S.goal.event; if(!ev||!ev.date) return ''; const left=daysBetween(todayKey(), ev.date); if(left<0) return '';
  const now=bodyKg(), toGo=r1(now-(+ev.weight||now)); const wks=Math.max(1,left/7), per=toGo>0?r1(toGo/wks):0;
  return `<div class="card ev-card"><div class="row" style="justify-content:space-between"><b>🎉 ${esc(ev.name||'Function')} · ${fmtD(ev.date)}</b><span class="ev-days">${left} days</span></div>
    <div class="small" style="margin-top:6px">Target <b>${ev.weight} kg</b>${ev.waist?` · waist <b>${ev.waist}\"</b>`:''} · now ${r1(now)} kg → ${toGo>0?`<b>${toGo} kg</b> to go (~${per} kg/week)`:'<b>target reached ✅</b>'}</div>
    ${left<=7?'<div class="tip" style="margin-top:8px">Last week: less salt for 3 days, no heavy dinner the night before, sleep 8 h, haircut done, outfit tried on.</div>':''}</div>`; }
function goalCard(){ const g=S.goal, p=S.profile; if(!g||!p) return '';
  const now=bodyKg(), start=+g.startWeight||+p.weight, lost=r1(start-now), need=r1(start-g.weight), pct=need>0?Math.max(0,Math.min(1,(start-now)/need)):0;
  return `<div class="card"><h3>🎯 My goal <span class="sub">${start} → ${g.weight} kg${g.waist?` · waist ${g.waist}"`:''}</span></h3>
    <div class="wg-bar big"><i class="g" style="width:${r0(pct*100)}%"></i></div>
    <div class="row" style="justify-content:space-between;margin-top:6px"><span class="small"><b>${lost>0?lost:0} kg</b> lost · <b>${r1(Math.max(0,now-g.weight))} kg</b> to go</span><span class="small muted">${S.plan?`target ${fmtD(S.plan.date)}`:''}</span></div></div>`; }
function setupPrompt(){ return S.profile ? '' : `<div class="card setup-cta" data-act="wizard"><div style="font-size:30px">🧭</div><div class="grow"><b>Set up my starting point</b><div class="small muted">2 minutes · BMI, blood numbers, goal → your own calories, protein & weekly goals</div></div><span>→</span></div>`; }
function meSetupCard(){ const p=S.profile, pl=S.plan;
  return `<div class="card"><h3>🧭 My starting point & plan ${p?`<span class="sub">set ${fmtD(p.date)}</span>`:''}</h3>
    ${p?`${standHTML(p)}${pl?`<div class="plan-box" style="margin-top:10px">${planBox(pl)}</div>`:''}`:'<div class="small muted">Not set up yet.</div>'}
    <div class="row" style="margin-top:12px"><button class="btn pri grow" data-act="wizard">${p?'✏️ Update':'Set up now'}</button><button class="btn sec grow" data-act="goalsEdit">Goals</button></div>
    ${p?`<button class="btn sec full" style="margin-top:8px" data-act="replan">🔄 Re-calculate plan with today's weight</button>`:''}
    <button class="btn ghost full" style="margin-top:4px" data-act="exportSetup">📤 Export my setup file (for a coach / new phone)</button></div>`; }
function goalsSheet(){ const gs=myWeekly(), ms=myMusts();
  openSheet(`<h2>🎯 Daily musts & weekly goals</h2>
    <div class="small muted" style="font-weight:800;margin:6px 0">Daily musts</div>
    <div class="ticks">${Object.entries(MUSTS).map(([k,m])=>`<button class="tick ${ms.includes(k)?'on':''}" data-act="gsMust" data-k="${k}"><span class="bx">${ms.includes(k)?'✓':''}</span>${m.n}</button>`).join('')}</div>
    <div class="small muted" style="font-weight:800;margin:14px 0 6px">Weekly goals</div>
    ${gs.map((g,i)=>`<div class="wz-wg"><span>${g.e} ${esc(g.name)}</span><input class="inp" data-gswg="${i}" inputmode="numeric" value="${g.target}"><small>${esc(g.unit)}</small><button class="x" data-act="gsDel" data-i="${i}" aria-label="Delete">×</button></div>`).join('')}
    <details class="card" style="margin-top:12px"><summary style="font-weight:700;cursor:pointer">+ Add my own weekly goal</summary>
      <label class="f">Name</label><input class="inp" id="ngName" placeholder="e.g. Squats, Surya namaskar, Swim">
      <div class="row"><div class="grow"><label class="f">Per week</label><input class="inp" id="ngT" inputmode="numeric" placeholder="e.g. 200"></div>
      <div class="grow"><label class="f">Counted in</label><select class="inp" id="ngU"><option value="reps">reps</option><option value="sessions">sessions</option><option value="min">minutes</option><option value="times">times</option></select></div></div>
      <button class="btn pri full" style="margin-top:12px" data-act="gsAdd">Add goal</button></details>
    <button class="btn sec full" style="margin-top:6px" data-act="closeSheet">Done</button>`); }

/* ---------- exercise step pictures ---------- */
function stepStrip(e){ if(!HAS_MEDIA) return ''; const af=AI_FRAMES[e.id]; if(!af || af.f.length<3) return '';
  return `<div class="strip">${af.f.map((f,i)=>`<figure><img src="${esc(f)}" alt="" loading="lazy"><figcaption><b>${i+1}</b> ${esc((af.cap&&af.cap[i])||'')}</figcaption></figure>`).join('')}</div>`; }

/* ---------- v1.5 actions + inputs ---------- */
Object.assign(A, {
  wizard:()=>wizard(0),
  wzSkip:()=>{ S.settings.onboarded=true; save(); closeSheet(); render(); },
  wzNext:()=>{ const err=wzValid(); if(err){ toast(err); return; } if(WZ.step>=5){ wzSave(); return; } WZ.step++; drawWz(); },
  wzBack:()=>{ WZ.step=Math.max(0,WZ.step-1); drawWz(); },
  wzSet:el=>{ const [a,b]=el.dataset.k.split('.'); WZ[a][b]=el.dataset.v; drawWz(); },
  wzMust:el=>{ const k=el.dataset.k; WZ.musts=WZ.musts.includes(k)?WZ.musts.filter(x=>x!==k):[...WZ.musts,k]; drawWz(); },
  repSave:()=>repSave(),
  mustTick:el=>{ const d=day(); const k=el.dataset.k; d.ticks[k]=!d.ticks[k]; save(); render(); },
  mustHelp:el=>{ const tips={steps:'Add steps in “Water & steps” below',water:'Tap a glass or bottle in “Water & steps”',protein:'Log your meals — protein adds up automatically',kcal:'Log all meals; stay within your calories',sleep:'Log bed and wake time in “Sleep & care”',workout:'Log or play any exercise',weigh:'Type today’s weight in “Body & habits”'}; toast(tips[el.dataset.k]||'Measured from your logs'); },
  wgAdd:el=>{ const d=day(); d.wg ||= {}; const id=el.dataset.id; d.wg[id]=Math.max(0,(+d.wg[id]||0)+(+el.dataset.n)); save(); render(); },
  goalsEdit:()=>goalsSheet(),
  gsMust:el=>{ const k=el.dataset.k; let ms=myMusts(); ms=ms.includes(k)?ms.filter(x=>x!==k):[...ms,k]; if(!ms.length){ toast('Keep at least one'); return; } S.musts=ms; save(true); goalsSheet(); },
  gsDel:el=>{ const gs=myWeekly(); gs.splice(+el.dataset.i,1); save(true); goalsSheet(); },
  gsAdd:()=>{ const n=$('#ngName').value.trim(), t=+$('#ngT').value, u=$('#ngU').value; if(!n||!(t>0)){ toast('Enter a name and a weekly number'); return; }
    const auto=/push.?up/i.test(n)?'pushups':null; myWeekly().push({id:'g'+uid(), e:'⭐', name:n, unit:u, target:t, auto}); save(); goalsSheet(); toast('Added — it shows on Today'); },
  replan:()=>{ const p=S.profile; if(!p||!S.goal) return; p.weight=bodyKg(); const pl=applyPlan(p,S.goal); save(); render(); toast(`🔄 New plan · ${pl.kcal} kcal · ${pl.protein} g protein`); },
  exportSetup:()=>{ const o={ojas_health:1, setup:1, profile:S.profile, goal:S.goal, musts:S.musts, weekly:S.weekly, labs:S.labs, retest:S.retest};
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(o,null,1)],{type:'application/json'})); a.download=`ojas-setup-${slug((S.profile&&S.profile.name)||'me')}-${todayKey()}.json`; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500); toast('Setup file saved ✓'); }
});
document.addEventListener('input',ev=>{ const t=ev.target;
  if(t.dataset.wz && WZ){ const path=t.dataset.wz.split('.'); if(path.length===1) WZ[path[0]]=t.value; else WZ[path[0]][path[1]]=t.value.trim();
    if(WZ.step===4 && path[0]==='goal'){ const pb=$('#wzPlan'); if(pb && +WZ.goal.weight>30) pb.innerHTML=planBox(computePlan(WZ.p,WZ.goal)); } return; }
  if(t.dataset.wzwg!=null && WZ){ const g=WZ.weekly[+t.dataset.wzwg]; if(+t.value>0) g.target=+t.value; return; }
  if(t.dataset.gswg!=null){ const g=myWeekly()[+t.dataset.gswg]; if(+t.value>0){ g.target=+t.value; save(true); } return; }
});
document.addEventListener('change',ev=>{ const t=ev.target;
  if(t.id==='repFile' && t.files[0]){ readReport(t.files[0], t.dataset.to||'health'); t.value=''; }
});
function importHealth(h){
  if(h.replace) S.labs={}; S.labs ||= {}; let n=0; for(const [k,arr] of Object.entries(h.labs||{})){ const a=(S.labs[k] ||= []); for(const [dt,v] of arr){ if(!a.some(x=>x[0]===dt)){ a.push([dt,v]); n++; } } }
  if(h.retest) S.retest={...h.retest, done:(S.retest&&S.retest.done)||{}};
  if(h.baseline && !(S.meas||[]).length){ S.meas=[{date:h.baseline.date, weight:h.baseline.weight, waist:h.baseline.waist}]; }
  if(h.meds) S.meds=h.meds; if(h.visits) S.visits=h.visits; if(h.notes) S.notes=h.notes;
  const sm=applySetupFile(h); S.settings.onboarded=true;
  return {sm, n, msg: sm.length?`✅ Loaded ${sm.join(' + ')}${n?` · ${n} results`:''}`:`🩸 Loaded ${n} results`}; }
function applySetupFile(h){ let msg=[];
  if(h.profile){ S.profile={...h.profile, date:h.profile.date||todayKey()}; msg.push('profile'); }
  if(h.goal){ S.goal={startWeight:(h.profile&&h.profile.weight)||'', startDate:todayKey(), startWaist:(h.profile&&h.profile.waist)||'', ...h.goal}; msg.push('goal'); }
  if(Array.isArray(h.musts)) S.musts=h.musts.filter(k=>MUSTS[k]);
  if(S.profile && S.goal){ applyPlan(S.profile, S.goal); msg.push('plan'); }
  if(Array.isArray(h.weekly)) S.weekly=h.weekly;
  if(h.settings) Object.assign(S.settings, h.settings);
  if(S.profile){ S.settings.onboarded=true; const d=day(todayKey()); if(!d.weight && S.profile.weight) d.weight=String(S.profile.weight); }
  return msg; }

/* =====================================================================
   v1.6 — coach chat (time-aware check-ins + free-text logging), portion sizes,
          weekly diet goals
   ===================================================================== */
const COACH_NAME = 'Riya';
/* ---------- portions (bowl / plate / glass) ---------- */
const PORTIONS = [
  {id:'katori-s', n:'Small katori', g:100, e:'🥣'}, {id:'katori-m', n:'Medium katori', g:150, e:'🥣'}, {id:'katori-l', n:'Big bowl', g:250, e:'🍲'},
  {id:'plate-q', n:'¼ plate', g:100, e:'🍽️'}, {id:'plate-h', n:'½ plate', g:200, e:'🍽️'}, {id:'plate-f', n:'Full plate', g:350, e:'🍽️'},
  {id:'glass', n:'Glass', g:250, e:'🥛'}, {id:'cup', n:'Cup', g:150, e:'☕'}, {id:'tbsp', n:'Tablespoon', g:15, e:'🥄'}, {id:'tsp', n:'Teaspoon', g:5, e:'🥄'}
];
const portionG = p => p.id==='katori-m' && +S.settings.katoriMl>0 ? +S.settings.katoriMl : p.g;
function portionSVG(kind, w=46){
  const c='var(--accent)';
  if(kind.startsWith('katori')){ const s={'katori-s':0.62,'katori-m':0.8,'katori-l':1}[kind]; const rx=20*s, ry=6*s, h=14*s;
    return `<svg width="${w}" height="${w*0.7}" viewBox="0 0 46 32"><ellipse cx="23" cy="${30-h}" rx="${rx}" ry="${ry}" fill="none" stroke="${c}" stroke-width="2"/><path d="M${23-rx} ${30-h} Q 23 ${30+h*0.6} ${23+rx} ${30-h}" fill="color-mix(in srgb,${c} 25%,transparent)" stroke="${c}" stroke-width="2"/></svg>`; }
  if(kind.startsWith('plate')){ const f={'plate-q':0.25,'plate-h':0.5,'plate-f':1}[kind]; const a=f*2*Math.PI, x=23+14*Math.sin(a), y=16-14*Math.cos(a);
    const wedge = f>=1 ? `<circle cx="23" cy="16" r="14" fill="color-mix(in srgb,${c} 30%,transparent)"/>` : `<path d="M23 16 L23 2 A14 14 0 ${f>0.5?1:0} 1 ${x} ${y} Z" fill="color-mix(in srgb,${c} 35%,transparent)"/>`;
    return `<svg width="${w}" height="${w*0.7}" viewBox="0 0 46 32"><circle cx="23" cy="16" r="15" fill="none" stroke="${c}" stroke-width="2"/>${wedge}</svg>`; }
  return `<span style="font-size:${w*0.5}px">${(PORTIONS.find(p=>p.id===kind)||{}).e||'🍽️'}</span>`;
}
function portionChips(){ return `<div class="small muted" style="font-weight:800;margin:10px 0 4px">OR PICK A SIZE</div><div class="por-grid">${PORTIONS.map(p=>`<button class="por" data-act="porPick" data-id="${p.id}">${portionSVG(p.id,40)}<b>${esc(p.n)}</b><small>~${portionG(p)} g</small></button>`).join('')}</div>`; }
function portionGuideCard(){ return `<details class="card"><summary style="font-weight:800;cursor:pointer">📏 Portion guide — bowls, plates & spoons</summary>
  <div class="por-grid" style="margin-top:10px">${PORTIONS.map(p=>`<div class="por">${portionSVG(p.id,40)}<b>${esc(p.n)}</b><small>~${portionG(p)} g/ml</small></div>`).join('')}</div>
  <div class="small muted" style="margin-top:8px">Measure your own medium katori once with a measuring cup and enter it in Me → Daily targets → "My katori (ml)". Sprint plate: ½ vegetables · ¼ protein · ¼ grain.</div></details>`; }

/* ---------- weekly diet + habit goals ---------- */
Object.assign(WG_AUTO, {
  proteinDays: (d,k)=> d.food&&d.food.length && dayTotals(k).p>=S.settings.protein*0.9 ? 1 : 0,
  seedDays:    d=> (d.food||[]).some(f=>f.dish==='ojas-seed-mix') ? 1 : 0,
  noSugarDays: d=> d.ticks&&d.ticks.nosugar ? 1 : 0,
  kegelDays:   d=> (d.kegel||0)>=3 ? 1 : 0,
  dinnerDays:  d=> d.ticks&&d.ticks.dinner ? 1 : 0
});

/* ---------- food text understanding ---------- */
const SYN = {chapati:'roti',chapatti:'roti',phulka:'roti',rotis:'roti',daal:'dal',dhal:'dal',dahi:'curd',yogurt:'curd',yoghurt:'curd',chaach:'chaas',chhach:'chaas',buttermilk:'chaas',
  sabji:'sabzi',subzi:'sabzi',subji:'sabzi',chai:'chai',tea:'chai',paneer:'paneer',sprout:'sprouts',chilla:'chilla',cheela:'chilla',chila:'chilla',khichri:'khichdi',khichadi:'khichdi',
  daliya:'dalia',porridge:'dalia',egg:'egg',channa:'chana',chole:'chole',rajmah:'rajma',seeds:'seed',almond:'almonds',badam:'almonds',walnut:'walnuts',akhrot:'walnuts',
  apples:'apple',bananas:'banana',kela:'banana',amrood:'guava',anar:'pomegranate',papita:'papaya',makhane:'makhana',lassi:'chaas',soup:'soup',salad:'salad'};
const NUMW = {half:0.5,'½':0.5,quarter:0.25,one:1,a:1,an:1,two:2,three:3,four:4,five:5,six:6,double:2};
const UNIT_RE = /\b(katori|katoris|bowl|bowls|plate|plates|glass|glasses|cup|cups|tbsp|tablespoons?|tsp|teaspoons?|spoons?|pieces?|pcs|g|gm|grams?|ml|small|medium|big|large|full|half)\b/g;
const normW = w => SYN[w] || w.replace(/s$/,'');
let DIDX=null;
function dishIndex(){ if(DIDX && DIDX.n===allDishes().length) return DIDX.list;
  const list=allDishes().map(d=>({d, toks:[...new Set(((d.en||'')+' '+(d.id||'').replace(/-/g,' ')).toLowerCase().replace(/[^a-z ]/g,' ').split(/\s+/).filter(w=>w.length>1).map(normW))]}));
  DIDX={n:allDishes().length, list}; return list; }
function matchDish(words){
  const ws=words.map(normW).filter(w=>w.length>1 && !['and','with','had','ate','have','some','my','the','of','for','in','at','today','drank','drink','took'].includes(w)); if(!ws.length) return null;
  let best=null;
  for(const it of dishIndex()){ const hit=ws.filter(w=>it.toks.includes(w)).length; if(!hit) continue;
    const score=hit/ws.length + hit/it.toks.length*0.6 - (it.d.mine?0:0); if(!best || score>best.score) best={d:it.d, score}; }
  return best && best.score>=0.75 ? best.d : null;
}
const ING_SERV = {curd:[150,'1 katori'], 'hung-curd':[100,'100 g'], paneer:[100,'100 g'], milk:[250,'1 glass'], chaas:[250,'1 glass'], tofu:[100,'100 g'], almonds:[10,'10 almonds'], walnuts:[14,'4 halves'], 'pumpkin-seeds':[10,'1 tbsp'], flaxseed:[7,'1 tbsp'], cucumber:[100,'1 cucumber'], carrot:[80,'1 carrot'], tomato:[80,'1 tomato'], makhana:[25,'1 bowl']};
const ALIAS = {rice:'rice-bowl', 'brown rice':'brown-rice-bowl', dal:'toor-dal', salad:'green-salad', curd:'ING:curd', paneer:'ING:paneer', milk:'ING:milk', tofu:'ING:tofu', 'hung curd':'ING:hung-curd', cucumber:'ING:cucumber', carrot:'ING:carrot', walnuts:'ING:walnuts', almonds:'ING:almonds', 'seed mix':'ojas-seed-mix', seed:'ojas-seed-mix', chai:'chai', 'green chai':'green-tea-drink', kadha:'tulsi-adrak-kadha', 'tulsi kadha':'tulsi-adrak-kadha', ccf:'ccf-tea', 'ccf tea':'ccf-tea', 'jeera dhaniya saunf':'ccf-tea', sattu:'sattu-drink', takra:'takra', saunth:'saunth-water', 'saunth water':'saunth-water', 'ajwain water':'ajwain-saunf-water', 'ajwain saunf':'ajwain-saunf-water', 'haldi water':'haldi-pepper-water', 'amla shot':'amla-ginger-shot', 'amla juice':'amla-ginger-shot', 'elaichi tea':'elaichi-saunf-tea', 'saunf tea':'elaichi-saunf-tea', 'missi roti':'missi-roti', 'multigrain roti':'multigrain-roti', saag:'sarson-saag', 'sarson saag':'sarson-saag', 'makki roti':'makki-roti', 'soya keema':'soya-keema', 'dal makhani':'dal-makhani-lite', lobia:'lobia-curry', 'moong soup':'moong-dal-soup', 'palak soup':'palak-paneer-soup', 'tomato soup':'tomato-beet-soup', 'tofu bhurji':'tofu-bhurji', 'paneer paratha':'paneer-paratha'};
function ingDish(id){ const a=ING.get(id); if(!a) return null; const [g,u]=ING_SERV[id]||[100,'100 g'];
  return {id:'ING:'+id, en:a[1], e:'🥣', unit:u, g, macros:{k:a[3]*g/100, p:a[4]*g/100, c:a[5]*g/100, f:a[6]*g/100}}; }
function aliasDish(ws){ const key=ws.map(normW).filter(w=>!['and','with','had','ate','have','some','my','the','of','plain','fresh'].includes(w)).join(' ');
  const a=ALIAS[key]; if(!a) return null; return a.startsWith('ING:') ? ingDish(a.slice(4)) : dishById(a); }
function piecesPerServing(d){ const m=/^(\d+)\s/.exec(d.unit||''); return m?+m[1]:1; }
function parseFoodPart(part){
  let t=' '+part.toLowerCase().replace(/(\d)(katori|bowl|plate|glass|cup|g|gm|ml)\b/g,'$1 $2')+' ';
  let num=null; const nm=/(\d+(\.\d+)?)/.exec(t); if(nm){ num=+nm[1]; t=t.replace(nm[0],' '); }
  for(const [w,v] of Object.entries(NUMW)){ const re=new RegExp('\\b'+w.replace('½','½')+'\\b'); if(num==null && re.test(t)){ num=v; t=t.replace(re,' '); break; } }
  const units=(t.match(UNIT_RE)||[]); t=t.replace(UNIT_RE,' ');
  const words=t.trim().split(/\s+/); const d=aliasDish(words)||matchDish(words); if(!d) return null;
  const sg=servingGrams(d); let q=num!=null?num:1; let how='';
  const has=u=>units.some(x=>x.startsWith(u));
  const size=has('small')?'s':has('big')||has('large')?'l':'m';
  if(has('katori')||has('bowl')){ const g=(has('bowl')&&size==='m'?250:{s:100,m:portionG(PORTIONS[1]),l:250}[size])*(num||1); q=g/sg; how=`${num||1} ${has('bowl')?'bowl':'katori'}`; }
  else if(has('plate')){ const g=(has('half')?200:has('full')?350:350)*(num||1); q=g/sg; how=`${num||1} plate`; }
  else if(has('glass')){ q=250*(num||1)/sg; how=`${num||1} glass`; } else if(has('cup')){ q=150*(num||1)/sg; how=`${num||1} cup`; }
  else if(has('tbsp')||has('tablespoon')||has('spoon')){ q=15*(num||1)/sg; how=`${num||1} tbsp`; } else if(has('tsp')||has('teaspoon')){ q=5*(num||1)/sg; how=`${num||1} tsp`; }
  else if(has('g')||has('gram')||has('gm')||has('ml')){ q=(num||100)/sg; how=`${num} g`; }
  else if(num!=null && piecesPerServing(d)>1){ q=num/piecesPerServing(d); how=`${num} pcs`; }
  else how = q===1?'1 serving':`${q} servings`;
  return {d, q:Math.round(q*100)/100, how};
}
function logDishQ(d, q, how){ const m=dishMacros(d); const t=cur===todayKey()?nowHM():'13:00';
  const e={id:uid(), t, slot:slotFor(t), dish:d.id, name:d.en, e:d.e, unit:d.unit||'serving', qty:q, k:r1(m.k*q), p:r1(m.p*q), c:r1(m.c*q), f:r1(m.f*q), via:'chat'};
  day().food.push(e); return e; }

/* ---------- check-ins (shown by time of day) ---------- */
const H = () => { const d=new Date(); return d.getHours()+d.getMinutes()/60; };
const todayW = () => (typeof WORKOUTS!=='undefined' ? WORKOUTS[parseKey(cur).getDay()] : null);
function logWorkoutFromChat(mins, title, minimum){ const w=minimum?WORKOUTS[7]:todayW(); if(!w) return;
  const main=w.items.map(it=>exById(it.id)).find(e=>e && !['jumping-jacks'].includes(e.id)) || exById(w.items[0].id);
  const kcal=Math.round((minimum?4:6)*(mins||w.mins)*bodyKg()/80);
  day().ex.push({id:uid(), ex:main.id, name:(minimum?'15-min minimum':w.title)+' (chat)', t:nowHM(), mins:mins||w.mins, kcal}); }
const CHECKINS = [
  {id:'warm', from:4, to:11.5, pri:1, q:'Good morning! Did you have a glass of warm water after waking up?', opts:[['✅ Yes','yes'],['❌ Not yet','no']], done:d=>!!d.ticks.warm,
   on:{yes:d=>{ d.ticks.warm=true; d.waterMl=wml(d)+250; d.waterLog.push({ml:250,t:nowHM(),n:'Warm water'}); return 'Lovely. 250 ml added. 💧'; }, no:()=>'Have it now — one glass, slowly. It wakes up your digestion.'}},
  {id:'methi', from:4, to:11.5, pri:1, q:'Methi water or jeera water this morning?', opts:[['🌿 Methi','methi'],['🌱 Jeera','jeera'],['❌ No','no']], done:d=>!!d.ticks.methi,
   on:{methi:d=>{ d.ticks.methi=true; const x=dishById('methi-water'); if(x) logDishQ(x,1); return 'Logged methi water ✓ — a good morning habit.'; },
       jeera:d=>{ d.ticks.methi=true; const x=dishById('jeera-water'); if(x) logDishQ(x,1); return 'Logged jeera water ✓ — good for gas and bloating.'; }, no:()=>'Okay. Soak 1 tsp methi tonight for tomorrow.'}},
  {id:'weight', from:4, to:12, pri:2, q:'What is your weight this morning? Just type the number, like 97.4', input:'weight', done:d=>parseFloat(d.weight)>30},
  {id:'sleep', from:4, to:13, pri:2, q:'What time did you sleep and wake up? Type like: 11 to 6', input:'sleep', done:d=>!!(d.sl&&d.sl.bed&&d.sl.wake)},
  {id:'snore', from:4, to:13, pri:2, q:'How was the snoring last night?', opts:[['😴 None','0'],['🙂 Light','1'],['😮‍💨 Loud','2'],['⚠️ Gasping','3']], done:d=>!!(d.sl&&d.sl.snore!=null&&d.sl.snore!==''),
   on:{'*':(d,v)=>{ d.sl ||= {}; d.sl.snore=v; return v==='3'?'Please tell your doctor about gasping — and ask about a sleep study.':'Noted ✓ Side-sleeping and dinner by 8 help a lot.'; }}},
  {id:'yoga', from:4, to:22, pri:3, q:'Did you do your yoga and breathing today?', opts:[['✅ Done','yes'],['⚡ Do 15-min now','min'],['⏳ Later','later']], done:d=>!!d.ticks.breath,
   on:{yes:d=>{ d.ticks.breath=true; return 'Shabash! Yoga ✓'; }, min:()=>'__MIN__', later:()=>'Okay — I will ask again later.'}},
  {id:'breakfast', from:7.5, to:12, pri:4, slot:'breakfast', q:'What did you have for breakfast? Type it, like "2 moong chilla and curd"', input:'food', opts:[['📋 Plan breakfast','plan'],['⏭ Skipped','skip']], done:d=>d.food.some(f=>f.slot==='breakfast')},
  {id:'seed', from:9, to:22, q:'Had your 2 tablespoons of seed mix today?', opts:[['✅ Yes','yes'],['⏳ Later','later']], done:d=>d.food.some(f=>f.dish==='ojas-seed-mix'),
   on:{yes:()=>{ const x=dishById('ojas-seed-mix'); if(x) logDishQ(x,1); return 'Logged ✓ Zinc + omega-3 done for today.'; }, later:()=>'Keep the jar on your desk.'}},
  {id:'lunch', from:12.5, to:16.5, pri:2, slot:'lunch', q:'What did you have for lunch? Type it, like "2 roti, dal palak, salad"', input:'food', opts:[['📋 Plan lunch','plan'],['⏭ Skipped','skip']], done:d=>d.food.some(f=>f.slot==='lunch')},
  {id:'water', from:14, to:21, q:'Water check! Shall I add some?', opts:[['+250 ml','250'],['+500 ml','500'],['+1 L','1000'],['Enough','no']], done:d=>wml(d)>=(+S.settings.waterMl||3000)*0.6,
   on:{'*':(d,v)=>{ if(v==='no') return 'Okay.'; d.waterMl=wml(d)+(+v); d.waterLog.push({ml:+v,t:nowHM(),n:'chat'}); return `💧 +${fmtMl(+v)} · total ${fmtMl(wml(d))}`; }}},
  {id:'ayur', from:16, to:20, pri:5, q:'Ayurvedic drink time — which one today?', opts:[['🫖 Tulsi kadha','tulsi-adrak-kadha'],['🍵 CCF tea','ccf-tea'],['🥤 Sattu','sattu-drink'],['⏳ Later','later']], done:d=>d.food.some(f=>{ const x=dishById(f.dish); return x&&x.cat==='Ayurvedic drinks' && f.slot!=='early'; }),
   on:{'*':(d,v)=>{ if(v==='later') return 'Okay — keep saunf or CCF tea for after dinner.'; const x=dishById(v); if(x){ logDishQ(x,1); return `Logged ${x.en} ✓ Tap it in the Food tab for the recipe.`; } return ''; }}},
  {id:'snack', from:16, to:19.5, slot:'snack', q:'Evening snack? Type it, like "roasted chana and green tea"', input:'food', opts:[['📋 Plan snack','plan'],['⏭ No snack','skip']], done:d=>d.food.some(f=>f.slot==='snack')},
  {id:'workout', from:16, to:23.5, pri:2, q:'Did you train today?', opts:[['💪 Yes, full workout','full'],['⚡ 15-min minimum','min15'],['😌 Rest day','rest']], done:d=>d.ex.length>0,
   on:{full:()=>{ logWorkoutFromChat(); return 'Workout logged ✓ It counts towards your weekly goals.'; }, min15:()=>{ logWorkoutFromChat(15,'',true); return 'Minimum logged ✓ Small days still count.'; }, rest:d=>{ d.chatDone ||= {}; return 'Rest is part of the plan. A walk still helps.'; }}},
  {id:'steps', from:18, to:23.9, q:'How many steps today? Type the number', input:'steps', done:d=>stepsOf(d.steps)>0},
  {id:'dinner', from:19, to:23.9, pri:1, q:'Dinner done — before 8 pm?', opts:[['✅ Yes, by 8','yes'],['🕗 After 8','late'],['⏳ Not yet','no']], done:d=>!!d.ticks.dinner || !!(d.chatDone&&d.chatDone.dinner),
   on:{yes:d=>{ d.ticks.dinner=true; return 'Perfect ✓ Now tell me what you ate, like "khichdi and soya curry".'; }, late:d=>{ d.ticks.dinner=false; return 'Okay — aim for 7:45 tomorrow. Tell me what you ate.'; }, no:()=>'Keep it light and warm. Tell me when done.'}},
  {id:'kegel', from:8, to:23.9, q:'Kegels — shall I count a set now?', opts:[['✅ +1 set','yes'],['⏳ Later','later']], done:d=>(d.kegel||0)>=3,
   on:{yes:d=>{ d.kegel=Math.min(3,(d.kegel||0)+1); return `Kegels ${d.kegel}/3 ✓`; }, later:()=>'Okay — 10 slow + 10 quick when you can.'}},
  {id:'intent', from:5, to:11, pri:8, q:'One intention for today? Type one short line, like "protein at every meal".', input:'intent', opts:[['⏭ Skip','skip']], done:d=>!!(d.mind&&d.mind.int), on:{skip:()=>'Okay.'}},
  {id:'journal', from:20.5, to:23.9, pri:6, q:'3-line journal: what went well today? Type one line.', input:'journal', opts:[['⏭ Skip','skip']], done:d=>!!(d.mind&&d.mind.j1), on:{skip:()=>'Okay — rest well.'}},
  {id:'review', from:20.5, to:23.9, pri:7, q:'Quick 1-tap review of today’s habits?', opts:[['📝 Open review','open'],['⏭ Not now','no']], done:d=>!!d.reviewed||reviewPending(todayKey()).length===0, on:{open:()=>'__REVIEW__', no:()=>'Okay — it will wait on the Today tab.'}},
  {id:'nosugar', from:20, to:23.9, q:'No sugar or sweets today?', opts:[['✅ No sugar','yes'],['🍬 Had some','no']], done:d=>d.ticks.nosugar!=null,
   on:{yes:d=>{ d.ticks.nosugar=true; return 'Great for your liver and uric acid ✓'; }, no:d=>{ d.ticks.nosugar=false; return 'Okay, no guilt — tomorrow is a new day.'; }}}
];
const CHAT_QUESTIONS = CHECKINS.map(c=>c.q);

/* ---------- chat engine ---------- */
let CH = {pending:null, last:null};
const chatLog = () => { const d=day(); d.chat ||= []; return d.chat; };
function botSay(text, opts){ chatLog().push({w:'b', t:text, ts:nowHM(), opts:opts||null}); if(chatLog().length>80) chatLog().splice(0, chatLog().length-80);
  if(S.settings.chatVoice!==false && !inQuiet() && typeof speak==='function' && CHAT_QUESTIONS.includes(text)) speak(text,{lang:'en', g:'f', flush:true}); }
function meSay(text){ chatLog().push({w:'m', t:text, ts:nowHM()}); }
function nextCheckin(){ const d=day(), h=cur===todayKey()?H():20; d.chatDone ||= {}; if(cur===todayKey() && inQuiet()) return null;
  const el=CHECKINS.filter(c=> h>=c.from && h<c.to && !d.chatDone[c.id] && !c.done(d)); el.sort((a,b)=>(a.pri||5)-(b.pri||5)); return el[0] || null; }
function askNext(){ const c=nextCheckin(); CH.pending=c;
  if(c){ botSay(c.q, c.opts||null); return; }
  if(cur===todayKey() && inQuiet()){ botSay(`🌙 Quiet hours (${fmt12(quietFrom())} – ${fmt12(quietTo())}). I won't ask anything now — sleep well. You can still type to log.`); return; }
  const d=day(), ms=myMusts(), done=ms.filter(m=>MUSTS[m].ok(d,cur)).length, b=bank(cur);
  botSay(`All caught up ✓ Daily musts ${done}/${ms.length} · ${r0(dayTotals(cur).k)} kcal, ${r0(dayTotals(cur).p)} g protein so far · week: ${r0(Math.max(0,b.left)).toLocaleString('en-IN')} kcal left. Tell me anything to log — food, water, steps, weight, sleep, Kegels.`); }
function answerCheckin(v, label){ const c=CH.pending; if(!c) return; const d=day(); d.chatDone ||= {};
  meSay(label||v);
  if(c.input==='food' && (v==='plan'||v==='skip')){ d.chatDone[c.id]=true;
    if(v==='plan'){ const pl=MEAL_PLANS[mealPlanIdx()]; let n=0; pl.items.forEach(([s,id],i)=>{ if(s===c.slot && !d.food.some(f=>f.dish===id&&f.slot===s)){ logPlanItem(i); n++; } }); botSay(n?`Logged your plan ${c.slot} (${n} items) ✓`:'Nothing to log from the plan for this meal.'); }
    else botSay('Okay, skipped.'); save(); askNext(); return; }
  const fn=c.on&&(c.on[v]||c.on['*']); let r=fn?fn(d,v):'';
  d.chatDone[c.id]=true; save();
  if(r==='__MIN__'){ closeSheet(); sessionStart(7); return; }
  if(r==='__REVIEW__'){ reviewSheet(todayKey()); return; }
  if(r) botSay(r); askNext();
}
function parseSleep(t){ const m=/(\d{1,2})(?::(\d\d))?\s*(am|pm)?\s*(?:to|-|till|until)\s*(\d{1,2})(?::(\d\d))?\s*(am|pm)?/.exec(t); if(!m) return null;
  let bh=+m[1], wh=+m[4]; if(m[3]!=='am' && bh>=7 && bh<=12) bh=bh===12?0:bh+12; if(bh===24) bh=0; if(m[6]==='pm' && wh<12) wh+=12;
  const f=(h,mm)=>String(h%24).padStart(2,'0')+':'+(mm||'00'); return {bed:f(bh,m[2]), wake:f(wh,m[5])}; }
function handleRules(raw, shown){ const t=raw.trim(); if(!t) return; const low=t.toLowerCase(); const d=day(); const out=[];
  meSay(shown||t);
  if(/^\d{2,3}(\.\d+)?\s*(kg)?$/.test(low) && +low.replace(/kg/,'')>30 && +low.replace(/kg/,'')<250 && !(CH.pending&&CH.pending.input==='steps')){ d.weight=String(+low.replace(/kg/,'')); d.chatDone ||= {}; d.chatDone.weight=true; save(); render(); botSay(`⚖️ Weight ${d.weight} kg ✓ — I watch the weekly average, not single days.`); askNext(); return; }
  if(/^(hi|hello|hey|namaste|good (morning|afternoon|evening))\b/.test(low)){ const h=H(); botSay(`${h<12?'Good morning':h<17?'Good afternoon':'Good evening'}, ${esc((S.profile&&S.profile.name)||'')}! 😊`); askNext(); save(); return; }
  { const rm=/(same|repeat|again)\b.*\b(breakfast|lunch|snack|dinner)|\b(breakfast|lunch|snack|dinner)\b.*\b(same|repeat|again|as yesterday)/.exec(low);
    if(rm){ const slot=rm[2]||rm[3]; const L=lastMeal(slot); if(L){ addItems(L.items, slot, `${slotName(slot)} repeated`); botSay(`🔁 Logged the same ${slotName(slot).toLowerCase()} as ${niceDate(L.k).toLowerCase()}: ${mealText(L.items)}. Type "undo" if wrong.`); save(); return; } } }
  if(/^undo\b/.test(low)){ const L=CH.last; if(!L){ botSay('Nothing to undo.'); return; } L.undo(); CH.last=null; save(); render(); botSay('Undone ✓'); return; }
  if(/status|how am i|summary|progress/.test(low)){ CH.pending=null; const c=nextCheckin(); CH.pending=null; const b=bank(cur), ms=myMusts();
    botSay(`Today: ${ms.map(m=>(MUSTS[m].ok(d,cur)?'✅ ':'⬜ ')+MUSTS[m].n.replace(/^\S+\s/,'')).join(' · ')}\nWeek: ${myWeekly().map(g=>{ const s=wgStatus(g,cur); return `${g.e} ${g.unit==='steps'?r0(s.done).toLocaleString('en-IN'):r1(s.done)}/${s.tgt}`; }).join(' · ')}\nCalorie bank: ${r0(Math.max(0,b.left)).toLocaleString('en-IN')} left · aim ~${b.aim}`); save(); return; }
  // pending numeric/sleep inputs
  const P=CH.pending;
  if(P && P.input==='weight'){ const m=/(\d{2,3}(\.\d+)?)/.exec(low); if(m && +m[1]>30 && +m[1]<250){ d.weight=m[1]; d.chatDone ||= {}; d.chatDone.weight=true; save(); render(); const prev=Object.keys(S.days).sort().filter(k=>k<cur && parseFloat(S.days[k].weight)>30).pop();
      botSay(`Weight ${m[1]} kg ✓${prev?` (${r1(+m[1]-parseFloat(S.days[prev].weight))>0?'+':''}${r1(+m[1]-parseFloat(S.days[prev].weight))} vs ${niceDate(prev)})`:''}. Daily ups and downs are water — I watch the weekly average.`); askNext(); return; } }
  if(P && P.input==='steps'){ const m=/(\d[\d,]*)/.exec(low); if(m){ d.steps=String(+m[1].replace(/,/g,'')); d.chatDone ||= {}; d.chatDone.steps=true; save(); render(); botSay(`👣 ${(+d.steps).toLocaleString('en-IN')} steps ✓`); askNext(); return; } }
  const looksLog = /\d/.test(low) || low.split(/,|\band\b|\+/).some(x=>parseFoodPart(x)) || /water|kegel|yoga|steps|slept/.test(low);
  if(P && (P.input==='intent' || P.input==='journal') && !looksLog){ d.mind ||= {}; d.chatDone ||= {};
    if(P.input==='intent'){ d.mind.int=t.slice(0,140); d.chatDone.intent=true; save(); botSay(`🌅 Intention saved: “${esc(d.mind.int)}”`); askNext(); return; }
    const kk=!d.mind.j1?'j1':!d.mind.j2?'j2':'j3'; d.mind[kk]=t.slice(0,140); save();
    if(kk==='j1'){ CH.pending={...P}; botSay('What did you learn today? One line.'); return; }
    if(kk==='j2'){ CH.pending={...P}; botSay('One thing for tomorrow?'); return; }
    d.chatDone.journal=true; save(); botSay('📓 Journal saved ✓ Good night.'); askNext(); return; }
  if(P && P.input==='sleep'){ const s=parseSleep(low); if(s){ d.sl ||= {}; Object.assign(d.sl,s); const h=sleepHours(d.sl); if(h!=null) d.sleep=String(h); d.chatDone ||= {}; d.chatDone.sleep=true; save(); botSay(`😴 Slept ${s.bed} → ${s.wake} = ${r1(h)} h ✓`); askNext(); return; } }
  // free text: several things in one message
  let m;
  if((m=/(?:weight|weigh|wt)\D{0,6}(\d{2,3}(\.\d+)?)/.exec(low)) || (m=/^(\d{2,3}(\.\d+)?)\s*kg\b/.exec(low))){ d.weight=m[1]; out.push(`⚖️ weight ${m[1]} kg`); }
  if((m=/waist\D{0,6}(\d{2}(\.\d+)?)/.exec(low))){ d.waist=m[1]; out.push(`📏 waist ${m[1]}"`); }
  if((m=/(\d[\d,]{2,})\s*steps?/.exec(low))){ d.steps=String(+m[1].replace(/,/g,'')); out.push(`👣 ${(+d.steps).toLocaleString('en-IN')} steps`); }
  if(/\b(slept|sleep|bed)\b/.test(low)){ const s=parseSleep(low); if(s){ d.sl ||= {}; Object.assign(d.sl,s); const h=sleepHours(d.sl); if(h!=null) d.sleep=String(h); out.push(`😴 sleep ${r1(h)} h`); } }
  let waterMl=0; if((m=/(\d+(\.\d+)?)\s*(l|litre|liter|ltr)s?\b/.exec(low)) && /water|pani|drank|drink/.test(low)) waterMl=+m[1]*1000;
  else if((m=/(\d+)\s*ml\b/.exec(low)) && /water|pani|drank/.test(low)) waterMl=+m[1];
  else if((m=/(\d+|a|one|two|three)\s*(glass|glasses)\s*(of\s*)?(warm\s*)?(water|pani)/.exec(low))) waterMl=(NUMW[m[1]]||+m[1]||1)*250;
  else if(/\b(warm water|water)\b/.test(low) && !/jeera|methi|coconut|saunth|ajwain|haldi|pudina|nimbu|dalchini/.test(low)) waterMl=250;
  if(waterMl){ d.waterMl=wml(d)+waterMl; d.waterLog.push({ml:waterMl,t:nowHM(),n:'chat'}); if(/warm/.test(low)) d.ticks.warm=true; out.push(`💧 +${fmtMl(waterMl)}`); }
  if(/kegel/.test(low)){ const n=(m=/(\d)\s*(sets?)?\s*kegel|kegels?\s*(\d)/.exec(low))?+(m[1]||m[3]):1; d.kegel=Math.min(3,(d.kegel||0)+n); out.push(`🔥 Kegels ${d.kegel}/3`); }
  if(/pranayam|kapalbhati|anulom|breath|yoga|surya/.test(low)){ d.ticks.breath=true; out.push('🧘 yoga/breath ✓'); }
  if(/meditat/.test(low)){ d.ticks.med=true; out.push('🧘 meditation ✓'); }
  if(/\bsun(light)?\b/.test(low)){ d.ticks.sun=true; out.push('☀️ sunlight ✓'); }
  if(/no (sugar|sweet)/.test(low)){ d.ticks.nosugar=true; out.push('🚫 no sugar ✓'); }
  if(/dinner/.test(low) && /(by|before) ?(7|8)/.test(low)){ d.ticks.dinner=true; out.push('🥣 dinner by 8 ✓'); }
  const csMsg=chatSets(low); if(csMsg) out.push(csMsg);
  else if((m=/(\d+)\s*(push ?ups?|pushups?)/.exec(low))){ const e=exById('pushup'); if(e){ d.ex.push({id:uid(), ex:'pushup', name:'Push-ups (chat)', t:nowHM(), sets:1, reps:+m[1], kcal:exKcal(e,1,+m[1],0)}); out.push(`💪 ${m[1]} push-ups`); } }
  if(!csMsg && /\b(gym|workout|trained|training|exercise done)\b/.test(low)){ logWorkoutFromChat(); out.push('🏋️ workout logged'); }
  // food: whatever is left
  let foodTxt = (csMsg?'':low).replace(/(weight|weigh|wt)\D{0,6}\d{2,3}(\.\d+)?|waist\D{0,6}\d{2}(\.\d+)?|\d[\d,]{2,}\s*steps?|\d+(\.\d+)?\s*(l|litre|liter|ltr|ml)\b|kegels?|\d+\s*push ?ups?|(slept|sleep|bed)[^,]*/g,' ');
  if(waterMl) foodTxt=foodTxt.replace(/\b(warm\s*)?(water|pani)\b/g,' ');
  const added=[];
  for(const part of foodTxt.split(/,|\band\b|\+|&|\bwith\b|\bthen\b|;/)){ const r=parseFoodPart(part); if(r){ const e=logDishQ(r.d, r.q); added.push(e); out.push(`${r.d.e||'🍽️'} ${r.d.en} (${r.how}) · ${r0(e.k)} kcal · ${r1(e.p)} g P`); } }
  if(!out.length){ if(aiOn()){ aiAsk(shown||t); return; } botSay(`I didn't catch that${CLOUD_ON()&&!Cloud.user?' (log in under Me to switch on my AI brain — then I understand anything)':''}. Try: "2 roti and dal", "9k steps", "weight 97.4", "slept 11 to 6", "500 ml water", "did my workout", or "status".`); save(); return; }
  if(added.length){ CH.last={undo:()=>{ const dd=day(); dd.del ||= []; added.forEach(f=>dd.del.push(f.id)); dd.food=dd.food.filter(f=>!added.includes(f)); }}; if(P && P.input==='food'){ d.chatDone ||= {}; d.chatDone[P.id]=true; } }
  save(); render();
  botSay('Logged ✓\n'+out.join('\n')+(added.length?`\nToday: ${r0(dayTotals(cur).k)} kcal · ${r0(dayTotals(cur).p)} g protein. (Type "undo" if wrong.)`:''));
  if(P && (P.input!=='food' || added.length)) askNext();
}
function drawChat(){ const L=chatLog(); const last=L[L.length-1];
  const html=`<div class="chat-head"><img src="frames/coaches/riya.jpg" alt=""><div><b>${COACH_NAME} · your Ojas coach</b><small>${aiOn()?'🧠 AI on · ask or tell me anything':'Logs food, water, steps, sleep, workouts'}</small></div><button class="mini" data-act="chatVoice">${S.settings.chatVoice===false?'🔇':'🔊'}</button></div>
    <div class="chat-list" id="chatList">${L.map(x=>`<div class="msg ${x.w}"><div>${esc(x.t).replace(/\n/g,'<br>')}</div><small>${esc(x.ts)}</small></div>`).join('')}</div>
    ${last&&last.w==='b'&&last.opts?`<div class="chat-opts">${last.opts.map(([l,v])=>`<button class="chip" data-act="chatOpt" data-v="${esc(v)}" data-l="${esc(l)}">${esc(l)}</button>`).join('')}</div>`:`<div class="chat-opts ideas">${CHAT_IDEAS.map(q=>`<button class="chip" data-act="chatOpt" data-v="__say:${esc(q)}" data-l="${esc(q)}">${esc(q)}</button>`).join('')}</div>`}
    <form class="chat-in" id="chatForm"><input id="chatIn" class="inp" placeholder="Ask or tell me anything — e.g. 9k steps, what should I eat?" autocomplete="off" enterkeyhint="send"><button class="btn pri" type="submit">Send</button></form>
    <div class="small muted" style="text-align:center;margin-top:6px">Tip: tap the 🎤 on your iPhone keyboard to speak instead of typing.</div>`;
  openSheet(html, b=>{ const li=$('#chatList',b); li.scrollTop=li.scrollHeight; requestAnimationFrame(()=>{ li.scrollTop=li.scrollHeight; });
    $('#chatForm',b).addEventListener('submit',ev=>{ ev.preventDefault(); const v=$('#chatIn',b).value; handleText(v); drawChat(); setTimeout(()=>$('#chatIn')&&$('#chatIn').focus(),50); }); });
}
function openChat(){ const L=chatLog(); const lastTs=L.length?L[L.length-1].ts:''; if(CH.confirm){ drawChat(); return; } CH.pending=null;
  const h=H(); if(!L.length || L[L.length-1].w==='m' || true){ if(!L.length) botSay(`${h<12?'Good morning':h<17?'Good afternoon':'Good evening'}${S.profile&&S.profile.name?', '+S.profile.name:''}! I'm ${COACH_NAME}. I'll check your day and log things for you.`); askNext(); }
  save(true); drawChat(); }
function chatCard(){ const c=nextCheckin(); return `<div class="card chat-cta" data-act="chat"><img src="frames/coaches/riya.jpg" alt=""><div class="grow"><b>💬 Chat with ${COACH_NAME}</b><div class="small muted">${c?esc(c.q):'Say hi — or type what you ate, water, steps, weight…'}</div></div><span>→</span></div>`; }

Object.assign(A, {
  chat:()=>openChat(),
  chatOpt:el=>{ const v=el.dataset.v; if(v==='__cfm_yes'||v==='__cfm_no'){ meSay(el.dataset.l); applyConfirm(v==='__cfm_yes'); save(); drawChat(); return; } if(v.startsWith('__say:')){ handleText(v.slice(6)); drawChat(); return; } if(v.startsWith('__edit:')){ closeSheet(); setTimeout(()=>A.editEntry({dataset:{id:v.slice(6)}}),350); return; } answerCheckin(v, el.dataset.l); if(sheetEl) drawChat(); },
  chatVoice:()=>{ S.settings.chatVoice = S.settings.chatVoice===false; save(true); drawChat(); },
  porPick:el=>{ const p=PORTIONS.find(x=>x.id===el.dataset.id); if(!p||!logDraft) return; logDraft.mode='g'; logDraft.grams=portionG(p); drawLog(); }
});

/* =====================================================================
   v1.7 — P1 + P2
   habit levels (history-based, change only after 2–3 weeks of continuity) ·
   quiet hours + nudges · 1-tap day review · treat budget + patterns ·
   eating-out pack · morning card · private space (encrypted) · voice ·
   skin (dermatologist's Rx) · mindset
   ===================================================================== */

/* ---------- quiet hours ---------- */
const quietFrom = () => S.settings.quietFrom || '22:30';
const quietTo   = () => S.settings.quietTo   || '06:00';
function inQuiet(hm){ hm = hm || nowHM(); const f=quietFrom(), t=quietTo(); return f>t ? (hm>=f || hm<t) : (hm>=f && hm<t); }
const fmt12 = hm => { const [h,m]=hm.split(':').map(Number); return `${((h+11)%12)+1}:${String(m).padStart(2,'0')} ${h<12?'am':'pm'}`; };

/* ---------- habit engine ---------- */
const careV = (d,id) => d.care && d.care[id]===true ? 1 : d.care && d.care[id]===false ? 0 : null;
const tickV = (d,id) => d.ticks[id]===true ? 1 : d.ticks[id]===false ? 0 : null;
const anyFood = d => (d.food||[]).length>0;
const HABITS = [
  {id:'brush-am', e:'🦷', n:'Brush — morning',   tgt:.95, g:'Care',  v:d=>careV(d,'teeth-am')},
  {id:'brush-pm', e:'🪥', n:'Brush — night',     tgt:.95, g:'Care',  v:d=>careV(d,'teeth-pm')},
  {id:'tongue',   e:'👅', n:'Tongue scraper',    tgt:.85, g:'Care',  v:d=>careV(d,'tongue')},
  {id:'face-am',  e:'🧼', n:'Face wash — morning', tgt:.9, g:'Care', v:d=>careV(d,'face-am')},
  {id:'face-pm',  e:'🌙', n:'Face wash — night', tgt:.9,  g:'Care',  v:d=>careV(d,'face-pm')},
  {id:'spf',      e:'🧴', n:'Sunscreen',         tgt:.85, g:'Care',  v:d=>careV(d,'spf')},
  {id:'shower',   e:'🚿', n:'Shower',            tgt:.9,  g:'Care',  v:d=>careV(d,'shower')},
  {id:'warm',     e:'🫖', n:'Warm water on waking', tgt:.85, g:'Body', v:d=>tickV(d,'warm')},
  {id:'water',    e:'💧', n:'Water target',      tgt:.85, g:'Body',  v:d=>wml(d)>=(+S.settings.waterMl||3000)?1:(wml(d)>0?0:null)},
  {id:'meals',    e:'🍽️', n:'3 meals logged',    tgt:.85, g:'Food',  v:d=>{ if(!anyFood(d)) return null; const s=new Set(d.food.map(f=>f.slot)); return ['breakfast','lunch','dinner'].every(x=>s.has(x))?1:0; }},
  {id:'protein',  e:'💪', n:'Protein target',    tgt:.85, g:'Food',  v:(d,k)=>anyFood(d)?(dayTotals(k).p>=S.settings.protein*0.9?1:0):null},
  {id:'dinner',   e:'🥣', n:'Dinner by 8',       tgt:.85, g:'Food',  v:d=>tickV(d,'dinner')},
  {id:'nosugar',  e:'🚫', n:'No sugar / sweets', tgt:.85, g:'Food',  v:d=>tickV(d,'nosugar')},
  {id:'seed',     e:'🌰', n:'Seed mix',          tgt:.85, g:'Food',  v:d=>anyFood(d)?(d.food.some(f=>f.dish==='ojas-seed-mix')?1:0):null},
  {id:'sleep',    e:'😴', n:'Sleep 7 h+',        tgt:.85, g:'Body',  v:d=>{ const h=sleepHours(d.sl); return h==null?null:(h>=7?1:0); }},
  {id:'steps',    e:'👣', n:'Daily minimum steps', tgt:.85, g:'Move', v:d=>stepsOf(d.steps)>=stepsMin()?1:(stepsOf(d.steps)>0?0:null)},
  {id:'walk',     e:'🚶', n:'Walk after meals',  tgt:.8,  g:'Move',  v:d=>tickV(d,'walk')},
  {id:'yoga',     e:'🧘', n:'Yoga / breathing',  tgt:.8,  g:'Move',  v:(d,k)=>MUSTS.yoga.ok(d,k)?1:(d.ticks.breath===false?0:null)},
  {id:'gym',      e:'🏋️', n:'Strength sessions (4 a week)', weekly:4, g:'Move', v:d=>WG_AUTO.strength(d)},
  {id:'kegel',    e:'🔥', n:'Kegels ×3',         tgt:.85, g:'Body',  v:d=>(d.kegel||0)>=3?1:((d.kegel||0)>0||(d.hab&&d.hab.kegel===0)?0:null)},
  {id:'ayur',     e:'🫖', n:'Ayurvedic drink / soup', tgt:.8, g:'Food', v:d=>anyFood(d)?(d.food.some(f=>{ const x=dishById(f.dish); return x&&(x.cat==='Ayurvedic drinks'||x.cat==='Soups'); })?1:0):null},
  {id:'voice',    e:'🎙️', n:'Voice practice',    tgt:.7,  g:'Mind',  v:d=>d.voice?1:null},
  {id:'journal',  e:'📓', n:'Intention + journal', tgt:.7, g:'Mind', v:d=>{ const m=d.mind||{}; return (m.int&&(m.j1||m.j2||m.j3))?1:((m.int||m.j1)?0:null); }},
  {id:'allmusts', e:'✅', n:'All daily musts',   tgt:6/7, g:'Overall', v:(d,k)=>{ const ms=myMusts(); const n=mustsDone(k); return n>=ms.length?1:((anyFood(d)||wml(d)>0||stepsOf(d.steps)>0)?0:null); }}
];
const habById = id => HABITS.find(h=>h.id===id);
function habVal(h,d,k){ const v=h.v(d,k); if(v===1) return 1; const r=d.hab&&d.hab[h.id]; return r!=null ? r : v; }
const LEVELS = [
  {n:'Not started', c:'n',  e:'⚪', tip:'No full week recorded yet.'},
  {n:'Starting',    c:'r',  e:'🌱', tip:'First good week done. Keep the chain going.'},
  {n:'Building',    c:'a',  e:'🧱', tip:'2 good weeks in a row. The habit is forming.'},
  {n:'Consistent',  c:'lg', e:'🟢', tip:'It is now part of your week.'},
  {n:'Strong',      c:'g',  e:'💪', tip:'Holds even on busy weeks.'},
  {n:'Mastered',    c:'s',  e:'🏆', tip:'Automatic. Keep it, it is yours.'}];
const NEED = [1,2,3,3,4];          // good weeks IN A ROW needed to move up from level i
const weakLine = h => h.weekly ? .5 : Math.max(.5, h.tgt-.25);
function habWeek(h, ws){ const t=todayKey(); let done=0, rec=0, any=false;
  for(const k of weekKeys(ws)){ if(k>t) break; const d=peekDay(k); if(!d) continue; day(k);
    let v=habVal(h,d,k); if(v!=null || anyFood(d) || wml(d)>0) any=true;
    if(k===t && v===0) v=null; if(v==null) continue; rec++; done+=v; }
  if(h.weekly){ if(!any) return {rate:null, rec:0, done:0}; return {rate:Math.min(1,done/h.weekly), rec:done, done}; }
  return {rate: rec>=3 ? done/rec : null, rec, done};
}
function weekClass(h, r){ if(r==null) return 'nd'; const good = h.weekly ? r>=1 : r>=h.tgt-1e-9; if(good) return 'good'; return r<weakLine(h) ? 'weak' : 'mixed'; }
function firstDataKey(){ const ks=Object.keys(S.days).sort(); return ks[0] || todayKey(); }
const HCACHE = {key:'', m:{}};
function habLevel(h){
  const ck=todayKey()+'|'+SAVE_N+'|'+cur;
  if(HCACHE.key!==ck){ HCACHE.key=ck; HCACHE.m={}; } if(HCACHE.m[h.id]) return HCACHE.m[h.id];
  const thisWs=weekStart(todayKey()); let ws=weekStart(firstDataKey());
  let lv=0, best=0, run=0, weakRun=0, recent=[], warn=false, fall=false, goodN=0, evalN=0; const hist=[];
  while(ws<thisWs){ const w=habWeek(h,ws), c=weekClass(h,w.rate); hist.push({ws, rate:w.rate, rec:w.rec, c});
    if(c!=='nd'){ evalN++; recent.push(c); if(recent.length>4) recent.shift(); }
    if(c==='good'){ goodN++; run++; weakRun=0; warn=false;
      if(lv<5 && run>=NEED[lv]){ lv++; run=0; fall=false; recent=[]; } }
    else if(c==='mixed'){ run=0; weakRun=0; }
    else if(c==='weak'){ run=0; weakRun++; warn=true;
      const weak4=recent.filter(x=>x==='weak').length;
      if(weakRun>=2 || weak4>=2){ if(lv>0){ lv--; fall=true; } weakRun=0; recent=[]; } }
    hist[hist.length-1].lv=lv; best=Math.max(best,lv); ws=addDays(ws,7); }
  const now=habWeek(h,thisWs);
  const res={lv, best, run, need:lv<5?NEED[lv]-run:0, warn, fall, hist, now, goodN, evalN, L:LEVELS[lv]};
  HCACHE.m[h.id]=res; return res;
}
function habRate(h, n){ const t=todayKey(); let done=0, rec=0;
  for(let i=0;i<n;i++){ const k=addDays(t,-i), d=peekDay(k); if(!d) continue; day(k); let v=habVal(h,d,k); if(i===0 && v===0) v=null; if(v==null) continue; rec++; done+=v; }
  return rec>=5 ? {r:done/rec, rec} : {r:null, rec}; }
function band(r){ if(r==null) return ['nd','not enough data']; if(r>=.95) return ['s','strong']; if(r>=.85) return ['g','green']; if(r>=.7) return ['lg','light green']; if(r>=.5) return ['a','amber']; return ['r','red']; }
function habStatus(h){ const L=habLevel(h); const nxt=LEVELS[L.lv+1];
  if(L.evalN===0) return 'No full week recorded yet — your level starts after your first full week.';
  if(L.fall) return `↘ Dropped to ${L.L.n} after weak weeks. ${L.need} good week${L.need>1?'s':''} in a row to climb back.`;
  if(L.warn) return L.lv===0 ? `⚠️ Weak weeks so far. Start small — one good week gets you to Starting.` : `⚠️ Last week was weak. One more weak week lowers the level.`;
  const lastC=(L.hist.filter(x=>x.c!=='nd').pop()||{}).c;
  if(lastC==='mixed') return `Mixed week — level held. ${nxt?`${L.need} good week${L.need>1?'s':''} in a row → ${nxt.n}.`:''}`;
  return nxt ? `${L.run} of ${NEED[L.lv]} good weeks in a row → ${nxt.n}.` : 'Top level. Keep it.'; }
const CLS_COL = {good:'var(--ok,#12b886)', mixed:'#f2c94c', weak:'#e03131', nd:'var(--border)'};
function habStrip(L, n=8){ const h=L.hist.slice(-n); return `<span class="hb-strip">${h.map(x=>`<i title="${fmtD(x.ws)}" style="background:${CLS_COL[x.c]}"></i>`).join('')}</span>`; }
function habRow(h){ const L=habLevel(h), r7=habRate(h,7), r30=habRate(h,30); const b=band(r30.r);
  return `<div class="hb-row" data-act="habOpen" data-id="${h.id}"><div class="hb-l"><b>${h.e} ${esc(h.n)}</b><small class="muted">${esc(habStatus(h))}</small></div>
    <div class="hb-r"><span class="lvl lv-${L.L.c}">${L.L.e} ${L.L.n}</span><div>${habStrip(L,6)}</div><small class="muted">7d ${r7.r==null?'—':r0(r7.r*100)+'%'} · 30d <span class="bd-${b[0]}">${r30.r==null?'—':r0(r30.r*100)+'%'}</span></small></div></div>`; }
function habitsCard(){ const groups=['Overall','Care','Body','Food','Move','Mind'];
  return `<div class="card"><h3>🧭 Habit levels <span class="sub">from your whole history</span></h3>
    <div class="small muted" style="margin-bottom:8px">A level moves <b>up</b> only after good weeks <b>in a row</b> (1 → 2 → 3 → 3 → 4), and <b>down</b> only after 2 weak weeks in a row (or 2 weak in 4). One good week after a missed week does not turn green. A past best level is never deleted. Not recorded ≠ missed.</div>
    ${HABITS.filter(h=>h.g==='Overall').map(habRow).join('')}
    <details><summary class="small" style="font-weight:800;cursor:pointer;margin-top:8px">All ${HABITS.length-1} habits ▾</summary>${groups.filter(g=>g!=='Overall').map(g=>{ const hs=HABITS.filter(h=>h.g===g); return `<div class="hb-g">${g}</div>${hs.map(habRow).join('')}`; }).join('')}</details>
    <div class="small muted" style="margin-top:8px">Week colours: <span style="color:#12b886">●</span> good <span style="color:#f2c94c">●</span> mixed (level holds) <span style="color:#e03131">●</span> weak ○ not recorded</div></div>`; }
function habSheet(id){ const h=habById(id); if(!h) return; const L=habLevel(h); const rs=[7,14,30].map(n=>habRate(h,n));
  const fx=(S.fix||{})[id];
  openSheet(`<h2>${h.e} ${esc(h.n)}</h2><div class="hih"><span class="lvl lv-${L.L.c}">${L.L.e} ${L.L.n}</span> · best ever: ${LEVELS[L.best].e} ${LEVELS[L.best].n}</div>
    <div class="card"><div class="small">${esc(habStatus(h))}</div><div class="small muted" style="margin-top:4px">${esc(L.L.tip)}</div>
    <div class="st-grid" style="margin-top:10px">${rs.map((r,i)=>{ const b=band(r.r); return `<div class="st"><b class="bd-${b[0]}">${r.r==null?'—':r0(r.r*100)+'%'}</b><span>${[7,14,30][i]} days · ${r.rec} recorded</span></div>`; }).join('')}</div></div>
    <div class="card"><h3>Week by week</h3><table class="tbl"><tr><th>Week of</th><th>Rate</th><th>Recorded</th><th></th></tr>
      ${L.hist.slice(-12).reverse().map(x=>`<tr><td>${fmtD(x.ws)}</td><td>${x.rate==null?'—':r0(x.rate*100)+'%'}</td><td>${h.weekly?x.rec+' sessions':x.rec+' days'}</td><td style="color:${CLS_COL[x.c]}">●</td></tr>`).join('') || '<tr><td colspan="4">No full week yet</td></tr>'}
      <tr><td>This week</td><td>${L.now.rate==null?'—':r0(L.now.rate*100)+'%'}</td><td>${h.weekly?L.now.rec+'/'+h.weekly:L.now.rec+' days'}</td><td>…</td></tr></table>
      <div class="small muted" style="margin-top:6px">Good week = ${h.weekly?`${h.weekly} sessions`:`${r0(h.tgt*100)}%+ of recorded days`} · weak = below ${r0(weakLine(h)*100)}%. Needs at least 3 recorded days to count.</div></div>
    ${fx?`<div class="tip">Your fix (${fmtD(fx.date)}): <b>${esc(fx.tip)}</b></div>`:''}
    <button class="btn sec full" data-act="habFix" data-id="${id}">🛠 Hard to keep? Find a fix</button>`); }
const FIX = {
  forgot:{l:'😶 I forget', tip:h=>`Stack it on something you never skip: do “${h.n}” right after ${h.g==='Care'?'brushing / using the bathroom':'a meal'} — and put a visible cue there.`},
  notime:{l:'⏱ No time', tip:h=>`Shrink it: a 2-minute version still counts on busy days. Do the tiny version first, full version when you can.`},
  wrongtime:{l:'🕒 Wrong time', tip:h=>`Move it to a time you control (straight after waking, or right after lunch). Tell me the new time in chat and I will ask then.`},
  hard:{l:'🧗 Too hard', tip:h=>`Lower the bar for 2 weeks (half the amount), then step back up. Two easy good weeks beat one heroic week.`}};
function fixSheet(id){ const h=habById(id); openSheet(`<h2>🛠 ${esc(h.n)}</h2><div class="hih">What gets in the way most?</div>
  <div class="chips">${Object.entries(FIX).map(([k,f])=>`<button class="chip" data-act="habFixPick" data-id="${id}" data-r="${k}">${f.l}</button>`).join('')}</div>`); }
function habAlerts(){ const out=[];
  for(const h of HABITS){ if(h.id==='allmusts') continue; const L=habLevel(h); let score=0, why='';
    if(L.fall){ score=4; why=`dropped to ${L.L.n}`; }
    else if(L.warn){ score=3; why='last week was weak'; }
    else if(L.now.rate!=null && L.now.rec>=3 && weekClass(h,L.now.rate)==='weak'){ score=2; why=`this week ${r0(L.now.rate*100)}% so far`; }
    else { const r=habRate(h,14); if(r.r!=null && r.r<.7){ score=1; why=`14-day rate ${r0(r.r*100)}%`; } }
    if(score) out.push({h, score, why}); }
  return out.sort((a,b)=>b.score-a.score).slice(0,3); }
function habAlertsCard(){ const al=habAlerts(), o=habLevel(habById('allmusts'));
  return `<div class="card"><h3>🧭 Habits <span class="sub">overall <span class="lvl lv-${o.L.c}">${o.L.e} ${o.L.n}</span></span></h3>
    ${al.length?al.map(a=>`<div class="row hb-al" style="justify-content:space-between"><span>${a.h.e} <b>${esc(a.h.n)}</b> <span class="small muted">· ${esc(a.why)}</span></span><button class="mini" data-act="habFix" data-id="${a.h.id}">Fix</button></div>`).join(''):'<div class="small muted">No habit needs attention right now. 👍</div>'}
    <button class="btn ghost" style="padding:8px 0 0" data-act="tab" data-tab="progress">All habit levels →</button></div>`; }
function levelUps(){ S.habLv ||= {}; const ups=[];
  for(const h of HABITS){ const L=habLevel(h), was=S.habLv[h.id]; if(was!=null && L.lv>was) ups.push(`${h.e} ${h.n} → ${L.L.n}`); S.habLv[h.id]=L.lv; }
  save(true); if(ups.length){ setTimeout(()=>{ confetti(); toast('⬆ Level up: '+ups.slice(0,2).join(' · ')); },900); } }

/* ---------- 1-tap end-of-day review ---------- */
const REVIEW_IDS = ['brush-am','tongue','face-am','spf','shower','warm','brush-pm','face-pm','dinner','nosugar','walk','yoga','kegel'];
function reviewKey(){ const t=todayKey(), h=H(); if(h<12 && !(peekDay(addDays(t,-1))||{}).reviewed && peekDay(addDays(t,-1))) return addDays(t,-1); return t; }
function reviewPending(k){ const d=day(k); return REVIEW_IDS.map(habById).filter(h=>habVal(h,d,k)==null); }
function setHab(k,id,v){ const d=day(k); d.hab ||= {}; d.hab[id]=v;
  const careMap={'brush-am':'teeth-am','brush-pm':'teeth-pm',tongue:'tongue','face-am':'face-am','face-pm':'face-pm',spf:'spf',shower:'shower'};
  if(careMap[id]){ d.care ||= {}; d.care[careMap[id]] = !!v; }
  if(['warm','dinner','nosugar','walk'].includes(id)) d.ticks[id] = !!v;
  if(id==='yoga'){ d.ticks.breath = !!v; }
  if(id==='kegel' && v) d.kegel=Math.max(3,d.kegel||0); }
function reviewCard(){ const h=H(); const k=reviewKey(); if(k===todayKey() && (h<20.5)) return ''; const d=day(k); if(d.reviewed) return '';
  const n=reviewPending(k).length; if(!n) return '';
  return `<div class="card setup-cta" data-act="review" data-k="${k}"><div style="font-size:28px">📝</div><div class="grow"><b>${k===todayKey()?'1-tap day review':'Yesterday’s review'}</b><div class="small muted">${n} habit${n>1?'s':''} not recorded — tap ✓ or ✗ (about 20 seconds)</div></div><span>→</span></div>`; }
function reviewSheet(k){ const d=day(k); const list=REVIEW_IDS.map(habById);
  openSheet(`<h2>📝 ${k===todayKey()?'Today':niceDate(k)} — quick review</h2><div class="hih">Not recorded is not missed — this turns blanks into ✓ or ✗</div>
    <div class="rv-list">${list.map(h=>{ const v=habVal(h,d,k); return `<div class="rv-row"><span>${h.e} ${esc(h.n)}</span><span><button class="mini ${v===1?'on':''}" data-act="revSet" data-k="${k}" data-id="${h.id}" data-v="1">✓</button><button class="mini ${v===0?'on no':''}" data-act="revSet" data-k="${k}" data-id="${h.id}" data-v="0">✗</button></span></div>`; }).join('')}</div>
    <div class="row" style="margin-top:12px"><button class="btn sec grow" data-act="revRest" data-k="${k}" data-v="1">✓ All blanks done</button><button class="btn pri grow" data-act="revDone" data-k="${k}">Save review</button></div>`); }

/* ---------- treat budget + patterns ---------- */
const TREAT_BUDGET = () => +S.settings.treats || 2;
function isTreat(f){ if(f.treat!=null) return !!f.treat; const d=dishById(f.dish); if(!d) return false; if(d.chain) return (d.macros&&d.macros.k>=150); return d.cat==='Treats' || d.dot==='r'; }
function treatsIn(keys){ const out=[]; for(const k of keys){ const d=peekDay(k); if(!d) continue; for(const f of (d.food||[])) if(isTreat(f)) out.push({k, f}); } return out; }
function treatCard(k=todayKey()){ const wk=weekKeys(k), ts=treatsIn(wk), B=TREAT_BUDGET(), left=B-ts.length;
  return `<div class="card"><h3>🍩 Occasional treats <span class="sub">${ts.length}/${B} this week</span></h3>
    <div class="wg-bar"><i class="${ts.length>B?'r':ts.length===B?'a':'g'}" style="width:${Math.min(100,ts.length/B*100)}%"></i></div>
    <div class="small" style="margin-top:6px">${left>0?`${left} treat${left>1?'s':''} left this week — inside the calorie bank, no guilt.`:left===0?'Budget used. Next treat → next week.':`${-left} over budget — balance with the calorie bank, no skipping meals.`}</div>
    ${ts.length?`<div class="small muted" style="margin-top:4px">${ts.map(x=>`${parseKey(x.k).toLocaleDateString('en-IN',{weekday:'short'})}: ${esc(x.f.name)}`).join(' · ')}</div>`:''}
    ${treatPatterns().map(p=>`<div class="tip" style="margin-top:8px">🔎 ${p}</div>`).join('')}</div>`; }
function treatPatterns(){ const keys=lastNDays(56), ts=treatsIn(keys), out=[];
  if(ts.length>=3){ const wd={}, sl={}; for(const x of ts){ const w=parseKey(x.k).getDay(); wd[w]=(wd[w]||0)+1; sl[x.f.slot]=(sl[x.f.slot]||0)+1; }
    const [bw,bn]=Object.entries(wd).sort((a,b)=>b[1]-a[1])[0]; if(bn>=3 && bn/ts.length>=.4) out.push(`${r0(bn/ts.length*100)}% of your treats are on <b>${['Sundays','Mondays','Tuesdays','Wednesdays','Thursdays','Fridays','Saturdays'][bw]}</b>. Plan that day’s treat on purpose.`);
    const [bs,bsn]=Object.entries(sl).sort((a,b)=>b[1]-a[1])[0]; if(bsn>=3 && bsn/ts.length>=.5) out.push(`Treats cluster at <b>${esc(slotName(bs).toLowerCase())}</b>. Keep a protein snack ready before then.`); }
  // skipped meal → bigger day?
  const full=[], skip=[]; for(const k of keys){ if(k===todayKey()) continue; const d=peekDay(k); if(!d||!anyFood(d)) continue; const s=new Set(d.food.map(f=>f.slot)); (s.has('breakfast')&&s.has('lunch')?full:skip).push(dayTotals(k).k); }
  if(full.length>=3 && skip.length>=3){ const a=full.reduce((x,y)=>x+y,0)/full.length, b=skip.reduce((x,y)=>x+y,0)/skip.length; if(b-a>200) out.push(`On days you skip breakfast or lunch you eat <b>~${r0(b-a)} kcal more</b> in total. Don’t skip — eat a small meal.`); }
  return out; }

/* ---------- eating-out pack ---------- */
const CHAIN_E = {"McDonald's":'🍔',"Domino's":'🍕','KFC':'🍗','Subway':'🥪','Burger King':'🍔','Pizza Hut':'🍕',"Haldiram's":'🥟','Starbucks':'☕','Cafe Coffee Day':'☕'};
if(typeof CHAIN_FOOD!=='undefined' && typeof DISHES!=='undefined' && !DISHES.some(d=>d.chain)){
  for(const c of CHAIN_FOOD) DISHES.push({id:c.id, en:`${c.en} · ${c.brand}`, hi:c.brand, e:CHAIN_E[c.brand]||'🍽️', cat:'Eating out', reg:'All', dot:c.macros.k>=400?'r':'y', unit:c.unit, macros:c.macros, chain:c.brand, src:c.src,
    tip:`${c.src==='official'?'From the brand’s published India nutrition chart':'Estimate — no official India chart found'} (checked ${typeof CHAIN_FOOD_CHECKED!=='undefined'?CHAIN_FOOD_CHECKED:''}). Counts as an occasional treat.`});
  if(typeof FOOD_CATS!=='undefined' && !FOOD_CATS.includes('Eating out')) FOOD_CATS.push('Eating out');
}
const OUT_F = {k:1.3, p:1, c:1.1, f:1.5};   // local restaurant = home recipe + more oil, bigger portion (estimate)
const logMult = L => L.out ? OUT_F : {k:1,p:1,c:1,f:1};

/* ---------- morning card ---------- */
const QUOTES = [
  ['Small steps, every day. The week is what counts.','Ojas'],
  ['You don’t need a perfect day. You need a good week.','Ojas'],
  ['You have a right to your actions, never to their fruits.','Bhagavad Gita 2.47'],
  ['The happiness of your life depends on the quality of your thoughts.','Marcus Aurelius'],
  ['We suffer more often in imagination than in reality.','Seneca'],
  ['Arise, awake, and stop not till the goal is reached.','Swami Vivekananda'],
  ['Health is the foundation of dharma, wealth, desire and liberation.','Charaka Samhita (paraphrased)'],
  ['Eat warm, eat on time, walk after. Simple wins.','Ojas'],
  ['Discipline is choosing what you want most over what you want now.','Ojas'],
  ['Waste no more time arguing what a good man should be. Be one.','Marcus Aurelius'],
  ['It is not that we have a short time to live, but that we waste a lot of it.','Seneca'],
  ['Yoga is the stilling of the movements of the mind.','Patanjali, Yoga Sutra 1.2'],
  ['Sleep is the first medicine. Lights out by 10:30.','Ojas'],
  ['A missed day is a comma, not a full stop.','Ojas'],
  ['Strength does not come from winning. It comes from showing up.','Ojas'],
  ['Better to do your own duty imperfectly than another’s perfectly.','Bhagavad Gita 3.35'],
  ['The impediment to action advances action. What stands in the way becomes the way.','Marcus Aurelius'],
  ['Luck is what happens when preparation meets opportunity.','Seneca (attributed)'],
  ['You are not behind. You are building.','Ojas'],
  ['Protein first, sugar last, water always.','Ojas'],
  ['Take up one idea. Make that one idea your life.','Swami Vivekananda'],
  ['He who has health has hope; and he who has hope has everything.','Proverb'],
  ['The body achieves what the mind believes — and the plan supports.','Ojas'],
  ['Two good weeks in a row beat one heroic day.','Ojas']];
function quoteOf(k){ const n=daysBetween('2026-01-01',k); return QUOTES[((n%QUOTES.length)+QUOTES.length)%QUOTES.length]; }
function morningInfo(k=todayKey()){ const w=(typeof WORKOUTS!=='undefined')?WORKOUTS[parseKey(k).getDay()]:null; const ev=S.goal&&S.goal.event;
  const left=ev&&ev.date?daysBetween(k,ev.date):null; const o=habLevel(habById('allmusts'));
  return {name:(S.profile&&S.profile.name)||'', date:parseKey(k).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'}), q:quoteOf(k), w:w?w.title:'', ev:ev&&left>=0?`${left} days to ${ev.name||'the function'}`:'', lv:`${o.L.e} ${o.L.n}`, slept:sleepHours((peekDay(k)||{}).sl)}; }
function drawMorningCanvas(){ const m=morningInfo(); const c=document.createElement('canvas'); c.width=1080; c.height=1920; const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,1080,1920); g.addColorStop(0,'#38bdf8'); g.addColorStop(.45,'#2563eb'); g.addColorStop(1,'#1e3a8a'); x.fillStyle=g; x.fillRect(0,0,1080,1920);
  x.fillStyle='rgba(255,255,255,.12)'; x.beginPath(); x.arc(900,260,300,0,7); x.fill(); x.beginPath(); x.arc(120,1700,360,0,7); x.fill();
  x.fillStyle='#fff'; x.textAlign='center'; x.font='600 54px system-ui,-apple-system,sans-serif'; x.fillText('☀️ Good morning'+(m.name?', '+m.name:''),540,330);
  x.font='400 40px system-ui,-apple-system,sans-serif'; x.fillText(m.date,540,400);
  const wrap=(t,y,size,lh,max=880)=>{ x.font=`700 ${size}px Georgia,serif`; const ws=t.split(' '); let line='', lines=[]; for(const w of ws){ const tt=line?line+' '+w:w; if(x.measureText(tt).width>max){ lines.push(line); line=w; } else line=tt; } lines.push(line); lines.forEach((l,i)=>x.fillText(l,540,y+i*lh)); return y+lines.length*lh; };
  let y=wrap('“'+m.q[0]+'”',760,68,92); x.font='italic 400 40px Georgia,serif'; x.fillText('— '+m.q[1],540,y+30);
  x.font='600 42px system-ui,-apple-system,sans-serif'; let yy=1380;
  if(m.w){ x.fillText('Today: '+m.w,540,yy); yy+=70; } if(m.ev){ x.fillText('🎉 '+m.ev,540,yy); yy+=70; }
  x.font='800 64px system-ui,-apple-system,sans-serif'; x.fillText('OJAS',540,1800); x.font='400 30px system-ui,-apple-system,sans-serif'; x.fillText('vital energy',540,1846);
  return c; }
function morningSheet(){ const m=morningInfo();
  openSheet(`<h2>☀️ Good morning${m.name?', '+esc(m.name):''}</h2><div class="hih">${esc(m.date)}</div>
    <div class="card mc-card"><div class="mc-q">“${esc(m.q[0])}”</div><div class="small muted">— ${esc(m.q[1])}</div></div>
    <div class="card"><div class="kv">${m.w?`<span>Today’s workout</span><span>${esc(m.w)}</span>`:''}${m.ev?`<span>Countdown</span><span>${esc(m.ev)}</span>`:''}<span>Habit level</span><span>${esc(m.lv)}</span><span>Sleep</span><span>${m.slept!=null?r1(m.slept)+' h ✓':'<a href="#" data-act="chat">log it in chat</a>'}</span></div></div>
    <div class="row"><button class="btn pri grow" data-act="mcShare">📤 Share to WhatsApp Status</button><button class="btn sec grow" data-act="chat">💬 Start my day</button></div>
    <div class="small muted" style="margin-top:8px">The shared picture shows only the quote, date, today’s workout and the countdown — never your weight, blood results or anything private.</div>`); }
async function mcShare(){ try{ const c=drawMorningCanvas(); const blob=await new Promise(r=>c.toBlob(r,'image/png')); const file=new File([blob],`ojas-morning-${todayKey()}.png`,{type:'image/png'});
    if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file], title:'Good morning'}); return; }
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=file.name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},800); toast('Picture saved — post it from Photos'); }catch(e){ if(e&&e.name!=='AbortError') toast('Could not share the picture'); } }
function maybeMorning(){ if(S.settings.morningCard===false || !S.settings.onboarded) return; const h=H(); if(h<6 || h>=11 || inQuiet()) return; S.ui ||= {}; if(S.ui.mcShown===todayKey()) return;
  S.ui.mcShown=todayKey(); save(true); setTimeout(()=>{ if(!sheetEl) morningSheet(); },700); }
function morningShortcutSheet(){ openSheet(`<h2>⏰ 7 am morning nudge</h2><div class="hih">Set once in the free iPhone Shortcuts app (about 1 minute)</div>
  <div class="card"><ol class="steps"><li>Open <b>Shortcuts</b> → <b>Automation</b> → <b>+</b>.</li><li><b>Time of Day</b> → <b>7:00 am</b> → <b>Daily</b> → <b>Run Immediately</b> → Next.</li>
  <li><b>New Blank Automation</b> → Add Action → <b>Show Notification</b> → type “☀️ Good morning — open Ojas”.</li><li>Done. Tap the notification, then tap the Ojas icon: the morning card opens by itself (once a day, 6–11 am).</li>
  <li>On the card tap <b>📤 Share</b> → <b>WhatsApp</b> → <b>My Status</b>. Two taps.</li></ol></div>
  <div class="tip">Why not open Ojas straight from the Shortcut? On iPhone a Shortcut opens links in Safari, and Safari has a separate (empty) copy of the app. The home-screen icon is where your data lives.</div>`); }

/* ---------- nudge schedule (anchored, outside quiet hours) ---------- */
const NUDGES = () => (typeof REMINDERS!=='undefined'?REMINDERS:[]).filter(r=>!inQuiet(r[0]));

/* ---------- mindset ---------- */
function mindCard(d){ const m=d.mind||{}, h=H(); const night=h>=19;
  return `<div class="card"><h3>${night?'📓 3-line night journal':'🌅 Today’s intention'}</h3>
    ${night?`${[['j1','✅ What went well'],['j2','💡 What I learned'],['j3','➡️ One thing for tomorrow']].map(([k,l])=>`<label class="f">${l}</label><input class="inp" data-mind="${k}" value="${esc(m[k]||'')}" maxlength="140">`).join('')}`
      :`<input class="inp" data-mind="int" value="${esc(m.int||'')}" placeholder="e.g. Protein at every meal, calm voice in meetings" maxlength="140">`}
    ${!night&&m.int?'':night&&m.int?`<div class="small muted" style="margin-top:6px">This morning: “${esc(m.int)}”</div>`:''}</div>`; }

/* ---------- voice & speaking module ---------- */
const VOICE_STEPS = [
  {t:'Posture', s:60, e:'🧍', say:'Stand tall. Feet hip width. Shoulders down and back, chin level. Relax the jaw.'},
  {t:'Belly breathing', s:120, e:'🌬️', say:'Hand on your belly. Breathe in through the nose for four, the belly moves out, the shoulders stay still. Breathe out slowly for six.'},
  {t:'Humming', s:60, e:'🎵', say:'Lips closed, teeth apart. Hum gently, mmm, feel the buzz on your lips and nose.'},
  {t:'Lip trills', s:60, e:'💨', say:'Blow air through loose lips, brrr, like a motorbike. Keep it easy and long.'},
  {t:'Straw phonation', s:90, e:'🥤', say:'Hum through a straw for a few seconds at a time. Slide your voice up and down gently. No pushing.'},
  {t:'Pitch glides', s:60, e:'〰️', say:'Say ooo and slide from low to high and back, like a siren. Small and smooth.'},
  {t:'Tongue twisters', s:90, e:'👅', say:'Slowly and clearly: red lorry, yellow lorry. She sells sea shells. Kacha papad, pakka papad. Then a little faster.'},
  {t:'Read aloud (timed)', s:60, e:'📖', say:'Read the passage on screen at a calm pace. Pause at every comma. Breathe low at every full stop.', read:true}];
const READ_TEXT = 'Every morning I choose one small thing that moves me forward. I drink warm water, I stretch, and I plan my meals. At work I speak slowly, I pause after each idea, and I breathe from my belly, not my shoulders. When the day gets busy, I do the short version instead of nothing. Week by week, these small choices add up. My energy is better, my sleep is deeper, and my voice is calm and clear. I do not need a perfect day. I need a good week, and then another one. That is how I build the body and the life that I want, one step at a time, with patience and with a smile.';
const READ_WORDS = READ_TEXT.split(/\s+/).length;
let VX=null;
function voiceCard(){ const L=habLevel(habById('voice')); const lg=(S.voiceLog||[]).slice(-1)[0];
  return `<div class="card"><h3>🎙️ Voice & speaking <span class="sub"><span class="lvl lv-${L.L.c}">${L.L.e} ${L.L.n}</span></span></h3>
    <div class="small muted">10 min a day: posture → belly breathing → humming → lip trills → straw → pitch glides → tongue twisters → timed read-aloud. Plus one 2-min talk a week.</div>
    ${lg?`<div class="small" style="margin-top:6px">Last: ${fmtD(lg.date)} · ${lg.wpm?`<b>${lg.wpm}</b> words/min`:''}${lg.fill!=null?` · ${lg.fill} fillers`:''}</div>`:''}
    <div class="row" style="margin-top:10px"><button class="btn pri grow" data-act="vxStart">▶ 10-min routine</button><button class="btn sec grow" data-act="talkOpen">🎤 Weekly 2-min talk</button></div>
    <div class="tip" style="margin-top:8px">Breathless while speaking? Plan a pause every 8–12 words and breathe low. And ask your doctor about it (ECG, lung test, sleep study) — exercises come second.</div></div>`; }
function vxDraw(){ const st=VOICE_STEPS[VX.i]; const done=VX.i>=VOICE_STEPS.length;
  if(done){ openSheet(`<h2>🎙️ Routine done ✓</h2>${VX.wpm?`<div class="card"><b>${VX.wpm}</b> words per minute on the read-aloud.<div class="small muted">Calm, clear speaking is about 130–150. Above 170 = slow down and pause more.</div></div>`:''}<button class="btn pri full" data-act="closeSheet">Close</button>`); return; }
  openSheet(`<div class="small muted">Step ${VX.i+1} of ${VOICE_STEPS.length}</div><h2>${st.e} ${esc(st.t)}</h2><div class="card"><div class="small">${esc(st.say)}</div></div>
    ${st.read?`<div class="card read-box">${esc(READ_TEXT)}</div><div class="row"><button class="btn pri grow" data-act="vxRead">${VX.r0?'⏹ Finished reading':'▶ Start reading'}</button></div>`
      :`<div class="vx-timer" id="vxT">${mmss(VX.left)}</div><div class="row"><button class="btn sec grow" data-act="vxPause">${VX.pause?'▶ Resume':'⏸ Pause'}</button><button class="btn pri grow" data-act="vxNext">Next →</button></div>`}
    <button class="btn ghost full" data-act="vxStop">Stop</button>`); }
function vxGo(i){ clearInterval(VX.tm); VX.i=i; const st=VOICE_STEPS[i];
  if(!st){ const d=day(todayKey()); d.voice=true; S.voiceLog ||= []; if(VX.wpm) S.voiceLog.push({date:todayKey(), kind:'read', wpm:VX.wpm}); save(); stopVoice(); vxDraw(); return; }
  VX.left=st.s; VX.pause=false; VX.r0=0; vxDraw(); try{ speak(st.say,{lang:'en', g:'f', flush:true}); }catch(e){}
  if(!st.read) VX.tm=setInterval(()=>{ if(VX.pause) return; VX.left--; const el=$('#vxT'); if(el) el.textContent=mmss(Math.max(0,VX.left)); if(VX.left<=0){ clearInterval(VX.tm); vxGo(VX.i+1); } },1000); }
let TALK=null;
const TOPICS = ['What I do at work, explained to a 12-year-old','My plan for the next 3 months','A mistake that taught me something','Why health matters to me','My favourite place in India and why','How I would explain investing to a friend'];
function talkSheet(){ const t=TOPICS[(S.voiceLog||[]).filter(x=>x.kind==='talk').length % TOPICS.length];
  const hist=(S.voiceLog||[]).filter(x=>x.kind==='talk').slice(-6).reverse();
  openSheet(`<h2>🎤 Weekly 2-min talk</h2><div class="hih">Topic: ${esc(t)}</div>
    <div class="card"><div class="small">1) Record 2 minutes. 2) Play it back. 3) Count your fillers (um, uh, “matlab”, “basically”, “like”). 4) Note one thing to improve.</div>
    <div class="row" style="margin-top:10px"><button class="btn pri grow" data-act="talkRec" id="talkBtn">${TALK&&TALK.rec?'⏹ Stop':'● Record'}</button></div>
    <audio id="talkAudio" controls style="width:100%;margin-top:10px;${TALK&&TALK.url?'':'display:none'}" src="${TALK&&TALK.url||''}"></audio>
    <div class="small muted" id="talkTime">${TALK&&TALK.secs?`Recorded ${mmss(TALK.secs)}`:'The recording stays on this phone and is gone when you close this — save notes below.'}</div></div>
    <div class="row"><div class="grow"><label class="f">Fillers counted</label><input class="inp" id="talkFill" inputmode="numeric"></div><div class="grow"><label class="f">Pace</label><select class="inp" id="talkPace"><option value="ok">Calm</option><option value="fast">Too fast</option><option value="slow">Too slow</option></select></div></div>
    <label class="f">One thing to improve</label><input class="inp" id="talkNote" maxlength="140">
    <button class="btn pri full" style="margin-top:10px" data-act="talkSave" data-topic="${esc(t)}">Save notes</button>
    ${hist.length?`<div class="card" style="margin-top:12px"><h3>Past talks</h3><table class="tbl"><tr><th>Date</th><th>Fillers</th><th>Pace</th></tr>${hist.map(x=>`<tr><td>${fmtD(x.date)}</td><td>${x.fill??'—'}</td><td>${esc(x.pace||'')}</td></tr>`).join('')}</table></div>`:''}`); }
async function talkRec(){ if(TALK&&TALK.rec){ TALK.mr.stop(); return; }
  try{ const stream=await navigator.mediaDevices.getUserMedia({audio:true}); const mr=new MediaRecorder(stream); const ch=[]; const t0=Date.now();
    TALK={rec:true, mr, url:TALK&&TALK.url}; mr.ondataavailable=e=>ch.push(e.data);
    mr.onstop=()=>{ stream.getTracks().forEach(t=>t.stop()); if(TALK.url) URL.revokeObjectURL(TALK.url); TALK.url=URL.createObjectURL(new Blob(ch,{type:mr.mimeType||'audio/mp4'})); TALK.secs=Math.round((Date.now()-t0)/1000); TALK.rec=false; clearTimeout(TALK.tm); talkSheet(); };
    mr.start(); TALK.tm=setTimeout(()=>{ if(TALK.rec) mr.stop(); },120000); const b=$('#talkBtn'); if(b) b.textContent='⏹ Stop (auto-stops at 2:00)'; }
  catch(e){ toast('Microphone not available — allow it in Settings → Safari / Ojas'); } }

/* ---------- skin & scalp (dermatologist's prescription) ---------- */
function skinCard(){ const ph=PHOTOS.filter(p=>p.pose==='face'||p.pose==='scalp'); const last=ph.length?ph[ph.length-1].date:null; const due=!last || daysBetween(last,todayKey())>=30;
  const rx=[...careList('am'),...careList('pm')].filter(c=>c.rx); const d=day(todayKey()); d.care ||= {};
  return `<div class="card"><h3>🧴 Skin & scalp <span class="sub">from your dermatologist’s prescription</span></h3>
    <div class="ticks">${rx.map(c=>`<button class="tick ${d.care[c.id]?'on':''}" data-act="careTick" data-k="${c.id}"><span class="bx">${d.care[c.id]?'✓':''}</span>${c.e} ${esc(c.t)}</button>`).join('')}</div>
    <div class="small muted" style="margin-top:6px">Use exactly as the doctor wrote (amount, how often). New product? Patch-test on the jaw for 2 days first. Dark circles → sleep + sunscreen. Neck darkness fades with sugar and weight (tracked with HbA1c).</div>
    <div class="row" style="margin-top:10px"><label class="btn sec grow" style="cursor:pointer">📷 Face<input type="file" accept="image/*" capture="user" data-photo="face" hidden></label><label class="btn sec grow" style="cursor:pointer">📷 Scalp<input type="file" accept="image/*" capture="environment" data-photo="scalp" hidden></label></div>
    <div class="small ${due?'':'muted'}" style="margin-top:6px">${last?`Last skin photo ${fmtD(last)}.`:'No skin photo yet.'} ${due?'<b>Monthly photo due</b> — same light, no filter.':''}</div>
    ${ph.length?`<div class="ph-strip" style="margin-top:8px"><div class="row" style="gap:4px">${ph.slice(-6).reverse().map(p=>`<img src="${p.data}" alt="" data-act="phView" data-id="${p.id}">`).join('')}</div></div>`:''}</div>`; }

/* ---------- private space (passcode + AES-GCM encryption, on this phone only) ---------- */
const b64 = u => btoa(String.fromCharCode(...u));
const unb64 = s => Uint8Array.from(atob(s), c=>c.charCodeAt(0));
const VAULT = {data:null, key:null, salt:null, fails:0, until:0, tm:null};
const VAULT_DEF = () => ({rk:[], log:[], semen:[], qs:['Is my sperm count/motility in range, and should I repeat the test after 3 months of weight loss?','Could my snoring or sleep affect testosterone? Do I need a sleep study?','Is it safe for me to try herbs like ashwagandha later, given my liver and thyroid?','Should my testosterone, prolactin and thyroid be checked together?'], notes:''});
async function vDerive(pin, salt){ const base=await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:250000, hash:'SHA-256'}, base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']); }
async function vSeal(){ if(!VAULT.key) return; const iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM', iv}, VAULT.key, new TextEncoder().encode(JSON.stringify(VAULT.data))));
  S.vault={v:1, salt:b64(VAULT.salt), iv:b64(iv), ct:b64(ct)}; save(true); }
async function vCreate(pin){ VAULT.salt=crypto.getRandomValues(new Uint8Array(16)); VAULT.key=await vDerive(pin, VAULT.salt); VAULT.data=VAULT_DEF(); await vSeal(); vTouch(); }
async function vUnlock(pin){ if(Date.now()<VAULT.until) return 'wait'; const v=S.vault; try{ const salt=unb64(v.salt), key=await vDerive(pin, salt);
    const pt=await crypto.subtle.decrypt({name:'AES-GCM', iv:unb64(v.iv)}, key, unb64(v.ct)); VAULT.data={...VAULT_DEF(), ...JSON.parse(new TextDecoder().decode(pt))}; VAULT.key=key; VAULT.salt=salt; VAULT.fails=0; vTouch(); return 'ok'; }
  catch(e){ VAULT.fails++; if(VAULT.fails>=5){ VAULT.until=Date.now()+60000; VAULT.fails=0; } return 'bad'; } }
function vLock(){ VAULT.data=null; VAULT.key=null; clearTimeout(VAULT.tm); if(sheetEl && $('#vaultRoot')) closeSheet(); }
function vTouch(){ clearTimeout(VAULT.tm); VAULT.tm=setTimeout(vLock, 3*60*1000); }
document.addEventListener('visibilitychange',()=>{ if(document.hidden && VAULT.key) vLock(); });
function privateCard(){ return `<div class="card"><h3>🔒 Private space</h3><div class="small muted" style="margin-bottom:10px">Passcode-locked and encrypted on this phone. Never shown in chat, reminders, badges, reports or shared pictures.</div>
  <button class="btn sec full" data-act="vaultOpen">${S.vault?'Open (passcode)':'Set up a passcode'}</button></div>`; }
function vaultGate(msg){ const first=!S.vault;
  openSheet(`<div id="vaultRoot"></div><h2>🔒 Private space</h2><div class="hih">${first?'Choose a passcode — 6 digits or more':'Enter your passcode'}</div>
    <input class="inp" id="vPin" type="password" inputmode="numeric" autocomplete="off" maxlength="20" placeholder="••••••">
    ${first?'<input class="inp" id="vPin2" type="password" inputmode="numeric" autocomplete="off" maxlength="20" placeholder="Same passcode again" style="margin-top:8px">':''}
    ${msg?`<div class="small" style="color:var(--crit);margin-top:6px">${esc(msg)}</div>`:''}
    <button class="btn pri full" style="margin-top:10px" data-act="vaultGo">${first?'Create':'Unlock'}</button>
    <div class="small muted" style="margin-top:8px">${first?'There is no “forgot passcode”: the data is encrypted with it. Write it somewhere safe.':'Locks itself after 3 minutes or when you leave the app.'}</div>
    ${!first?'<button class="btn ghost full" data-act="vaultWipe" style="color:var(--crit)">Forgot it? Erase the private space</button>':''}`, b=>{ const i=$('#vPin',b); setTimeout(()=>i&&i.focus(),200); }); }
const SEMEN_REF = [['vol','Volume','mL',1.4],['conc','Concentration','million/mL',16],['total','Total count','million',39],['mot','Total motility','%',42],['prog','Progressive motility','%',30],['morph','Normal forms','%',4]];
function sleepLink(){ const L=VAULT.data.log; if(L.length<4) return 'Needs at least 4 dates to compare.';
  const after=[], other=[]; for(const k of lastNDays(90)){ const h=sleepHours((peekDay(addDays(k,1))||{}).sl); if(h==null) continue; (L.includes(k)?after:other).push(h); }
  if(after.length<3||other.length<3) return 'Not enough sleep logged on both kinds of nights yet.';
  const a=after.reduce((x,y)=>x+y,0)/after.length, o=other.reduce((x,y)=>x+y,0)/other.length;
  return `Sleep after those nights: <b>${r1(a)} h</b> vs other nights <b>${r1(o)} h</b>${a<o-0.3?' — late nights seem to cost you sleep. Earlier is better.':' — no real difference.'}`; }
function vaultSheet(){ vTouch(); const V=VAULT.data; const t=todayKey();
  const rkWeek=weekKeys(t).filter(k=>V.rk.includes(k)).length;
  openSheet(`<div id="vaultRoot"></div><h2>🔒 Private space</h2><div class="hih">Encrypted · locks after 3 min · <button class="mini" data-act="vaultLock">🔒 Lock now</button></div>
    <div class="card"><h3>🔥 Pelvic floor</h3><div class="small muted">Daily Kegels are counted on Today. Reverse Kegels (gently relax and drop the pelvic floor while breathing out, 10 reps) 2× a week balance the muscle.</div>
      <div class="row" style="margin-top:8px;justify-content:space-between"><span class="small">Reverse Kegels this week: <b>${rkWeek}/2</b></span><button class="mini ${V.rk.includes(t)?'on':''}" data-act="vRk">${V.rk.includes(t)?'✓ Done today':'+ Done today'}</button></div></div>
    <div class="card"><h3>📅 Private log <span class="sub">date only</span></h3><div class="row" style="justify-content:space-between"><span class="small">${V.log.filter(k=>k>=addDays(t,-29)).length} in the last 30 days</span><span><button class="mini" data-act="vLog" data-k="${t}">${V.log.includes(t)?'✓ today':'+ today'}</button> <button class="mini" data-act="vLog" data-k="${addDays(t,-1)}">${V.log.includes(addDays(t,-1))?'✓ yesterday':'+ yesterday'}</button></span></div>
      <div class="small" style="margin-top:6px">${sleepLink()}</div><div class="small muted" style="margin-top:4px">There is no “right” number. Before a semen test, keep 2–5 days’ gap (as the lab says).</div></div>
    <div class="card"><h3>🧪 Semen reports <span class="sub">your entries · WHO 2021 lower limits</span></h3>
      ${V.semen.length?`<table class="tbl"><tr><th>Date</th>${SEMEN_REF.map(r=>`<th>${r[1].split(' ')[0]}</th>`).join('')}</tr>${V.semen.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(s=>`<tr><td>${fmtD(s.date)}</td>${SEMEN_REF.map(([k,,,lo])=>`<td style="${s[k]!=null&&s[k]!==''&&+s[k]<lo?'color:var(--crit);font-weight:700':''}">${s[k]??'—'}</td>`).join('')}</tr>`).join('')}</table>`:'<div class="small muted">No reports added yet.</div>'}
      <div class="small muted" style="margin-top:4px">Lower limits: ${SEMEN_REF.map(r=>`${r[1].toLowerCase()} ${r[3]} ${r[2]}`).join(' · ')}. One report is not a verdict — results vary a lot between tests.</div>
      <button class="btn sec full" style="margin-top:8px" data-act="vSemenAdd">+ Add a report</button></div>
    <div class="card"><h3>🩺 Questions for the doctor</h3>${V.qs.map((q,i)=>`<div class="row" style="justify-content:space-between;gap:8px;padding:4px 0"><span class="small">• ${esc(q)}</span><button class="x" data-act="vQDel" data-i="${i}">×</button></div>`).join('')}
      <div class="row" style="margin-top:6px"><input class="inp grow" id="vQ" placeholder="Add a question" maxlength="200"><button class="btn sec" data-act="vQAdd">Add</button></div></div>
    <div class="card"><h3>📝 Notes</h3><textarea class="inp" id="vNotes" rows="4" maxlength="2000">${esc(V.notes)}</textarea><button class="btn sec full" style="margin-top:6px" data-act="vNotesSave">Save notes</button></div>
    <div class="card"><h3>🌱 Basics that help</h3><div class="small">Seed mix + amla + 7 h sleep + fat loss + no smoking/alcohol · loose cotton underwear · no laptop on the lap · no very hot baths or sauna · herbs only via a BAMS doctor after your liver result.</div></div>`); }
function semenSheet(){ vTouch(); openSheet(`<div id="vaultRoot"></div><h2>🧪 Add a semen report</h2><div class="hih">Type the numbers from your report</div>
  <label class="f">Date</label><input class="inp" type="date" id="sDate" value="${todayKey()}">
  ${SEMEN_REF.map(([k,l,u])=>`<label class="f">${l} (${u})</label><input class="inp" id="s_${k}" inputmode="decimal">`).join('')}
  <button class="btn pri full" style="margin-top:10px" data-act="vSemenSave">Save (encrypted)</button>`); }
async function vMut(fn){ if(!VAULT.key){ vaultGate(); return; } fn(VAULT.data); await vSeal(); vaultSheet(); }

/* ---------- styles for v1.7 ---------- */
(function(){ const st=document.createElement('style'); st.textContent=`
.hb-g{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;opacity:.6;margin:10px 0 4px}
.hb-row{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer}
.hb-l{display:flex;flex-direction:column;gap:2px;min-width:0}.hb-l small{font-size:12px;line-height:1.3}
.hb-r{display:flex;flex-direction:column;align-items:flex-end;gap:3px;text-align:right;flex-shrink:0}.hb-r small{font-size:11px}
.hb-strip{display:inline-flex;gap:3px}.hb-strip i{width:10px;height:10px;border-radius:3px;display:inline-block}
.lvl{font-size:12px;font-weight:800;padding:2px 8px;border-radius:999px;white-space:nowrap;background:var(--border)}
.lv-r{background:#ffe3e3;color:#c92a2a}.lv-a{background:#fff3bf;color:#8a6d00}.lv-lg{background:#d3f9d8;color:#2b8a3e}.lv-g{background:#b2f2bb;color:#1b6e2d}.lv-s{background:linear-gradient(90deg,#ffd43b,#ffa94d);color:#5c3b00}
.bd-r{color:#e03131;font-weight:700}.bd-a{color:#e8a200;font-weight:700}.bd-lg{color:#40c057;font-weight:700}.bd-g{color:#2f9e44;font-weight:700}.bd-s{color:#2b8a3e;font-weight:800}
.hb-al{padding:6px 0;border-bottom:1px solid var(--border)}
.rv-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)}.rv-row .mini{margin-left:6px;min-width:42px}
.mini.on{background:var(--accent,#12b886);color:#fff}.mini.on.no{background:#e03131}
.vx-timer{font-size:56px;font-weight:800;text-align:center;font-family:var(--font-d);margin:14px 0}
.read-box{font-size:17px;line-height:1.6}
.mc-card .mc-q{font-family:Georgia,serif;font-size:20px;font-weight:700;line-height:1.4;margin-bottom:6px}
`; document.head.appendChild(st); })();

/* ---------- actions ---------- */
Object.assign(A, {
  habOpen:el=>habSheet(el.dataset.id),
  habFix:el=>fixSheet(el.dataset.id),
  habFixPick:el=>{ const h=habById(el.dataset.id), f=FIX[el.dataset.r]; S.fix ||= {}; const tip=f.tip(h); S.fix[h.id]={r:el.dataset.r, tip, date:todayKey()}; save(true);
    openSheet(`<h2>🛠 ${esc(h.n)}</h2><div class="card"><b>Try this for 2 weeks:</b><div style="margin-top:6px">${esc(tip)}</div></div><div class="small muted">Saved. Two good weeks in a row and the level moves up again.</div><button class="btn pri full" data-act="closeSheet">OK</button>`); },
  review:el=>reviewSheet(el.dataset.k||reviewKey()),
  revSet:el=>{ setHab(el.dataset.k, el.dataset.id, +el.dataset.v); save(true); reviewSheet(el.dataset.k); },
  revRest:el=>{ const k=el.dataset.k, d=day(k); for(const h of reviewPending(k)) setHab(k,h.id,1); save(true); reviewSheet(k); },
  revDone:el=>{ const k=el.dataset.k; day(k).reviewed=true; save(); closeSheet(); render(); toast('Review saved ✓'); },
  morning:()=>morningSheet(),
  mcShare:()=>mcShare(),
  mcHelp:()=>morningShortcutSheet(),
  vxStart:()=>{ VX={i:0}; vxGo(0); },
  vxNext:()=>vxGo(VX.i+1),
  vxPause:()=>{ VX.pause=!VX.pause; const b=$('[data-act="vxPause"]'); if(b) b.textContent=VX.pause?'▶ Resume':'⏸ Pause'; },
  vxStop:()=>{ clearInterval(VX&&VX.tm); stopVoice(); closeSheet(); },
  vxRead:()=>{ if(!VX.r0){ VX.r0=Date.now(); vxDraw(); return; } const s=(Date.now()-VX.r0)/1000; VX.wpm=Math.round(READ_WORDS/(s/60)); vxGo(VX.i+1); },
  talkOpen:()=>talkSheet(),
  talkRec:()=>talkRec(),
  talkSave:el=>{ S.voiceLog ||= []; const f=$('#talkFill').value; S.voiceLog.push({date:todayKey(), kind:'talk', topic:el.dataset.topic, fill:f===''?null:+f, pace:$('#talkPace').value, note:$('#talkNote').value.trim(), secs:TALK&&TALK.secs||null}); day(todayKey()).voice=true; save(); toast('Talk notes saved ✓'); talkSheet(); },
  vaultOpen:()=>{ if(VAULT.key) vaultSheet(); else vaultGate(); },
  vaultGo:async()=>{ const p=$('#vPin').value.trim(); if(!S.vault){ const p2=$('#vPin2').value.trim(); if(p.length<6) return vaultGate('Use at least 6 digits.'); if(p!==p2) return vaultGate('The two passcodes don’t match.'); await vCreate(p); vaultSheet(); return; }
    const r=await vUnlock(p); if(r==='ok') vaultSheet(); else vaultGate(r==='wait'?'Too many tries — wait 1 minute.':'Wrong passcode.'); },
  vaultLock:()=>{ vLock(); toast('Locked 🔒'); },
  vaultWipe:()=>{ if(!confirmWipe){ confirmWipe=true; toast('Tap again to erase the private space'); setTimeout(()=>confirmWipe=false,4000); return; } delete S.vault; vLock(); save(true); toast('Private space erased'); confirmWipe=false; },
  vRk:()=>vMut(V=>{ const t=todayKey(); V.rk=V.rk.includes(t)?V.rk.filter(x=>x!==t):[...V.rk,t]; }),
  vLog:el=>vMut(V=>{ const k=el.dataset.k; V.log=V.log.includes(k)?V.log.filter(x=>x!==k):[...V.log,k]; }),
  vSemenAdd:()=>{ if(!VAULT.key) return vaultGate(); semenSheet(); },
  vSemenSave:()=>vMut(V=>{ const s={date:$('#sDate').value||todayKey()}; for(const [k] of SEMEN_REF){ const v=$('#s_'+k).value.trim(); s[k]=v===''?null:+v; } V.semen.push(s); }),
  vQAdd:()=>{ const q=$('#vQ').value.trim(); if(q) vMut(V=>V.qs.push(q)); },
  vQDel:el=>vMut(V=>V.qs.splice(+el.dataset.i,1)),
  vNotesSave:()=>{ const n=$('#vNotes').value; vMut(V=>{ V.notes=n; }); toast('Saved (encrypted) ✓'); },
  logOut:()=>{ if(!logDraft) return; logDraft.out=!logDraft.out; drawLog(); },
  logTreat:()=>{ if(!logDraft) return; logDraft.treat = logDraft.treat==null ? !isTreat({dish:logDraft.dish}) : !logDraft.treat; drawLog(); },
  quietSet:el=>{ S.settings[el.dataset.k]=el.value; save(true); }
});
let confirmWipe=false;
document.addEventListener('change',ev=>{ const t=ev.target; if(t.dataset && t.dataset.setBool){ S.settings[t.dataset.setBool]=t.checked; save(true); toast('Saved ✓'); } });
document.addEventListener('input',ev=>{ const t=ev.target; if(t.dataset && t.dataset.mind){ const d=day(); d.mind ||= {}; d.mind[t.dataset.mind]=t.value.trim(); save(true); } });
document.addEventListener('change',ev=>{ const t=ev.target; if(t.dataset && t.dataset.quiet){ if(/^\d\d:\d\d$/.test(t.value)){ S.settings[t.dataset.quiet]=t.value; save(true); toast('Quiet hours saved ✓'); } } });
['pointerdown','keydown'].forEach(e=>document.addEventListener(e,()=>{ if(VAULT.key) vTouch(); },{passive:true}));

/* =====================================================================
   v1.9 — cloud backup & sync (Supabase). The phone stays the main copy
   (works offline); every change is copied online within seconds; on a
   new phone / laptop you log in and everything comes back.
   ===================================================================== */
const HAS_CLOUD = CLOUD_ON();
const SYK = 'ojas.sync';
let SY = (()=>{ try{ return JSON.parse(localStorage.getItem(SYK)||'null') || {}; }catch(e){ return {}; } })();
SY.h ||= {}; SY.ph ||= {};
const syKeep = () => { try{ localStorage.setItem(SYK, JSON.stringify(SY)); }catch(e){} };
const SYNC = {busy:false, t:null, err:'', last:SY.lastOk||0, srv:null, pend:0};
function hashStr(s){ let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return (h>>>0).toString(36)+'.'+s.length; }
const dayHash = d => hashStr(JSON.stringify(d||{}));
function stateOnly(){ const o={}; for(const k in S) if(k!=='days') o[k]=S[k]; return o; }
const stateHash = () => hashStr(JSON.stringify(stateOnly()));
function cloudReport(){ try{
  return {at:new Date().toISOString(), version:VERSION, streak:mustStreak(),
    habits:HABITS.map(h=>{ const L=habLevel(h), r7=habRate(h,7), r30=habRate(h,30); return {id:h.id, e:h.e, n:h.n, g:h.g, lv:L.lv, level:L.L.n, best:LEVELS[L.best].n, r7:r7.r, r30:r30.r, status:habStatus(h), weeks:L.hist.slice(-12).map(x=>({ws:x.ws, c:x.c, rate:x.rate}))}; }),
    weekly:myWeekly().map(g=>{ const s=wgStatus(g,todayKey()); return {e:g.e, n:g.name, done:s.done, tgt:s.tgt, unit:g.unit}; }),
    prog:Object.keys(S.prog||{}).map(id=>{ const e=exById(id); if(!e) return null; const t=progTarget(findPlanItem(id)||{id}); return {id, n:e.en, next:tgtText(t,e), week:progWeek()}; }).filter(Boolean),
    musts:myMusts().map(m=>MUSTS[m].n), treats:treatsIn(weekKeys(todayKey())).length, treatBudget:TREAT_BUDGET()};
  }catch(e){ return {at:new Date().toISOString(), error:String(e)}; } }
function changedDays(){ const out=[]; for(const k of Object.keys(S.days)){ const h=dayHash(S.days[k]); if(SY.h[k]!==h) out.push([k,h]); } return out; }
function syncSoon(ms=3000){ if(!HAS_CLOUD || !Cloud.user || SY.off) return; clearTimeout(SYNC.t); SYNC.t=setTimeout(()=>syncNow(), ms); }
function mergeDay(loc, rem){ // loc = the copy whose single values win; food / workouts from BOTH copies are kept, except ones deleted on either
  const m={...rem, ...loc}; const del=new Set([...(loc.del||[]),...(rem.del||[])]); m.del=[...del].slice(-300);
  const uni=(a,b,key)=>{ const seen=new Set(), out=[]; for(const x of [...(a||[]),...(b||[])]){ const k=key(x); if(seen.has(k) || (x&&x.id&&del.has(x.id))) continue; seen.add(k); out.push(x); } return out; };
  m.food=uni(loc.food,rem.food,x=>x.id||JSON.stringify(x)); m.ex=uni(loc.ex,rem.ex,x=>x.id||JSON.stringify(x));
  m.waterLog=uni(loc.waterLog,rem.waterLog,x=>x.t+'|'+x.ml+'|'+(x.n||'')); m.waterMl=Math.max(+loc.waterMl||0, +rem.waterMl||0);
  m.ticks={...(rem.ticks||{}), ...(loc.ticks||{})}; m.care={...(rem.care||{}), ...(loc.care||{})}; m.hab={...(rem.hab||{}), ...(loc.hab||{})};
  m.kegel=Math.max(+loc.kegel||0, +rem.kegel||0); m.chat=(loc.chat||[]).length>=(rem.chat||[]).length?loc.chat:rem.chat; return m; }
async function syncPull(){ let changed=0;
  // 1) settings, profile, goals, labs...
  const st=await Cloud.rest('ojas_state?select=state,updated_at,client_ms');
  if(st && st[0] && st[0].updated_at!==SY.stAt){ const rem=st[0].state||{};
    const localUnchanged = SY.sh && SY.sh===stateHash(); const firstHere = !SY.sh;
    const localEmpty = !S.profile && Object.keys(S.days).length===0;
    if(localUnchanged || (firstHere && localEmpty) || (firstHere && !S.profile && rem.profile)){
      const keepDays=S.days; const f=freshState(); const imp=rem._import; S={...f, ...rem, days:keepDays, settings:{...f.settings, ...(rem.settings||{})}, rungs:{...f.rungs, ...(rem.rungs||{})}}; delete S._import; ING=ingMap(); changed++;
      if(imp){ const r=importHealth(imp); S.settings.onboarded=true; SY.sh=null; setTimeout(()=>toast('🎉 Your profile, goals, plan and blood results are loaded'),600); } else SY.sh=stateHash(); }
    else if(rem._import && !S.profile){ const r=importHealth(rem._import); SY.sh=null; changed++; setTimeout(()=>toast('🎉 Your profile, goals, plan and blood results are loaded'),600); }
    SY.stAt=st[0].updated_at; }
  // 2) days changed online since the last pull
  const since=SY.pullAt ? `&updated_at=gt.${encodeURIComponent(SY.pullAt)}` : '';
  let from=0, rows=[]; for(;;){ const part=await Cloud.rest(`ojas_days?select=day,data,updated_at&order=updated_at.asc${since}`, {headers:{Range:`${from}-${from+499}`}}); rows=rows.concat(part||[]); if(!part || part.length<500) break; from+=500; }
  for(const r of rows){ const loc=S.days[r.day]; const remH=dayHash(r.data);
    if(!loc || !SY.h[r.day] && !(loc.food||[]).length && !(loc.ex||[]).length){ S.days[r.day]=r.data; SY.h[r.day]=remH; changed++; }
    else if(dayHash(loc)===remH){ SY.h[r.day]=remH; }
    else if(SY.h[r.day]===dayHash(loc)){ const mg=mergeDay(r.data, loc); S.days[r.day]=mg; SY.h[r.day]=dayHash(mg)===remH?remH:SY.h[r.day]; changed++; } // phone unchanged: take the online copy, keep any entry only we had
    else { S.days[r.day]=mergeDay(loc, r.data); changed++; }
    if(!SY.pullAt || r.updated_at>SY.pullAt) SY.pullAt=r.updated_at; }
  if(changed){ save(true); HCACHE.key=''; if(!sheetEl) render(); }
  return changed; }
async function syncPush(){ let ch=changedDays(); const uid=Cloud.user.uid; let n=0;
  if(ch.length && ch.length<=60){ // last-second check: did another device change these same days? merge first so nothing is lost
    const fresh=await Cloud.rest(`ojas_days?select=day,data,updated_at&day=in.(${ch.map(([k])=>k).join(',')})`);
    let merged=0; for(const r of (fresh||[])){ const loc=S.days[r.day], rh=dayHash(r.data); if(loc && SY.h[r.day] && rh!==SY.h[r.day] && rh!==dayHash(loc)){ S.days[r.day]=mergeDay(loc, r.data); merged++; } }
    if(merged){ _save0(true); ch=changedDays(); if(!sheetEl) render(); } }
  for(let i=0;i<ch.length;i+=60){ const part=ch.slice(i,i+60);
    await Cloud.rest('ojas_days?on_conflict=user_id,day', {method:'POST', headers:{Prefer:'resolution=merge-duplicates,return=minimal'}, body:JSON.stringify(part.map(([k])=>({user_id:uid, day:k, data:S.days[k], client_ms:Date.now()})))});
    for(const [k,h] of part) SY.h[k]=h; n+=part.length; syKeep(); }
  const sh=stateHash(); const repDue = !SY.repAt || Date.now()-SY.repAt>30*60*1000 || n>0;
  if(sh!==SY.sh || repDue){ await Cloud.rest('ojas_state?on_conflict=user_id', {method:'POST', headers:{Prefer:'resolution=merge-duplicates,return=minimal'}, body:JSON.stringify([{user_id:uid, state:stateOnly(), report:cloudReport(), client_ms:Date.now(), app_version:VERSION}])});
    SY.sh=sh; SY.repAt=Date.now(); SY.stAt=null; }
  return n; }
async function syncPhotos(){ if(SY.noPhotos) return 0; let n=0; const list=await Cloud.photoList(); const online=new Set((list||[]).map(o=>o.name.replace(/\.jpg$/,'')));
  const local=await PDB.all(); const have=new Set(local.map(p=>p.id));
  for(const p of local){ if(online.has(p.id)) continue; const blob=await (await fetch(p.data)).blob(); await Cloud.photoUp(p.id, blob); n++; }
  for(const id of online){ if(have.has(id)) continue; const blob=await Cloud.photoDown(id+'.jpg'); const data=await new Promise(r=>{ const fr=new FileReader(); fr.onload=()=>r(fr.result); fr.readAsDataURL(blob); }); await PDB.put({id, date:id.slice(0,10), pose:id.slice(11), data}); n++; }
  if(n) loadPhotos(); return n; }
async function syncNow(opts={}){ if(!HAS_CLOUD || !Cloud.user || SYNC.busy) return; if(!navigator.onLine){ SYNC.err='offline — will copy when internet is back'; drawCloudBadge(); return; }
  SYNC.busy=true; SYNC.err=''; drawCloudBadge();
  try{ await syncPull(); const n=await syncPush(); if(opts.photos!==false) await syncPhotos(); SY.lastOk=Date.now(); SYNC.last=SY.lastOk; syKeep(); if(opts.count) await cloudCount(); }
  catch(e){ SYNC.err = e.status===401 ? 'logged out — log in again in Me' : (e.message||'could not reach the server'); }
  finally{ SYNC.busy=false; syKeep(); drawCloudBadge(); if(tab==='me' && !sheetEl) render(); } }
async function cloudCount(){ try{ const [dn,st,ph]=await Promise.all([Cloud.count('ojas_days'), Cloud.count('ojas_state'), SY.noPhotos?Promise.resolve(null):Cloud.photoList().then(l=>(l||[]).length)]);
  const localPh=(await PDB.all()).length; SYNC.srv={dn, st, ph, at:Date.now(), ln:Object.keys(S.days).length, lph:localPh, pend:changedDays().length}; }catch(e){ SYNC.err=e.message; } }
const agoTxt = ms => { if(!ms) return 'never'; const s=Math.round((Date.now()-ms)/1000); return s<60?'just now':s<3600?`${Math.round(s/60)} min ago`:s<86400?`${Math.round(s/3600)} h ago`:`${Math.round(s/86400)} days ago`; };
function drawCloudBadge(){ const el=document.getElementById('cloudBadge'); if(!el) return; el.textContent = !HAS_CLOUD||!Cloud.user ? '' : SYNC.busy ? '☁️ …' : SYNC.err ? '☁️ ⚠️' : '☁️ ✓'; el.title = SYNC.err || ('Saved online '+agoTxt(SYNC.last)); }
function cloudCard(){ if(!HAS_CLOUD) return '';
  if(!Cloud.user) return `<div class="card setup-cta" data-act="cloudLogin"><div style="font-size:28px">☁️</div><div class="grow"><b>Save my data online</b><div class="small muted">Log in once with your email. Every log is copied to your private online database — safe if the phone is lost, and you get a laptop report page.</div></div><span>→</span></div>`;
  const v=SYNC.srv, pend=changedDays().length;
  return `<div class="card"><h3>☁️ Online backup <span class="sub">${esc(Cloud.user.email||'')}</span></h3>
    <div class="small">${SYNC.busy?'Copying now…':SYNC.err?`<b style="color:var(--crit)">⚠️ ${esc(SYNC.err)}</b>`:`✅ Last copied <b>${agoTxt(SYNC.last)}</b>`} · waiting to copy: <b>${pend}</b> day${pend===1?'':'s'}</div>
    ${v?`<table class="tbl" style="margin-top:8px"><tr><th></th><th>On this phone</th><th>Online (counted ${agoTxt(v.at)})</th></tr><tr><td>Days logged</td><td>${v.ln}</td><td>${v.dn}</td></tr><tr><td>Settings & health file</td><td>1</td><td>${v.st}</td></tr>${v.ph!=null?`<tr><td>Photos</td><td>${v.lph}</td><td>${v.ph}</td></tr>`:''}</table>
      <div class="small ${v.dn>=v.ln&&v.st>=1?'':'muted'}" style="margin-top:4px">${v.dn>=v.ln&&v.st>=1&&(v.ph==null||v.ph>=v.lph)?'✅ Everything on this phone is online.':'Some items not online yet — tap Copy now.'}</div>`:''}
    <div class="row" style="margin-top:10px"><button class="btn pri grow" data-act="cloudSync">🔄 Copy now & count</button><a class="btn sec grow" href="report.html" target="_blank" rel="noopener">📊 Report page</a></div>
    <label class="row small" style="margin-top:8px;gap:8px"><input type="checkbox" data-act="cloudPhotos" ${SY.noPhotos?'':'checked'}> Also back up body & skin photos (private folder)</label>
    <div class="small muted" style="margin-top:6px">Your private space is copied only as scrambled text (locked with your passcode) — nobody, including the server, can read it.</div>
    <button class="btn ghost full" data-act="cloudOut" style="margin-top:4px">Log out of online backup</button></div>`; }
function cloudLoginSheet(step, email, msg, ok){
  openSheet(`<div class="login-hero">☁️</div><h2 style="text-align:center">Log in to Ojas</h2><div class="hih" style="text-align:center">Your data is saved online — safe even if the phone is lost</div>
    <label class="f">Email</label><input class="inp" id="cEmail" type="email" inputmode="email" autocomplete="username" value="${esc(email||'')}" placeholder="you@gmail.com">
    <label class="f">Password</label><input class="inp" id="cPw" type="password" autocomplete="current-password" placeholder="8 or more characters">
    <button class="btn pri full" style="margin-top:12px" data-act="cloudGo">Continue</button>
    ${ok?`<div class="tip" style="margin-top:12px">${ok}</div>`:''}
    ${msg?`<div class="small" style="color:var(--crit);margin-top:10px">${esc(msg)}</div>`:''}
    <div class="small muted" style="margin-top:12px;text-align:center">First time? Just type your email and choose a password — the same button creates your account.</div>
    ${!S.settings.onboarded?'<button class="btn ghost full" style="margin-top:6px" data-act="noCloud">Use without an account →</button>':''}`, b=>{ const i=$(email?'#cPw':'#cEmail',b); setTimeout(()=>i&&i.focus(),250); }); }
async function cloudAfterLogin(){ closeSheet(); toast('Logged in ✓ Copying your data…'); await syncNow({count:true}); toast(SYNC.err?'⚠️ '+SYNC.err:'☁️ All copied online'); render(); }
Object.assign(A, {
  cloudLogin:()=>cloudLoginSheet('in', Cloud.user&&Cloud.user.email),
  cloudGo:async()=>{ const e=$('#cEmail').value.trim().toLowerCase(), p=$('#cPw').value;
    if(!/^\S+@\S+\.\S+$/.test(e)) return cloudLoginSheet('in', e, 'Please type your full email.'); if(p.length<8) return cloudLoginSheet('in', e, 'Password needs at least 8 characters.');
    try{ await Cloud.signIn(e,p); return cloudAfterLogin(); }
    catch(er){ if(/confirm/i.test(er.message)) return cloudLoginSheet('in', e, '', '📧 One last step: open the email from Supabase and tap <b>Confirm email address</b>. Then come back and tap Continue.');
      if(!/invalid/i.test(er.message)) return cloudLoginSheet('in', e, 'Could not reach the server — check internet and try again.'); }
    try{ const r=await Cloud.signUp(e,p); if(r==='in') return cloudAfterLogin();
      cloudLoginSheet('in', e, '', '📧 Account created. One-time step (protects your health data): open the email from Supabase, tap <b>Confirm email address</b>, then come back here and tap <b>Continue</b>.'); }
    catch(er){ cloudLoginSheet('in', e, /registered|exists/i.test(er.message)?'Wrong password for this email.':er.status===429?'Too many tries — wait a minute.':'Could not create the account: '+er.message); } },
  cloudSignUp:async()=>{ const e=$('#cEmail').value.trim().toLowerCase(), p=$('#cPw').value, p2=$('#cPw2').value;
    if(!/^\S+@\S+\.\S+$/.test(e)) return cloudLoginSheet('new', e, 'Please type a full email address.');
    if(p.length<8) return cloudLoginSheet('new', e, 'Use at least 8 characters.'); if(p!==p2) return cloudLoginSheet('new', e, 'The two passwords don’t match.');
    try{ const r=await Cloud.signUp(e,p); if(r==='in') return cloudAfterLogin();
      cloudLoginSheet('in', e, '', `📧 Almost done: open the email “Confirm your email address” from Supabase and tap <b>Confirm email address</b> (it may open Safari — that’s fine, just close it). Then come back here and log in with the same password.`); }
    catch(er){ cloudLoginSheet('new', e, /registered|exists/i.test(er.message)?'This email already has an account — tap “I have an account”.':er.status===429?'Too many tries — wait a minute.':'Could not create: '+er.message); } },
  cloudSignIn:async()=>{ const e=$('#cEmail').value.trim().toLowerCase(), p=$('#cPw').value;
    try{ await Cloud.signIn(e,p); await cloudAfterLogin(); }
    catch(er){ cloudLoginSheet('in', e, /confirm/i.test(er.message)?'Email not confirmed yet — open the Supabase email and tap “Confirm email address” first.':/invalid/i.test(er.message)?'Wrong email or password.':'Could not log in: '+er.message); } },
  cloudSync:async()=>{ await syncNow({count:true}); toast(SYNC.err?'⚠️ '+SYNC.err:'☁️ Copied & counted'); },
  cloudPhotos:el=>{ SY.noPhotos=!el.checked; syKeep(); if(!SY.noPhotos) syncSoon(500); },
  cloudOut:()=>{ Cloud.logout(); SY={h:{}, ph:{}}; syKeep(); SYNC.srv=null; render(); toast('Logged out. Data stays on this phone.'); }
});
// copy online a few seconds after any change, on opening, when coming back to the app, and every 5 minutes
const _save0 = save;
save = function(quiet){ _save0(quiet); syncSoon(); };
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) syncSoon(800); });
window.addEventListener('online',()=>syncSoon(800));
setInterval(()=>{ if(!document.hidden) syncSoon(100); }, 5*60*1000);
(function(){ const h1=document.querySelector('.brand h1'); if(h1 && !document.getElementById('cloudBadge')){ const b=document.createElement('span'); b.id='cloudBadge'; b.style.cssText='font-size:12px;font-weight:600;opacity:.8;margin-left:6px;vertical-align:middle'; h1.appendChild(b); } drawCloudBadge(); })();

/* =====================================================================
   v2.0 — exercise targets, actual sets logging, week-by-week progression
   Every exercise has a target (sets × reps, seconds, or kg). You log what
   you actually did (each set). If you hit every set, the target goes up a
   small step next time (max one step a week); if you fall short twice it
   eases back. Weeks 1–2 = learn the form (no increase); sprint week 8 = easy week.
   ===================================================================== */
const PK = { // how each exercise grows: kind + cap
  'bench-press':{k:'load',inc:2.5},'lat-pulldown':{k:'load',inc:2.5},'seated-row':{k:'load',inc:2.5},'shoulder-press':{k:'load',inc:2},'goblet-squat':{k:'load',inc:2},
  'rdl':{k:'load',inc:2.5},'hip-thrust':{k:'load',inc:5},'calf-raise':{k:'load',inc:2.5},'incline-press':{k:'load',inc:2},'db-row':{k:'load',inc:2},'leg-press':{k:'load',inc:5},
  'pushup':{k:'reps'},'inverted-row':{k:'reps'},'bw-squat':{k:'reps'},'step-up':{k:'reps'},'split-squat':{k:'reps'},'dead-bug':{k:'reps'},'knee-raise':{k:'reps'},
  'plank':{k:'hold',cap:90},'side-plank':{k:'hold',cap:60},'jumping-jacks':{k:'hold',cap:45},'farmer-carry':{k:'hold',cap:60},
  'virabhadrasana':{k:'hold',cap:60},'trikonasana':{k:'hold',cap:60},'setu-bandhasana':{k:'hold',cap:45},'bhujangasana':{k:'hold',cap:45},'malasana':{k:'hold',cap:120},'hip-flexor':{k:'hold',cap:60},
  'brisk-walk':{k:'cardio',cap:4500},'incline-walk':{k:'cardio',cap:1800},'cycling':{k:'cardio',cap:1800},
  'surya-namaskar':{k:'count',step:1,cap:24},'bhramari':{k:'count',step:1,cap:11},'kegel':{k:'count',step:1,cap:15},'kapalbhati':{k:'kapal'},
  'anulom-vilom':{k:'time1',step:60,cap:600},
  'marjaryasana':{k:'fixed'},'balasana':{k:'fixed'},'yoga-nidra':{k:'fixed'}
};
const kindOf = e => PK[e.id] || (e.cat==='Gym'&&e.type!=='time'?{k:'load',inc:2.5} : e.type==='time'?(e.cat==='Cardio'?{k:'cardio',cap:3600}:{k:'hold',cap:60}) : ['Calisthenics','Pelvic'].includes(e.cat)?{k:'reps'}:{k:'fixed'});
function progStart(){ const g=S.goal||{}; return (g.sprint&&(g.sprint.start||g.sprint.from)) || g.startDate || todayKey(); }
function progWeek(k=todayKey()){ return Math.max(1, Math.floor(daysBetween(progStart(), k)/7)+1); }
const easyWeek = (k=todayKey()) => !!(S.goal&&S.goal.sprint) && progWeek(k)===8;
const pst = id => { S.prog ||= {}; return S.prog[id] ||= {step:0, miss:0, upWk:null, kg:null, r:0}; };
function baseOf(it, e){ const d=parseDose(e); return {sets:it.sets||d.sets, reps:it.reps||d.reps, secs:it.secs||d.secs}; }
function progTarget(it, k=todayKey()){ const e=exById(it.id); if(!e) return null; const b=baseOf(it,e), K=kindOf(e), s=pst(e.id), n=s.step||0; let t={...b};
  if(K.k==='load'){ t.reps=b.reps+(s.r||0); t.kg=s.kg; }
  else if(K.k==='reps'){ t.sets=Math.min(5, b.sets+Math.floor(n/6)); t.reps=b.reps+(n%6); }
  else if(K.k==='hold'){ const cs=Math.max(0,Math.floor((K.cap-b.secs)/5)); if(n<=cs) t.secs=b.secs+5*n; else { t.secs=Math.max(b.secs,K.cap); t.sets=Math.min(b.sets+2, b.sets+(n-cs)); } }
  else if(K.k==='cardio'){ t.secs=Math.min(Math.max(b.secs,K.cap), b.secs+120*n); }
  else if(K.k==='count'){ t.reps=Math.min(Math.max(b.reps,K.cap), b.reps+K.step*n); }
  else if(K.k==='time1'){ t.secs=Math.min(Math.max(b.secs,K.cap), b.secs+K.step*n); }
  else if(K.k==='kapal'){ const strokes=Math.min(60, b.reps+10*n); t.reps=strokes; t.sets=Math.min(3, b.sets+Math.max(0, n-3)); }
  if(easyWeek(k) && t.sets>1) t.sets=t.sets-1;
  t.timed = e.type==='time'; t.kind=K.k; t.up = n>0 || (K.k==='load' && (s.r||0)>0); return t; }
function tgtText(t, e){ if(!t) return ''; const kg=t.kind==='load'?(t.kg?` @ ${t.kg} kg`:' @ your weight'):'';
  if(t.timed) return `${t.sets>1?t.sets+' × ':''}${fmtSecs(t.secs)}`;
  if(e && e.id==='kapalbhati') return `${t.sets} round${t.sets>1?'s':''} × ${t.reps} strokes (~${Math.round(t.reps*2/60*10)/10||1} min)`;
  if(e && e.id==='surya-namaskar') return `${t.reps} rounds`;
  if(e && e.id==='bhramari') return `${t.reps} rounds`;
  return `${t.sets} × ${t.reps}${/each/i.test(e&&e.dose||'')?' each side':''}${kg}`; }
function progAfter(id, entry, it){ const e=exById(id); if(!e || !entry.target || !entry.log) return ''; const K=kindOf(e); if(K.k==='fixed') return '';
  const t=entry.target, L=entry.log, s=pst(id), wk=weekStart(todayKey());
  if(entry.pain){ s.painN=(s.painN||0)+1; if(s.painN>=2){ if(K.k==='load'){ if((s.r||0)>0) s.r--; else if(s.kg) s.kg=Math.max(0,Math.round((s.kg-(K.inc||2.5))*10)/10); } else s.step=Math.max(0,(s.step||0)-1); s.painN=0; return '↘ Pain twice in a row — I eased the target one step. '+painAdvice(id); } return painAdvice(id); }
  s.painN=0;
  const per = x => t.timed ? (+x.s||0) : (+x.r||0), need = t.timed ? t.secs*0.95 : t.reps;
  if(K.k==='load'){ const kgs=L.map(x=>+x.kg||0).filter(Boolean); if(kgs.length) s.kg=Math.max(...kgs); }
  const hit = L.length>=t.sets && L.slice(0,t.sets).every(x=>per(x)>=need) && (K.k!=='load' || !t.kg || L.every(x=>(+x.kg||0)>=t.kg));
  const total=L.reduce((a,x)=>a+per(x),0), want=t.sets*(t.timed?t.secs:t.reps);
  let msg='';
  if(hit){ s.miss=0;
    if(progWeek()<3) msg='✓ Target hit. Weeks 1–2 are for learning the form — the target starts rising in week 3.';
    else if(easyWeek()) msg='✓ Easy week — the target stays the same.';
    else if(s.upWk===wk) msg='✓ Target hit. It already went up this week — next rise next week.';
    else { if(K.k==='load'){ if(!s.kg) msg='✓ Hit. Type the kg you used next time so I can raise it.'; else if((s.r||0)<2){ s.r=(s.r||0)+1; } else { s.r=0; s.kg=Math.round((s.kg+(K.inc||2.5))*10)/10; } }
      else s.step=(s.step||0)+1;
      s.upWk=wk; if(!msg){ const nt=progTarget(it||findPlanItem(id)||{id}); msg=`⬆ All sets hit — next time: ${tgtText(nt, e)}`; } } }
  else if(want && total < want*0.8){ s.miss=(s.miss||0)+1; if(s.miss>=2){ if(K.k==='load'){ if((s.r||0)>0) s.r--; else if(s.kg) s.kg=Math.max(0, Math.round((s.kg-(K.inc||2.5))*10)/10); } else s.step=Math.max(0,(s.step||0)-1); s.miss=0; msg='↘ Short twice in a row — I eased the target one step. No shame: two good weeks and it climbs again.'; } else msg='Below target this time. Same target next session.'; }
  else { s.miss=0; msg='Close — same target next time. Hit every set to move up.'; }
  return msg; }
/* history */
function exHistory(id){ const out=[]; for(const k of Object.keys(S.days).sort()){ for(const x of (S.days[k].ex||[])){ if(x.ex!==id) continue; out.push({k, x}); } } return out; }
function entryText(x, e){ if(x.log&&x.log.length){ const timed=x.target?x.target.timed:e&&e.type==='time';
    const vals=x.log.map(l=>timed?fmtSecs(+l.s||0):(+l.r||0)); const kg=x.log.some(l=>+l.kg)?` @ ${Math.max(...x.log.map(l=>+l.kg||0))} kg`:''; return `${x.log.length} set${x.log.length>1?'s':''}: ${vals.join(', ')}${kg}`; }
  return x.mins?`${x.mins} min`:`${x.sets} × ${x.reps}`; }
function bestOf(x, e){ if(x.log&&x.log.length){ const timed=x.target?x.target.timed:e&&e.type==='time'; return Math.max(...x.log.map(l=>timed?+l.s||0:+l.r||0)); } return x.mins? x.mins*60 : +x.reps||0; }
function volOf(x, e){ if(x.log&&x.log.length){ const timed=x.target?x.target.timed:e&&e.type==='time'; return x.log.reduce((a,l)=>a+(timed?+l.s||0:(+l.r||0)*((+l.kg)||1)),0); } return x.mins? x.mins*60 : (+x.sets||0)*(+x.reps||0); }
function exProgressHTML(id){ const e=exById(id); const H=exHistory(id); const nextIt=findPlanItem(id); const nt=progTarget(nextIt||{id});
  const K=kindOf(e), timed=e.type==='time';
  return `<div class="card"><h3>📈 My progress <span class="sub">week ${progWeek()} of the plan${easyWeek()?' · easy week':''}</span></h3>
    <div class="small">Next target: <b>${esc(tgtText(nt,e))}</b>${K.k==='fixed'?' (stays the same — it’s a recovery move)':''}</div>
    ${H.length?`<table class="tbl" style="margin-top:8px"><tr><th>Date</th><th>Target</th><th>Did</th></tr>${H.slice(-8).reverse().map(({k,x})=>`<tr><td>${fmtD(k)}</td><td>${x.target?esc(tgtText(x.target,e)):'—'}</td><td style="text-align:left">${esc(entryText(x,e))}</td></tr>`).join('')}</table>
      ${H.length>=2?`<div class="small muted" style="margin-top:6px">First: ${esc(entryText(H[0].x,e))} (${fmtD(H[0].k)}) → latest: ${esc(entryText(H[H.length-1].x,e))}. Best set ${timed?fmtSecs(bestOf(H[0].x,e))+' → '+fmtSecs(Math.max(...H.map(h=>bestOf(h.x,e)))):bestOf(H[0].x,e)+' → '+Math.max(...H.map(h=>bestOf(h.x,e)))}.</div>`:''}`
      :'<div class="small muted" style="margin-top:6px">No sessions logged yet. Do it once and log each set — the history starts here.</div>'}
    <div class="small muted" style="margin-top:6px">Rule: hit every set → small step up next time (max one step a week). Short twice → one step back. Weeks 1–2 = learn the form.</div></div>`; }
function findPlanItem(id){ if(typeof WORKOUTS==='undefined') return null; const wd=new Date().getDay(); const order=[wd,1,2,3,4,5,6,0,7]; for(const w of order){ const it=(WORKOUTS[w]||{items:[]}).items.find(x=>x.id===id); if(it) return it; } return null; }
function exProgressCard(){ const ids=new Set(); for(const k in S.days) for(const x of (S.days[k].ex||[])) if(x.log) ids.add(x.ex);
  const rows=[...ids].map(id=>{ const e=exById(id); if(!e) return null; const H=exHistory(id).filter(h=>h.x.log); if(!H.length) return null; const f=H[0], l=H[H.length-1]; const nt=progTarget(findPlanItem(id)||{id});
    const fb=bestOf(f.x,e), lb=bestOf(l.x,e), timed=e.type==='time'; const ch=lb-fb;
    return `<tr data-act="openEx" data-id="${esc(id)}" style="cursor:pointer"><td>${esc(e.en)}</td><td>${timed?fmtSecs(fb):fb}${f.x.log.some(x=>+x.kg)?' @'+Math.max(...f.x.log.map(x=>+x.kg||0)):''}</td><td>${timed?fmtSecs(lb):lb}${l.x.log.some(x=>+x.kg)?' @'+Math.max(...l.x.log.map(x=>+x.kg||0)):''}</td><td class="${ch>0?'up':''}">${ch>0?'▲ '+(timed?fmtSecs(ch):ch):ch<0?'▼':'='}</td><td>${esc(tgtText(nt,e))}</td></tr>`; }).filter(Boolean);
  return `<div class="card"><h3>🏋️ Exercise progress <span class="sub">best set · week ${progWeek()}${easyWeek()?' (easy week)':''}</span></h3>
    ${rows.length?`<table class="tbl"><tr><th>Exercise</th><th>First</th><th>Latest</th><th>Change</th><th>Next target</th></tr>${rows.join('')}</table><div class="small muted" style="margin-top:6px">Tap an exercise for its full history.</div>`
      :'<div class="small muted">Log your first workout with ✍️ “Log what I did” — every set’s reps (and kg in the gym). This table then shows first vs latest and the next target.</div>'}</div>`; }
/* ---------- the "log what I actually did" sheet ---------- */
let AX=null;
function actualsSheet(wd, fromSession){ const w=workoutFor(wd); if(!w) return; const d=day();
  AX={wd, title:w.title, items:w.items.filter(it=>exById(it.id)).map(it=>{ const e=exById(it.id), t=progTarget(it, cur), ex=(d.ex||[]).filter(x=>x.ex===it.id && (x.plan===wd || x.guided)).pop();
    const sets=[...Array(t.sets)].map((_,i)=>{ const l=ex&&ex.log&&ex.log[i]; return {v: l?(t.timed?+l.s:+l.r):(t.timed?t.secs:t.reps), kg: l&&l.kg!=null?l.kg:(t.kg||''), ok: !!(l || (ex && !ex.log && i<(ex.sets||1)))}; });
    if(ex&&ex.log&&ex.log.length>t.sets) for(let i=t.sets;i<ex.log.length;i++) sets.push({v:t.timed?+ex.log[i].s:+ex.log[i].r, kg:ex.log[i].kg||'', ok:true});
    return {id:it.id, it, t, sets, skip:false}; })};
  drawActuals(fromSession); }
function drawActuals(fromSession){ const X=AX;
  openSheet(`<h2>✍️ What I actually did</h2><div class="hih">${esc(X.title||'')} · week ${progWeek()}${easyWeek()?' (easy week)':''}</div>
    <div class="small muted" style="margin-bottom:8px">Each row is one set. Change the number to what you really did, tap ✓ for every set you finished. ${fromSession?'Sets you finished in the guided session are already ticked.':''}</div>
    ${X.items.map((x,i)=>{ const e=exById(x.id), t=x.t, unit=t.timed?'sec':(x.id==='kapalbhati'?'strokes':'reps');
      return `<div class="card ax-ex ${x.skip?'skip':''}"><div class="row" style="justify-content:space-between;gap:8px"><div><b>${esc(e.en)}</b><div class="small muted">Target: <b>${esc(tgtText(t,e))}</b>${t.up?' <span class="up">▲ raised</span>':''}</div></div>
        <button class="mini" data-act="axAll" data-i="${i}">✓ all</button></div>
        ${x.sets.map((s,j)=>`<div class="ax-row"><span class="small">Set ${j+1}</span><button class="mini" data-act="axStep" data-i="${i}" data-j="${j}" data-d="${-(t.timed?(t.secs>=120?60:5):1)}">−</button><input class="inp ax-in" inputmode="numeric" data-ax="${i}:${j}:v" value="${esc(s.v)}"><span class="small muted">${unit}</span><button class="mini" data-act="axStep" data-i="${i}" data-j="${j}" data-d="${t.timed?(t.secs>=120?60:5):1}">+</button>${t.kind==='load'?`<input class="inp ax-kg" inputmode="decimal" placeholder="kg" data-ax="${i}:${j}:kg" value="${esc(s.kg)}"><span class="small muted">kg</span>`:''}<button class="mini ax-ok ${s.ok?'on':''}" data-act="axOk" data-i="${i}" data-j="${j}">${s.ok?'✓':'○'}</button></div>`).join('')}
        <div class="row" style="gap:6px;margin-top:6px"><button class="mini" data-act="axAdd" data-i="${i}">+ set</button><button class="mini" data-act="axSkip" data-i="${i}">${x.skip?'Undo skip':'Skipped'}</button><button class="mini ax-pain ${x.pain?'on':''}" data-act="axPain" data-i="${i}">🤕 ${x.pain?'Pain noted':'Pain?'}</button></div></div>`; }).join('')}
    <button class="btn pri full" data-act="axSave">Save my sets</button>`, b=>{
      $$('[data-ax]',b).forEach(el=>el.addEventListener('input',()=>{ const [i,j,f]=el.dataset.ax.split(':'); const s=AX.items[+i].sets[+j]; s[f]=el.value.trim(); if(f==='v') s.ok=true; const okb=el.closest('.ax-row').querySelector('.ax-ok'); okb.classList.add('on'); okb.textContent='✓'; })); }); }
function saveActuals(){ const d=day(); const msgs=[]; let n=0;
  for(const x of AX.items){ if(x.skip) continue; const done=x.sets.filter(s=>s.ok && +s.v>0); if(!done.length) continue; const e=exById(x.id), t=x.t;
    const log=done.map(s=>t.timed?{s:+s.v}:{r:+s.v, ...(t.kind==='load'&&+s.kg?{kg:+s.kg}:{})});
    const total=log.reduce((a,l)=>a+(t.timed?l.s:l.r),0); const mins=t.timed?Math.round(total/60*10)/10:0; const reps=t.timed?0:Math.round(total/log.length);
    const entry={id:uid(), pain:!!x.pain, t:cur===todayKey()?nowHM():'07:00', ex:x.id, name:e.en, cat:e.cat, sets:t.timed?0:log.length, reps, mins, kcal:r0(exKcal(e, log.length, reps, mins)), plan:AX.wd, target:{sets:t.sets, reps:t.reps, secs:t.secs, kg:t.kg||null, timed:t.timed, kind:t.kind}, log};
    const i=(d.ex||[]).findIndex(z=>z.ex===x.id && (z.plan===AX.wd || z.guided)); if(i>=0){ entry.id=d.ex[i].id; d.ex[i]=entry; } else d.ex.push(entry);
    if(x.id==='kegel') d.kegel=Math.max(d.kegel||0, Math.min(3,log.length));
    if(e.cat==='Breath') d.ticks.breath=true; if(e.cat==='Meditation') d.ticks.med=true;
    const m=progAfter(x.id, entry, x.it); if(m) msgs.push(`<b>${esc(e.en)}</b>: ${esc(m)}`); n++; }
  save(); closeSheet(); render();
  if(n) openSheet(`<h2>✅ ${n} exercise${n>1?'s':''} saved</h2><div class="card small" style="line-height:1.6">${msgs.join('<br>')||'Saved.'}</div><button class="btn pri full" data-act="closeSheet">Done</button>`);
  else toast('Nothing ticked — tap ✓ for each set you did'); }
/* single exercise (library) log with sets */
function logOneSheet(id){ const e=exById(id); if(!e) return; const it=findPlanItem(id)||{id}; const t=progTarget(it, cur);
  AX={wd:'lib', title:e.en, items:[{id, it, t, sets:[...Array(t.sets)].map(()=>({v:t.timed?t.secs:t.reps, kg:t.kg||'', ok:false})), skip:false}]};
  drawActuals(false); }
(function(){ const st=document.createElement('style'); st.textContent=`
.ax-ex.skip{opacity:.45}.ax-row{display:flex;align-items:center;gap:5px;margin-top:6px}.ax-row>span{white-space:nowrap}.ax-in{width:58px;height:36px;padding:4px 6px;text-align:center;margin:0}.ax-kg{width:52px;height:36px;padding:4px 6px;text-align:center;margin:0}
.ax-ok.on{background:var(--accent,#12b886);color:#fff}.up{color:#2f9e44;font-weight:700}.wk-tg{display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid var(--border);font-size:13px}`; document.head.appendChild(st); })();
Object.assign(A, {
  axLog:el=>actualsSheet(+el.dataset.wd, false),
  axOne:el=>logOneSheet(el.dataset.id),
  axStep:el=>{ const s=AX.items[+el.dataset.i].sets[+el.dataset.j]; s.v=Math.max(0,(+s.v||0)+(+el.dataset.d)); s.ok=true; drawActuals(); },
  axOk:el=>{ const s=AX.items[+el.dataset.i].sets[+el.dataset.j]; s.ok=!s.ok; drawActuals(); },
  axAll:el=>{ AX.items[+el.dataset.i].sets.forEach(s=>s.ok=true); AX.items[+el.dataset.i].skip=false; drawActuals(); },
  axAdd:el=>{ const x=AX.items[+el.dataset.i]; const l=x.sets[x.sets.length-1]||{v:x.t.timed?x.t.secs:x.t.reps, kg:x.t.kg||''}; x.sets.push({v:l.v, kg:l.kg, ok:true}); drawActuals(); },
  axSkip:el=>{ const x=AX.items[+el.dataset.i]; x.skip=!x.skip; drawActuals(); },
  axSave:()=>saveActuals()
});
/* chat: "3 sets of 12 pushups", "pushups 3x12", "plank 45 sec", "kapalbhati 2 rounds" */
function exByWords(s){ const t=s.toLowerCase().replace(/push ?-?ups?/,'pushup').replace(/squats?/,'squat').replace(/planks?/,'plank');
  const map={goblet:'goblet-squat', 'leg press':'leg-press', bench:'bench-press', 'lat pull':'lat-pulldown', 'shoulder press':'shoulder-press', 'side plank':'side-plank', 'inverted row':'inverted-row', 'step up':'step-up', 'dead bug':'dead-bug', 'knee raise':'knee-raise', 'jumping jack':'jumping-jacks', pushup:'pushup', 'bodyweight squat':'bw-squat', squat:'bw-squat', plank:'plank', kapalbhati:'kapalbhati', surya:'surya-namaskar', anulom:'anulom-vilom', bhramari:'bhramari'};
  for(const [w,id] of Object.entries(map)) if(t.includes(w)) return exById(id); return null; }
function chatSets(low){ let m, e, log=null;
  if((m=/(\d+)\s*(?:sets?\s*(?:of|x|×)?|x|×)\s*(\d+)\s*(?:reps?)?\s*(?:of\s*)?([a-z][a-z \-]*)/.exec(low)) && (e=exByWords(m[3]))) log=[...Array(+m[1])].map(()=>e.type==='time'?{s:+m[2]}:{r:+m[2]});
  else if((m=/([a-z][a-z \-]*?)\s*(\d+)\s*(?:x|×|sets? of)\s*(\d+)/.exec(low)) && (e=exByWords(m[1]))) log=[...Array(+m[2])].map(()=>e.type==='time'?{s:+m[3]}:{r:+m[3]});
  else if((m=/([a-z][a-z \-]*?)\s*(\d+)\s*(s|sec|secs|seconds|min|mins|minutes)\b/.exec(low)) && (e=exByWords(m[1])) && e.type==='time') log=[{s:/^m/.test(m[3])?+m[2]*60:+m[2]}];
  else if((m=/([a-z][a-z \-]*?)\s*(\d+)\s*rounds?/.exec(low)) && (e=exByWords(m[1]))) log=e.id==='kapalbhati'?[...Array(+m[2])].map(()=>({r:30})):[{r:+m[2]}];
  if(!log || !e) return null; const d=day(); const it=findPlanItem(e.id)||{id:e.id}; const t=progTarget(it,cur);
  const total=log.reduce((a,l)=>a+(l.s||l.r||0),0), timed=e.type==='time'; const mins=timed?Math.round(total/60*10)/10:0, reps=timed?0:Math.round(total/log.length);
  const entry={id:uid(), t:nowHM(), ex:e.id, name:e.en+' (chat)', cat:e.cat, sets:timed?0:log.length, reps, mins, kcal:r0(exKcal(e,log.length,reps,mins)), target:{sets:t.sets,reps:t.reps,secs:t.secs,kg:t.kg||null,timed:t.timed,kind:t.kind}, log};
  d.ex.push(entry); if(e.cat==='Breath') d.ticks.breath=true; const msg=progAfter(e.id, entry, it);
  return `💪 ${e.en}: ${entryText(entry,e)} (target ${tgtText(t,e)})${msg?' — '+msg:''}`; }

/* =====================================================================
   v2.1 — simple bright Today view, one-button login, auto-loaded profile
   ===================================================================== */
function simpleToday(d){ const loggedIn = !CLOUD_ON() || Cloud.user;
  return `
  ${!loggedIn?`<div class="card big-cta" data-act="cloudLogin"><div class="bc-ic">☁️</div><div class="grow"><b>Save my data online</b><div class="small">1 minute · your profile, goals and reports load automatically</div></div><span>→</span></div>`:''}
  ${S.profile?'':setupPrompt()}
  ${reviewCard()}
  ${repeatCard()}
  ${chatCard()}
  <div class="quick-row">
    <button class="qbtn" data-act="quickAdd"><span>🍽️</span>Add food</button>
    <button class="qbtn" data-act="addWater" data-ml="250" data-n="Glass"><span>💧</span>+1 glass</button>
    <button class="qbtn" data-act="sxStart" data-wd="7"><span>⚡</span>15-min</button>
    <button class="qbtn" data-act="chat"><span>💬</span>Ask Riya</button>
  </div>
  ${mustsCard()}
  ${workoutCard(parseKey(cur).getDay(), true)}
  ${mealPlanCard(d)}
  <button class="btn sec full" style="margin:6px 0 10px" data-act="todayAll">▼ Show everything (habits, water, sleep, care, food log)</button>
  <p class="small muted" style="text-align:center">Coach, not doctor.</p>`; }
Object.assign(A, {
  noCloud:()=>{ closeSheet(); setTimeout(()=>wizard(0),350); },
  todayAll:()=>{ S.ui ||= {}; S.ui.todayAll=true; save(true); render(); },
  todaySimple:()=>{ S.ui ||= {}; S.ui.todayAll=false; save(true); render(); window.scrollTo({top:0}); }
});
(function(){ const st=document.createElement('style'); st.textContent=`
.big-cta{display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,#e0f2ff,#fff1e6);border:1px solid #cfe6fb;cursor:pointer}
.big-cta .bc-ic{font-size:30px}.big-cta b{font-family:var(--font-d);font-size:16px}
.quick-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 14px}
.qbtn{display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 4px;border-radius:16px;border:1px solid var(--border);background:var(--surface);box-shadow:var(--shadow);font-size:12px;font-weight:700;cursor:pointer}
.qbtn span{font-size:22px}
.login-hero{font-size:46px;text-align:center;margin:4px 0 2px}
.chat-opts.ideas{flex-wrap:wrap}.chat-opts.ideas .chip{font-size:12px;opacity:.9}`; document.head.appendChild(st); })();


/* =====================================================================
   v2.3 — faster logging (repeat & saved meals, "did it as planned"),
          pain flag, calmer calorie words, safer health wording,
          "where my data lives", leaner Progress, compact Today header
   ===================================================================== */
const MEAL_SLOTS = [['breakfast','Breakfast'],['lunch','Lunch'],['snack','Snack'],['dinner','Dinner']];
function lastMeal(slot, before=cur){ for(let i=1;i<=14;i++){ const k=addDays(before,-i), d=peekDay(k); const items=(d&&d.food||[]).filter(f=>f.slot===slot); if(items.length) return {k, items}; } return null; }
function mealText(items){ return items.map(f=>`${f.qty!==1?r1(f.qty)+'× ':''}${f.name}`).join(', '); }
function addItems(items, slot, label){ const d=day(); const t=cur===todayKey()?nowHM():{breakfast:'08:30',lunch:'13:00',snack:'16:30',dinner:'19:30'}[slot]||'13:00';
  const added=items.map(f=>({...f, id:uid(), t, slot})); d.food.push(...added); save(); render();
  const k=added.reduce((s,f)=>s+(+f.k||0),0), p=added.reduce((s,f)=>s+(+f.p||0),0);
  toast(`${label} ✓ ${r0(k)} kcal · ${r0(p)} g protein`); CH.last={undo:()=>{ const dd=day(); dd.del ||= []; added.forEach(f=>dd.del.push(f.id)); dd.food=dd.food.filter(f=>!added.includes(f)); }}; return added; }
function slotNow(){ const h=H(); return h<11?'breakfast':h<15.5?'lunch':h<18.5?'snack':'dinner'; }
function repeatCard(){ if(cur!==todayKey()) return ''; const slot=slotNow(), d=day(); if(d.food.some(f=>f.slot===slot)) return ''; const L=lastMeal(slot); const saved=(S.meals||[]).filter(m=>m.slot===slot).slice(0,2);
  if(!L && !saved.length) return '';
  return `<div class="card rep-card"><div class="small muted" style="font-weight:800">${esc(slotName(slot)).toUpperCase()} · ONE TAP</div>
    ${L?`<button class="rep-btn" data-act="repMeal" data-s="${slot}"><span>🔁</span><span class="grow"><b>Same as ${esc(niceDate(L.k).toLowerCase()==='yesterday'?'yesterday':fmtD(L.k))}</b><small>${esc(mealText(L.items)).slice(0,90)}</small></span></button>`:''}
    ${saved.map(m=>`<button class="rep-btn" data-act="savedMeal" data-id="${esc(m.id)}"><span>⭐</span><span class="grow"><b>${esc(m.name)}</b><small>${esc(mealText(m.items)).slice(0,90)}</small></span></button>`).join('')}</div>`; }
function mealsChips(){ const out=[]; for(const [s,n] of MEAL_SLOTS){ const L=lastMeal(s, addDays(todayKey(),1)===cur?todayKey():cur); if(L) out.push(`<button class="chip" data-act="repMeal" data-s="${s}">🔁 ${n} like ${niceDate(L.k).toLowerCase()==='yesterday'?'yesterday':fmtD(L.k)}</button>`); }
  for(const m of (S.meals||[]).slice(0,6)) out.push(`<button class="chip" data-act="savedMeal" data-id="${esc(m.id)}">⭐ ${esc(m.name)}</button>`);
  return out.length?`<div class="sec-title" style="margin-top:4px">One tap</div><div class="chips" style="flex-wrap:wrap">${out.join('')}</div>`:''; }
function saveMealSheet(slot){ const d=day(); const items=d.food.filter(f=>f.slot===slot); if(!items.length) return toast('Nothing logged for this meal yet');
  openSheet(`<h2>⭐ Save this ${esc(slotName(slot).toLowerCase())}</h2><div class="hih">${esc(mealText(items))}</div>
    <label class="f">Name</label><input class="inp" id="mealName" value="${esc(slotName(slot)+' — usual')}" maxlength="40">
    <button class="btn pri full" style="margin-top:10px" data-act="mealSave" data-s="${slot}">Save — log it later with one tap</button>`); }

/* workout: one tap for the whole plan, and a pain flag */
function buildAX(wd){ const w=workoutFor(wd); if(!w) return null; const d=day();
  return {wd, title:w.title, items:w.items.filter(it=>exById(it.id)).map(it=>{ const e=exById(it.id), t=progTarget(it, cur), ex=(d.ex||[]).filter(x=>x.ex===it.id && (x.plan===wd || x.guided)).pop();
    const sets=[...Array(t.sets)].map((_,i)=>{ const l=ex&&ex.log&&ex.log[i]; return {v: l?(t.timed?+l.s:+l.r):(t.timed?t.secs:t.reps), kg: l&&l.kg!=null?l.kg:(t.kg||''), ok: !!(l || (ex && !ex.log && i<(ex.sets||1)))}; });
    return {id:it.id, it, t, sets, skip:false, pain:!!(ex&&ex.pain)}; })}; }
const EASIER = {'pushup':'incline-pushup','incline-pushup':'wall-pushup','knee-pushup':'wall-pushup','plank':'knee-pushup','bw-squat':'glute-bridge','split-squat':'bw-squat','step-up':'bw-squat'};
function painAdvice(id){ const e=exById(EASIER[id]); return `Pain noted — the target will NOT go up. ${e?`Next time try the easier version: ${e.en}. `:'Next time do fewer reps or a lighter weight. '}Sharp pain, chest pain, dizziness or breathlessness → stop and see a doctor.`; }

/* where my data lives + delete online data */
function dataCard(){ const on=CLOUD_ON()&&Cloud.user;
  return `<div class="card"><h3>📍 Where my data lives</h3>
    <div class="dl-row"><b>📱 On this phone</b><span class="small muted">Always. Works without internet. Deleting the Ojas icon deletes this copy.</span></div>
    <div class="dl-row"><b>☁️ Online</b><span class="small muted">${on?`Yes — copied to your private database (${esc(Cloud.user.email)}). Only your login can open it.`:'No — you are not logged in. Log in above to keep a safe copy.'} ${on&&!SY.noPhotos?'Body & skin photos: included.':on?'Photos: not included.':''}</span></div>
    <div class="dl-row"><b>🔒 Private space</b><span class="small muted">Scrambled with your passcode before it is saved. Nobody else can read it — not even the server.</span></div>
    <div class="dl-row"><b>📤 Shared</b><span class="small muted">Only what you share yourself. The morning card shows a quote, today's workout and the countdown — never weight, reports or photos.</span></div>
    ${on?`<button class="btn ghost full" style="color:var(--crit);margin-top:6px" data-act="cloudWipe">${wipeArm?'Tap again: delete ALL my online data':'Delete my online data'}</button>`:''}</div>`; }
let wipeArm=false;
async function cloudWipe(){ const uid=Cloud.user.uid;
  await Cloud.rest(`ojas_days?user_id=eq.${uid}`, {method:'DELETE', headers:{Prefer:'return=minimal'}});
  await Cloud.rest(`ojas_state?user_id=eq.${uid}`, {method:'DELETE', headers:{Prefer:'return=minimal'}});
  try{ const l=await Cloud.photoList(); if(l&&l.length) await Cloud.photoDel(l.map(o=>o.name)); }catch(e){}
}

/* styles */
(function(){ const st=document.createElement('style'); st.textContent=`
.rep-card{padding:12px 14px}.rep-btn{display:flex;gap:10px;align-items:center;width:100%;text-align:left;border:1px solid var(--border);background:var(--surface-2);border-radius:14px;padding:10px 12px;margin-top:8px;cursor:pointer}
.rep-btn>span:first-child{font-size:22px}.rep-btn b{display:block}.rep-btn small{color:var(--muted)}
.hero-sm{padding:16px 18px}.hero-sm .hs-row{display:flex;gap:14px;position:relative;margin-top:10px}.hero-sm .hs{flex:1}.hero-sm .hs b{font-size:22px;font-family:var(--font-d)}.hero-sm .hs small{opacity:.9}
.hero-sm .bar{height:8px;border-radius:99px;background:rgba(255,255,255,.35);margin-top:6px;overflow:hidden}.hero-sm .bar i{display:block;height:100%;background:#fff;border-radius:99px}
.dl-row{display:flex;flex-direction:column;gap:2px;padding:8px 0;border-bottom:1px solid var(--border)}
.ax-pain.on{background:#e03131;color:#fff}`; document.head.appendChild(st); })();

/* compact header for the simple Today */
function heroSimple(){ const t=dayTotals(), st=S.settings; const h=new Date().getHours(); const greet = cur!==todayKey() ? niceDate(cur) : h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  const pk=Math.min(1,t.k/(st.kcal||1)), pp=Math.min(1,t.p/(st.protein||1));
  return `<section class="hero hero-sm"><button class="hero-av" data-act="tab" data-tab="me" aria-label="Avatar">${avatarHTML()}</button>
    <div class="greet">${greet}${S.profile&&S.profile.name?', '+esc(String(S.profile.name).split(' ')[0]):''}</div>
    <div class="hs-row"><div class="hs"><b>${r0(t.k).toLocaleString('en-IN')}</b><small> / ${(+st.kcal).toLocaleString('en-IN')} kcal</small><div class="bar"><i style="width:${r0(pk*100)}%"></i></div></div>
    <div class="hs"><b>${r0(t.p)}</b><small> / ${st.protein} g protein</small><div class="bar"><i style="width:${r0(pp*100)}%"></i></div></div></div></section>`; }

Object.assign(A, {
  repMeal:el=>{ const s=el.dataset.s; const L=lastMeal(s, addDays(cur,0)); if(!L) return toast('No earlier meal found'); closeSheet(); addItems(L.items, s, `${slotName(s)} repeated`); },
  savedMeal:el=>{ const m=(S.meals||[]).find(x=>x.id===el.dataset.id); if(!m) return; closeSheet(); addItems(m.items, m.slot, m.name); },
  mealSaveOpen:el=>saveMealSheet(el.dataset.s),
  mealSave:el=>{ const s=el.dataset.s, items=day().food.filter(f=>f.slot===s).map(({id,t,...f})=>f); S.meals ||= []; S.meals.unshift({id:uid(), name:($('#mealName').value||slotName(s)).trim(), slot:s, items}); S.meals=S.meals.slice(0,12); save(); closeSheet(); toast('⭐ Saved — it now shows as a one-tap button'); },
  planDone:el=>{ AX=buildAX(+el.dataset.wd); if(!AX) return; AX.items.forEach(x=>x.sets.forEach(s=>s.ok=true)); saveActuals(); },
  axPain:el=>{ const x=AX.items[+el.dataset.i]; x.pain=!x.pain; drawActuals(); },
  cloudWipe:async()=>{ if(!wipeArm){ wipeArm=true; render(); setTimeout(()=>{ wipeArm=false; if(tab==='me') render(); },5000); return; } wipeArm=false;
    try{ await cloudWipe(); Cloud.logout(); SY={h:{},ph:{}}; syKeep(); render(); toast('Online data deleted. This phone still has its copy.'); }catch(e){ toast('Could not delete: '+e.message); } }
});

/* =====================================================================
   v2.4 — Riya becomes an AI coach that can run the whole app from chat.
   1) a smarter rule engine handles everyday logging instantly (free, offline)
      and ASKS when a number is missing ("log my steps" → "How many steps?")
   2) anything else goes to the AI (OpenAI via the private Supabase function),
      which reads a short summary of today and presses the app's buttons
   ===================================================================== */
const aiOn = () => S.settings.ai!==false && CLOUD_ON() && !!Cloud.user && navigator.onLine;
function normChat(low){ let s=' '+low+' ';
  s=s.replace(/(\d+(?:\.\d+)?)\s?k\b/g,(m,n)=>String(Math.round(parseFloat(n)*1000)));            // 9k → 9000
  s=s.replace(/\b(\d{1,3}),(\d{3})\b/g,'$1$2');                                                     // 9,000 → 9000
  s=s.replace(/\bsteps?\s*(?:count|today|is|are|=|:|-)*\s*(\d{3,6})\b/g,'$1 steps');               // "steps 9000" → "9000 steps"
  s=s.replace(/\b(walked|walk(?:ed)? today|did)\s+(\d{3,6})\b(?!\s*(?:m\b|meter|metre|ml|kcal|cal))/g,'$2 steps');   // "walked 9000"
  s=s.replace(/\bi(?: am|'m| weigh| weighed)\s+(\d{2,3}(?:\.\d+)?)\s*(kg|kgs)?\b/g,'weight $1');   // "i am 97.2"
  s=s.replace(/\bmy weight (?:is|was)\s+(\d{2,3}(?:\.\d+)?)/g,'weight $1');
  s=s.replace(/\b(a|one|1)\s+bottle\s+(of\s+)?water\b/g,'1000 ml water').replace(/\b(\d)\s+bottles?\s+(of\s+)?water\b/g,(m,n)=>`${n*1000} ml water`);
  return s.trim(); }
function askFor(kind){ const Q={steps:'How many steps today? Type the number — like 8500 or 8.5k.', weight:'What is your weight this morning? Just the number, like 97.4', sleep:'What time did you sleep and wake up? Type like: 11 to 6', waist:'What is your waist in inches? Like 40.5'};
  CH.pending={id:kind, input:kind==='waist'?'waist':kind, q:Q[kind], from:0, to:24, done:()=>false}; botSay(Q[kind]); }
const ASK_RE = {steps:/^(?:(?:please\s+)?(?:log|add|update|enter|record|save|put|note)\s+(?:my\s+|today'?s?\s+)?steps?|steps?|my steps|log steps?)\s*(?:please|today|for today)?\s*$/,
  weight:/^(?:(?:log|add|update|enter|record|save)\s+(?:my\s+)?weight|weight|my weight)\s*(?:please|today)?\s*$/,
  sleep:/^(?:(?:log|add|update|enter|record|save)\s+(?:my\s+)?sleep|sleep|my sleep)\s*(?:please|today)?\s*$/,
  waist:/^(?:(?:log|add|update|enter|record|save)\s+(?:my\s+)?waist|waist)\s*$/};
const QUESTION_RE = /\?\s*$|^(what|why|how|should|shall|can|could|which|when|where|is|are|do|does|did|will|would|suggest|plan|recommend|kya|kaise|kitna|kitne|kab|batao|bataiye|tell me|help|explain|give me|make me|create|change|set my|increase|decrease|reduce|remind|motivate|i feel|i am feeling|i'm feeling|feeling)\b/;
function aiContext(){ const t=todayKey(), d=day(t), tt=dayTotals(t), st=S.settings, b=bank(t), g=S.goal||{}, p=S.profile||{};
  const L=[]; const now=new Date();
  L.push(`Now: ${now.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'short'})} ${nowHM()}. Quiet hours ${quietFrom()}-${quietTo()}.`);
  L.push(`Person: ${p.name||'user'}, ${p.age||''}y, ${p.heightCm||''} cm, vegetarian. Goal ${g.startWeight||''}→${g.weight||''} kg, waist ${g.startWaist||''}→${g.waist||''} in.${g.event?` Event "${g.event.name}" on ${g.event.date} target ${g.event.weight} kg.`:''} Plan week ${progWeek()}${easyWeek()?' (easy week)':''}.`);
  L.push(`Daily targets: ${st.kcal} kcal, protein ${st.protein} g, carbs ${st.carbs} g, fat ${st.fat} g, water ${r1((+st.waterMl||3000)/1000)} L, steps ${st.steps} (minimum ${stepsMin()}).`);
  L.push(`Today so far: ${r0(tt.k)} kcal, protein ${r0(tt.p)} g, carbs ${r0(tt.c)} g, fat ${r0(tt.f)} g, water ${r1(wml(d)/1000)} L, steps ${stepsOf(d.steps)||0}, sleep ${sleepHours(d.sl)!=null?r1(sleepHours(d.sl))+' h':'not logged'}, weight ${d.weight||'not logged'}.`);
  const bySlot={}; for(const f of d.food) (bySlot[f.slot] ||= []).push(`${f.qty!==1?r1(f.qty)+'x ':''}${f.name} (${r0(f.k)} kcal)`);
  L.push('Food today: '+(Object.keys(bySlot).length?Object.entries(bySlot).map(([s,a])=>`${s}: ${a.join(', ')}`).join(' | '):'nothing yet'));
  L.push('Daily musts: '+myMusts().map(m=>`${MUSTS[m].n.replace(/^\S+\s/,'')} ${MUSTS[m].ok(d,t)?'done':'pending'} (${MUSTS[m].v(d,t)})`).join('; '));
  const w=typeof WORKOUTS!=='undefined'?WORKOUTS[now.getDay()]:null; if(w) L.push(`Today's workout "${w.title}": `+w.items.filter(it=>exById(it.id)).map(it=>`${exById(it.id).en} ${tgtText(progTarget(it),exById(it.id))}`).join(', ')+`. Logged: ${(d.ex||[]).map(x=>x.name).join(', ')||'nothing yet'}.`);
  L.push(`Week: ${r0(Math.max(0,b.left))} kcal left in weekly plan, aim ~${b.aim} today. Treats ${treatsIn(weekKeys(t)).length}/${TREAT_BUDGET()}. Weekly goals: `+myWeekly().map(gg=>{ const s=wgStatus(gg,t); return `${gg.name} ${r0(s.done)}/${s.tgt}`; }).join('; '));
  const ws=lastNDays(14).map(k=>parseFloat((peekDay(k)||{}).weight)).filter(x=>x>30); if(ws.length) L.push(`Weight last 14 days: ${ws.join(', ')}.`);
  const al=habAlerts(); if(al.length) L.push('Habits needing attention: '+al.map(a=>`${a.h.n} (${a.why})`).join('; '));
  const pl=MEAL_PLANS[mealPlanIdx(t)]; if(pl) L.push(`Chosen meal plan "${pl.name}": `+pl.items.map(([s,id,q])=>{ const x=dishById(id); return x?`${s}: ${q!==1?q+'x ':''}${x.en}`:''; }).filter(Boolean).join('; '));
  if(S.settings.aiLabs!==false){ const keys=['hba1c','fbs','alt','ast','tg','ldl','hdl','uric','b12','vitd','tsh','egfr']; const lab=keys.map(k=>{ const s=labSeries(k); return s.length?`${k} ${s[s.length-1][1]} (${s[s.length-1][0]})`:''; }).filter(Boolean); if(lab.length) L.push('Latest blood results: '+lab.join(', ')+'. (Coach only — never diagnose.)'); }
  return L.join('\n'); }
function aiHistory(){ return chatLog().slice(-9,-1).filter(x=>x.t && !/^…/.test(x.t)).map(x=>({role:x.w==='b'?'assistant':'user', content:x.t})); }
const HABIT_MAP = {warm_water:['tick','warm'], no_sugar:['tick','nosugar'], dinner_by_8:['tick','dinner'], walk_after_meals:['tick','walk'], yoga:['tick','breath'], meditation:['tick','med'], sunlight:['tick','sun'], methi_water:['tick','methi'],
  brush_am:['care','teeth-am'], brush_pm:['care','teeth-pm'], tongue_scraper:['care','tongue'], face_wash_am:['care','face-am'], face_wash_pm:['care','face-pm'], sunscreen:['care','spf'], shower:['care','shower']};
function findExercise(name){ const n=String(name||'').toLowerCase(); const w=exByWords(n); if(w) return w; const all=allEx(); return all.find(e=>e.en.toLowerCase()===n) || all.find(e=>e.en.toLowerCase().includes(n)) || all.find(e=>n.includes(e.en.toLowerCase().split(' (')[0])) || null; }
function execAction(a, undoList){ const d=day(), A0=a.args||{}; const say=[];
  switch(a.name){
    case 'log_food': { for(const it of (A0.items||[])){ const q=+it.qty||1; const txt=`${q} ${it.unit||''} ${it.name}`.replace(/\s+/g,' ').trim(); let r=parseFoodPart(txt.toLowerCase()) || parseFoodPart(String(it.name).toLowerCase());
        const GEN=new Set(['veg','vegetable','mixed','mix','curry','sabzi','dish','with','plain','bowl','plate','katori','fresh','home','made','spicy','masala','fry','light']);
        const words=String(it.name).toLowerCase().split(/[^a-z]+/).filter(w=>w.length>=3&&!GEN.has(w));
        if(r && words.length){ const hay=(r.d.en+' '+(r.d.id||'')).toLowerCase(); if(!words.some(w=>hay.includes(w.replace(/s$/,'')))) r=null; }
        let e=null; if(r && !(it.kcal && r.how && /serving/.test(r.how) && false)){ e=logDishQ(r.d, r.q); }
        else if(it.kcal){ e={id:uid(), t:nowHM(), slot:slotFor(nowHM()), name:it.name, e:'🍽️', unit:`${q} ${it.unit||'serving'}`, qty:1, k:r1(+it.kcal), p:r1(+it.protein||0), c:r1(+it.carbs||0), f:r1(+it.fat||0), via:'ai', est:true}; d.food.push(e); }
        if(e){ if(A0.meal) e.slot=A0.meal; undoList.push(()=>{ const dd=day(); dd.del ||= []; dd.del.push(e.id); dd.food=dd.food.filter(f=>f!==e); }); say.push(`${e.e||'🍽️'} ${e.name}${e.est?' (estimate)':''} · ${r0(e.k)} kcal · ${r1(e.p)} g P`); }
        else say.push(`❓ couldn't find "${it.name}" — tell me roughly what it was`); } break; }
    case 'add_water': { const ml=Math.max(0,Math.min(5000,+A0.ml||0)); if(ml){ d.waterMl=wml(d)+ml; d.waterLog.push({ml,t:nowHM(),n:'chat'}); undoList.push(()=>{ const dd=day(); dd.waterMl=Math.max(0,wml(dd)-ml); }); say.push(`💧 +${fmtMl(ml)} (total ${fmtMl(wml(d))})`); } break; }
    case 'set_steps': { const n=Math.max(0,Math.round(+A0.steps||0)); const old=d.steps; d.steps=String(A0.mode==='add'?stepsOf(d.steps)+n:n); undoList.push(()=>{ day().steps=old; }); say.push(`👣 ${(+d.steps).toLocaleString('en-IN')} steps`); break; }
    case 'set_weight': { const kg=+A0.kg; if(kg>30&&kg<250){ const old=d.weight; d.weight=String(r1(kg)); undoList.push(()=>{ day().weight=old; }); say.push(`⚖️ ${d.weight} kg`); } break; }
    case 'set_waist': { const v=+A0.inches; if(v>20&&v<70){ const old=d.waist; d.waist=String(v); undoList.push(()=>{ day().waist=old; }); say.push(`📏 waist ${v}"`); } break; }
    case 'set_sleep': { if(/^\d{1,2}:\d\d$/.test(A0.bed||'')&&/^\d{1,2}:\d\d$/.test(A0.wake||'')){ const old=JSON.stringify(d.sl||{}); d.sl ||= {}; d.sl.bed=A0.bed.padStart(5,'0'); d.sl.wake=A0.wake.padStart(5,'0'); if(A0.snoring!=null) d.sl.snore=String(A0.snoring); const h=sleepHours(d.sl); if(h!=null) d.sleep=String(h); undoList.push(()=>{ day().sl=JSON.parse(old); }); say.push(`😴 ${d.sl.bed} → ${d.sl.wake} = ${r1(h)} h`); } break; }
    case 'log_exercise': { const e=findExercise(A0.exercise); if(!e){ say.push(`❓ couldn't find the exercise "${A0.exercise}"`); break; } const it=findPlanItem(e.id)||{id:e.id}; const t=progTarget(it,cur); const timed=e.type==='time';
      let log=(A0.sets||[]).map(s=>timed?{s:+s.seconds||(+s.reps||0)}:{r:+s.reps||0, ...(+s.kg?{kg:+s.kg}:{})}).filter(l=>(l.s||l.r)>0);
      if(!log.length && A0.minutes) log=[{s:Math.round(+A0.minutes*60)}];
      if(!log.length) log=[...Array(t.sets)].map(()=>timed?{s:t.secs}:{r:t.reps});
      const tot=log.reduce((x,l)=>x+(l.s||l.r||0),0), mins=timed?r1(tot/60):0, reps=timed?0:Math.round(tot/log.length);
      const en={id:uid(), pain:!!A0.pain, t:nowHM(), ex:e.id, name:e.en, cat:e.cat, sets:timed?0:log.length, reps, mins, kcal:r0(exKcal(e,log.length,reps,mins)), target:{sets:t.sets,reps:t.reps,secs:t.secs,kg:t.kg||null,timed:t.timed,kind:t.kind}, log, via:'ai'};
      d.ex.push(en); if(e.cat==='Breath'||e.cat==='Yoga') d.ticks.breath=true; const m=progAfter(e.id,en,it); undoList.push(()=>{ const dd=day(); dd.del ||= []; dd.del.push(en.id); dd.ex=dd.ex.filter(x=>x!==en); });
      say.push(`💪 ${e.en}: ${entryText(en,e)}${m?` — ${m}`:''}`); break; }
    case 'workout_done_as_planned': { const wd=new Date().getDay(); AX=buildAX(wd); if(AX){ AX.items.forEach(x=>x.sets.forEach(s=>s.ok=true)); const n0=d.ex.length; saveActuals(); closeSheet(); say.push(`🏋️ Whole workout logged as planned (${day().ex.length-n0||AX.items.length} exercises)`); } break; }
    case 'tick_habit': { const m=HABIT_MAP[A0.habit]; if(m){ if(m[0]==='tick') d.ticks[m[1]]=!!A0.done; else { d.care ||= {}; d.care[m[1]]=!!A0.done; } say.push(`${A0.done?'✅':'⬜'} ${String(A0.habit).replace(/_/g,' ')}`); } break; }
    case 'add_kegel': { const n=Math.max(1,Math.min(3,+A0.sets||1)); d.kegel=Math.min(3,(d.kegel||0)+n); say.push(`🔥 Kegels ${d.kegel}/3`); break; }
    case 'repeat_meal': { const L=lastMeal(A0.meal); if(L){ const added=addItems(L.items, A0.meal, `${slotName(A0.meal)} repeated`); undoList.push(()=>{ const dd=day(); dd.food=dd.food.filter(f=>!added.includes(f)); }); say.push(`🔁 ${slotName(A0.meal)} like ${niceDate(L.k).toLowerCase()}: ${mealText(L.items)}`); } else say.push('No earlier meal found to repeat.'); break; }
    case 'set_target': { const map={calories:'kcal', protein:'protein', water_litres:'waterMl', steps:'steps', steps_minimum:'stepsMin'}; const k=map[A0.target]; let v=+A0.value; if(!k||!(v>0)) break;
      if(k==='waterMl') v=Math.round(v*1000); if(k==='kcal' && v<((S.profile&&S.profile.sex==='f')?1200:1500)){ say.push(`⚠️ I won't set calories below ${(S.profile&&S.profile.sex==='f')?1200:1500} — too low to be safe.`); break; }
      CH.confirm={k, v, label:`${A0.target.replace(/_/g,' ')} → ${A0.target==='water_litres'?r1(v/1000)+' L':v}`}; say.push(`❔ Change ${CH.confirm.label}? Tap Yes to confirm.`); break; }
    case 'journal': { d.mind ||= {}; const k={intention:'int', went_well:'j1', learned:'j2', tomorrow:'j3'}[A0.kind]; if(k){ d.mind[k]=String(A0.text||'').slice(0,140); say.push(`📓 saved`); } break; }
    case 'open_screen': { const s=A0.screen; setTimeout(()=>{ closeSheet(); if(['today','food','train','progress','health','me'].includes(s)){ tab=s; render(); window.scrollTo({top:0}); } else if(s==='day_review') reviewSheet(reviewKey()); else if(s==='morning_card') morningSheet(); else if(s==='log_sets') actualsSheet(new Date().getDay(), false); }, 900); say.push(`📲 opening ${s.replace('_',' ')}…`); break; }
    case 'start_workout': { setTimeout(()=>{ closeSheet(); sessionStart(A0.which==='minimum_15'?7:new Date().getDay()); }, 900); say.push('▶ starting your workout…'); break; }
    case 'undo_last': { const L=CH.last; if(L){ L.undo(); CH.last=null; say.push('↩️ undone'); } else say.push('Nothing to undo.'); break; }
  }
  return say; }
let AI_BUSY=false;
async function aiAsk(text){ if(AI_BUSY) return; AI_BUSY=true; botSay('… Riya is thinking'); if(sheetEl) drawChat();
  let res=null, err='';
  try{ res=await Cloud.fn('ojas-ai', {message:text, context:aiContext(), history:aiHistory()}); }catch(e){ err=e.status===401?'Please log in again (Me → Online backup) to use the AI.':'I could not reach the AI just now — check internet. Simple logging still works.'; }
  const L=chatLog(); if(L.length && /^… Riya is thinking/.test(L[L.length-1].t)) L.pop();
  if(err){ botSay(err); AI_BUSY=false; save(); if(sheetEl) drawChat(); return; }
  const undoList=[]; const lines=[]; for(const a of (res.actions||[])){ try{ lines.push(...execAction(a, undoList)); }catch(e){ lines.push('⚠️ could not do: '+a.name); } }
  if(undoList.length) CH.last={undo:()=>undoList.reverse().forEach(f=>f())};
  save(); render();
  const reply=(res.reply||'').trim(); const body=[reply, lines.length?(reply?'\n':'')+lines.join('\n'):''].filter(Boolean).join('\n');
  const ests=day().food.filter(f=>f.est && f.via==='ai').slice(-2);
  const opts = CH.confirm ? [['✅ Yes','__cfm_yes'],['✖ No','__cfm_no']] : undoList.length ? [['↩ Undo','__say:undo'], ...ests.filter(f=>lines.some(l=>l.includes(f.name))).map(f=>['✏️ Edit '+f.name.slice(0,18),'__edit:'+f.id])] : null;
  botSay((lines.length&&!CH.confirm?'Saved:\n':'')+(body || 'Done ✓'), opts); if(opts && CH.confirm) CH.pending={id:'confirm', on:{}, done:()=>false};
  if(lines.length && !CH.confirm) chatLog()[chatLog().length-1].t += `\nToday: ${r0(dayTotals(cur).k)} kcal · ${r0(dayTotals(cur).p)} g protein.${lines.some(l=>/estimate/.test(l))?' "Estimate" = Riya guessed the numbers — tap Edit to fix.':''}`;
  AI_BUSY=false; save(); if(sheetEl) drawChat(); }
const CHAT_IDEAS = ['What should I eat now?','How is my week going?','Plan my dinner','Log 9k steps','Did my workout as planned','Why is my weight not dropping?'];

function applyConfirm(yes){ const c=CH.confirm; CH.confirm=null; CH.pending=null; if(!c) return; if(yes){ S.settings[c.k]=c.v; save(); render(); botSay(`✅ Changed ${c.label}.`); } else botSay('Okay, kept as it was.'); }
function handleText(raw){ const t=String(raw||'').trim(); if(!t) return; const low=t.toLowerCase(); const norm=normChat(low); const d=day();
  if(CH.confirm && /^(yes|y|ok|okay|haan|ha|confirm|sure|done)\b/.test(low)){ meSay(t); applyConfirm(true); save(); return; }
  if(CH.confirm && /^(no|n|nahi|cancel)\b/.test(low)){ meSay(t); applyConfirm(false); save(); return; }
  if(CH.pending && CH.pending.input==='waist'){ const m=/(\d{2}(?:\.\d+)?)/.exec(norm); if(m && +m[1]>20 && +m[1]<70){ meSay(t); d.waist=m[1]; CH.pending=null; save(); render(); botSay(`📏 Waist ${m[1]}" ✓`); askNext(); return; } }
  for(const k of Object.keys(ASK_RE)){ if(ASK_RE[k].test(norm.replace(/[.!]+$/,''))){ meSay(t); askFor(k); save(); return; } }
  let m=/\bslept\s*(?:for\s*)?(\d{1,2}(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/.exec(norm);
  if(m && !/\bto\b|-/.test(norm.replace(m[0],''))){ meSay(t); const h=+m[1]; const wakeH=H()<11&&cur===todayKey()?H():6.5; const bedH=(wakeH-h+24)%24; const f=x=>String(Math.floor(x)).padStart(2,'0')+':'+String(Math.round((x%1)*60)).padStart(2,'0');
    d.sl ||= {}; d.sl.bed=f(bedH); d.sl.wake=f(wakeH); d.sleep=String(h); d.chatDone ||= {}; d.chatDone.sleep=true; save(); render(); botSay(`😴 Sleep ${h} h ✓ (about ${d.sl.bed} → ${d.sl.wake}).`); askNext(); return; }
  if(QUESTION_RE.test(low) && !/^(status|summary)\b/.test(low) && aiOn()){ meSay(t); aiAsk(t); save(); return; }
  handleRules(norm, t); }

/* ---------- DEMO mode (?demo=1): sample person, sample data, nothing online, separate storage ---------- */
function demoSetup(){
  const bar=document.createElement('div'); bar.textContent='DEMO · sample data only (not a real person) · nothing is saved online'; bar.style.cssText='position:fixed;left:0;right:0;top:0;z-index:99;background:#1b1a22;color:#fff;font:600 11px system-ui;text-align:center;padding:4px 6px calc(4px + env(safe-area-inset-bottom))';
  document.body.appendChild(bar);
  if(S.demoSeeded) return;
  const t=todayKey(); const f=freshState(); S={...f, demoSeeded:true, lastVersion:VERSION};
  Object.assign(S.settings,{onboarded:true, theme:'dark', kcal:1800, protein:95, carbs:200, fat:55, steps:10000, stepsMin:8000, waterMl:3000, katoriMl:150, heightCm:172, kg:''});
  S.profile={name:'Arjun (demo)', age:34, sex:'m', heightCm:172, weight:92, waist:39, activity:'mod', diet:'veg', date:addDays(t,-24)};
  S.goal={weight:76, waist:33, pace:0.7, startWeight:92, startDate:addDays(t,-24), startWaist:39, event:{name:'Wedding', date:addDays(t,30), weight:86, waist:36}, sprint:{from:addDays(t,-24), to:addDays(t,32), weight:85, waist:35.5}};
  S.musts=['steps','water','protein','kcal','sleep','dinner','yoga','kegel'];
  S.labs={hba1c:[[addDays(t,-60),6.1],[addDays(t,-10),5.8]], alt:[[addDays(t,-60),64],[addDays(t,-10),52]], tg:[[addDays(t,-60),190],[addDays(t,-10),162]], vitd:[[addDays(t,-60),18],[addDays(t,-10),31]], b12:[[addDays(t,-10),210]], uric:[[addDays(t,-10),7.2]], tsh:[[addDays(t,-10),3.1]]};
  S.ui={mcShown:t, bright21:true, ocean25:true}; ING=ingMap();
  const R=(a,b)=>a+Math.random()*(b-a), pick=a=>a[Math.floor(Math.random()*a.length)];
  const plan=MEAL_PLANS[3]||MEAL_PLANS[0];
  for(let i=24;i>=1;i--){ const k=addDays(t,-i); const d=day(k); const good=Math.random()<0.78;
    for(const [slot,id,q] of plan.items){ if(!good && Math.random()<0.25) continue; const x=dishById(id); if(!x) continue; const m=dishMacros(x);
      d.food.push({id:uid(), t:{early:'06:40',breakfast:'08:40',mid:'11:00',lunch:'13:10',snack:'16:40',dinner:'19:40',late:'21:30'}[slot]||'13:00', slot, dish:id, name:x.en, e:x.e, unit:x.unit, qty:q, k:r1(m.k*q), p:r1(m.p*q), c:r1(m.c*q), f:r1(m.f*q)}); }
    if(!good && Math.random()<0.5){ const tr=dishById('samosa'); if(tr){ const m=dishMacros(tr); d.food.push({id:uid(), t:'17:30', slot:'snack', dish:'samosa', name:tr.en, e:tr.e, unit:tr.unit, qty:1, k:m.k, p:m.p, c:m.c, f:m.f}); } }
    d.waterMl=Math.round(R(good?2600:1500, good?3400:2600)/250)*250; d.steps=String(Math.round(R(good?8500:4000, good?12500:8000)));
    const bh=good?pick(['22:30','22:45','23:00']):pick(['23:30','00:15']); d.sl={bed:bh, wake:pick(['06:15','06:30','06:45']), snore:String(pick([0,1,1,2]))}; d.sleep=String(r1(sleepHours(d.sl)));
    d.weight=String(r1(92-(24-i)*0.11+R(-0.4,0.4))); if(i%14===0) d.waist=String(r1(39-(24-i)*0.04));
    d.ticks={warm:good, dinner:good, walk:Math.random()<0.7, nosugar:good, breath:Math.random()<0.75, methi:Math.random()<0.6};
    d.care={'teeth-am':true, 'teeth-pm':Math.random()<(i>12?0.5:0.9), tongue:Math.random()<0.7, 'face-am':Math.random()<0.85, spf:Math.random()<0.6, shower:true};
    d.kegel=good?3:Math.floor(R(0,3));
    const wd=parseKey(k).getDay(), w=WORKOUTS[wd]; if(w && (good||Math.random()<0.4)){ for(const it of w.items){ const e=exById(it.id); if(!e) continue; const tg=progTarget(it,k);
        const log=[...Array(tg.sets)].map(()=>tg.timed?{s:tg.secs}:{r:Math.max(1,tg.reps-(Math.random()<0.2?2:0)), ...(tg.kind==='load'?{kg:20+Math.floor((24-i)/7)*2.5}:{})});
        const tot=log.reduce((a,l)=>a+(l.s||l.r||0),0); const en={id:uid(), t:'07:00', ex:e.id, name:e.en, cat:e.cat, sets:tg.timed?0:log.length, reps:tg.timed?0:Math.round(tot/log.length), mins:tg.timed?r1(tot/60):0, kcal:r0(exKcal(e,log.length,tg.reps,tg.timed?tot/60:0)), plan:wd, target:{sets:tg.sets,reps:tg.reps,secs:tg.secs,kg:tg.kg||null,timed:tg.timed,kind:tg.kind}, log};
        d.ex.push(en); progAfter(e.id, en, it); } }
  }
  save(true); render();
}

/* ---------- safety copy on every version change (kept in the phone's bigger store, last 3 versions) ---------- */
(function(){ try{ if(DEMO) return; const prev=S.lastVersion; if(prev===VERSION) return; const snap=JSON.stringify(S);
  if(prev && Object.keys(S.days).length){ const r=indexedDB.open('ojas-safety',1); r.onupgradeneeded=()=>r.result.createObjectStore('s',{keyPath:'v'});
    r.onsuccess=()=>{ try{ const db=r.result, st=db.transaction('s','readwrite').objectStore('s'); st.put({v:prev, at:new Date().toISOString(), data:snap});
      const all=st.getAllKeys(); all.onsuccess=()=>{ const ks=all.result.sort(); ks.slice(0,-3).forEach(k=>st.delete(k)); }; }catch(e){} }; }
  S.lastVersion=VERSION; save(true); }catch(e){} })();
/* =====================================================================
   v2.5 — "Ocean Calm" look + one design system
   One set of rules for every screen: same spacing (4/8/12/16/24), same
   corners (cards 16, inner boxes 12, buttons 12, chips round), same title
   sizes, solid blue buttons, docked tab bar, chat button in the header,
   calmer Today (one "next thing" card, shorter workout list).
   ===================================================================== */
const ICON = {
  food:'<path d="M4 13h16a8 8 0 0 1-16 0z"/><path d="M8 9c0-2 2-2 2-4M12 9c0-2 2-2 2-4M16 9c0-2 2-2 2-4"/>',
  water:'<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>',
  bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
  chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z"/>',
  play:'<path d="M7 5v14l11-7z"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
  down:'<path d="M6 9l6 6 6-6"/>',
};
const ico = (n, sz=20) => `<svg class="ic" width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[n]||''}</svg>`;

/* Today: workout card with only the first 4 moves, the rest behind "Show all" */
function todayWorkout(wd){
  const w=workoutFor(wd); if(!w) return '';
  const items=w.items.filter(it=>exById(it.id)); const open=S.ui?.wkOpen;
  const rows=(open?items:items.slice(0,4)).map(it=>{ const e=exById(it.id), t=progTarget(it); return `<div class="wk-tg" data-act="openEx" data-id="${esc(e.id)}"><span>${esc(S.settings.hindi?e.en:e.en.replace(/\s*\([^)]*\)\s*$/,''))}</span><b>${esc(tgtText(t,e))}${t.up?' <span class="up">▲</span>':''}</b></div>`; }).join('');
  const more=items.length-4;
  return `<section class="card">
    <div class="ds-head"><div><div class="ds-eyebrow">Today's workout · Week ${progWeek()}${easyWeek()?' · easy week':''}</div><h3 class="ds-title">${esc(w.title)}</h3><div class="ds-sub">${items.length} exercises · about ${w.mins} min</div></div>
      <button class="btn pri sm" data-act="sxStart" data-wd="${wd}">${ico('play',16)}Start</button></div>
    <div class="ds-list">${rows}</div>
    ${more>0?`<button class="ds-more" data-act="wkMore">${open?'Show less':`Show all ${items.length}`}</button>`:''}
    <div class="ds-actions"><button class="btn pri" data-act="planDone" data-wd="${wd}">${ico('check',18)}Did it as planned</button><button class="btn sec" data-act="axLog" data-wd="${wd}">${ico('edit',18)}Change sets</button></div>
  </section>`;
}

/* Today (simple view): one clear order, max one "next thing" card */
simpleToday = function(d){ const loggedIn = !CLOUD_ON() || Cloud.user;
  const next = reviewCard() || repeatCard() || chatCard();
  return `
  ${!loggedIn?`<div class="card big-cta" data-act="cloudLogin"><div class="grow"><b>Save my data online</b><div class="small muted">1 minute · your profile, goals and reports load automatically</div></div><span class="ds-chev">›</span></div>`:''}
  ${S.profile?'':setupPrompt()}
  <div class="quick-row">
    <button class="qbtn" data-act="quickAdd">${ico('food',22)}<span>Add food</span></button>
    <button class="qbtn" data-act="addWater" data-ml="250" data-n="Glass">${ico('water',22)}<span>+1 glass</span></button>
    <button class="qbtn" data-act="sxStart" data-wd="7">${ico('bolt',22)}<span>15-min</span></button>
    <button class="qbtn" data-act="chat">${ico('chat',22)}<span>Ask Riya</span></button>
  </div>
  ${next?`<div class="ds-label">Next</div>${next}`:''}
  <div class="ds-label">Today</div>
  ${mustsCard()}
  ${todayWorkout(parseKey(cur).getDay())}
  ${mealPlanCard(d)}
  <button class="ds-link" data-act="todayAll">Show everything — habits, water, sleep, care, food log ${ico('down',16)}</button>
  <p class="ds-foot">Ojas is a coach, not a doctor.</p>`; };
Object.assign(A, { wkMore:()=>{ S.ui ||= {}; S.ui.wkOpen=!S.ui.wkOpen; save(true); render(); } });

/* tidy-up after every screen and sheet: titles without leading emoji, wide tables scroll inside their card */
const LEAD_EMO = /^[\s\p{Extended_Pictographic}‍️⃣\u{1F3FB}-\u{1F3FF}]+(?=\S)/u;
function dsTidy(root){ if(!root) return;
  root.querySelectorAll('.card h3, .sheet h2, .sec-title, .btn:not(.keep-emo), .chat-cta b, .card > .row > b, .ds-title, .must b, .mp-card > summary > b, .tick, .dl-row b, details > summary, .card > b').forEach(el=>{
    const n=[...el.childNodes].find(x=>x.nodeType===3 && x.textContent.trim()); if(!n) return;
    if(el.firstChild!==n && el.firstChild.nodeType!==3) return;            // starts with an icon element – leave it
    const t=n.textContent.replace(LEAD_EMO,''); if(t.trim()) n.textContent=t; });
  root.querySelectorAll('table.tbl').forEach(t=>{ if(!t.parentElement.classList.contains('tbl-wrap')){ const w=document.createElement('div'); w.className='tbl-wrap'; t.replaceWith(w); w.appendChild(t); } });
}
render = (orig => function(){ orig.apply(this, arguments); dsTidy($('#main')); })(render);
new MutationObserver(()=>{ const r=document.getElementById('sheetRoot'); if(r && !r.dataset.tidying){ r.dataset.tidying='1'; requestAnimationFrame(()=>{ dsTidy(r); delete r.dataset.tidying; }); } })
  .observe(document.getElementById('sheetRoot'), {childList:true, subtree:true});

(function(){ const st=document.createElement('style'); st.textContent=`
/* ---------- base ---------- */
body{font-size:15px;letter-spacing:-.005em}
main{padding:8px 16px 24px}
html.demo .hdr{padding-top:calc(26px + env(safe-area-inset-top))}
.shell{padding-bottom:calc(84px + env(safe-area-inset-bottom))}
.small{font-size:13px}
/* ---------- header ---------- */
.hdr{gap:8px;padding:calc(10px + env(safe-area-inset-top)) 16px 10px;border-bottom:1px solid transparent}
.hdr .datenav{margin-left:auto}
.logo{width:32px;height:32px;border-radius:10px;box-shadow:none}
.brand h1{font-size:19px}
.hdr-chat{width:38px;height:38px;flex:none;border-radius:12px;border:1px solid var(--border);background:var(--surface);color:var(--accent);display:grid;place-items:center;cursor:pointer}
.hdr-chat svg{width:20px;height:20px}
#chatFab{display:none!important}
/* ---------- cards: one style everywhere ---------- */
.card{border-radius:16px;padding:16px;margin:0 0 12px;box-shadow:var(--shadow);border:1px solid var(--border);background:var(--surface)}
.card h3{font-size:16px;font-weight:700;margin:0 0 12px;letter-spacing:-.01em}
.card h3 .sub{font-size:13px;font-weight:600}
.card.wk-card{border:1px solid var(--border)}
.sec-title,.ds-label{font-family:var(--font-b);font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin:24px 2px 8px}
.ds-label:first-child{margin-top:8px}
.ds-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}
.ds-eyebrow{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.ds-title{font-family:var(--font-d);font-size:17px!important;font-weight:700;margin:2px 0 2px!important;display:block!important}
.ds-sub{font-size:13px;color:var(--muted)}
.ds-list .wk-tg:first-child{border-top:0}
.ds-more{border:0;background:none;color:var(--accent);font:inherit;font-weight:700;font-size:13px;padding:10px 0 0;cursor:pointer}
.ds-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.ds-actions .btn{white-space:nowrap;padding:12px 8px;font-size:14px;gap:6px}
.rep-btn>span:first-child{display:none}
.mp-card>summary{flex-direction:column;align-items:flex-start!important;gap:2px}.mp-card>summary::-webkit-details-marker{display:none}
.tick{gap:10px;min-width:0;overflow-wrap:anywhere}.ticks{grid-template-columns:repeat(2,minmax(0,1fr))}
.ds-link{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;border:1px solid var(--border);background:transparent;color:var(--fg);border-radius:12px;padding:13px;font:inherit;font-weight:600;font-size:14px;cursor:pointer;margin:12px 0 0}
.ds-foot{text-align:center;color:var(--muted);font-size:12px;margin:16px 0 0}
.ds-chev{font-size:22px;color:var(--muted)}
.tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -4px;padding:0 4px}
/* ---------- hero ---------- */
.hero{border-radius:20px;box-shadow:none;padding:18px}
.hero::before,.hero::after{display:none}
.hero-sm .hs b{font-size:24px}
/* ---------- buttons ---------- */
.btn{border-radius:12px;min-height:46px;padding:12px 16px;font-size:14.5px;font-weight:700;gap:8px}
.btn.sm{min-height:38px;padding:8px 14px;font-size:13.5px;border-radius:10px}
.btn.pri{background:var(--accent);color:#fff;box-shadow:none}
.btn.sec{background:var(--surface-2);border:1px solid var(--border)}
.btn.ghost{min-height:0}
.btn .ic{flex:none}
.mini{border-radius:8px}
.cele-card .btn.pri{background:#fff;color:#1e40af}
/* ---------- quick actions ---------- */
.quick-row{grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 4px}
.qbtn{gap:6px;padding:14px 4px 12px;border-radius:14px;box-shadow:var(--shadow);background:var(--surface);border:1px solid var(--border);color:var(--fg);font-size:12.5px;font-weight:600}
.qbtn .ic{color:var(--accent)}
.qbtn span{font-size:12.5px}
/* ---------- inner boxes / rows ---------- */
.must-grid,.ticks{gap:8px}
.must{border-radius:12px;border:1px solid var(--border);background:var(--surface-2);padding:10px 10px 10px 38px}
.must.ok{background:color-mix(in srgb,var(--good) 12%,var(--surface));border-color:color-mix(in srgb,var(--good) 40%,transparent)}
.must .mi{border-radius:50%}
.tick{border-radius:12px}
.item{border-radius:14px;box-shadow:var(--shadow)}
.emo{border-radius:12px}
.rep-card{padding:16px}.rep-btn{border-radius:12px;margin-top:8px}
.rep-btn>span:first-child{font-size:18px}
.big-cta{display:flex;align-items:center;gap:12px;background:var(--accent-weak);border-color:color-mix(in srgb,var(--accent) 35%,transparent)}
.chat-cta img{width:40px;height:40px}
.setup-cta,.ev-card{background:var(--accent-weak)}
.chips{gap:6px}.chip{padding:7px 12px;font-size:13px}
.chip.on{background:var(--accent);border-color:var(--accent);color:#fff}
.seg{border-radius:12px}.seg button{border-radius:9px}
.inp{border-radius:12px;background:var(--surface-2)}
.search{border-radius:12px;box-shadow:none}
.tip{border-radius:12px}
.sheet{border-radius:22px 22px 0 0}
.sheet h2{font-size:20px}
.msg.m{background:var(--accent)}
.rung button.on{background:var(--accent)}
.pbar i{background:var(--accent)}
.wk-tg{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid var(--border);border-bottom:0;font-size:14px;cursor:pointer}
.wk-tg b{font-weight:700;white-space:nowrap}
/* ---------- tab bar: docked, evenly spaced ---------- */
.tabs{left:0;right:0;transform:none;bottom:0;width:100%;max-width:none;border-radius:0;border:0;border-top:1px solid var(--border);
  padding:6px max(8px,calc(50% - 260px)) calc(6px + env(safe-area-inset-bottom));box-shadow:none;background:color-mix(in srgb,var(--surface) 92%,transparent)}
.tabs button{padding:6px 0 4px;border-radius:10px;font-size:10.5px;font-weight:600;gap:3px}
.tabs button svg{width:24px;height:24px}
.tabs button.on{background:none;color:var(--accent)}
.tabs button.on svg{transform:none}
/* ---------- the one floating button ---------- */
.fab{width:54px;height:54px;border-radius:16px;background:var(--accent);box-shadow:0 8px 20px rgba(37,99,235,.35);right:max(16px,calc(50% - 244px));bottom:calc(76px + env(safe-area-inset-bottom))}
.fab svg{width:26px;height:26px}
`; document.head.appendChild(st); })();

/* =====================================================================
   v2.6 — fixes from the ChatGPT design review (all 15 approved)
   ===================================================================== */
/* 1. readable durations: under 1 min → "45 sec", else "32 min" / "1 min 30 sec" */
function fmtDur(s){ s=Math.round(+s||0); if(s<60) return `${s} sec`; const m=Math.floor(s/60), r=s%60; return r?`${m} min ${r} sec`:`${m} min`; }
tgtText = (orig => function(t, e){ if(t && t.timed) return `${t.sets>1?t.sets+' × ':''}${fmtDur(t.secs)}`; return orig(t, e); })(tgtText);

/* 9. English names only (old name kept in .alt so chat and history still match) */
const EN_NAME = {'tadasana':'Mountain Pose','vrikshasana':'Tree Pose','trikonasana':'Triangle Pose','virabhadrasana':'Warrior Pose','bhujangasana':'Cobra Pose',
  'setu-bandhasana':'Bridge Pose','marjaryasana':'Cat-Cow','balasana':"Child's Pose",'naukasana':'Boat Pose','paschimottanasana':'Seated Forward Fold',
  'malasana':'Deep Squat','bhramari':'Humming Bee Breath','trataka':'Candle Gazing','inverted-row':'Inverted Row'};
function applyEnglishNames(){ if(S.settings.hindi) return; for(const e of EXERCISES){ const n=EN_NAME[e.id]; if(n && e.en!==n){ e.alt=e.en; e.en=n; } } }
applyEnglishNames();
findExercise = (orig => function(name){ const r=orig(name); if(r) return r; const n=String(name||'').toLowerCase(); return allEx().find(e=>e.alt && e.alt.toLowerCase().includes(n.split(' (')[0])) || null; })(findExercise);
const exName = (id, fallback) => { const e=exById(id); return e ? e.en : (fallback||id); };

/* 6. Today: daily musts — the 4 still to do first, "See all" for the rest */
function mustsTop(k=cur){ const d=day(k), ms=myMusts(); const rows=ms.map(m=>({m, M:MUSTS[m], ok:MUSTS[m].ok(d,k)})); const done=rows.filter(r=>r.ok).length;
  const ordered=[...rows.filter(r=>!r.ok), ...rows.filter(r=>r.ok)]; const all=S.ui?.mustsAll; const show=all?ordered:ordered.slice(0,4);
  return `<section class="card"><div class="ds-head" style="margin-bottom:10px"><h3 class="ds-title" style="margin:0!important">Daily musts</h3><span class="ds-count">${done} of ${ms.length} done</span></div>
    <div class="must-grid">${show.map(({m,M,ok})=>`<button class="must ${ok?'ok':''}" ${M.tick?`data-act="mustTick" data-k="${M.tick}"`:'data-act="mustHelp" data-k="'+m+'"'}><span class="mi">${ok?'✓':''}</span><b>${M.n}</b><small>${esc(M.v(d,k))}</small></button>`).join('')}</div>
    ${ms.length>4?`<button class="ds-more" data-act="mustsAll">${all?'Show less':`See all ${ms.length}`}</button>`:''}</section>`; }

/* 3. Train: same workout card as Today, at the top; no duplicate banner */
vTrain = (orig => function(){ let h=orig(); const wd=new Date().getDay();
  h=h.replace(/<div class="hero" style="padding:16px">[\s\S]*?<\/div><\/div>/, '');           // old "Today's plan" banner
  h=h.replace(workoutCard(wd, true), '');
  return todayWorkout(wd) + h; })(vTrain);

/* 4 + 11. Food tab: Add button and search stay at the top, Recent first, weekly numbers folded */
function recentDishes(n=6){ const ids=[]; for(const k of Object.keys(S.days).sort().reverse().slice(0,14)) for(const e of [...(S.days[k].food||[])].reverse()) if(e.dish && !ids.includes(e.dish) && dishById(e.dish)) ids.push(e.dish); return ids.slice(0,n).map(dishById); }
vFood = function(){
  const cats=['All','★ Saved','High protein','Mine',...FOOD_CATS];
  const list=filterDishes(foodQ, foodCat); const rec=recentDishes(); const showRec=!foodQ && foodCat==='All' && rec.length;
  const b=bank(todayKey());
  return `
  <div class="food-top">
    <button class="btn pri full" data-act="quickAdd">${ico('food',18)}Add food to ${esc(niceDate(cur).toLowerCase()==='today'?'today':niceDate(cur))}</button>
    <div class="search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity=".5"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input id="foodSearch" placeholder="Search dish or ingredient — moong, paneer, dal" value="${esc(foodQ)}" autocomplete="off"></div>
    <div class="chips">${cats.map(c=>`<button class="chip ${c===foodCat?'on':''}" data-act="foodCat" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
  </div>
  ${showRec?`<div id="foodRecent"><div class="ds-label">Recent</div><div class="list">${rec.map(dishCard).join('')}</div>${mealsChips()}</div>`:''}
  <details class="card fold"><summary><span class="grow"><b>This week</b><small>${b&&b.left!=null?`${r0(Math.max(0,b.left)).toLocaleString('en-IN')} kcal left · `:''}treats, portion guide</small></span>${ico('down',18)}</summary>
    <div class="fold-in">${bankCard(todayKey())}${treatCard(todayKey())}${portionGuideCard()}</div></details>
  <div class="ds-label">${foodQ||foodCat!=='All'?'Results':'All dishes'} · ${list.length}</div>
  <div class="small muted" style="margin:-4px 2px 10px"><span class="dot g"></span> everyday <span class="dot y"></span> sometimes <span class="dot r"></span> treat · per serving</div>
  <div class="list" id="foodList">${list.map(dishCard).join('') || `<div class="card empty">No match. Try another word, or create it with “New dish”.</div>`}</div>
  <div class="ds-actions"><button class="btn sec" data-act="newDish">New dish</button><button class="btn sec" data-act="newIng">New ingredient</button></div>`;
};

/* 2. Progress: exercise history as one row per exercise (no wide table) */
exProgressCard = function(){ const ids=new Set(); for(const k in S.days) for(const x of (S.days[k].ex||[])) if(x.log) ids.add(x.ex);
  const rows=[...ids].map(id=>{ const e=exById(id); if(!e) return null; const H=exHistory(id).filter(h=>h.x.log); if(!H.length) return null; const f=H[0], l=H[H.length-1]; const nt=progTarget(findPlanItem(id)||{id});
    const fb=bestOf(f.x,e), lb=bestOf(l.x,e), timed=e.type==='time', ch=lb-fb; const kgOf=x=>x.log.some(y=>+y.kg)?' @ '+Math.max(...x.log.map(y=>+y.kg||0))+' kg':'';
    const v=x=>timed?fmtDur(x):x+' reps';
    return `<div class="exp-row" data-act="openEx" data-id="${esc(id)}"><div class="grow"><b>${esc(e.en)}</b><span class="exp-ft">${v(fb)}${kgOf(f.x)} → <b>${v(lb)}${kgOf(l.x)}</b></span><small>Next: ${esc(tgtText(nt,e))}</small></div>
      <em class="exp-ch ${ch>0?'up':ch<0?'dn':''}">${ch>0?'▲ +'+(timed?fmtDur(ch):ch+' rep'+(ch>1?'s':'')):ch<0?'▼ lower':'same'}</em></div>`; }).filter(Boolean);
  return `<div class="card"><h3>Exercise progress <span class="sub">best set · first → latest</span></h3>
    ${rows.length?rows.join('')+'<div class="small muted" style="margin-top:8px">Tap an exercise for its full history.</div>'
      :'<div class="small muted">Log your first workout with “Did it as planned” or “Change sets”. Each exercise then shows first → latest and the next target.</div>'}</div>`; };

/* 7. Log my sets: big + / − buttons, minutes for long timers, Skipped / Pain under "More" */
drawActuals = function(fromSession){ const X=AX;
  openSheet(`<h2>What I actually did</h2><div class="hih">${esc(X.title||'')} · week ${progWeek()}${easyWeek()?' (easy week)':''}</div>
    <div class="small muted" style="margin-bottom:12px">One row per set. Change the number if you did more or less, then tick it. ${fromSession?'Sets from the guided session are already ticked.':''}</div>
    ${X.items.map((x,i)=>{ const e=exById(x.id), t=x.t, mins=t.timed&&t.secs>=120, unit=t.timed?(mins?'min':'sec'):(x.id==='kapalbhati'?'strokes':'reps'), stp=t.timed?(mins?60:5):1; const more=x.more||x.skip||x.pain;
      return `<div class="card ax-ex ${x.skip?'skip':''}"><div class="ds-head" style="margin-bottom:8px"><div><b class="ax-n">${esc(e.en)}</b><div class="small muted">Target ${esc(tgtText(t,e))}${t.up?' <span class="up">▲ raised</span>':''}</div></div>
        <button class="btn sec sm" data-act="axAll" data-i="${i}">${ico('check',16)}All</button></div>
        ${x.sets.map((s,j)=>`<div class="ax-row"><span class="ax-l">Set ${j+1}</span><button class="ax-b" data-act="axStep" data-i="${i}" data-j="${j}" data-d="${-stp}" aria-label="less">−</button><input class="inp ax-in" inputmode="decimal" data-ax="${i}:${j}:v" value="${esc(mins?r1((+s.v||0)/60):s.v)}"><span class="ax-u">${unit}</span><button class="ax-b" data-act="axStep" data-i="${i}" data-j="${j}" data-d="${stp}" aria-label="more">+</button>${t.kind==='load'?`<input class="inp ax-kg" inputmode="decimal" placeholder="kg" data-ax="${i}:${j}:kg" value="${esc(s.kg)}">`:''}<button class="ax-b ax-ok ${s.ok?'on':''}" data-act="axOk" data-i="${i}" data-j="${j}" aria-label="done">${s.ok?'✓':''}</button></div>`).join('')}
        <div class="ax-foot"><button class="ds-more" data-act="axAdd" data-i="${i}">+ Add a set</button><button class="ds-more" data-act="axMore" data-i="${i}">${more?'Less':'More'}</button></div>
        ${more?`<div class="ax-more"><button class="btn sec sm ${x.skip?'on':''}" data-act="axSkip" data-i="${i}">${x.skip?'Undo skip':'Skipped it'}</button><button class="btn sec sm ax-pain ${x.pain?'on':''}" data-act="axPain" data-i="${i}">${x.pain?'Pain noted':'Felt pain'}</button></div>`:''}</div>`; }).join('')}
    <button class="btn pri full" data-act="axSave">Save my sets</button>`, b=>{
      $$('[data-ax]',b).forEach(el=>el.addEventListener('input',()=>{ const [i,j,f]=el.dataset.ax.split(':'); const x=AX.items[+i], s=x.sets[+j]; let v=el.value.trim();
        if(f==='v' && x.t.timed && x.t.secs>=120) v=String(Math.round((parseFloat(v)||0)*60));
        s[f]=v; if(f==='v') s.ok=true; const okb=el.closest('.ax-row').querySelector('.ax-ok'); okb.classList.add('on'); okb.textContent='✓'; })); }); };
Object.assign(A, {
  axMore:el=>{ const x=AX.items[+el.dataset.i]; x.more=!(x.more||x.skip||x.pain); drawActuals(); },
  mustsAll:()=>{ S.ui ||= {}; S.ui.mustsAll=!S.ui.mustsAll; save(true); render(); },
  meGrp:el=>{ S.ui ||= {}; const o=S.ui.meOpen ||= {}; o[el.dataset.g]=!o[el.dataset.g]; save(true); setTimeout(()=>{ el.parentElement.open=!!o[el.dataset.g]; },0); },
});
simpleToday = (orig => function(d){ return orig(d).replace(mustsCard(), mustsTop()); })(simpleToday);

/* 5. Blood results: words next to the colour — never colour alone */
const ST_WORD={g:'Within range', a:'Slightly outside range', r:'Outside range — review with your doctor', '':'No range'};

/* 8. Chat: show exactly what was saved; estimates get Edit; Undo always one tap */

/* 14. Me tab in clear groups */
const ME_GROUPS=[['acct','Account & backup','Online copy, login, backup',/online|backup|log ?in|cloud|save my data/i],
  ['goals','Health & goals','Starting point, daily targets, health file, bottles',/starting point|daily targets|health data|bottle|goal/i],
  ['coach','Coach & reminders','Riya, AI, voice, steps, nudges, quiet hours',/coach|voice|ai\b|riya|nudge|steps from|reminder/i],
  ['look','Appearance','Light or dark, avatar',/look|avatar|theme/i],
  ['priv','Privacy & data','Where data lives, private space, erase',/where my data|private space|erase|delete/i],
  ['more','More','My additions, about',/.*/]];
function groupMe(view){ if(!view) return; const kids=[...view.children]; if(!kids.length || view.querySelector('.me-grp')) return; const bins={};
  for(const el of kids){ const t=((el.querySelector('h3,summary,b')||{}).textContent||el.textContent||'').slice(0,60); const g=ME_GROUPS.find(G=>G[3].test(t)); (bins[g[0]] ||= []).push(el); }
  const open=S.ui?.meOpen||{};
  for(const [id,title,hint] of ME_GROUPS){ const els=bins[id]; if(!els) continue; const det=document.createElement('details'); det.className='me-grp'; if(open[id]) det.open=true;
    det.innerHTML=`<summary data-act="meGrp" data-g="${id}"><span class="grow"><b>${title}</b><small>${hint}</small></span><span class="me-n">${els.length}</span>${ico('down',18)}</summary><div class="me-in"></div>`;
    const box=det.querySelector('.me-in'); els.forEach(e=>box.appendChild(e)); if(id==='priv') els.sort((a,b)=>(a.tagName==='BUTTON')-(b.tagName==='BUTTON')).forEach(e=>box.appendChild(e)); view.appendChild(det); } }

/* after every screen: Me grouping, single "+" button, Food search hides Recent */
render = (orig => function(){ orig.apply(this, arguments);
  if(tab==='me') groupMe($('#main .view'));
  $('#fab').style.display = tab==='today' ? '' : 'none';
  if(tab==='food'){ const s=$('#foodSearch'); if(s) s.addEventListener('input',()=>{ const r=$('#foodRecent'); if(r) r.style.display=s.value.trim()?'none':''; }); }
})(render);

(function(){ const st=document.createElement('style'); st.textContent=`
/* readable text sizes — nothing important under 13 px */
body{font-size:15.5px}
.small,.item .t2,.must small,.lab-row small,.rr-row small,.st span,.kv3 small,.jhead small,.badge small,.coach-row small,.wbtn small,.por small{font-size:13px}
.tabs button{font-size:11px}.pill{font-size:12px}.tl-slot{font-size:12.5px}.badge b{font-size:12.5px}.chart text{font-size:11px}.sl-b small{font-size:10.5px}
.item .t1{font-size:15px}.hab .hl{font-size:12.5px}.hab .hv{font-size:20px}
.ds-count{font-size:13px;color:var(--muted);font-weight:600;white-space:nowrap}
/* food tab */
.food-top{position:sticky;top:calc(58px + env(safe-area-inset-top));z-index:20;background:var(--bg);margin:0 -16px 4px;padding:6px 16px 2px;display:grid;gap:10px}
html.demo .food-top{top:calc(74px + env(safe-area-inset-top))}
.food-top .search{margin:0}.food-top .chips{padding-bottom:8px}
.fold>summary{display:flex;align-items:center;gap:10px;cursor:pointer;list-style:none}.fold>summary::-webkit-details-marker{display:none}
.fold>summary small,.me-grp>summary small{display:block;color:var(--muted);font-size:13px;font-weight:500;margin-top:1px}
.fold[open]>summary .ic,.me-grp[open]>summary .ic{transform:rotate(180deg)}
.fold-in{margin-top:12px}.fold-in .card{border:0;padding:0;margin:0 0 16px;background:none;box-shadow:none}
/* progress rows */
.exp-row{display:flex;gap:12px;align-items:center;padding:12px 0;border-top:1px solid var(--border);cursor:pointer}
.exp-row:first-of-type{border-top:0}.exp-row b{font-size:15px}.exp-row small{display:block;color:var(--muted);font-size:13px}
.exp-row .grow{min-width:0}.exp-ft{display:block;font-size:14px;color:var(--muted);margin:2px 0}.exp-ft b{font-size:14px;color:var(--fg)}
.exp-ch{flex:none;font-style:normal;font-weight:700;font-size:13px;color:var(--muted);background:var(--surface-2);border-radius:99px;padding:4px 10px}.exp-ch.up{color:var(--good)}.exp-ch.dn{color:var(--watch)}
/* log sets */
.ax-ex{padding:14px}.ax-n{font-size:15.5px}
.ax-row{display:grid;grid-template-columns:44px 44px minmax(0,1fr) auto 44px auto 44px;align-items:center;gap:6px;margin-top:8px}
.ax-row:has(.ax-kg){grid-template-columns:40px 44px minmax(0,1fr) auto 44px 64px 44px}
.ax-l{font-size:13px;color:var(--muted);font-weight:600}.ax-u{font-size:13px;color:var(--muted)}
.ax-b{width:44px;height:44px;border-radius:12px;border:1px solid var(--border);background:var(--surface-2);color:var(--fg);font-size:20px;font-weight:700;cursor:pointer;display:grid;place-items:center}
.ax-b.ax-ok{color:var(--good);font-size:18px}.ax-b.ax-ok.on{background:var(--good);border-color:var(--good);color:#fff}
.ax-in{height:44px;text-align:center;font-weight:700;font-size:16px;padding:0 4px;min-width:0}.ax-kg{height:44px;text-align:center;padding:0 4px}
.ax-foot{display:flex;justify-content:space-between;margin-top:4px}
.ax-more{display:flex;gap:8px;margin-top:8px}.ax-more .btn{flex:1}.ax-more .btn.on{background:var(--accent-weak);border-color:var(--accent);color:var(--fg)}
.ax-more .ax-pain.on{background:color-mix(in srgb,var(--crit) 18%,var(--surface));border-color:var(--crit)}
.ax-ex.skip{opacity:.6}
/* blood results */
.lab-row .dot{width:10px;height:10px;flex:none}.lab-st{font-weight:700}.lab-st.g{color:var(--good)}.lab-st.a{color:var(--watch)}.lab-st.r{color:var(--crit)}
/* Me groups */
.me-grp{background:var(--surface);border:1px solid var(--border);border-radius:16px;margin:0 0 12px;box-shadow:var(--shadow)}
.me-grp>summary{display:flex;align-items:center;gap:10px;padding:16px;cursor:pointer;list-style:none}.me-grp>summary::-webkit-details-marker{display:none}
.me-grp>summary b{font-size:16px}.me-n{font-size:12px;font-weight:700;color:var(--muted);background:var(--surface-2);border-radius:99px;padding:2px 8px}
.me-in{padding:0 12px 4px}.me-in>.card{background:var(--surface-2);box-shadow:none}.me-in>.btn{margin-bottom:12px}
.chat-est{font-size:12px;font-weight:700;color:var(--watch)}
`; document.head.appendChild(st); })();

/* 10. emoji out of chips, care ticks and filters too */
dsTidy = (orig => function(root){ orig(root); if(!root) return;
  root.querySelectorAll('.chip, .tick, .seg button, .tl-slot .mini').forEach(el=>{ const n=[...el.childNodes].find(x=>x.nodeType===3 && x.textContent.trim()); if(!n) return;
    const t=n.textContent.replace(LEAD_EMO,''); if(t.trim()) n.textContent=t; }); })(dsTidy);
/* ---------------- start ---------------- */
applyTheme(); render(); checkBadges(); loadPhotos(); levelUps(); maybeMorning(); setTimeout(()=>syncNow(),1200);
if(DEMO){ document.documentElement.classList.add("demo"); demoSetup(); }
if(!S.settings.onboarded) setTimeout(()=>{ if(CLOUD_ON() && !Cloud.user) cloudLoginSheet('in'); else wizard(0); },400);
window.__ojas = {lastMeal, addItems, buildAX, pickVoice, progTarget, progAfter, progWeek, tgtText, actualsSheet, exHistory, chatSets, PDB, syncNow, syncPull, syncPush, cloudCount, changedDays, SY:()=>SY, SYNC, habLevel, habRate, HABITS, habWeek, setHab, reviewPending, treatsIn, treatPatterns, isTreat, inQuiet, NUDGES, vCreate, vUnlock, VAULT, morningInfo, drawMorningCanvas, levelUps, handleText, openChat, answerCheckin, nextCheckin, parseFoodPart, CHECKINS, PORTIONS, computePlan, bank, wgStatus, mustsDone, mustStreak, myWeekly, weekKeys, applySetupFile, wizard, readReport, weeklyReport, labStatus, sleepHours, SESSION:()=>SESSION, S:()=>S, dishMacros, allDishes, allEx, ING:()=>ING, version:VERSION, parseDose, exMedia, statsAll, journeyAt, stepStats, P:()=>P, plFinish, checkBadges};
})();
