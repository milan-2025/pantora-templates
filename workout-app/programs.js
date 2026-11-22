/* ---------- exercises, animated figures and the six challenges ---------- */
/* A pose is 11 joints in a 100×100 box (ground at y≈91): head, neck, hip, front knee, front foot, back knee, back foot,
   front elbow, front hand, back elbow, back hand. "|n" bends the back (+ = sags down, − = rounds up). */
const STAND = '50,16 50,26 50,54 51,72 52,91 49,72 48,91 51,40 52,53 49,40 48,53';
const STAND_F = '50,16 50,26 50,54 53,72 54,91 47,72 46,91 54,40 55,53 46,40 45,53';
const ARMS_UP = '50,16 50,26 50,54 51,72 52,91 49,72 48,91 51,14 52,4 49,14 48,4';
const SQUAT_DOWN = '54,27 50,36 38,64 56,66 52,91 55,67 50,91 60,38 71,37 59,39 70,38';
const PLANK_HIGH = '73,66 66,70 40,77 27,84 14,90 27,84 14,90 67,80 67,90 66,80 66,90';
const SEAT = '50,44 50,54 50,82 66,86 44,90 34,86 56,90 62,70 66,84 38,70 34,84';

const EX = {
  march: { n: 'March on the spot', p: ['50,16 50,26 50,54 61,62 59,78 49,72 48,91 46,40 43,50 55,38 61,45', '50,16 50,26 50,54 51,72 52,91 61,62 59,78 55,38 61,45 46,40 43,50'], t: 900, cues: ['Lift your knees to hip height', 'Swing your arms', 'Breathe easy'] },
  jacks: { n: 'Jumping jacks', p: ['50,16 50,26 50,54 53,72 54,91 47,72 46,91 54,40 55,53 46,40 45,53', '50,15 50,25 50,53 59,72 65,91 41,72 35,91 59,17 63,6 41,17 37,6'], t: 700, cues: ['Land softly on your toes', 'Arms all the way up'], easier: 'stepjacks' },
  stepjacks: { n: 'Step jacks (no jump)', p: ['50,16 50,26 50,54 53,72 54,91 47,72 46,91 54,40 55,53 46,40 45,53', '50,16 50,26 50,54 53,72 54,91 41,72 36,91 59,18 63,7 41,18 37,7'], t: 1000, cues: ['Step one foot out as your arms go up', 'Keep it smooth'], harder: 'jacks' },
  squat: { n: 'Squats', p: ['50,16 50,26 50,54 51,72 52,91 49,72 48,91 60,29 70,29 59,30 69,30', SQUAT_DOWN], t: 2200, cues: ['Sit back like into a chair', 'Knees follow your toes', 'Chest up, heels down'], easier: 'chairsquat', harder: 'jumpsquat' },
  chairsquat: { n: 'Chair squats', p: ['50,16 50,26 50,54 51,72 52,91 49,72 48,91 60,29 70,29 59,30 69,30', '54,29 50,38 38,66 56,67 52,91 55,68 50,91 60,40 71,39 59,41 70,40'], prop: 'stool', t: 2400, cues: ['Touch the chair lightly, then stand', 'Push through your heels'], harder: 'squat' },
  wallpush: { n: 'Wall push-ups', p: ['64,24 60,32 51,60 46,76 40,91 45,76 39,91 71,33 81,34 70,34 81,35', '72,26 68,33 55,60 47,76 40,91 46,76 39,91 69,43 81,34 68,44 81,35'], prop: 'wall', t: 2000, cues: ['Body in one straight line', 'Chest to the wall, then push away'], harder: 'kneepush' },
  kneepush: { n: 'Knee push-ups', p: ['73,64 66,68 41,76 30,90 18,82 30,90 18,82 67,79 67,90 66,79 66,90', '73,79 66,82 42,83 30,90 18,82 30,90 18,82 57,79 66,90 56,79 65,90'], t: 2000, cues: ['Straight line from knees to head', 'Lower your chest, not your hips'], easier: 'wallpush', harder: 'pushup' },
  pushup: { n: 'Push-ups', p: [PLANK_HIGH, '73,80 66,83 40,85 27,88 14,90 27,88 14,90 57,80 66,90 56,80 65,90'], t: 2000, cues: ['Hands under shoulders', 'Elbows back at 45°', 'Tight tummy'], easier: 'kneepush' },
  bridge: { n: 'Glute bridges', p: ['14,85 22,87 46,88 60,72 66,90 59,72 65,90 31,89 40,90 31,89 40,90', '14,84 22,86 46,71 61,68 66,90 60,68 65,90 31,89 40,90 31,89 40,90'], t: 2000, cues: ['Squeeze your glutes at the top', 'Push through your heels'] },
  plank: { n: 'Plank', p: ['72,71 64,74 40,79 27,85 14,90 27,85 14,90 63,90 74,90 62,90 73,90', '72,72 64,75 40,80 27,85 14,90 27,85 14,90 63,90 74,90 62,90 73,90'], t: 3000, hold: 1, cues: ['Elbows under shoulders', 'Hips level, don’t let them sag', 'Keep breathing'], easier: 'kneeplank' },
  kneeplank: { n: 'Knee plank', p: ['72,71 64,74 42,80 30,90 18,82 30,90 18,82 63,90 74,90 62,90 73,90', '72,72 64,75 42,81 30,90 18,82 30,90 18,82 63,90 74,90 62,90 73,90'], t: 3000, hold: 1, cues: ['Knees down, body straight from knees to head'], harder: 'plank' },
  sideplank: { n: 'Side plank', p: ['74,62 66,66 42,77 28,84 14,90 28,83 14,89 66,90 76,90 66,53 66,40', '74,60 66,64 42,73 28,82 14,90 28,81 14,89 66,90 76,90 66,51 66,38'], t: 3000, hold: 1, side: 1, cues: ['Lift your hips high', 'Switch sides halfway'] },
  lunge: { n: 'Reverse lunges', p: [STAND, '49,28 49,38 48,66 62,68 62,91 40,86 28,90 52,52 54,65 46,52 45,65'], t: 2400, cues: ['Step back, drop the back knee', 'Front knee over the ankle', 'Alternate legs'] },
  calf: { n: 'Calf raises', p: [STAND, '50,12 50,22 50,50 51,68 53,88 49,68 49,88 51,36 52,49 49,36 48,49'], t: 1500, cues: ['Rise up tall on your toes', 'Lower slowly'] },
  superman: { n: 'Superman', p: ['80,86 72,88 46,89 30,90 14,90 30,90 14,90 84,87 94,87 84,88 94,88', '80,80 72,84 46,89 30,86 14,81 30,86 14,82 84,80 94,76 84,81 94,77'], t: 2400, cues: ['Lift arms and legs together', 'Look at the floor'] },
  birddog: { n: 'Bird dog', p: ['72,58 66,62 38,64 38,90 22,90 38,90 22,90 66,76 66,90 66,76 66,90', '73,58 66,62 38,64 38,90 22,90 23,64 8,62 79,60 91,58 66,76 66,90'], t: 2600, cues: ['Reach opposite arm and leg', 'Keep your back flat like a table'] },
  deadbug: { n: 'Dead bug', p: ['14,85 22,87 46,88 46,70 60,70 46,70 60,70 22,75 22,62 22,75 22,62', '14,85 22,87 46,88 62,82 78,85 46,70 60,70 22,75 22,62 14,77 5,82'], t: 2600, cues: ['Lower back pressed to the floor', 'Move slowly, opposite arm and leg'] },
  crunch: { n: 'Crunches', p: ['16,84 24,87 46,88 60,72 68,90 59,72 67,90 18,78 14,85 19,78 15,85', '27,73 32,80 46,88 60,72 68,90 59,72 67,90 28,68 23,75 29,68 24,75'], t: 1800, cues: ['Lift your shoulders, not your neck', 'Breathe out as you curl up'] },
  bicycle: { n: 'Bicycle crunches', p: ['27,73 32,80 46,88 55,72 64,78 64,82 82,84 28,68 23,75 29,68 24,75', '27,73 32,80 46,88 64,82 82,84 55,72 64,78 28,68 23,75 29,68 24,75'], t: 1400, cues: ['Elbow towards the opposite knee', 'Slow and controlled'] },
  legraise: { n: 'Leg raises', p: ['14,85 22,87 46,88 62,87 78,85 62,87 78,85 32,89 42,90 32,89 42,90', '14,85 22,87 46,88 49,70 51,52 49,70 51,52 32,89 42,90 32,89 42,90'], t: 2600, cues: ['Lower back stays down', 'Bend the knees a little if needed'] },
  climber: { n: 'Mountain climbers', p: ['73,66 66,70 40,77 54,80 46,88 27,84 14,90 67,80 67,90 66,80 66,90', '73,66 66,70 40,77 27,84 14,90 54,80 46,88 67,80 67,90 66,80 66,90'], t: 600, cues: ['Drive your knees to your chest', 'Hips down, shoulders over hands'] },
  burpee: { n: 'Burpees', p: ['50,14 50,24 50,52 51,71 52,90 49,71 48,90 52,12 54,3 48,12 46,3', PLANK_HIGH], t: 1800, cues: ['Hands down, jump back, jump in, jump up', 'Step back instead of jumping if needed'], easier: 'squat' },
  jumpsquat: { n: 'Squat jumps', p: [SQUAT_DOWN, '50,11 50,21 50,49 51,67 53,85 49,67 47,85 53,10 55,2 47,10 45,2'], t: 1300, cues: ['Explode up, land softly', 'Go straight into the next squat'], easier: 'squat' },
  highknees: { n: 'High knees', p: ['50,15 50,25 50,53 62,56 60,72 49,71 48,90 46,39 44,48 56,36 62,42', '50,15 50,25 50,53 51,71 52,90 62,56 60,72 56,36 62,42 46,39 44,48'], t: 500, cues: ['Knees up fast', 'Stay on the balls of your feet'], easier: 'march' },
  skater: { n: 'Skater hops', p: ['40,20 42,30 42,58 40,74 40,91 50,76 58,88 34,44 28,54 52,40 58,46', 'M'], t: 1100, cues: ['Hop side to side', 'Land on one leg, stay low'] },
  wallsit: { n: 'Wall sit', p: ['35,40 35,48 34,72 56,72 56,91 55,72 55,91 44,62 53,70 44,62 52,70', '35,41 35,49 34,72 56,72 56,91 55,72 55,91 44,63 53,70 44,63 52,70'], prop: 'wallL', t: 3000, hold: 1, cues: ['Back flat on the wall', 'Thighs parallel to the floor'] },
  dips: { n: 'Chair dips', p: ['46,36 45,44 46,66 64,66 66,91 63,66 65,91 40,55 37,66 40,55 37,66', '46,47 45,55 46,78 64,73 66,91 63,73 65,91 31,55 37,66 31,55 37,66'], prop: 'chair', t: 2200, cues: ['Use a steady chair', 'Elbows point back'] },
  boxing: { n: 'Shadow boxing', p: ['50,16 50,26 50,54 56,72 60,91 45,72 40,91 57,38 59,30 54,40 56,32', '51,16 51,26 50,54 56,72 60,91 45,72 40,91 64,28 77,27 54,40 56,32'], t: 550, cues: ['Fast punches, hands back to your face', 'Stay light on your feet'] },
  armcircle: { n: 'Arm circles', p: ['50,16 50,26 50,54 53,72 54,91 47,72 46,91 63,27 76,26 37,27 24,26', '50,16 50,26 50,54 53,72 54,91 47,72 46,91 63,25 76,20 37,25 24,20'], t: 500, cues: ['Small circles, then bigger', 'Switch direction halfway'] },
  toetouch: { n: 'Forward fold', p: [ARMS_UP, '59,80 57,72 46,53 49,72 50,91 48,72 49,91 57,82 54,90 56,82 53,90'], t: 3200, cues: ['Soft knees', 'Let your head hang'] },
  catcow: { n: 'Cat-cow', p: ['74,54 66,62 38,64 38,90 22,90 38,90 22,90 66,76 66,90 66,76 66,90|5', '70,70 66,64 38,64 38,90 22,90 38,90 22,90 66,77 66,90 66,77 66,90|-9'], t: 3400, cues: ['Breathe in: belly down, look up', 'Breathe out: round your back'] },
  child: { n: 'Child’s pose', p: ['64,86 57,81 30,80 42,90 22,90 42,90 22,90 72,88 86,90 72,88 86,90|-4', '64,85 57,80 30,79 42,90 22,90 42,90 22,90 72,88 86,90 72,88 86,90|-5'], t: 4000, hold: 1, cues: ['Sit back on your heels', 'Arms long, forehead down', 'Slow, deep breaths'] },
  downdog: { n: 'Downward dog', p: ['69,80 64,73 46,50 34,70 22,90 34,70 22,90 69,82 75,90 69,82 75,90', '69,79 64,72 46,48 34,69 22,90 34,69 22,90 69,81 75,90 69,81 75,90'], t: 4000, hold: 1, cues: ['Hips up and back', 'Press the floor away', 'Bend your knees if your back rounds'] },
  cobra: { n: 'Cobra', p: ['74,78 66,82 44,89 28,90 12,90 28,90 12,90 62,86 66,90 62,86 66,90', '72,64 66,72 44,88 28,90 12,90 28,90 12,90 66,82 68,90 66,82 68,90|3'], t: 3600, cues: ['Lift your chest gently', 'Shoulders away from your ears'] },
  warrior: { n: 'Warrior II', p: ['50,22 50,32 50,60 65,72 74,91 35,76 22,91 64,32 79,32 36,32 21,32', '50,23 50,33 50,61 65,73 74,91 35,76 22,91 64,33 79,33 36,33 21,33'], t: 4000, hold: 1, side: 1, cues: ['Front knee over the ankle', 'Arms strong and level', 'Switch sides halfway'] },
  tree: { n: 'Tree pose', p: ['50,18 50,28 50,55 64,66 51,71 49,73 49,91 54,30 50,40 46,30 50,40', '50,18 50,28 50,55 64,66 51,71 49,73 49,91 56,14 50,5 44,14 50,5'], t: 4000, hold: 1, side: 1, cues: ['Foot on the calf or thigh, never the knee', 'Look at one spot', 'Switch sides halfway'] },
  chairpose: { n: 'Chair pose', p: [ARMS_UP, '55,27 52,35 41,62 56,67 53,91 55,68 51,91 58,20 63,10 57,21 62,11'], t: 3600, cues: ['Sit back, arms up', 'Weight in your heels'] },
  butterfly: { n: 'Butterfly stretch', p: ['49,48 48,58 45,86 62,77 56,90 61,77 55,90 54,72 56,88 53,72 55,88', '49,49 48,59 45,86 64,84 56,90 63,84 55,90 54,73 56,88 53,73 55,88'], t: 2600, cues: ['Soles of the feet together', 'Let your knees drop gently'] },
  hamstring: { n: 'Seated forward reach', p: ['33,50 32,60 30,88 50,89 70,89 50,89 70,89 45,68 57,74 45,68 57,74', '55,69 47,73 30,88 50,89 70,89 50,89 70,89 60,80 70,86 60,80 70,86|-5'], t: 4000, cues: ['Reach for your toes', 'Long back, no bouncing'] },
  twist: { n: 'Seated twist', p: [SEAT, '50,44 50,54 50,82 66,86 44,90 34,86 56,90 58,62 40,72 34,66 30,80'], t: 3600, side: 1, cues: ['Sit tall, twist from the middle', 'Switch sides halfway'] },
  breathe: { n: 'Deep breathing', p: [SEAT, '50,43 50,53 50,82 66,86 44,90 34,86 56,90 63,69 66,84 37,69 34,84'], t: 5000, hold: 1, cues: ['In for 4… out for 6', 'Relax your shoulders'] },
  walk: { n: 'Brisk walk', p: ['51,16 51,26 50,54 56,72 60,91 46,72 42,91 46,40 44,52 55,40 59,50', '51,16 51,26 50,54 46,72 42,91 56,72 60,91 55,40 59,50 46,40 44,52'], t: 1100, cues: ['Walk like you’re a bit late', 'You can talk, but not sing'] },
  jog: { n: 'Run', p: ['53,16 52,26 49,54 60,66 58,82 44,74 36,86 44,42 40,50 58,40 62,32', '53,16 52,26 49,54 44,74 36,86 60,66 58,82 58,40 62,32 44,42 40,50'], t: 700, cues: ['Easy pace: you should be able to talk', 'Short, light steps'] },
  garba: { n: 'Garba steps', p: ['50,16 50,26 50,54 56,72 62,91 47,72 46,91 58,18 52,8 42,18 48,8', '50,16 50,26 50,54 53,72 54,91 44,72 38,91 60,36 56,44 40,36 44,44'], t: 900, cues: ['Step side to side and clap high, then low', 'Turn a little with each clap', 'Smile, it’s a festival!'] },
  dandiya: { n: 'Dandiya strikes', p: ['50,16 50,26 50,54 53,72 54,91 47,72 46,91 62,30 72,22 40,34 34,28', '50,16 50,26 50,54 56,72 60,91 45,72 40,91 60,34 66,28 38,30 28,22'], t: 700, cues: ['Twist from the waist and strike left, then right', 'Bounce on soft knees'] },
  bhangra: { n: 'Bhangra bounce', p: ['50,15 50,25 50,53 60,58 58,74 49,71 48,90 60,16 64,6 40,16 36,6', '50,16 50,26 50,54 51,72 52,91 40,58 42,74 62,18 66,8 38,18 34,8'], t: 650, cues: ['Arms up, shoulders bouncing', 'Lift one knee, then the other', 'Balle balle!'] },
  quad: { n: 'Standing quad stretch', p: ['50,16 50,26 50,54 50,72 52,91 48,74 36,62 60,36 70,30 42,48 37,60', '50,16 50,26 50,54 50,72 52,91 48,74 35,60 60,35 70,29 42,48 36,58'], t: 4000, hold: 1, side: 1, cues: ['Hold a wall for balance', 'Knees together', 'Switch legs halfway'] },
};

