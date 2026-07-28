/**
 * OMRET — UI and game loop, shared by both language editions.
 *
 * All rule decisions live in engine.js; this file only renders them and
 * handles input, persistence and animation. The page it runs on declares its
 * locale via <html data-locale>, which selects both the word lists and the
 * interface strings.
 */

import {
  WORD_LENGTH, MAX_GUESSES, MARK, ENDING, STARVED_IS_LOSS,
  evaluate, newConstraints, applyGuess, checkLegal, legalWords,
  deadEnd, puzzleNumber, solutionFor,
} from './engine.js';
import { LOCALES, DEFAULT_LOCALE, setLocale, getLocale, t, applyI18n } from './i18n.js';

const LOCALE = setLocale(document.documentElement.dataset.locale || DEFAULT_LOCALE);
const LOCALE_KEY = 'omret/locale';

// Keep the remembered language in step with whichever edition is actually open,
// so the root chooser sends this player straight back here next time.
try { localStorage.setItem(LOCALE_KEY, LOCALE); } catch { /* storage blocked */ }

/**
 * Word lists are per-locale. Portuguese plays on accent-stripped keys and
 * renders the properly accented spelling from DISPLAY — you type "acido" and
 * the board shows "ÁCIDO", exactly like TERMO.
 */
const { ANSWERS, VALID, VALID_LIST, DISPLAY } = LOCALE === 'en-US'
  ? await import('./words-en.js')
  : await import('./words-pt.js');

/** The spelling shown for a word; identical to the key in English. */
const spell = (word) => DISPLAY[word] || word;

/**
 * Which words count as legal guesses.
 *
 * This is the single biggest difficulty lever in the game. With the full
 * 12,972-word dictionary you can dodge forever on obscure rare-letter words
 * (96.8% survival for that strategy, and tightening the rules barely dents it:
 * 96.5% even with strict mode on). Restricting guesses to the ~2,300 common
 * words drops it to 76.8% and makes word choice actually decide the round.
 *
 * The cost is that Wordle's answer list excludes most plurals, so a natural
 * guess like BORES gets rejected. Hence the toggle — on by default, because
 * off is barely a game.
 */
const COMMON_SET = new Set(ANSWERS);

const dict = () => (store.settings.commonOnly
  ? { list: ANSWERS, set: COMMON_SET }
  : { list: VALID_LIST, set: VALID });

/** Stats and progress are kept per language — they're different games. */
const STORE_KEY = `omret/v1/${LOCALE}`;

/**
 * Bumped when a rule change must override a setting already saved in a
 * player's browser. v2 made "every amber letter must move" the default: a
 * guess that quietly drops a known letter is exactly what this game is about
 * preventing, so requiring only one of them was the wrong default.
 */
const RULES_VERSION = 2;
const REVEAL_MS = 300;
const FLIP_MS = 500;

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const defaultSave = () => ({
  settings: {
    dark: true, pool: true, strict: true, contrast: false,
    practice: false, commonOnly: true, wordList: true,
  },
  rulesVersion: RULES_VERSION,
  stats: {
    played: 0, wins: 0, streak: 0, maxStreak: 0,
    dist: new Array(MAX_GUESSES).fill(0),
  },
  daily: null,       // { puzzle, guesses:[], ending:null }
  seenHelp: false,
});

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    const base = defaultSave();
    const merged = {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings || {}) },
      stats: { ...base.stats, ...(parsed.stats || {}) },
    };
    // Saves from an earlier guess count have a shorter distribution array.
    const dist = new Array(MAX_GUESSES).fill(0);
    (merged.stats.dist || []).forEach((n, i) => { if (i < MAX_GUESSES) dist[i] = n; });
    merged.stats.dist = dist;

    // Re-apply rule defaults that changed since this save was written, without
    // discarding the player's stats.
    if ((parsed.rulesVersion || 1) < RULES_VERSION) {
      merged.settings.strict = true;
      merged.daily = null;          // an in-progress round may break the new rule
      merged.rulesVersion = RULES_VERSION;
    }
    return merged;
  } catch {
    return defaultSave();
  }
}

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* private mode */ }
}

