/* OJAS — coaches, exercise pictures, journey and badges.
   AI coach frames live in frames/*.jpg (made in Canva, downloaded by frames/get_batch1.py).
   Real-trainer photos (free public-domain library) are used for exercises that have no AI frames yet:
   first from frames/real/<ID>_0.jpg (after running frames/get_trainer_photos.py), otherwise from the internet. */

const COACHES = {
  riya:   {name:'Riya',   img:'frames/coaches/riya.jpg',   role:'Gym & legs',            line:'Strong legs, strong life. Let\'s go!'},
  kabir:  {name:'Kabir',  img:'frames/coaches/kabir.jpg',  role:'Gym & cardio',          line:'Steady effort beats big effort.'},
  vikram: {name:'Vikram', img:'frames/coaches/vikram.jpg', role:'Calisthenics & boxing', line:'Your body is your gym.'},
  anaya:  {name:'Anaya',  img:'frames/coaches/anaya.jpg',  role:'Yoga, breath & mind',   line:'Breathe slow. Move with the breath.'}
};
const COACH_FOR_CAT = {Gym:'kabir', Calisthenics:'vikram', Cardio:'kabir', Yoga:'anaya', Breath:'anaya', Meditation:'anaya', Mobility:'anaya', Pelvic:'anaya'};

/* AI coach frames (batch 1 + 2). say = words spoken on each frame of a multi-pose sequence (Surya Namaskar). coach overrides the category coach. cue = words spoken at the two halves of each rep. */
const AI_FRAMES = {
  'bw-squat':       {coach:'riya',   f:['frames/squat_1.jpg','frames/squat_2.jpg']},
  'goblet-squat':   {coach:'riya',   f:['frames/squat_1.jpg','frames/squat_2.jpg']},
  'sit-to-stand':   {coach:'riya',   f:['frames/squat_1.jpg','frames/squat_2.jpg']},
  'split-squat':    {coach:'riya',   f:['frames/lunge_1.jpg','frames/lunge_2.jpg']},
  'bulgarian':      {coach:'riya',   f:['frames/lunge_1.jpg','frames/lunge_2.jpg']},
  'hip-flexor':     {coach:'riya',   f:['frames/lunge_2.jpg']},
  'pushup':         {coach:'vikram', f:['frames/pushup_1.jpg','frames/pushup_2.jpg']},
  'diamond-pushup': {coach:'vikram', f:['frames/pushup_1.jpg','frames/pushup_2.jpg']},
  'plank':          {coach:'vikram', f:['frames/plank_1.jpg','frames/plank_2.jpg']},
  'db-row':         {coach:'kabir',  f:['frames/row_1.jpg','frames/row_2.jpg']},
  'shoulder-press': {coach:'kabir',  f:['frames/press_1.jpg','frames/press_2.jpg']},
  'glute-bridge':   {coach:'anaya',  f:['frames/bridge_1.jpg','frames/bridge_2.jpg']},
  'hip-thrust':     {coach:'anaya',  f:['frames/bridge_1.jpg','frames/bridge_2.jpg']},
  'setu-bandhasana':{coach:'anaya',  f:['frames/bridge_1.jpg','frames/bridge_2.jpg']},
  'marjaryasana':   {coach:'anaya',  f:['frames/catcow_1.jpg','frames/catcow_2.jpg'], tempo:6000,
                     cue:{en:['Breathe in, look up','Breathe out, round your back'], hi:['सांस लीजिए, ऊपर देखिए','सांस छोड़िए, पीठ गोल कीजिए']}},
  'surya-namaskar': {coach:'anaya',  tempo:30000,
                     f:['frames/surya_1.jpg','frames/armsup_1.jpg','frames/fold_1.jpg','frames/lowlunge_1.jpg','frames/yplank_1.jpg','frames/ashtanga_1.jpg',
                        'frames/surya_2.jpg','frames/dog_1.jpg','frames/lowlunge_1.jpg','frames/fold_1.jpg','frames/armsup_1.jpg','frames/surya_1.jpg'],
                     say:{en:['Prayer pose','Breathe in, arms up','Breathe out, fold forward','Breathe in, step back into lunge','Hold, plank','Knees, chest, chin down','Breathe in, cobra','Breathe out, downward dog','Breathe in, step forward into lunge','Breathe out, fold forward','Breathe in, rise up, arms up','Breathe out, prayer pose'],
                          hi:['प्रणाम आसन','सांस लीजिए, हाथ ऊपर','सांस छोड़िए, आगे झुकिए','सांस लीजिए, पैर पीछे','रुकिए, प्लैंक','घुटने, छाती, ठोड़ी नीचे','सांस लीजिए, भुजंगासन','सांस छोड़िए, पर्वतासन','सांस लीजिए, पैर आगे','सांस छोड़िए, आगे झुकिए','सांस लीजिए, हाथ ऊपर','सांस छोड़िए, प्रणाम']}},
  'bhujangasana':   {coach:'anaya',  f:['frames/surya_2.jpg']},
  'tadasana':       {coach:'anaya',  f:['frames/tadasana_1.jpg','frames/armsup_1.jpg'], tempo:8000, cue:{en:['Stand tall, breathe in','Stretch up, breathe out'], hi:['सीधे खड़े, सांस लीजिए','ऊपर खिंचिए, सांस छोड़िए']}},
  'vrikshasana':    {coach:'anaya',  f:['frames/tree_1.jpg']},
  'trikonasana':    {coach:'anaya',  f:['frames/triangle_1.jpg']},
  'virabhadrasana': {coach:'anaya',  f:['frames/warrior_1.jpg']},
  'naukasana':      {coach:'anaya',  f:['frames/boat_1.jpg']},
  'balasana':       {coach:'anaya',  f:['frames/child_1.jpg']},
  'paschimottanasana':{coach:'anaya',f:['frames/paschim_1.jpg']},
  'malasana':       {coach:'anaya',  f:['frames/malasana_1.jpg']},
  'body-scan':      {coach:'anaya',  f:['frames/shavasana_1.jpg']},
  'yoga-nidra':     {coach:'anaya',  f:['frames/shavasana_1.jpg']},
  'chin-tuck':      {coach:'anaya',  f:['frames/chin_1.jpg','frames/chin_2.jpg'], tempo:6000, cue:{en:['Pull your chin straight back, hold','Relax'], hi:['ठोड़ी सीधी पीछे, रोकिए','ढीला छोड़िए']}},
  'wall-angel':     {coach:'anaya',  f:['frames/wallangel_1.jpg','frames/wallangel_2.jpg'], tempo:5000},
  'boxing':         {coach:'vikram', f:['frames/boxing_1.jpg','frames/boxing_2.jpg']},
  'kegel':          {coach:'anaya',  f:['frames/kegel_1.jpg'], tempo:10000, cue:{en:['Squeeze and hold','Relax'], hi:['कसिए और रोकिए','ढीला छोड़िए']}},
  'reverse-kegel':  {coach:'anaya',  f:['frames/kegel_1.jpg'], tempo:8000, cue:{en:['Gently push out','Relax'], hi:['धीरे से बाहर की ओर','ढीला छोड़िए']}},
  'anulom-vilom':   {coach:'anaya',  f:['frames/anulom_1.jpg']},
  'bhramari':       {coach:'anaya',  f:['frames/bhramari_1.jpg'], tempo:8000, cue:{en:['Breathe in','Hum mmm'], hi:['सांस लीजिए','म्म्म गुनगुनाइए']}},
  'kapalbhati':     {coach:'anaya',  f:['frames/kegel_1.jpg'], tempo:1000},
  'ujjayi':         {coach:'anaya',  f:['frames/kegel_1.jpg']},
  'box-breathing':  {coach:'anaya',  f:['frames/kegel_1.jpg']},
  'mouth-throat':   {coach:'anaya',  f:['frames/kegel_1.jpg']},
  'breath-watch':   {coach:'anaya',  f:['frames/kegel_1.jpg']},
  'trataka':        {coach:'anaya',  f:['frames/trataka_1.jpg']}
};