const PHASES = ['Foundation', 'Build', 'Strengthen', 'Peak'];
const r = (ex, reps) => ({ ex, reps });
const s = (ex, secs) => ({ ex, secs });
const scale = (v, k) => Math.max(1, Math.round(v * k));

/* ----- session builders: each returns { title, kind, blocks: [{ label, rounds, rest, items }] } ----- */
const WARM = [s('march', 60), s('armcircle', 30)];
const COOL = [s('quad', 40), s('hamstring', 40), s('child', 40)];
const MOBILITY = { title: 'Mobility & recovery', kind: 'rest', blocks: [{ label: 'Easy flow', rounds: 1, rest: 10, items: [s('catcow', 60), s('downdog', 40), s('cobra', 30), s('child', 45), s('butterfly', 45), s('twist', 40), s('breathe', 60)] }] };

function homeSession(type, ph, k) {
  const push = ['wallpush', 'kneepush', 'kneepush', 'pushup'][ph];
  const rounds = [2, 2, 3, 3][ph];
  if (type === 'A') return { title: 'Full body', kind: 'circuit', blocks: [{ label: 'Warm-up', rounds: 1, rest: 10, items: WARM }, { label: 'Circuit', rounds, rest: 60, items: [r('squat', scale(10, k)), r(push, scale(8, k)), r('bridge', scale(12, k)), s(ph ? 'plank' : 'kneeplank', scale(20, k)), s(ph > 1 ? 'jacks' : 'stepjacks', scale(30, k))] }, { label: 'Cool-down', rounds: 1, rest: 5, items: COOL }] };
  return { title: 'Legs & core', kind: 'circuit', blocks: [{ label: 'Warm-up', rounds: 1, rest: 10, items: WARM }, { label: 'Circuit', rounds, rest: 60, items: [r('lunge', scale(10, k)), r('calf', scale(15, k)), r('birddog', scale(10, k)), r('deadbug', scale(10, k)), s('wallsit', scale(20, k)), r(ph > 1 ? 'superman' : 'bridge', scale(10, k))] }, { label: 'Cool-down', rounds: 1, rest: 5, items: COOL }] };
}

