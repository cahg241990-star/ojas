/* OJAS report reader — reads a lab-report PDF ON THE PHONE (nothing is uploaded) and finds common blood markers.
   Uses pdf.js (lib/pdf.min.js), loaded only when the user picks a PDF. Every value is shown on a review screen before saving. */
(function(g){
'use strict';
// [key, label regex, skip-line regex, min, max]
const M = [
  ['hba1c', /hba1c|glycosylated ha?emoglobin|glycated ha?emoglobin/i, /estimated|average glucose|eag|interpret|diabetes|goal|therap|risk|>=|non.?diab/i, 3, 20],
  ['fbs',   /(plasma |blood )?glucose[ ,(-]*fasting|fasting (plasma |blood )?(glucose|sugar)|\bfbs\b/i, /impaired|toleran|diabetes|interpret/i, 40, 500],
  ['tc',    /(serum |total )?cholesterol\b/i, /hdl|ldl|vldl|ratio|non.?hdl|risk/i, 70, 500],
  ['tg',    /triglycerides?/i, /ratio/i, 20, 3000],
  ['hdl',   /\bhdl\b/i, /ratio|non.?hdl|ldl\s*\//i, 10, 150],
  ['ldl',   /\bldl\b/i, /ratio|vldl|hdl\s*\//i, 10, 400],
  ['alt',   /sgpt|alanine amino|\balt\b/i, /ratio|sgot\s*\//i, 3, 3000],
  ['ast',   /sgot|aspartate amino|\bast\b/i, /ratio|\/\s*sgpt/i, 3, 3000],
  ['ggt',   /\bggt|gamma.?glutamyl|g\.g\.t/i, /ratio/i, 2, 3000],
  ['creat', /creatinine/i, /urine|ratio|clearance|bun\s*\//i, 0.2, 15],
  ['egfr',  /\begfr\b|\bgfr\b/i, /national|stage|recommend|kdigo|equation|applicable|aged|years|=/i, 5, 200],
  ['uric',  /uric acid/i, /urine|ratio/i, 1, 20],
  ['tsh',   /\btsh\b|thyroid stimulating/i, /trimester|children|note|drugs|circadian|subject|variant|central/i, 0.01, 100],
  ['vitd',  /vitamin d\b|25.?oh|25.?hydroxy/i, /status|deficien|insuffic|toxic|suffic|make your/i, 3, 250],
  ['b12',   /vitamin\s*-?\s*b\s?12|cobalamin/i, /comment|keep your|deficien|patients|daily intake|lack of|conditions|population|healthy|%\s*of/i, 50, 3000],
  ['iron',  /^\s*(serum )?iron\b|\biron,? serum/i, /binding|unsaturated|tibc|uibc|deficien/i, 10, 500],
  ['ferritin', /ferritin/i, /deficien/i, 1, 3000],
  ['folate', /folate|folic acid/i, /deficien/i, 1, 50],
  ['hb',    /ha?emoglobin\b|\bhb\b/i, /glycosylated|glycated|hba1c|mean corp|mch|estimated|iron deficiency|associated/i, 4, 25],
  ['pcv',   /\bpcv\b|ha?ematocrit/i, /ratio/i, 15, 75],
  ['plt',   /platelet count|^\s*platelets?\b/i, /volume|mpv|distribution|pdw/i, 0.5, 2000000],
  ['mcv',   /\bmcv\b|mean corp\.? (uscular )?volume/i, /mchc|mch\b/i, 50, 150],
  ['rdw',   /rdw\s*-?\s*cv|^\s*rdw\b(?!\s*-?\s*sd)/i, /sd|rdwi/i, 8, 30]
];
const NUM = /(?:^|[^\w.^])([<>]?\s?\d{1,7}(?:[.,]\d+)?)(?![\w^])/;
function valueAfter(line, re){
  const m = re.exec(line); if(!m) return null;
  let rest = line.slice(m.index + m[0].length).replace(/\([^)]*\)/g,' ').replace(/^[\s:|,.-]+/,' ');
  rest = rest.replace(/\b(10\^\d|x10\^?\d+|1\.73\s*m2?)\b/gi,' ').replace(/\b25\s*-?\s*(oh|hydroxy)\b/gi,' ').replace(/^\s*b\s?12\b/i,' ');
  const n = NUM.exec(rest); if(!n) return null;
  const pre = line.slice(0, m.index + m[0].length) + rest.slice(0, n.index);
  return {pre, v: parseFloat(n[1].replace(/[<>\s]/g,'').replace(/,(?=\d{3}\b)/g,'').replace(',','.'))};
}
const MON = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
const pad = n => String(n).padStart(2,'0');
function findDate(lines){
  const keys = /(sample )?collect(ed|ion)( on| date)?|registered on|sample date|date of collection/i;
  for(const L of lines){ if(!keys.test(L)) continue; const s = L.slice(L.search(keys));
    let m = /(\d{1,2})[\/\-\s]([A-Za-z]{3})[a-z]*[\/\-\s,]+(\d{4})/.exec(s); if(m && MON[m[2].toLowerCase()]) return `${m[3]}-${pad(MON[m[2].toLowerCase()])}-${pad(m[1])}`;
    m = /([A-Za-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})/.exec(s); if(m && MON[m[1].toLowerCase()]) return `${m[3]}-${pad(MON[m[1].toLowerCase()])}-${pad(m[2])}`;
    m = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(s); if(m && +m[2]<=12) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  }
  return null;
}
function parse(lines){
  const found = {};
  for(let L of lines){
    if(L.length > 220 || /[●•]|^\s*\d+[.)]\s/.test(L)) continue;   // long sentences, bullets, numbered notes = explanations
    L = L.replace(/\b([A-Z]) (?=[A-Z]\b)/g,'$1');             // 'M C V' -> 'MCV'
    for(const [k, re, skip, lo, hi] of M){
      if(found[k] || !re.test(L)) continue;
      const r = valueAfter(L, re); if(!r || isNaN(r.v) || skip.test(r.pre)) continue; let v = r.v;
      if(k==='vitd' && /nmol/i.test(L)) v = Math.round(v/2.496*10)/10;
      if(k==='plt'){ if(v>=1000) v = Math.round(v/1000); else if(v<10) v = Math.round(v*100); }
      if(k==='b12' && /pmol/i.test(L)) v = Math.round(v*1.355);
      if(v < lo || v > hi) continue;
      found[k] = {v, line: L.trim().replace(/\s+/g,' ').slice(0,90)};
    }
  }
  return {date: findDate(lines), found};
}
// rebuild text lines from pdf.js text items (same code on phone and in tests)
function linesFromItems(items){
  const rows = [];
  for(const it of items){ if(!it.str || !it.str.trim()) continue; const y = it.transform[5], x = it.transform[4];
    let r = rows.find(r => Math.abs(r.y - y) < 2.5); if(!r){ r = {y, it:[]}; rows.push(r); } r.it.push({x, w: it.width||0, s: it.str}); }
  rows.sort((a,b) => b.y - a.y);
  return rows.map(r => { r.it.sort((a,b) => a.x - b.x); let out = '', end = null;
    for(const t of r.it){ if(end != null) out += (t.x - end > 6 ? '   ' : (t.x - end > 1 ? ' ' : '')); out += t.s; end = t.x + t.w; } return out; });
}
async function readPdf(file, pdfjs){
  pdfjs = pdfjs || g.pdfjsLib;
  const data = file.arrayBuffer ? new Uint8Array(await file.arrayBuffer()) : file;
  const doc = await pdfjs.getDocument({data}).promise; const lines = [];
  for(let p = 1; p <= doc.numPages; p++){ const page = await doc.getPage(p); const tc = await page.getTextContent(); lines.push(...linesFromItems(tc.items)); }
  return {pages: doc.numPages, lines};
}
let libP = null;
function loadLib(){
  if(g.pdfjsLib) return Promise.resolve(g.pdfjsLib);
  return libP ||= new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'lib/pdf.min.js';
    s.onload = () => { g.pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js'; res(g.pdfjsLib); };
    s.onerror = () => { libP = null; rej(new Error('Could not load the PDF reader (needs internet the first time).')); }; document.head.appendChild(s); });
}
const api = {parse, linesFromItems, readPdf, loadLib, MARKERS: M.map(m => m[0])};
g.OjasReport = api; if(typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
