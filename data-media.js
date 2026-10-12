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

/* AI coach frames (batch 1). coach overrides the category coach. cue = words spoken at the two halves of each rep. */
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
  'surya-namaskar': {coach:'anaya',  f:['frames/surya_1.jpg','frames/surya_2.jpg'], tempo:9000},
  'bhujangasana':   {coach:'anaya',  f:['frames/surya_2.jpg']},
  'kegel':          {coach:'anaya',  f:['frames/kegel_1.jpg'], tempo:10000, cue:{en:['Squeeze and hold','Relax'], hi:['कसिए और रोकिए','ढीला छोड़िए']}},
  'reverse-kegel':  {coach:'anaya',  f:['frames/kegel_1.jpg'], tempo:8000, cue:{en:['Gently push out','Relax'], hi:['धीरे से बाहर की ओर','ढीला छोड़िए']}},
  'anulom-vilom':   {coach:'anaya',  f:['frames/kegel_1.jpg']},
  'bhramari':       {coach:'anaya',  f:['frames/kegel_1.jpg'], tempo:8000, cue:{en:['Breathe in','Hum mmm'], hi:['सांस लीजिए','म्म्म गुनगुनाइए']}},
  'kapalbhati':     {coach:'anaya',  f:['frames/kegel_1.jpg'], tempo:1000},
  'ujjayi':         {coach:'anaya',  f:['frames/kegel_1.jpg']},
  'box-breathing':  {coach:'anaya',  f:['frames/kegel_1.jpg']},
  'mouth-throat':   {coach:'anaya',  f:['frames/kegel_1.jpg']},
  'breath-watch':   {coach:'anaya',  f:['frames/kegel_1.jpg']},
  'trataka':        {coach:'anaya',  f:['frames/kegel_1.jpg']}
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
  'jumping-jacks':'Star_Jump','burpee':'Mountain_Climbers','brisk-walk':'Walking_Treadmill','skipping':'Rope_Jumping','cycling':'Bicycling_Stationary',
  'balasana':'Childs_Pose','paschimottanasana':'Seated_Hamstring_and_Calf_Stretch','malasana':'Bodyweight_Squat'
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