function walkSession(type, ph, k) {
  const base = Math.round([20, 25, 30, 40][ph] * k);
  if (type === 'I') {
    const sets = Math.max(4, Math.round(base / 3));
    return { title: 'Walk intervals', kind: 'cardio', blocks: [{ label: 'Warm-up', rounds: 1, rest: 0, items: [s('walk', 180)] }, { label: 'Brisk 2 min · Fast 1 min', rounds: sets, rest: 0, items: [s('walk', 120), { ex: 'walk', secs: 60, fast: 1 }] }, { label: 'Cool-down', rounds: 1, rest: 0, items: [s('walk', 120), s('quad', 40), s('hamstring', 40)] }] };
  }
  if (type === 'L') return { title: 'Long walk', kind: 'cardio', blocks: [{ label: 'Steady walk', rounds: 1, rest: 0, items: [s('walk', (base + 15) * 60)] }, { label: 'Stretch', rounds: 1, rest: 0, items: [s('quad', 40), s('hamstring', 40)] }] };
  return { title: 'Brisk walk', kind: 'cardio', blocks: [{ label: 'Walk', rounds: 1, rest: 0, items: [s('walk', base * 60)] }, { label: 'Stretch', rounds: 1, rest: 0, items: [s('calf', 30), s('quad', 40)] }] };
}