/* Real-trainer photo IDs in the free exercise library (github.com/yuhonas/free-exercise-db, public domain). */
const FX_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const FX = {
  'bench-press':'Dumbbell_Bench_Press','incline-press':'Incline_Dumbbell_Press','lat-pulldown':'Wide-Grip_Lat_Pulldown','seated-row':'Seated_Cable_Rows',
  'lateral-raise':'Side_Lateral_Raise','bicep-curl':'Dumbbell_Bicep_Curl','tricep-pushdown':'Triceps_Pushdown','leg-press':'Leg_Press',
  'rdl':'Romanian_Deadlift','calf-raise':'Standing_Calf_Raises','incline-walk':'Walking_Treadmill','farmer-carry':'Farmers_Walk',
  'wall-pushup':'Pushups','incline-pushup':'Incline_Push-Up','knee-pushup':'Push-Ups_-_Close_Triceps_Position','dead-hang':'Pullups',
  'inverted-row':'Inverted_Row','negative-pullup':'Pullups','pullup':'Pullups','single-bridge':'Single_Leg_Glute_Bridge','dead-bug':'Dead_Bug',
  'side-plank':'Push_Up_to_Side_Plank','hollow-hold':'Dead_Bug','knee-raise':'Hanging_Leg_Raise','crunch':'Crunches','step-up':'Step-up_with_Knee_Raise',
  'jumping-jacks':'Star_Jump','burpee':'Mountain_Climbers','brisk-walk':'Walking_Treadmill','skipping':'Rope_Jumping','cycling':'Bicycling_Stationary'
};

/* Walking journey — approximate road distances, cumulative from Gurgaon. */
const JOURNEY = [
  {km:0,    name:'Gurgaon',           e:'🏠'},
  {km:32,   name:'India Gate, Delhi', e:'🏛️'},
  {km:180,  name:'Mathura',           e:'🛕'},
  {km:240,  name:'Taj Mahal, Agra',   e:'🕌'},
  {km:480,  name:'Jaipur',            e:'🏰'},
  {km:625,  name:'Pushkar',           e:'🐪'},
  {km:905,  name:'Udaipur',           e:'🛶'},
  {km:1165, name:'Ahmedabad',         e:'🪁'},
  {km:1690, name:'Mumbai',            e:'🌊'},
  {km:2280, name:'Goa',               e:'🏖️'},
  {km:2840, name:'Bengaluru',         e:'🌳'},
  {km:2985, name:'Mysuru Palace',     e:'👑'},
  {km:3420, name:'Kochi',             e:'⛵'},
  {km:3720, name:'Kanyakumari',       e:'🌅'}
];

