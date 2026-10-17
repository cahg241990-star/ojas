/* OJAS — plans & routines (generic content, no personal data; personal health values are imported on the phone only). */

/* ---------- Full guided workouts per weekday (0 = Sunday). sets/reps/secs override the exercise's own dose. ---------- */
const WORKOUTS = {
  0:{title:'Rest day · gentle yoga, breath & easy walk', mins:30, items:[
     {id:'surya-namaskar',reps:3,sets:1},{id:'marjaryasana',reps:8,sets:1},{id:'hip-flexor',secs:45,sets:1},{id:'balasana',secs:45,sets:1},
     {id:'anulom-vilom',secs:300,sets:1},{id:'yoga-nidra',secs:600,sets:1},{id:'brisk-walk',secs:1800,sets:1}]},
  1:{title:'Gym · upper body + incline walk', mins:60, items:[
     {id:'jumping-jacks',secs:30,sets:2},{id:'bench-press',sets:3,reps:10},{id:'lat-pulldown',sets:3,reps:10},{id:'seated-row',sets:3,reps:10},
     {id:'shoulder-press',sets:3,reps:10},{id:'plank',secs:40,sets:3},{id:'incline-walk',secs:900,sets:1},{id:'balasana',secs:45,sets:1}]},
  2:{title:'Yoga flow (12 Surya Namaskar) + brisk walk', mins:85, items:[
     {id:'surya-namaskar',reps:12,sets:1},{id:'virabhadrasana',secs:30,sets:2},{id:'trikonasana',secs:30,sets:2},{id:'setu-bandhasana',secs:20,sets:3},
     {id:'bhujangasana',secs:20,sets:2},{id:'balasana',secs:45,sets:1},{id:'brisk-walk',secs:2700,sets:1}]},
  3:{title:'Gym · legs & core + incline walk', mins:60, items:[
     {id:'jumping-jacks',secs:30,sets:2},{id:'goblet-squat',sets:3,reps:12},{id:'rdl',sets:3,reps:10},{id:'split-squat',sets:3,reps:8},
     {id:'hip-thrust',sets:3,reps:12},{id:'calf-raise',sets:2,reps:15},{id:'dead-bug',sets:3,reps:10},{id:'incline-walk',secs:900,sets:1}]},
  4:{title:'Calisthenics circuit ×4 + breathing', mins:45, items:[
     {id:'jumping-jacks',secs:30,sets:2},{id:'pushup',sets:4,reps:10},{id:'inverted-row',sets:4,reps:10},{id:'bw-squat',sets:4,reps:15},
     {id:'step-up',sets:4,reps:10},{id:'side-plank',secs:30,sets:2},{id:'anulom-vilom',secs:300,sets:1},{id:'bhramari',reps:7,sets:1}]},
  5:{title:'Gym · full body + cycling intervals', mins:60, items:[
     {id:'jumping-jacks',secs:30,sets:2},{id:'incline-press',sets:3,reps:10},{id:'db-row',sets:3,reps:10},{id:'leg-press',sets:3,reps:12},
     {id:'farmer-carry',secs:40,sets:3},{id:'knee-raise',sets:3,reps:10},{id:'cycling',secs:900,sets:1},{id:'balasana',secs:45,sets:1}]},
  6:{title:'Long walk 60–75 min + hip & back yoga', mins:90, items:[
     {id:'brisk-walk',secs:3900,sets:1},{id:'malasana',secs:45,sets:1},{id:'hip-flexor',secs:45,sets:2},{id:'marjaryasana',reps:8,sets:1},
     {id:'bhujangasana',secs:20,sets:2},{id:'balasana',secs:60,sets:1}]},
  7:{title:'Busy day minimum · 15 min', mins:15, items:[
     {id:'surya-namaskar',reps:4,sets:1},{id:'bw-squat',sets:2,reps:15},{id:'pushup',sets:2,reps:10},{id:'plank',secs:30,sets:1},
     {id:'kapalbhati',secs:60,sets:1},{id:'anulom-vilom',secs:180,sets:1},{id:'kegel',reps:10,sets:1}]}
};