/** Couch to 5K: run/walk sets that grow into 30 minutes of running, spread over however many run days the challenge has. */
function runSession(p, k) {
  const blocks = [{ label: 'Warm-up walk', rounds: 1, rest: 0, items: [s('walk', 300)] }];
  if (p < 0.72) {
    const run = Math.round((60 + p * 440) * k / 10) * 10, walk = Math.max(60, Math.round((150 - p * 110) / 10) * 10);
    const sets = Math.max(4, Math.min(8, Math.round(1500 / (run + walk))));
    blocks.push({ label: `Run ${fmtDur(run)} · Walk ${fmtDur(walk)}`, rounds: sets, rest: 0, items: [s('jog', run), s('walk', walk)] });
  } else {
    const mins = Math.round(Math.min(30, 15 + ((p - 0.72) / 0.28) * 15) * k);
    blocks.push({ label: `Run ${mins} min without stopping`, rounds: 1, rest: 0, items: [s('jog', mins * 60)] });
  }
  blocks.push({ label: 'Cool-down', rounds: 1, rest: 0, items: [s('walk', 300), s('quad', 40), s('hamstring', 40)] });
  return { title: 'Run day', kind: 'cardio', blocks };
}

function yogaSession(type, ph, k) {
  const h = (n) => scale(n * [1, 1.2, 1.4, 1.6][ph], k);
  if (type === 'A') return { title: 'Morning flow', kind: 'flow', blocks: [{ label: 'Flow', rounds: ph > 1 ? 2 : 1, rest: 10, items: [s('breathe', 60), s('catcow', h(45)), s('downdog', h(30)), s('cobra', h(25)), s('chairpose', h(20)), s('warrior', h(40)), s('tree', h(30)), s('hamstring', h(40)), s('child', 60)] }] };
  return { title: 'Hips & back', kind: 'flow', blocks: [{ label: 'Flow', rounds: ph > 1 ? 2 : 1, rest: 10, items: [s('catcow', h(45)), s('birddog', h(30)), s('bridge', h(30)), s('butterfly', h(45)), s('twist', h(40)), s('quad', h(40)), s('downdog', h(30)), s('breathe', 90)] }] };
}