const store = load();

// ---------------------------------------------------------------------------
// Round state
// ---------------------------------------------------------------------------

const state = {
  solution: '',
  constraints: newConstraints(),
  marks: [],          // marks per submitted guess, for the share grid
  current: new Array(WORD_LENGTH).fill(null),
  busy: false,
  ending: null,
  practice: false,
  wordDeath: new Map(),   // word -> turn it stopped being playable
};

const $ = (id) => document.getElementById(id);
const board = $('board');
const keyboard = $('keyboard');

const ruleOpts = () => ({ strictRequired: store.settings.strict });

/** Start a round. `replay` re-applies stored guesses to restore the daily. */
function startRound({ practice, replay = [] } = {}) {
  state.practice = practice ?? store.settings.practice;
  state.solution = state.practice
    ? ANSWERS[Math.floor(Math.random() * ANSWERS.length)]
    : solutionFor(puzzleNumber(), ANSWERS);

  state.constraints = newConstraints();
  state.marks = [];
  state.ending = null;
  state.busy = false;
  state.wordDeath = new Map();
  lastPoolCount = null;

  for (const g of replay) {
    const m = evaluate(g, state.solution);
    state.marks.push(m);
    applyGuess(state.constraints, g, m);
    // Stamp per-turn so a restored daily still attributes each death correctly.
    stampDeaths(state.constraints.history.length);
  }

  // A restored daily may already have finished.
  if (!state.practice && store.daily?.ending) state.ending = store.daily.ending;

  resetInput();
  renderBoard();
  renderKeyboard();
  renderStatus();

  if (state.ending) showStats(true);
}

function resetInput() {
  state.current = state.constraints.locked.map((l) => l);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * A gray mark means two very different things, and conflating them misleads.
 *
 * Guess REFER against RETCH and the final R comes back gray — but only because
 * the solution's single R was already claimed by the green R in slot 1. That
 * letter is emphatically *not* dead; it's locked, so every future guess must
 * contain it. Only a gray letter that actually landed in `banned` is dead.
 */
function displayState(mark, letter) {
  if (mark !== MARK.BANNED) return mark;
  return state.constraints.banned.has(letter) ? MARK.BANNED : 'spent';
}

function renderBoard() {
  board.style.setProperty('--rows', MAX_GUESSES);
  board.textContent = '';

  const played = state.constraints.history.length;

  for (let r = 0; r < MAX_GUESSES; r++) {
    const row = document.createElement('div');
    row.className = 'row';
    row.id = `row-${r}`;

    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.id = `tile-${r}-${c}`;

      if (r < played) {
        const word = state.constraints.history[r];
        // Show the accented spelling; matching already happened on the key.
        tile.textContent = spell(word)[c];
        tile.dataset.state = displayState(state.marks[r][c], word[c]);
      } else if (r === played && state.ending === ENDING.CORNERED) {
        // Keep the word the trap forced on you visible across a reload.
        tile.textContent = spell(state.solution)[c];
        tile.dataset.state = 'locked';
      } else if (r === played && !state.ending) {
        const ch = state.current[c];
        if (ch) {
          tile.textContent = ch;
          tile.dataset.state = state.constraints.locked[c] ? 'pinned' : 'filled';
        }
      }

      row.appendChild(tile);
    }
    board.appendChild(row);
  }

  sizeBoard();
}

/** Keep the grid square and fully visible without scrolling. */
function sizeBoard() {
  const wrap = board.parentElement;
  const availH = wrap.clientHeight - 16;
  const availW = Math.min(wrap.clientWidth - 16, 500);
  const tileH = (availH - 5 * (MAX_GUESSES - 1) - 16) / MAX_GUESSES;
  const tileW = (availW - 5 * (WORD_LENGTH - 1) - 16) / WORD_LENGTH;
  // The floor has to stay small: on a short landscape phone six rows simply
  // cannot be 28px each, and forcing it pushes the board under the keyboard.
  const tile = Math.max(15, Math.min(tileH, tileW, 68));
  board.style.width = `${tile * WORD_LENGTH + 5 * (WORD_LENGTH - 1) + 16}px`;
  board.style.height = `${tile * MAX_GUESSES + 5 * (MAX_GUESSES - 1) + 16}px`;
}