/* ---------- Head-to-toe care routines ---------- */
// days: optional list of weekdays (0=Sun) when the item applies. why: shown when tapped.
const CARE = {
  am:[
    {id:'teeth-am', e:'🦷', t:'Brush 2 min', why:'Cleaner breath and gums.'},
    {id:'tongue', e:'👅', t:'Tongue scraper', why:'Ayurvedic daily habit (jihwa nirlekhana): fresher breath, better taste. Gentle strokes, back to front.'},
    {id:'shower', e:'🚿', t:'Shower', why:'Fresh start; lukewarm, not very hot (very hot water dries skin and is not good for sperm).'},
    {id:'oil-pull', e:'🫗', t:'Oil pulling 5 min (coconut/sesame)', why:'Optional Ayurvedic gum care. Spit in the bin, not the sink. Never replaces brushing.', opt:true},
    {id:'face-am', e:'🧼', t:'Face wash — Ahaglow (Rx)', why:'Prescribed by your dermatologist. Twice a day, gentle, pat dry.', rx:true},
    {id:'sal-gel', e:'💧', t:'Salicylic gel — thin layer (Rx)', why:'Prescribed. Use as the doctor wrote; stop and call if it burns or peels a lot.', rx:true},
    {id:'spf', e:'🧴', t:'Sunscreen — Cetaphil (Rx), face & neck', why:'Prescribed. Stops dark spots and neck darkening from getting worse. Re-apply if outdoors long.', rx:true},
    {id:'hairbless', e:'💊', t:'Hairbless — as prescribed (Rx)', why:'Prescribed by your dermatologist for hair. Take exactly as written on the prescription.', rx:true},
    {id:'neck-am', e:'🧣', t:'Neck: wash gently, no scrubbing', why:'Neck darkness is often linked to high insulin and fades as weight and sugar improve. Scrubbing makes it worse.'},
    {id:'sun-d', e:'☀️', t:'15–20 min morning sun', why:'Helps vitamin D (yours is below 30) and sets your sleep clock.'},
    {id:'eyes', e:'👀', t:'20-20-20 eye breaks at work', why:'Every 20 min look 20 feet away for 20 s — less eye strain and headache.'}
  ],
  pm:[
    {id:'teeth-pm', e:'🪥', t:'Brush + floss before bed', why:'Night is when plaque does most damage. Flossing protects gums.'},
    {id:'face-pm', e:'🌙', t:'Face wash — Ahaglow (Rx) + moisturiser', why:'Prescribed. Removes sweat, oil and sunscreen; fewer pimples.', rx:true},
    {id:'pimple', e:'🎯', t:'Spot care on pimples only (no picking)', why:'Picking leaves marks. Many or painful pimples → see a dermatologist.', opt:true},
    {id:'hair-oil', e:'💆', t:'Scalp oil massage (wash next morning)', why:'2×/week. Hair fall also needs ferritin, vitamin D and thyroid checked.', days:[3,0]},
    {id:'exfoliate', e:'✨', t:'Gentle exfoliation (face & neck)', why:'2×/week only. Helps dull skin and neck darkness — gently.', days:[2,5]},
    {id:'neti', e:'👃', t:'Saline rinse / 2 drops nasya oil', why:'Clears the nose — helps snoring. Use boiled-cooled or sterile water only.'},
    {id:'side', e:'🛏️', t:'Side-sleeping set-up (pillow behind back)', why:'Sleeping on your back makes snoring worse.'},
    {id:'screens', e:'📵', t:'Screens off 1 h before bed', why:'Better deep sleep, better hormones, less late-night snacking.'}
  ]
};

/* ---------- Daily meal plans (~1,850–2,050 kcal, ~85–91 g protein from food — kept at or under 90 g until the kidney retest) ---------- */
// [slot, dishId, servings]
/* Sprint dishes (added to the food list) */
if (typeof DISHES !== 'undefined') DISHES.push(
  {id:'ojas-seed-mix',en:'Ojas seed mix (sperm + liver)',hi:'बीज मिश्रण',e:'🌰',cat:'Snacks',reg:'All',dot:'g',unit:'2 tbsp',
   ing:[['pumpkin-seeds',10],['flaxseed',7],['walnuts',7],['sesame',3]],
   steps:['Keep a jar: equal parts pumpkin seeds, freshly ground flaxseed, chopped walnuts, a little roasted til.','Eat 2 tablespoons a day — on curd, dalia, salad, or plain.'],
   tip:'Zinc (pumpkin seeds), omega-3 (flax + walnuts) and vitamin E — the main foods for sperm count, movement and testosterone. Also good for liver fat.'},
  {id:'beet-pom-salad',en:'Beetroot–pomegranate salad',hi:'चुकंदर अनार सलाद',e:'🥗',cat:'Salads',reg:'All',dot:'g',unit:'1 bowl',
   ing:[['beetroot',60],['pomegranate',30],['cucumber',50],['lemon',5]],
   steps:['Grate or dice raw beetroot, add cucumber and pomegranate.','Squeeze lemon, pinch of rock salt and roasted jeera. Lunch only (raw food is harder to digest at night).'],
   tip:'Beetroot nitrates open up blood vessels (BP + erections); pomegranate antioxidants protect sperm.'}
);
const MEAL_PLANS = [
  {name:'Sprint · North', items:[
    ['early','methi-water',1],['breakfast','moong-chilla',1],['breakfast','hung-curd-bowl',1],['mid','guava-fruit',1],['mid','amla-fruit',1],
    ['lunch','roti',1],['lunch','dal-palak',1],['lunch','soya-curry',1],['lunch','beet-pom-salad',1],['lunch','chaas-drink',1],
    ['snack','roasted-chana-snack',1],['snack','ojas-seed-mix',1],['dinner','lauki-soup',1],['dinner','palak-paneer',1]]},
  {name:'Sprint · South', items:[
    ['early','jeera-water',1],['breakfast','pesarattu',1],['breakfast','hung-curd-bowl',1],['mid','papaya-bowl',1],['mid','amla-fruit',1],
    ['lunch','brown-rice-bowl',1],['lunch','sambar',1],['lunch','tofu-stirfry',1],['lunch','chaas-drink',1],
    ['snack','sprouts-chaat',1],['snack','ojas-seed-mix',1],['dinner','dal-soup',1],['dinner','soya-curry',1],['dinner','beans-poriyal',1]]},
  {name:'Sprint · Millet', items:[
    ['early','methi-water',1],['breakfast','veg-dalia',1],['breakfast','protein-shake',1],['mid','pomegranate-fruit',1],
    ['lunch','jowar-roti',1],['lunch','rajma',1],['lunch','mushroom-masala',1],['lunch','green-salad',1],['lunch','chaas-drink',1],
    ['snack','roasted-chana-snack',1],['snack','ojas-seed-mix',1],['dinner','khichdi',1],['dinner','soya-curry',1]]}
];