function coreSession(type, ph, k) {
  const rounds = [2, 3, 3, 4][ph];
  if (type === 'A') return { title: 'Abs blast', kind: 'circuit', blocks: [{ label: 'Warm-up', rounds: 1, rest: 10, items: WARM }, { label: 'Circuit', rounds, rest: 45, items: [r('crunch', scale(12, k)), r('bicycle', scale(16, k)), s('plank', scale(25, k)), r('legraise', scale(8, k)), r('deadbug', scale(10, k))] }, { label: 'Cool-down', rounds: 1, rest: 5, items: [s('cobra', 30), s('child', 40)] }] };
  return { title: 'Core & back', kind: 'circuit', blocks: [{ label: 'Warm-up', rounds: 1, rest: 10, items: WARM }, { label: 'Circuit', rounds, rest: 45, items: [s('climber', scale(25, k)), r('birddog', scale(12, k)), r('superman', scale(10, k)), s('sideplank', scale(30, k)), r('bridge', scale(15, k))] }, { label: 'Cool-down', rounds: 1, rest: 5, items: [s('catcow', 40), s('child', 40)] }] };
}

function hiitSession(type, ph, k) {
  const work = [20, 30, 35, 40][ph], rest = [40, 30, 25, 20][ph], rounds = [2, 3, 3, 4][ph];
  if (type === 'C') return { title: 'Cardio boxing', kind: 'intervals', work, restSec: rest, blocks: [{ label: 'Warm-up', rounds: 1, rest: 10, items: WARM }, { label: `${work}s on · ${rest}s off`, rounds, rest: 60, items: [s('boxing', work), s('highknees', work), s('boxing', work), s('skater', work)] }, { label: 'Cool-down', rounds: 1, rest: 5, items: COOL }] };
  const list = ph < 2 ? ['jacks', 'squat', 'highknees', 'kneepush', 'climber', 'skater'] : ['jacks', 'jumpsquat', 'highknees', 'pushup', 'climber', 'burpee'];
  return { title: 'Fat-burn HIIT', kind: 'intervals', work, restSec: rest, blocks: [{ label: 'Warm-up', rounds: 1, rest: 10, items: WARM }, { label: `${work}s on · ${rest}s off`, rounds, rest: 60, items: list.map((e) => s(e, Math.round(work * k))) }, { label: 'Cool-down', rounds: 1, rest: 5, items: COOL }] };
}

