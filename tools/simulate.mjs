/**
 * Offline balance testing for OMRET.
 *
 * Plays many full games under several strategies and rule variants, and reports
 * how each round ended. It exists to answer two questions: is there a dominant
 * strategy that trivially survives, and how reachable is the "starved" state?
 *
 *   node tools/simulate.mjs [gamesPerCell] [pt|en]
 *
 * The two editions have very different dictionaries, so each needs its own
 * balance pass — Portuguese answers are far more likely to share letters.
 */

const LOCALE = (process.argv[3] || 'pt').toLowerCase().startsWith('en') ? 'en' : 'pt';
const { ANSWERS, VALID, VALID_LIST } = await import(
  LOCALE === 'en' ? '../js/words-en.js' : '../js/words-pt.js');
import {
  ENDING, evaluate, newConstraints, applyGuess, legalWords,
} from '../js/engine.js';

const GAMES = Number(process.argv[2] || 400);

// Deterministic RNG so runs are reproducible.
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const reseed = () => { seed = 12345; };

// How common each letter is among answers — a stand-in for "how much of the
// dictionary do I destroy by getting this letter banned".
const freq = {};
for (const w of ANSWERS) for (const ch of new Set(w)) freq[ch] = (freq[ch] || 0) + 1;
const distinct = (w) => [...new Set(w)];

const STRATEGIES = {
  // Uninformed baseline — what a casual player roughly does.
  random: (legal) => pick(legal),

  // "Avoid contact": guess the most obscure letters available so every slot
  // comes back gray and nothing ever gets locked. The suspected dominant line.
  rare: (legal) => best(legal, (w) => -distinct(w).reduce((s, c) => s + (freq[c] || 0), 0)),

  // "Conserve alphabet": prefer words reusing letters already spoken for
  // (locked or required), since those can never be banned.
  conserve: (legal, c) => best(legal, (w) => {
    const spoken = new Set([...c.locked.filter(Boolean), ...c.required.keys()]);
    return -distinct(w).filter((ch) => !spoken.has(ch)).length;
  }),
};

function best(list, score) {
  let bestW = list[0], bestS = -Infinity;
  for (const w of list) {
    const s = score(w);
    if (s > bestS) { bestS = s; bestW = w; }
  }
  return bestW;
}

const clone = (c) => ({
  locked: [...c.locked],
  required: new Map([...c.required].map(([k, v]) => [k, new Set(v)])),
  banned: new Set(c.banned),
  history: [...c.history],
});

/** Play one full round under a rule variant. */
function playGame(solution, strategy, rules) {
  const { guesses, list, set, opts } = rules;
  const c = newConstraints();

  for (let turn = 0; turn < guesses; turn++) {
    const legal = legalWords(c, list, set, opts);

    if (legal.length === 0) return { ending: ENDING.STARVED, turn };
    if (legal.length === 1 && legal[0] === solution) return { ending: ENDING.CORNERED, turn };

    // A rational player never types the solution voluntarily.
    const options = legal.filter((w) => w !== solution);
    if (options.length === 0) return { ending: ENDING.CORNERED, turn };

    const guess = strategy(options, c);
    applyGuess(c, guess, evaluate(guess, solution));
  }

  return { ending: ENDING.SURVIVED, turn: guesses };
}

// ---------------------------------------------------------------------------

const ANSWER_SET = new Set(ANSWERS);

const STRICT = { strictRequired: true };

const VARIANTS = [
  { label: '6 common + all-move', guesses: 6, list: ANSWERS, set: ANSWER_SET, opts: STRICT },
  { label: '6 common, lenient', guesses: 6, list: ANSWERS, set: ANSWER_SET, opts: {} },
  { label: '6 full dict + all-move', guesses: 6, list: VALID_LIST, set: VALID, opts: STRICT },
  { label: '5 common + all-move', guesses: 5, list: ANSWERS, set: ANSWER_SET, opts: STRICT },
];

console.log(`OMRET — balance simulation (${LOCALE === 'en' ? 'English' : 'Português'})`);
console.log(`${GAMES} games per cell · ${ANSWERS.length} answers · ${VALID_LIST.length} valid\n`);
console.log('variant                    strategy    survived   cornered    starved   avg death');
console.log('─'.repeat(84));

for (const v of VARIANTS) {
  let first = true;
  for (const [name, fn] of Object.entries(STRATEGIES)) {
    reseed();
    const solutions = Array.from({ length: GAMES }, () => pick(ANSWERS));
    const tally = { survived: 0, found: 0, cornered: 0, starved: 0 };
    const deaths = [];

    for (const sol of solutions) {
      const r = playGame(sol, fn, v);
      tally[r.ending]++;
      if (r.ending !== ENDING.SURVIVED) deaths.push(r.turn + 1);
    }

    const pct = (n) => ((n / GAMES) * 100).toFixed(1).padStart(5) + '%';
    const avg = deaths.length ? (deaths.reduce((a, b) => a + b, 0) / deaths.length).toFixed(1) : '—';

    console.log(
      (first ? v.label : '').padEnd(26),
      name.padEnd(10),
      pct(tally.survived), '  ', pct(tally.cornered), '  ', pct(tally.starved),
      '     ', String(avg).padStart(4),
    );
    first = false;
  }
  console.log('');
}

console.log(`survived = win (reached the last guess without typing the solution)
cornered = the solution became the only legal word left
starved  = no legal word remained at all

Target: 'rare' well under 90%, and the three strategies spread apart — that
means word choice matters instead of one line dominating.`);
