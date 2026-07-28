# OMRET

**OMRET** is TERMO backwards — and that's the whole idea. It's a full Wordle clone
with one rule change: **the goal is to *not* find the word.**

Two editions, same game, same identity:

| | | |
| --- | --- | --- |
| **OMRET** | `/pt-br/` | Português (Brasil) — the default |
| **Wordle Reversed** | `/eng-us/` | English (US) |

The root URL asks which language you want, remembers the answer, and sends you
straight there on every later visit. Share the root link when you don't know the
person's language; share the direct link when you do.

## The rules

Every guess is marked exactly like normal Wordle. But the marks aren't hints —
they're obligations on your next guess:

| Mark | Wordle meaning | Here |
| --- | --- | --- |
| 🟥 Red | green — right letter, right spot | **Locked.** Welded to that slot for the rest of the game. |
| 🟧 Amber | yellow — right letter, wrong spot | **Must move.** *Every* amber letter must appear in *every* later guess, each time in a slot it has never occupied. You can never quietly drop one. |
| ⬛ Gray | absent | **Dead.** You may never type that letter again. |
| ▨ Hatched | gray, but the letter is locked or amber elsewhere | **No more copies.** REFER against RETCH greys the last R — the word's only R was already claimed. R is still locked, so you must keep using it. |

Survive six guesses without typing the answer and you win.

**The two ways to lose:** you type the answer, or you get **cornered** — the locks,
obligations and dead letters squeeze until the only word you're still allowed to
play *is* the answer. The trap closes on its own, and the game spells the word out
for you when it does.

## Portuguese and accents

The pt-BR edition works like TERMO: you type without accents and letters match
without them, but the board shows the proper spelling. Type `acoes` and the tiles
reveal **A Ç Õ E S**. Internally every word is an accent-stripped key and
`DISPLAY` maps it to its real spelling, so `ç` matches `c` and `õ` matches `o`
without any special cases in the rules engine.

## Running it

Static, no build step, no dependencies — but it must be served over HTTP, since ES
modules don't load over `file://`:

```sh
python3 -m http.server 8000
# http://localhost:8000
```

After editing `tools/template.html`, regenerate the two locale pages:

```sh
node tools/build.mjs
```

## Deploying to GitHub Pages

```sh
git init
git add .
git commit -m "OMRET"
git branch -M main
git remote add origin git@github.com:<user>/omret.git
git push -u origin main
```

Then **Settings → Pages → Deploy from a branch → `main` / `root`**. Subdirectories
work as-is, so you get:

```
https://<user>.github.io/omret/          language chooser
https://<user>.github.io/omret/pt-br/    OMRET
https://<user>.github.io/omret/eng-us/   Wordle Reversed
```

All asset paths are relative, so it works the same under a custom domain
(`omret.com.br/pt-br/`) with a `CNAME` file at the root.

**Run `node tools/build.mjs` before every push.** It regenerates the locale pages
and stamps a content hash onto every asset URL, which is what stops players from
running a stale build.

### Why the cache needs handling

GitHub Pages serves everything with `Cache-Control: max-age=600` and gives you no
way to change that, so for ten minutes a browser is entitled to reuse the old
files. Three things address it:

1. **Hashed asset URLs.** The build hashes the CSS and JS and stamps `?v=<hash>`
   on every reference. New build, new URLs, guaranteed fetch.
2. **The hash is passed down the import chain.** A query string is *not* inherited
   by a module's own imports, so a versioned `game.js` would still pull a cached
   `engine.js` — a fresh entry point wired to stale internals, which is worse than
   no cache busting at all. `game.js` reads its own version back off
   `import.meta.url` and appends it to every import it makes.
3. **`version.json` catches stale HTML.** Hashing cannot help a page whose HTML is
   itself cached, because that HTML points at the old hashes. On load the page
   fetches `version.json` with `cache: 'no-store'` and, if it disagrees, reloads
   through a URL the CDN has never seen. A `sessionStorage` guard means it can
   only do this once per deploy, so a bad fetch can never loop the page.