/* ----- festival and wedding challenges ----- */
const DANCE = (k, secs) => [s('garba', scale(secs, k)), s('dandiya', scale(secs, k)), s('bhangra', scale(Math.round(secs * 0.8), k)), s('highknees', scale(Math.round(secs * 0.5), k)), s('garba', scale(secs, k))];
function navratriSession(type, ph, k) {
  if (type === 'F') return { title: 'Garba flow & stretch', kind: 'rest', blocks: [{ label: 'Easy dance', rounds: 1, rest: 10, items: [s('garba', 60), s('dandiya', 45)] }, { label: 'Stretch', rounds: 1, rest: 5, items: [s('quad', 40), s('hamstring', 40), s('butterfly', 40), s('breathe', 60)] }] };
  const secs = [35, 40, 45, 50][ph], rounds = [2, 3, 3, 4][ph];
  return { title: type === 'B' ? 'Bhangra burn' : 'Garba cardio', kind: 'intervals', work: secs, restSec: 20, blocks: [{ label: 'Warm-up', rounds: 1, rest: 10, items: WARM }, { label: `Dance ${secs}s · breathe 20s`, rounds, rest: 45, items: type === 'B' ? [s('bhangra', scale(secs, k)), s('jacks', scale(secs, k)), s('bhangra', scale(secs, k)), s('skater', scale(secs - 10, k))] : DANCE(k, secs) }, { label: 'Cool-down', rounds: 1, rest: 5, items: COOL }] };
}
function diwaliSession(type, ph, k) {
  const rounds = [2, 2, 3, 3][ph], push = ph < 2 ? 'kneepush' : 'pushup';
  if (type === 'A') return { title: 'Glow-up full body', kind: 'circuit', blocks: [{ label: 'Warm-up', rounds: 1, rest: 10, items: WARM }, { label: 'Circuit', rounds, rest: 50, items: [s('jacks', scale(30, k)), r('squat', scale(12, k)), r(push, scale(8, k)), s('climber', scale(25, k)), s('plank', scale(25, k))] }, { label: 'Cool-down', rounds: 1, rest: 5, items: COOL }] };
  if (type === 'B') return { title: 'Sculpt & core', kind: 'circuit', blocks: [{ label: 'Warm-up', rounds: 1, rest: 10, items: WARM }, { label: 'Circuit', rounds, rest: 50, items: [r('lunge', scale(10, k)), r('bridge', scale(14, k)), r('bicycle', scale(16, k)), s('sideplank', scale(25, k)), r('superman', scale(10, k))] }, { label: 'Cool-down', rounds: 1, rest: 5, items: COOL }] };
  return { title: 'Festive dance cardio', kind: 'intervals', work: 40, restSec: 20, blocks: [{ label: 'Warm-up', rounds: 1, rest: 10, items: WARM }, { label: 'Dance 40s · breathe 20s', rounds: rounds + 1, rest: 45, items: [s('bhangra', scale(40, k)), s('boxing', scale(40, k)), s('garba', scale(40, k)), s('skater', scale(30, k))] }, { label: 'Cool-down', rounds: 1, rest: 5, items: COOL }] };
}
function shaadiSession(type, ph, k) {
  const rounds = [2, 3, 3, 4][ph], push = ['wallpush', 'kneepush', 'kneepush', 'pushup'][ph];
  if (type === 'S') return { title: 'Sculpt: arms, back & legs', kind: 'circuit', blocks: [{ label: 'Warm-up', rounds: 1, rest: 10, items: WARM }, { label: 'Circuit', rounds, rest: 50, items: [r('squat', scale(12, k)), r(push, scale(10, k)), r('dips', scale(10, k)), r('lunge', scale(10, k)), r('superman', scale(10, k)), s('plank', scale(30, k))] }, { label: 'Cool-down', rounds: 1, rest: 5, items: COOL }] };
  if (type === 'C') return ph < 2 ? walkSession('I', ph, k) : hiitSession('H', ph, k);
  return { title: 'Posture & glow yoga', kind: 'flow', blocks: [{ label: 'Flow', rounds: ph > 1 ? 2 : 1, rest: 10, items: [s('breathe', 60), s('catcow', 45), s('cobra', 30), s('warrior', 40), s('chairpose', 30), s('tree', 30), s('downdog', 40), s('child', 60)] }] };
}