/* ---------- Blood markers: names, units and healthy ranges (generic). lo/hi = healthy range; wlo/whi = "watch" band. ---------- */
const LAB_MARKERS = [
  {k:'hba1c', n:'Sugar average (HbA1c)', u:'%', hi:5.7, whi:6.5, g:'Sugar'},
  {k:'fbs',   n:'Fasting sugar', u:'mg/dL', hi:100, whi:126, g:'Sugar'},
  {k:'tc',    n:'Total cholesterol', u:'mg/dL', hi:200, whi:240, g:'Heart'},
  {k:'ldl',   n:'"Bad" cholesterol (LDL)', u:'mg/dL', hi:100, whi:130, g:'Heart'},
  {k:'hdl',   n:'"Good" cholesterol (HDL)', u:'mg/dL', lo:40, wlo:35, g:'Heart'},
  {k:'tg',    n:'Triglycerides', u:'mg/dL', hi:120, whi:200, g:'Heart'},
  {k:'alt',   n:'Liver — ALT (SGPT)', u:'U/L', hi:45, whi:80, g:'Liver'},
  {k:'ast',   n:'Liver — AST (SGOT)', u:'U/L', hi:35, whi:50, g:'Liver'},
  {k:'ggt',   n:'Liver — GGT', u:'U/L', hi:55, whi:80, g:'Liver'},
  {k:'creat', n:'Kidney — creatinine', u:'mg/dL', hi:1.2, whi:1.25, g:'Kidney'},
  {k:'egfr',  n:'Kidney filter — eGFR', u:'mL/min', lo:90, wlo:75, g:'Kidney'},
  {k:'uric',  n:'Uric acid', u:'mg/dL', hi:6, whi:7, g:'Kidney'},
  {k:'tsh',   n:'Thyroid — TSH', u:'mIU/L', hi:4.0, whi:6, g:'Hormones & vitamins'},
  {k:'vitd',  n:'Vitamin D', u:'ng/mL', lo:30, wlo:20, g:'Hormones & vitamins'},
  {k:'b12',   n:'Vitamin B12', u:'pg/mL', lo:300, wlo:200, g:'Hormones & vitamins'},
  {k:'iron',  n:'Iron (serum)', u:'µg/dL', lo:65, hi:175, wlo:50, whi:200, g:'Hormones & vitamins'},
  {k:'ferritin', n:'Iron store (ferritin)', u:'ng/mL', lo:30, hi:300, wlo:20, whi:400, g:'Hormones & vitamins'},
  {k:'folate', n:'Folate (vitamin B9)', u:'ng/mL', lo:5.4, wlo:4, g:'Hormones & vitamins'},
  {k:'hb',    n:'Haemoglobin', u:'g/dL', lo:13, hi:17, wlo:12, whi:17.5, g:'Blood count'},
  {k:'pcv',   n:'Packed-cell volume (PCV)', u:'%', lo:40, hi:50, wlo:38, whi:52, g:'Blood count'},
  {k:'plt',   n:'Platelets', u:'×10³/µL', lo:150, hi:410, wlo:100, whi:450, g:'Blood count'},
  {k:'mcv',   n:'Red-cell size (MCV)', u:'fL', lo:80, hi:100, wlo:78, whi:104, g:'Blood count'},
  {k:'rdw',   n:'Red-cell spread (RDW)', u:'%', hi:14.5, whi:16, g:'Blood count'},
  {k:'bpsys', n:'Blood pressure — top number', u:'mmHg', hi:120, whi:130, g:'Heart'},
  {k:'bpdia', n:'Blood pressure — bottom number', u:'mmHg', hi:80, whi:85, g:'Heart'}
];

/* ---------- Reminder schedule (set up as iPhone Shortcuts automations) ---------- */
const REMINDERS = [
  ['07:00','☀️ Morning card · warm water · tongue scraper · weigh-in'],['08:30','🍳 Protein breakfast + seed mix — log it'],['11:00','💧 Water check — 1 L by now?'],
  ['13:00','🍛 Lunch + 10-min walk'],['16:30','🥜 Snack + water · Kegels set'],['19:15','🥣 Light dinner by 8'],
  ['21:30','📝 1-tap review · journal · Kegels · screens off'],['22:15','🛏️ Bed soon — side-sleeping']
];
