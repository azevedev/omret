/**
 * Wordle Reversed — rules engine.
 *
 * Pure logic, no DOM. Shared verbatim by the browser game and the offline
 * simulator so both play by identical rules.
 *
 * The twist: marking works exactly like Wordle, but the marks become
 * *obligations* on your next guess instead of hints:
 *
 *   LOCKED   (Wordle green)  — that letter is pinned to that slot forever.
 *   REQUIRED (Wordle yellow) — you must keep using that letter, and each time
 *                              it has to sit in a slot it has never occupied.
 *   BANNED   (Wordle gray)   — that letter is dead, you may never use it again.
 *
 * You win by surviving all five guesses without typing the solution.
 */

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 5;

/**
 * When no legal word remains at all ("starved"), is that a loss?
 *
 * Set to `true` by default: if starving counted as a win, the dominant
 * strategy would be to burn rare letters as fast as possible and strangle the
 * dictionary on purpose. Making it a loss keeps gray letters genuinely costly.
 * See tools/simulate.mjs for the measurements behind this.
 */
export const STARVED_IS_LOSS = true;

export const MARK = { LOCKED: 'locked', REQUIRED: 'required', BANNED: 'banned' };

export const ENDING = {
  SURVIVED: 'survived',   // win — five guesses, never typed the solution
  FOUND: 'found',         // loss — typed the solution
  CORNERED: 'cornered',   // loss — the solution was the only word left
  STARVED: 'starved',     // no legal word remained at all
};

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

/**
 * Standard Wordle marking, including the duplicate-letter rules: exact matches
 * are claimed first, then remaining letters are matched against what's left.
 *
 * @returns {string[]} one MARK per position
 */
export function evaluate(guess, solution) {
  const marks = new Array(WORD_LENGTH).fill(MARK.BANNED);
  const pool = new Map();

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === solution[i]) {
      marks[i] = MARK.LOCKED;
    } else {
      pool.set(solution[i], (pool.get(solution[i]) || 0) + 1);
    }
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (marks[i] === MARK.LOCKED) continue;
    const left = pool.get(guess[i]) || 0;
    if (left > 0) {
      marks[i] = MARK.REQUIRED;
      pool.set(guess[i], left - 1);
    }
  }

  return marks;
}

// ---------------------------------------------------------------------------
// Constraint state
// ---------------------------------------------------------------------------

/**
 * @typedef {object} Constraints
 * @property {(string|null)[]} locked   letter pinned at each slot, or null
 * @property {Map<string,Set<number>>} required  letter -> slots it has already occupied
 * @property {Set<string>} banned       letters that may never be used again
 * @property {string[]} history         words already guessed
 */

/** @returns {Constraints} */
export function newConstraints() {
  return {
    locked: new Array(WORD_LENGTH).fill(null),
    required: new Map(),
    banned: new Set(),
    history: [],
  };
}

export function cloneConstraints(c) {
  return {
    locked: [...c.locked],
    required: new Map([...c.required].map(([k, v]) => [k, new Set(v)])),
    banned: new Set(c.banned),
    history: [...c.history],
  };
}

/**
 * Fold a marked guess into the constraint state. Mutates and returns `c`.
 *
 * Precedence is locked > required > banned, applied per letter across the whole
 * game. A letter that comes back gray in one slot but locked or required in
 * another slot of the same guess is NOT banned — that pattern only means the
 * solution has fewer copies of it, not that it's forbidden.
 */
export function applyGuess(c, guess, marks) {
  c.history.push(guess);

  // Letters that earned a non-gray mark somewhere in *this* guess.
  const alive = new Set();
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (marks[i] !== MARK.BANNED) alive.add(guess[i]);
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    const letter = guess[i];

    if (marks[i] === MARK.LOCKED) {
      c.locked[i] = letter;
      c.banned.delete(letter);
      // Pinning resolves the "keep moving it" obligation for that letter.
      c.required.delete(letter);
    } else if (marks[i] === MARK.REQUIRED) {
      c.banned.delete(letter);
      if (!c.locked.includes(letter)) {
        if (!c.required.has(letter)) c.required.set(letter, new Set());
        c.required.get(letter).add(i);
      }
    } else if (!alive.has(letter) && !c.required.has(letter) && !c.locked.includes(letter)) {
      c.banned.add(letter);
    }
  }

  return c;
}

// ---------------------------------------------------------------------------
// Legality
// ---------------------------------------------------------------------------

/**
 * Slots where a required letter is still allowed to land: never green-locked,
 * and never a slot that letter has already occupied.
 */
export function openSlotsFor(c, letter) {
  const used = c.required.get(letter) || new Set();
  const slots = [];
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (c.locked[i] === null && !used.has(i)) slots.push(i);
  }
  return slots;
}

/**
 * Does `word` satisfy every standing obligation?
 *
 * @returns {{ok: boolean, reason?: string, letter?: string, slot?: number}}
 *          `reason` is a machine-readable code the UI turns into a message.
 */
export function checkLegal(c, word, validSet, opts = {}) {
  if (word.length !== WORD_LENGTH) return { ok: false, reason: 'short' };
  if (validSet && !validSet.has(word)) return { ok: false, reason: 'not-a-word', word };
  if (c.history.includes(word)) return { ok: false, reason: 'repeat' };

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (c.locked[i] !== null && word[i] !== c.locked[i]) {
      return { ok: false, reason: 'locked', letter: c.locked[i], slot: i };
    }
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (c.banned.has(word[i])) {
      return { ok: false, reason: 'banned', letter: word[i], slot: i };
    }
  }

  // Each required letter must land somewhere it has never been. With
  // `strictRequired` every one of them must move; otherwise moving any single
  // required letter discharges the obligation for the turn.
  if (c.required.size > 0) {
    let anyMoved = false;
    for (const [letter, used] of c.required) {
      let moved = false;
      for (let i = 0; i < WORD_LENGTH; i++) {
        if (word[i] === letter && c.locked[i] === null && !used.has(i)) {
          moved = true;
          break;
        }
      }
      if (moved) anyMoved = true;
      else if (opts.strictRequired) return { ok: false, reason: 'required', letter };
    }
    if (!opts.strictRequired && !anyMoved) {
      // Any one of them would have satisfied it, so name them all.
      return { ok: false, reason: 'required', letters: [...c.required.keys()] };
    }
  }

  return { ok: true };
}

/** Every word still playable under `c`. */
export function legalWords(c, list, validSet, opts = {}) {
  const out = [];
  for (const w of list) {
    if (checkLegal(c, w, validSet, opts).ok) out.push(w);
  }
  return out;
}

/**
 * Has the round ended before the player even gets to move?
 *
 * @returns {?{ending: string, only?: string}} null if play continues
 */
export function deadEnd(c, list, validSet, solution, opts = {}) {
  const legal = legalWords(c, list, validSet, opts);
  if (legal.length === 0) return { ending: ENDING.STARVED };
  if (legal.length === 1 && legal[0] === solution) {
    return { ending: ENDING.CORNERED, only: solution };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Daily puzzle selection
// ---------------------------------------------------------------------------

const EPOCH = Date.UTC(2026, 0, 1);

/** Days elapsed since the launch epoch, in the player's local timezone. */
export function puzzleNumber(date = new Date()) {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((local - EPOCH) / 86400000);
}

/**
 * Deterministic shuffle-free pick: a large odd stride over the answer list so
 * consecutive days land far apart and the full list cycles before repeating.
 */
export function solutionFor(n, answers) {
  const stride = 1103;
  const i = (((n * stride) % answers.length) + answers.length) % answers.length;
  return answers[i];
}