/* ----- the challenges ----- */
const PROGRAMS = {
  home: {
    name: 'Beginner Home Workout', emoji: '🏠', level: 'Beginner', gear: 'No equipment', color: '#FF5A36',
    blurb: 'Bodyweight strength at home: squats, push-ups, bridges and planks that get harder every phase.',
    week: ['A', 'B', 'A', 'M', 'B', 'A', 'M'], make: homeSession,
    tests: [{ id: 'pushups', name: 'Push-ups in one go', unit: 'reps', up: 1, how: 'Wall, knee or full: note which. Stop when form breaks.' }, { id: 'squats1', name: 'Squats in 1 minute', unit: 'reps', up: 1, how: 'Full squats, chest up.' }, { id: 'plank', name: 'Plank hold', unit: 'sec', up: 1, how: 'Until your hips drop.' }],
  },
  walk: {
    name: 'Walking & Steps', emoji: '🚶', level: 'Gentle', gear: 'Comfortable shoes', color: '#22C55E',
    blurb: 'Brisk walks, interval walks and one long walk a week. Great for starting out or coming back.',
    week: ['W', 'I', 'W', 'M', 'W', 'L', 'M'], make: walkSession,
    tests: [{ id: 'walk1k', name: '1 km brisk walk', unit: 'min', up: 0, how: 'Walk 1 km as fast as you comfortably can.' }, { id: 'steps', name: 'Steps on a normal day', unit: 'steps', up: 1, how: 'From your phone or watch.' }, { id: 'pulse', name: 'Resting pulse', unit: 'bpm', up: 0, how: 'Count for 30 seconds after waking, ×2.' }],
  },
  c25k: {
    name: 'Couch to 5K', emoji: '🏃', level: 'Beginner+', gear: 'Running shoes', color: '#3B82F6',
    blurb: 'Run/walk intervals that build to 30 minutes of running. Three runs a week, recovery in between.',
    week: ['R', 'M', 'R', 'W', 'R', 'M', 'X'], make: null,
    tests: [{ id: 'runmins', name: 'Longest run without stopping', unit: 'min', up: 1, how: 'Easy pace. Stop when you need to walk.' }, { id: 'run1k', name: '1 km time', unit: 'min', up: 0, how: 'Run/walk 1 km, note the time.' }],
  },
  yoga: {
    name: 'Yoga & Flexibility', emoji: '🧘', level: 'Gentle', gear: 'A mat or towel', color: '#A855F7',
    blurb: 'Calm daily flows for mobility, balance and stress. Holds get longer as you get bendier.',
    week: ['A', 'B', 'A', 'M', 'B', 'A', 'M'], make: yogaSession,
    tests: [{ id: 'reach', name: 'Sit and reach', unit: 'cm', up: 1, how: 'Seated, legs straight: cm past your toes (minus if short).' }, { id: 'balance', name: 'Balance on one leg', unit: 'sec', up: 1, how: 'Eyes open, weaker leg.' }, { id: 'plank', name: 'Plank hold', unit: 'sec', up: 1, how: 'Until your hips drop.' }],
  },
  core: {
    name: 'Core & Abs', emoji: '🎯', level: 'Intermediate', gear: 'A mat', color: '#F59E0B',
    blurb: 'A stronger middle: crunches, planks, leg raises and back work, with mobility days to recover.',
    week: ['A', 'B', 'M', 'A', 'B', 'A', 'M'], make: coreSession,
    tests: [{ id: 'plank', name: 'Plank hold', unit: 'sec', up: 1, how: 'Until your hips drop.' }, { id: 'crunch1', name: 'Crunches in 1 minute', unit: 'reps', up: 1, how: 'Shoulders off the floor each rep.' }, { id: 'legraise', name: 'Leg raises in one go', unit: 'reps', up: 1, how: 'Slow, lower back down.' }],
  },
  hiit: {
    name: 'Fat-Burn HIIT & Cardio', emoji: '⚡', level: 'Intermediate', gear: 'No equipment', color: '#EF4444',
    blurb: 'Short, sweaty interval workouts and cardio boxing. Work time goes up, rest goes down.',
    week: ['H', 'C', 'H', 'M', 'H', 'C', 'M'], make: hiitSession,
    tests: [{ id: 'burpee1', name: 'Burpees in 1 minute', unit: 'reps', up: 1, how: 'Step back if you need to.' }, { id: 'jacks1', name: 'Jumping jacks in 1 minute', unit: 'reps', up: 1, how: 'Full arm swing.' }, { id: 'pulse', name: 'Resting pulse', unit: 'bpm', up: 0, how: 'Count for 30 seconds after waking, ×2.' }],
  },
  shaadi: {
    name: 'Shaadi Fit', emoji: '💍', level: 'All levels', gear: 'A chair and a mat', color: '#E11D74', lengths: [45, 60, 75, 90, 100], def: 90, event: 1, tag: 'For the bride, groom & family',
    blurb: 'Your wedding countdown: toned arms and back for the outfit, cardio for the sangeet, and yoga for posture and calm on the big day.',
    week: ['S', 'C', 'P', 'S', 'C', 'S', 'M'], make: shaadiSession,
    tests: [{ id: 'pushups', name: 'Push-ups in one go', unit: 'reps', up: 1, how: 'Wall, knee or full: note which.' }, { id: 'plank', name: 'Plank hold', unit: 'sec', up: 1, how: 'Until your hips drop.' }, { id: 'walk1k', name: '1 km brisk walk', unit: 'min', up: 0, how: 'As fast as you comfortably can.' }],
  },
  diwali: {
    name: 'Diwali Glow 21', emoji: '🪔', level: 'Beginner+', gear: 'No equipment', color: '#F59E0B', lengths: [21], def: 21, tag: 'Festival special',
    blurb: '21 days to feel your best for the festive season: full-body circuits, sculpt and core, and festive dance cardio.',
    week: ['A', 'C', 'B', 'M', 'A', 'C', 'M'], make: diwaliSession,
    tests: [{ id: 'squats1', name: 'Squats in 1 minute', unit: 'reps', up: 1, how: 'Full squats, chest up.' }, { id: 'plank', name: 'Plank hold', unit: 'sec', up: 1, how: 'Until your hips drop.' }],
  },
  navratri: {
    name: 'Navratri Dance Cardio', emoji: '💃', level: 'All levels', gear: 'Space to dance', color: '#D946EF', lengths: [9, 18], def: 9, tag: 'Festival special',
    blurb: 'Nine nights, nine workouts: garba, dandiya and bhangra moves in cardio intervals. Fun first, sweat second.',
    week: ['D', 'B', 'D', 'F', 'D', 'B', 'D', 'F', 'D'], make: navratriSession,
    tests: [{ id: 'jacks1', name: 'Jumping jacks in 1 minute', unit: 'reps', up: 1, how: 'Full arm swing.' }, { id: 'pulse', name: 'Resting pulse', unit: 'bpm', up: 0, how: 'Count for 30 seconds after waking, ×2.' }],
  },
};
const PROGRAM_IDS = Object.keys(PROGRAMS);
const lengthsOf = (id) => (PROGRAMS[id] && PROGRAMS[id].lengths) || LENGTHS;
const LENGTHS = [14, 21, 30, 45, 60, 75, 90, 100];

function fmtDur(sec) { sec = Math.round(sec); if (sec < 60) return sec + 's'; const m = Math.floor(sec / 60), x = sec % 60; return x ? m + ':' + String(x).padStart(2, '0') : m + ' min'; }

/** Retest days: day 1, a third and two-thirds of the way, and the last day. */
const testDays = (n) => [...new Set([1, Math.round(n / 3), Math.round((2 * n) / 3), n])];

/**
 * The plan for day `n` (1-based) of a challenge: phase, whether it's a rest day, a test day, and the session.
 * `ch` = { program, length, start, adj } where adj (0.7–1.4) scales reps and times (easier/harder feedback, comeback mode).
 */
function planDay(ch, n, extraScale) {
  const prog = PROGRAMS[ch.program] || PROGRAMS.home;
  const len = ch.length || 30;
  const ph = Math.min(3, Math.floor((4 * (n - 1)) / len));
  const k = Math.max(0.6, Math.min(1.5, (ch.adj || 1) * (extraScale || 1)));
  const slot = prog.week[(n - 1) % prog.week.length];
  const test = testDays(len).includes(n);
  let sess;
  if (slot === 'M') sess = MOBILITY;
  else if (ch.program === 'c25k') {
    if (slot === 'R') {
      const runDays = []; for (let i = 1; i <= len; i++) if (prog.week[(i - 1) % prog.week.length] === 'R') runDays.push(i);
      sess = runSession(runDays.length > 1 ? runDays.indexOf(n) / (runDays.length - 1) : 0, k);
    } else if (slot === 'W') sess = walkSession('W', Math.min(ph, 1), k);
    else sess = { title: 'Rest day', kind: 'rest', blocks: [{ label: 'Gentle stretch', rounds: 1, rest: 5, items: [s('quad', 40), s('hamstring', 40), s('calf', 30), s('breathe', 60)] }] };
  } else sess = prog.make(slot, ph, k);
  const restDay = sess.kind === 'rest';
  return { n, phase: ph, phaseName: PHASES[ph], rest: restDay, test, session: sess, mins: estMinutes(sess) };
}