/* Badges. test(st) gets the stats object built by the app. */
const BADGES = [
  {id:'first-meal',  e:'🍽️', name:'First meal logged',     test:s=>s.foodDays>=1},
  {id:'streak-3',    e:'🔥', name:'3-day logging streak',   test:s=>s.streak>=3},
  {id:'streak-7',    e:'🔥', name:'7-day logging streak',   test:s=>s.streak>=7},
  {id:'streak-30',   e:'🏆', name:'30-day streak',          test:s=>s.streak>=30},
  {id:'protein-1',   e:'💪', name:'Protein target hit',     test:s=>s.proteinDays>=1},
  {id:'protein-7',   e:'💪', name:'Protein target × 7 days',test:s=>s.proteinDays>=7},
  {id:'water-1',     e:'💧', name:'3 litres in a day',      test:s=>s.waterDays>=1},
  {id:'water-7',     e:'🌊', name:'Water goal × 7 days',    test:s=>s.waterDays>=7},
  {id:'steps-10k',   e:'👟', name:'First 10,000-step day',  test:s=>s.maxSteps>=10000},
  {id:'steps-100k',  e:'🚶', name:'1 lakh steps total',     test:s=>s.totalSteps>=100000},
  {id:'steps-1m',    e:'🏃', name:'10 lakh steps total',    test:s=>s.totalSteps>=1000000},
  {id:'workout-1',   e:'🏋️', name:'First workout',          test:s=>s.workouts>=1},
  {id:'workout-10',  e:'🏋️', name:'10 workouts',            test:s=>s.workouts>=10},
  {id:'workout-50',  e:'🥇', name:'50 workouts',            test:s=>s.workouts>=50},
  {id:'kg-1',        e:'⚖️', name:'First kilo down',        test:s=>s.kgLost>=1},
  {id:'kg-5',        e:'🎯', name:'5 kg down',              test:s=>s.kgLost>=5},
  {id:'kg-10',       e:'🚀', name:'10 kg down',             test:s=>s.kgLost>=10},
  {id:'kg-21',       e:'👑', name:'Goal weight reached',    test:s=>s.kgLost>=21}
].concat(JOURNEY.slice(1).map((j,i)=>({id:'stop-'+(i+1), e:j.e, name:'Walked to '+j.name.split(',')[0], test:s=>s.totalKm>=j.km, journey:true})));

/* Natural voice pack (pre-recorded by voices/make_voices.py). The app plays voices/<file>.mp3 when the exact sentence
   exists in voices/voices.json, otherwise it falls back to the phone's built-in voice. Keep sentences here in one place. */
const VOICE = {
  ids:    {en:{f:'en-IN-NeerjaNeural', m:'en-IN-PrabhatNeural'}, hi:{f:'hi-IN-SwaraNeural', m:'hi-IN-MadhurNeural'}},
  gender: {riya:'f', anaya:'f', kabir:'f', vikram:'f'},   // one warm, soft female coach voice for everything
  phrase: {
    en:{ready:'Get ready.', go:'Go!', rest:'Rest. Shake out, sip water, breathe.', next:'Next set coming.', half:'Halfway.', left10:'10 seconds left.',
        done:'Great work! Well done.', hello:'Hello! I am your Ojas coach.', test:'One, two, three. Great work!', keep:'Keep going, you are doing great.', nextEx:'Next exercise.', wdone:'Workout complete. Amazing work today!'},
    hi:{ready:'तैयार हो जाइए।', go:'शुरू!', rest:'आराम कीजिए। हाथ-पैर ढीले, थोड़ा पानी, लंबी सांस।', next:'अगला सेट आ रहा है।', half:'आधा हो गया।', left10:'दस सेकंड बाकी।',
        done:'शाबाश! बहुत बढ़िया।', hello:'नमस्ते! मैं आपका ओजस कोच हूँ।', test:'एक, दो, तीन। शाबाश!', keep:'बहुत बढ़िया, ऐसे ही चलते रहिए।', nextEx:'अगली एक्सरसाइज़।', wdone:'वर्कआउट पूरा हुआ। आज बहुत बढ़िया किया!'}
  },
  setGo:  {en:n=>`Set ${n}. Go!`, hi:n=>`सेट ${n}। शुरू!`},
  minLeft:{en:m=>`${m} ${m>1?'minutes':'minute'} left.`, hi:m=>`${m} मिनट बाकी।`},
  intro(e, lang){ return lang==='hi' ? `${e.hi||e.en}। तैयार हो जाइए।` : `${e.en}. ${(e.steps||[]).slice(0,3).join(' ')} Get ready.`; },
  maxCount: 60
};