The one case still not covered is a tab left open across a deploy without being
reloaded; it keeps playing the old build until the player revisits. Fixing that
properly needs a real CDN in front, not Pages.

### Link previews

Every page carries Open Graph and Twitter card tags with absolute image URLs, so a
pasted link unfurls with a real card in Slack, WhatsApp, Discord and X. The three
images in `assets/` are 1200x630 JPEGs.

They are screenshots of `tools/social-card.html`, which draws the card in the
game's own colours at exactly 1200x630. To change one, edit that file, open it at
`?locale=pt` or `?locale=en` in a 1200x630 viewport, and save the screenshot over
the matching file in `assets/`. The root card reuses the Portuguese one, since the
chooser leads in Portuguese.

## Layout

```
index.html          language chooser (self-contained, no shared assets)
pt-br/index.html    generated
eng-us/index.html   generated
css/style.css       shared
js/engine.js        rules — pure functions, no DOM
js/game.js          rendering, input, persistence
js/i18n.js          every interface string, both languages
js/words-pt.js      2,000 answers + 3,350 extra, plus accent spellings
js/words-en.js      2,315 answers + 10,657 extra
tools/template.html single markup source for both editions
tools/build.mjs     writes the two locale pages
tools/simulate.mjs  offline balance testing
```

Both editions run the same `game.js` against the same `engine.js`; only the word
module and the string table differ. `engine.js` has no DOM dependency, so the
simulator and the browser play by byte-identical rules.

## Balance

```sh
node tools/simulate.mjs 400 pt     # or: en
```

Survival rate at the shipped config: 6 guesses, common words, every amber must
move. Higher means easier.

| Edition | random | rare-letter dodge | conserve-alphabet |
| --- | --- | --- | --- |
| Português | 11.3% | 39.0% | **56.8%** |
| English | 9.0% | **52.0%** | 48.0% |

The two languages reward *different* strategies, which was not designed. It falls
out of the dictionaries. English answers are full of rare consonants you can dodge
into, so hunting obscure letters wins. Portuguese answers share vowels far more
heavily, so obscure letters make contact anyway and conserving your alphabet wins
instead.

Findings that shaped the rules:

1. **The guess dictionary is the difficulty.** With the full English dictionary the
   dodge strategy survives 92.8%, and tightening the rules barely dents it.
   Restricting guesses to common words is the only lever that bites. Hence
   "Common words only", on by default.
2. **More guesses makes this game harder, not easier**, the opposite of Wordle.
   Surviving is winning, so every extra turn is another chance to get cornered.
   Going from five guesses to six drops the best English line from 75.0% to 52.0%,
   and the best Portuguese line from 76.3% to 56.8%.
3. **Starving is unreachable.** Running out of *every* legal word never happened in
   any variant, in either language, including under a strategy built to force it.
   `STARVED_IS_LOSS` still handles it, but it isn't a real ending.

## Settings

- **Language** — switches edition. Each keeps its own stats and streak.
- **Common words only** — the difficulty lever above.
- **Every amber must move** — on by default, and the intended rule. Off relaxes it
  so moving any single amber letter satisfies the turn.
- **Show words remaining** — live count, escalating through five colour bands as
  the trap closes, with a `−1,886` chip showing what the last guess destroyed.
- **Word pool panel** — testing aid listing every word, struck through and demoted
  as it becomes unplayable. A side column on desktop, a bottom sheet on phones
  (tap the counter).
- **Practice mode** — unlimited random rounds; doesn't touch stats.
- Dark theme and a colour-blind-friendly high contrast palette.

## Word lists

Portuguese is built from the [IME-USP Brazilian word list](https://www.ime.usp.br/~pf/dicios/)
ranked by [OpenSubtitles frequency](https://github.com/hermitdave/FrequencyWords),
keeping the 2,000 most common five-letter words as answers. English uses the
public Wordle answer and allowed-guess lists.