function estMinutes(sess) {
  let sec = 0;
  sess.blocks.forEach((b) => { for (let i = 0; i < b.rounds; i++) b.items.forEach((it) => { sec += it.secs || (it.reps || 10) * ((EX[it.ex] && EX[it.ex].t) || 2000) / 1000 + 5; sec += sess.restSec || b.rest || 0; }); });
  return Math.max(5, Math.round(sec / 60));
}

/** Flattens a session into the player's steps: exercise, rest, exercise… */
function playerSteps(sess) {
  const out = [];
  sess.blocks.forEach((b, bi) => {
    for (let rd = 0; rd < b.rounds; rd++) {
      b.items.forEach((it, ii) => {
        out.push({ ex: it.ex, reps: it.reps || 0, secs: it.secs || 0, fast: it.fast, label: b.label + (b.rounds > 1 ? ` · round ${rd + 1}/${b.rounds}` : ''), block: bi });
        const last = ii === b.items.length - 1;
        const restSec = last ? (rd < b.rounds - 1 ? b.rest : 0) : sess.kind === 'intervals' ? sess.restSec : sess.kind === 'cardio' ? 0 : Math.min(20, b.rest || 15);
        if (restSec > 0) out.push({ rest: restSec, label: last ? 'Rest between rounds' : 'Rest' });
      });
    }
  });
  return out;
}

/* ---------- the figure ---------- */
function parsePose(str, mirrorOf) {
  if (str === 'M') { const a = parsePose(mirrorOf); return { pts: a.pts.map(([x, y]) => [100 - x, y]), bend: a.bend }; }
  const [p, b] = str.split('|');
  return { pts: p.trim().split(/\s+/).map((xy) => xy.split(',').map(Number)), bend: Number(b) || 0 };
}
const POSE_CACHE = {};
function posesOf(id) {
  if (POSE_CACHE[id]) return POSE_CACHE[id];
  const e = EX[id] || EX.march;
  const a = parsePose(e.p[0]);
  const b = parsePose(e.p[1] || e.p[0], e.p[0]);
  return (POSE_CACHE[id] = [a, b]);
}
const PROPS = {
  wall: '<rect x="82" y="8" width="5" height="84" rx="1.5" class="fg-prop"/>',
  wallL: '<rect x="25" y="8" width="5" height="84" rx="1.5" class="fg-prop"/>',
  chair: '<path d="M14 66h24v4H14zM16 70v21M36 70v21M14 40v26" class="fg-propl"/>',
  stool: '<path d="M24 64h20v4H24zM27 68v23M41 68v23" class="fg-propl"/>',
};
function figureSvg(id) {
  const e = EX[id] || EX.march;
  return `<svg class="fig" viewBox="0 0 100 100" data-ex="${id}" aria-hidden="true"><line x1="4" y1="92.5" x2="96" y2="92.5" class="fg-floor"/>${PROPS[e.prop] || ''}<g class="fg-b"><path class="b1"/><path class="b2"/></g><path class="fg-t"/><g class="fg-f"><path class="f1"/><path class="f2"/></g><circle class="fg-h" r="6.2"/></svg>`;
}
function drawPose(svg, a, b, t) {
  const P = (i) => [a.pts[i][0] + (b.pts[i][0] - a.pts[i][0]) * t, a.pts[i][1] + (b.pts[i][1] - a.pts[i][1]) * t];
  const j = Array.from({ length: 11 }, (_, i) => P(i)), bend = a.bend + (b.bend - a.bend) * t;
  const L = (...ps) => 'M' + ps.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
  const [H, N, Hp, K1, F1, K2, F2, E1, A1, E2, A2] = j;
  const mx = (N[0] + Hp[0]) / 2, my = (N[1] + Hp[1]) / 2 + bend;
  svg.querySelector('.fg-t').setAttribute('d', `M${N[0].toFixed(1)} ${N[1].toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${Hp[0].toFixed(1)} ${Hp[1].toFixed(1)}`);
  svg.querySelector('.b1').setAttribute('d', L(Hp, K2, F2));
  svg.querySelector('.b2').setAttribute('d', L(N, E2, A2));
  svg.querySelector('.f1').setAttribute('d', L(Hp, K1, F1));
  svg.querySelector('.f2').setAttribute('d', L(N, E1, A1));
  const h = svg.querySelector('.fg-h'); h.setAttribute('cx', H[0].toFixed(1)); h.setAttribute('cy', H[1].toFixed(1));
}
/** Animates every figure on the page (cheap: one loop, paused when the tab is hidden). */
const FIG = { raf: 0, start: 0 };
function animateFigures() {
  cancelAnimationFrame(FIG.raf);
  const tick = (now) => {
    if (!FIG.start) FIG.start = now;
    document.querySelectorAll('svg.fig').forEach((svg) => {
      const id = svg.dataset.ex, e = EX[id] || EX.march, [a, b] = posesOf(id);
      const period = (svg.dataset.speed ? Number(svg.dataset.speed) : 1) * (e.t || 2000);
      const ph = ((now - FIG.start) % period) / period;
      const t = (1 - Math.cos(ph * Math.PI * 2)) / 2; // ease in and out, A → B → A
      drawPose(svg, a, b, e.hold ? t * 0.5 : t);
    });
    FIG.raf = document.querySelector('svg.fig') ? requestAnimationFrame(tick) : 0;
  };
  FIG.raf = requestAnimationFrame(tick);
}