const KB_ROWS = ['qwertyuiop', 'asdfghjkl', '↵zxcvbnm⌫'];

function renderKeyboard() {
  keyboard.textContent = '';

  for (const rowStr of KB_ROWS) {
    const row = document.createElement('div');
    row.className = 'kb-row';

    for (const ch of rowStr) {
      const key = document.createElement('button');
      key.type = 'button';

      if (ch === '↵') {
        key.className = 'key wide';
        key.textContent = 'Enter';
        key.dataset.key = 'enter';
      } else if (ch === '⌫') {
        key.className = 'key wide';
        key.dataset.key = 'backspace';
        key.setAttribute('aria-label', 'Backspace');
        key.innerHTML = '<svg viewBox="0 0 24 24"><path d="M22 3H7c-.7 0-1.2.4-1.6.9L0 12l5.4 8.1c.4.5.9.9 1.6.9h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.6L17.6 17 14 13.4 10.4 17 9 15.6 12.6 12 9 8.4 10.4 7 14 10.6 17.6 7 19 8.4 15.4 12 19 15.6z"/></svg>';
      } else {
        key.className = 'key';
        key.textContent = ch;
        key.dataset.key = ch;
        const st = keyState(ch);
        if (st) key.dataset.state = st;
      }

      row.appendChild(key);
    }
    keyboard.appendChild(row);
  }
}

function keyState(ch) {
  const c = state.constraints;
  if (c.locked.includes(ch)) return 'locked';
  if (c.required.has(ch)) return 'required';
  if (c.banned.has(ch)) return 'banned';
  return null;
}

/** Escalating pressure bands for the remaining-words counter. */
function poolLevel(n) {
  if (n <= 3) return 'critical';
  if (n <= 12) return 'danger';
  if (n <= 60) return 'warn';
  if (n <= 250) return 'caution';
  return 'safe';
}

let lastPoolCount = null;

function renderStatus() {
  $('status-mode').textContent = state.practice
    ? t('status.practice')
    : t('status.daily', { n: puzzleNumber() });

  const pool = $('status-pool');
  pool.hidden = !store.settings.pool;

  const legal = legalWords(state.constraints, dict().list, dict().set, ruleOpts());
  renderWordPanel(legal);

  if (!store.settings.pool) { lastPoolCount = legal.length; return; }

  const n = legal.length;
  pool.textContent = n === 1
    ? t('status.wordsLeftOne')
    : t('status.wordsLeft', { n: n.toLocaleString(LOCALE) });
  pool.dataset.level = poolLevel(n);
  pool.classList.toggle('danger', n <= 12);

  // Show what the last guess cost, and bump the pill so the drop is felt.
  if (lastPoolCount !== null && n < lastPoolCount) {
    const delta = $('pool-delta');
    delta.hidden = false;
    delta.textContent = `−${(lastPoolCount - n).toLocaleString()}`;
    delta.style.animation = 'none';
    void delta.offsetWidth;
    delta.style.animation = '';
    setTimeout(() => { delta.hidden = true; }, 1600);

    pool.classList.remove('bump');
    void pool.offsetWidth;
    pool.classList.add('bump');
    setTimeout(() => pool.classList.remove('bump'), 450);
  }

  lastPoolCount = n;
}

// ---------------------------------------------------------------------------
// Word pool panel — testing aid
// ---------------------------------------------------------------------------

/** Record, once per word, the turn on which it stopped being playable. */
function stampDeaths(turn, aliveSet) {
  const alive = aliveSet
    ?? new Set(legalWords(state.constraints, dict().list, dict().set, ruleOpts()));
  for (const w of dict().list) {
    if (!alive.has(w) && !state.wordDeath.has(w)) state.wordDeath.set(w, turn);
  }
}

/**
 * Lists every word in the dictionary. Words still playable stay at the top in
 * their original order; words that have become unplayable are struck through
 * and demoted, grouped by the turn that killed them (most recent first).
 */
function renderWordPanel(legal) {
  const panel = $('wordpanel');
  const on = store.settings.wordList;

  panel.hidden = !on;
  document.body.classList.toggle('with-panel', on);
  if (!on) return;

  const alive = new Set(legal);
  const turn = state.constraints.history.length;
  stampDeaths(turn, alive);

  const living = [];
  const byTurn = new Map();
  for (const w of dict().list) {
    if (alive.has(w)) { living.push(w); continue; }
    const t = state.wordDeath.get(w) ?? turn;
    if (!byTurn.has(t)) byTurn.set(t, []);
    byTurn.get(t).push(w);
  }

  $('wp-alive').textContent = living.length.toLocaleString();
  $('wp-dead').textContent = (dict().list.length - living.length).toLocaleString();

  const frag = document.createDocumentFragment();

  const heading = (text) => {
    const h = document.createElement('div');
    h.className = 'wp-group';
    h.textContent = text;
    frag.appendChild(h);
  };

  const addWords = (words, cls) => {
    for (const w of words) {
      const d = document.createElement('div');
      d.className = `wp-word ${cls}`;
      d.textContent = spell(w);
      frag.appendChild(d);
    }
  };

  heading(t('panel.playable', { n: living.length.toLocaleString(LOCALE) }));
  addWords(living, '');

  // Most recently killed first, so the last guess's damage is right there.
  for (const died of [...byTurn.keys()].sort((a, b) => b - a)) {
    const words = byTurn.get(died);
    const n = words.length.toLocaleString(LOCALE);
    heading(died === 0
      ? t('panel.neverPlayable', { n })
      : t('panel.killedBy', { t: died, n }));
    addWords(words, died === turn && turn > 0 ? 'just-died' : 'dead');
  }

  const list = $('wp-list');
  list.textContent = '';
  list.appendChild(frag);
  list.scrollTop = 0;
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

function toast(msg, ms = 1800) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = msg;
  $('toaster').appendChild(el);
  if (ms === Infinity) return;
  setTimeout(() => {
    el.classList.add('fade');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

function rejectionMessage(res) {
  switch (res.reason) {
    case 'short':      return t('toast.short');
    case 'not-a-word':
      // Distinguish "no such word" from "real word, but not a common one",
      // otherwise the common-words setting looks like a broken dictionary.
      return store.settings.commonOnly && VALID.has(res.word)
        ? t('toast.notCommon')
        : t('toast.notWord');
    case 'repeat':     return t('toast.repeat');
    case 'locked':
      return t('toast.locked', {
        letter: res.letter.toUpperCase(),
        ord: t(`ordinal.${res.slot + 1}`),
      });
    case 'banned':     return t('toast.banned', { letter: res.letter.toUpperCase() });
    case 'required': {
      const list = res.letters ?? [res.letter];
      const names = list.map((l) => `<b>${l.toUpperCase()}</b>`);
      const joined = names.length > 1
        ? `${names.slice(0, -1).join(', ')} ${t('toast.or')} ${names[names.length - 1]}`
        : names[0];
      return t('toast.required', { letters: joined });
    }
    default:           return t('toast.illegal');
  }
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

let lastReject = { letter: '', at: 0 };

/**
 * Refuse a dead letter at the keystroke instead of at submit time: the letter
 * never enters the row, and the key itself flashes red and shakes so the reason
 * is obvious without reading a message.
 */
function rejectLetter(ch) {
  const key = keyboard.querySelector(`.key[data-key="${ch}"]`);
  if (key) {
    key.classList.remove('reject');
    void key.offsetWidth;            // restart the animation on repeat presses
    key.classList.add('reject');
    setTimeout(() => key.classList.remove('reject'), 400);
  }

  const row = $(`row-${state.constraints.history.length}`);
  if (row) {
    row.classList.remove('reject');
    void row.offsetWidth;
    row.classList.add('reject');
    setTimeout(() => row.classList.remove('reject'), 300);
  }

  navigator.vibrate?.(35);

  // Spell out the reason, but don't stack a toast per keypress.
  const now = performance.now();
  if (lastReject.letter !== ch || now - lastReject.at > 1500) {
    toast(t('toast.banned', { letter: ch.toUpperCase() }), 1400);
  }
  lastReject = { letter: ch, at: now };
}

function typeLetter(ch) {
  if (state.busy || state.ending) return;

  if (state.constraints.banned.has(ch)) {
    rejectLetter(ch);
    return;
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (state.constraints.locked[i] === null && state.current[i] === null) {
      state.current[i] = ch;
      renderBoard();
      return;
    }
  }
}

function backspace() {
  if (state.busy || state.ending) return;
  for (let i = WORD_LENGTH - 1; i >= 0; i--) {
    if (state.constraints.locked[i] === null && state.current[i] !== null) {
      state.current[i] = null;
      renderBoard();
      return;
    }
  }
}

function shakeRow() {
  const row = $(`row-${state.constraints.history.length}`);
  if (!row) return;
  row.classList.add('shake');
  setTimeout(() => row.classList.remove('shake'), 600);
}

async function submit() {
  if (state.busy || state.ending) return;

  const rowIndex = state.constraints.history.length;
  const word = state.current.join('');

  if (state.current.includes(null)) {
    toast(t('toast.short'));
    shakeRow();
    return;
  }

  const res = checkLegal(state.constraints, word, dict().set, ruleOpts());
  if (!res.ok) {
    toast(rejectionMessage(res));
    shakeRow();
    return;
  }

  state.busy = true;
  const marks = evaluate(word, state.solution);

  await revealRow(rowIndex, word, marks);

  state.marks.push(marks);
  applyGuess(state.constraints, word, marks);
  renderKeyboard();

  if (!state.practice) {
    store.daily = {
      puzzle: puzzleNumber(),
      guesses: [...state.constraints.history],
      ending: null,
    };
    save();
  }

  finishTurn(word, rowIndex);
}

function revealRow(rowIndex, word, marks) {
  return new Promise((resolve) => {
    const shown = spell(word);
    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = $(`tile-${rowIndex}-${c}`);
      setTimeout(() => {
        tile.classList.add('flip');
        setTimeout(() => {
          tile.textContent = shown[c];
          tile.dataset.state = marks[c];
        }, FLIP_MS / 2);
      }, c * REVEAL_MS);
    }
    setTimeout(resolve, (WORD_LENGTH - 1) * REVEAL_MS + FLIP_MS);
  });
}

function finishTurn(word, rowIndex) {
  // 1. Typed the answer.
  if (word === state.solution) return revealFound(rowIndex);

  // 2. Survived every guess.
  if (state.constraints.history.length >= MAX_GUESSES) {
    bounceRow(rowIndex);
    return endRound(ENDING.SURVIVED);
  }

  // 3. The squeeze closed on its own.
  const dead = deadEnd(state.constraints, dict().list, dict().set, state.solution, ruleOpts());
  if (dead && (dead.ending !== ENDING.STARVED || STARVED_IS_LOSS)) {
    if (dead.ending === ENDING.CORNERED) return revealTrap(dead.only);
    return endRound(dead.ending);
  }

  resetInput();
  renderBoard();
  renderStatus();
  state.busy = false;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Scale every beat down when the player has asked for less motion. */
const beat = (ms) => sleep(REDUCED ? Math.min(ms, 90) : ms);

/**
 * The cornered ending, played out rather than announced.
 *
 * The player never typed this word — the constraints did. So it gets spelled
 * into the next row one slammed letter at a time, turns red, and pulses, while
 * the screen closes in around it. Only then does the end screen appear.
 */
async function revealTrap(word) {
  state.busy = true;
  const rowIndex = state.constraints.history.length;

  // Clear whatever the player had half-typed; this row isn't theirs any more.
  state.current = new Array(WORD_LENGTH).fill(null);
  renderBoard();

  await beat(650);
  toast(t('toast.nowhere'), 2400);
  await beat(750);

  $('doom-veil').classList.add('on');

  for (let c = 0; c < WORD_LENGTH; c++) {
    const tile = $(`tile-${rowIndex}-${c}`);
    tile.textContent = word[c];
    tile.dataset.state = 'filled';
    tile.classList.add('slam');
    board.classList.add('jolt');
    setTimeout(() => board.classList.remove('jolt'), 170);
    navigator.vibrate?.(18);
    await beat(280);
  }

  await beat(500);
  await ignite(rowIndex);
  endRound(ENDING.CORNERED, { quiet: true, statsDelay: 700 });
}

/**
 * Set a finished row alight: each letter turns red in sequence, then the whole
 * row pulses while the screen closes in. Shared by both losing endings, so
 * walking into the answer yourself looks exactly as bad as being forced into it.
 */
async function ignite(rowIndex) {
  $('doom-veil').classList.add('on');

  for (let c = 0; c < WORD_LENGTH; c++) {
    const tile = $(`tile-${rowIndex}-${c}`);
    tile.classList.add('doom');
    tile.dataset.state = 'locked';
    await beat(130);
  }

  navigator.vibrate?.([50, 60, 120]);
  $(`row-${rowIndex}`).classList.add('doom-pulse');
  await beat(1500);
  $('doom-veil').classList.remove('on');
}

/** You typed the answer. Same funeral, minus the forced spelling-out. */
async function revealFound(rowIndex) {
  state.busy = true;
  await beat(350);
  toast(t('end.found'), 2400);
  await beat(450);
  await ignite(rowIndex);
  endRound(ENDING.FOUND, { quiet: true, statsDelay: 700 });
}

function bounceRow(rowIndex) {
  for (let c = 0; c < WORD_LENGTH; c++) {
    const tile = $(`tile-${rowIndex}-${c}`);
    setTimeout(() => tile.classList.add('bounce'), c * 100);
  }
}

// ---------------------------------------------------------------------------
// Endings
// ---------------------------------------------------------------------------

const ENDING_TOAST = {
  [ENDING.SURVIVED]: () => t('end.survived'),
  [ENDING.FOUND]: () => t('end.found'),
  [ENDING.CORNERED]: () => t('end.cornered'),
  [ENDING.STARVED]: () => t('end.starved'),
};

function endRound(ending, { quiet = false, statsDelay = null } = {}) {
  state.ending = ending;
  state.busy = true;
  renderStatus();

  const won = ending === ENDING.SURVIVED;

  if (!state.practice) {
    recordStats(won, state.constraints.history.length);
    store.daily = {
      puzzle: puzzleNumber(),
      guesses: [...state.constraints.history],
      ending,
    };
    save();
  }

  if (!quiet) toast(ENDING_TOAST[ending](), 2600);
  setTimeout(() => showStats(true), statsDelay ?? (won ? 2000 : 1600));
}

function recordStats(won, turns) {
  const s = store.stats;
  s.played++;
  if (won) {
    s.wins++;
    s.streak++;
    s.maxStreak = Math.max(s.maxStreak, s.streak);
  } else {
    s.streak = 0;
    s.dist[Math.min(turns, MAX_GUESSES) - 1]++;
  }
  save();
}

// ---------------------------------------------------------------------------
// Stats modal
// ---------------------------------------------------------------------------

function showStats(withEndgame = false) {
  const s = store.stats;
  const winPct = s.played ? Math.round((s.wins / s.played) * 100) : 0;

  $('stats-row').innerHTML = [
    [t('stats.played'), s.played],
    [t('stats.winPct'), winPct],
    [t('stats.streak'), s.streak],
    [t('stats.maxStreak'), s.maxStreak],
  ].map(([label, num]) =>
    `<div class="stat"><div class="stat-num">${num}</div><div class="stat-label">${label}</div></div>`
  ).join('');

  const max = Math.max(1, ...s.dist);
  const lostTurn = state.ending && state.ending !== ENDING.SURVIVED
    ? state.constraints.history.length
    : -1;

  $('dist').innerHTML = s.dist.map((n, i) => {
    const pct = Math.max(7, (n / max) * 100);
    const current = i + 1 === lostTurn && !state.practice ? ' current' : '';
    return `<div class="dist-line"><span>${i + 1}</span>` +
           `<div class="dist-bar${current}" style="width:${pct}%">${n}</div></div>`;
  }).join('');

  const endgame = $('endgame');
  endgame.hidden = !(withEndgame && state.ending);

  if (withEndgame && state.ending) {
    $('endgame-msg').innerHTML = endgameMessage();
    $('btn-share').hidden = state.practice;
    $('countdown').hidden = state.practice;
    if (!state.practice) startCountdown();
  }

  openModal('modal-stats');
}

const ENDING_KEY = {
  [ENDING.SURVIVED]: 'survived',
  [ENDING.FOUND]: 'found',
  [ENDING.CORNERED]: 'cornered',
  [ENDING.STARVED]: 'starved',
};

function endgameMessage() {
  const key = ENDING_KEY[state.ending];
  if (!key) return '';
  const word = spell(state.solution).toUpperCase();
  return `<strong>${t(`end.${key}`)}</strong><br>${t(`end.${key}Body`, { word })}`;
}

let countdownTimer = null;

function startCountdown() {
  clearInterval(countdownTimer);
  const tick = () => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const diff = Math.max(0, next - now);
    const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    const sec = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
    $('countdown-clock').textContent = `${h}:${m}:${sec}`;
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

// ---------------------------------------------------------------------------
// Share
// ---------------------------------------------------------------------------

const EMOJI = {
  [MARK.LOCKED]: '\u{1F7E5}',    // red — locked
  [MARK.REQUIRED]: '\u{1F7E7}',  // orange — must move
  [MARK.BANNED]: '⬛',       // black — dead letter
};

function shareText() {
  const turns = state.constraints.history.length;
  const key = state.ending === ENDING.SURVIVED ? 'survived'
    : state.ending === ENDING.FOUND ? 'found'
      : 'cornered';
  const headline = t(`share.${key}`, { n: turns, max: MAX_GUESSES });

  const grid = state.marks.map((m) => m.map((x) => EMOJI[x]).join('')).join('\n');
  const name = LOCALE === 'en-US' ? 'Wordle Reversed' : 'OMRET';
  return `${name} #${puzzleNumber()} — ${headline}\n\n${grid}\n${shareUrl()}`;
}

/** Deep link straight to this edition, so a shared grid lands in the right one. */
function shareUrl() {
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  return url.href.replace(/index\.html$/, '');
}

async function share() {
  const text = shareText();
  try {
    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      await navigator.share({ text });
      return;
    }
    await navigator.clipboard.writeText(text);
    toast(t('toast.copied'));
  } catch {
    toast(t('toast.copyFailed'));
  }
}

// ---------------------------------------------------------------------------
// Modals & settings
// ---------------------------------------------------------------------------

function openModal(id) {
  for (const m of document.querySelectorAll('.modal-backdrop')) m.hidden = true;
  $(id).hidden = false;
}

function closeModals() {
  for (const m of document.querySelectorAll('.modal-backdrop')) m.hidden = true;
  clearInterval(countdownTimer);
}

/**
 * Language picker. Switching navigates to the other edition's page and records
 * the choice, so the root chooser stops asking and goes straight there.
 */
function renderLangSwitch() {
  const host = $('lang-switch');
  host.textContent = '';

  for (const [code, meta] of Object.entries(LOCALES)) {
    const btn = document.createElement('a');
    btn.className = 'lang-chip';
    btn.textContent = meta.short;
    btn.title = meta.label;
    btn.href = `../${meta.path}/`;
    if (code === LOCALE) {
      btn.setAttribute('aria-current', 'true');
      btn.removeAttribute('href');
    } else {
      btn.addEventListener('click', () => {
        try { localStorage.setItem(LOCALE_KEY, code); } catch { /* ignore */ }
      });
    }
    host.appendChild(btn);
  }
}

function applySettings() {
  const s = store.settings;
  document.documentElement.dataset.theme = s.dark ? 'dark' : 'light';
  document.documentElement.dataset.contrast = s.contrast ? 'high' : 'normal';
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', s.dark ? '#121213' : '#ffffff');

  $('opt-dark').setAttribute('aria-checked', String(s.dark));
  $('opt-pool').setAttribute('aria-checked', String(s.pool));
  $('opt-strict').setAttribute('aria-checked', String(s.strict));
  $('opt-common').setAttribute('aria-checked', String(s.commonOnly));
  $('opt-wordlist').setAttribute('aria-checked', String(s.wordList));
  $('opt-contrast').setAttribute('aria-checked', String(s.contrast));
  $('opt-practice').setAttribute('aria-checked', String(s.practice));

  renderStatus();
}

function bindSwitch(id, key, onChange) {
  $(id).addEventListener('click', () => {
    store.settings[key] = !store.settings[key];
    save();
    applySettings();
    onChange?.();
  });
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

keyboard.addEventListener('click', (e) => {
  const key = e.target.closest('.key');
  if (!key) return;
  const k = key.dataset.key;
  if (k === 'enter') submit();
  else if (k === 'backspace') backspace();
  else typeLetter(k);
});

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const open = [...document.querySelectorAll('.modal-backdrop')].some((m) => !m.hidden);
  if (e.key === 'Escape') {
    closeModals();
    $('wordpanel').classList.remove('open');
    return;
  }
  if (open) return;

  if (e.key === 'Enter') submit();
  else if (e.key === 'Backspace') backspace();
  else if (/^[a-zA-Z]$/.test(e.key)) typeLetter(e.key.toLowerCase());
});

$('btn-help').addEventListener('click', () => openModal('modal-help'));
$('btn-stats').addEventListener('click', () => showStats(Boolean(state.ending)));
$('btn-settings').addEventListener('click', () => openModal('modal-settings'));
$('btn-share').addEventListener('click', share);

$('btn-practice').addEventListener('click', () => {
  closeModals();
  startRound({ practice: true });
});

for (const el of document.querySelectorAll('[data-close]')) {
  el.addEventListener('click', closeModals);
}

for (const backdrop of document.querySelectorAll('.modal-backdrop')) {
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModals();
  });
}

bindSwitch('opt-dark', 'dark');
bindSwitch('opt-contrast', 'contrast');
bindSwitch('opt-pool', 'pool');

// Both of these change which words are legal, so the round has to restart —
// mid-round the board could otherwise contain now-illegal guesses.
const restartForRuleChange = (whatKey) => () => {
  toast(t('toast.ruleChanged', { what: t(whatKey) }));
  if (!state.practice) { store.daily = null; save(); }
  startRound({ practice: state.practice });
};

bindSwitch('opt-wordlist', 'wordList', () => { renderStatus(); sizeBoard(); });
bindSwitch('opt-strict', 'strict', restartForRuleChange('toast.strictChanged'));
bindSwitch('opt-common', 'commonOnly', restartForRuleChange('toast.dictChanged'));

bindSwitch('opt-practice', 'practice', () => {
  closeModals();
  startRound({ practice: store.settings.practice });
});

// On phones the word pool is a bottom sheet, opened by tapping the counter.
const sheetMode = () => window.innerWidth <= 900;

$('status-pool').addEventListener('click', () => {
  if (!sheetMode() || !store.settings.wordList) return;
  $('wordpanel').classList.toggle('open');
});

$('wp-close').addEventListener('click', () => $('wordpanel').classList.remove('open'));

window.addEventListener('resize', () => {
  sizeBoard();
  // Leaving phone width with the sheet still "open" would pin it mid-screen.
  if (!sheetMode()) $('wordpanel').classList.remove('open');
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

applyI18n();
renderLangSwitch();
applySettings();

const today = puzzleNumber();
const saved = store.daily && store.daily.puzzle === today ? store.daily : null;

startRound({
  practice: store.settings.practice,
  replay: saved && !store.settings.practice ? saved.guesses : [],
});

if (!store.seenHelp) {
  openModal('modal-help');
  store.seenHelp = true;
  save();
}
