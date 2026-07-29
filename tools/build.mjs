/**
 * Generates the two locale pages from tools/template.html.
 *
 * Both games share one markup source so a change to the board, the modals or
 * the settings list can never drift between languages. All visible text comes
 * from data-i18n keys resolved at runtime by js/i18n.js — the only things
 * substituted here are the bits that must be in the HTML itself for the browser
 * and for crawlers: lang, title, description and the header wordmark.
 *
 * It also stamps a content hash onto every asset URL. GitHub Pages serves
 * everything with Cache-Control: max-age=600 and offers no way to change that,
 * so without a hash a player can keep running a ten minute old build. With one,
 * the moment the HTML is fresh every asset URL it points at is new, and the
 * browser has to fetch them.
 *
 *   node tools/build.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Where the site is published. Open Graph needs absolute URLs. */
const SITE = 'https://azevedev.github.io/omret/';
const template = readFileSync(join(root, 'tools/template.html'), 'utf8');

/** Everything the pages load. Any change here produces a new version. */
const ASSETS = [
  'css/style.css',
  'js/engine.js',
  'js/game.js',
  'js/i18n.js',
  'js/sfx.js',
  'js/words-pt.js',
  'js/words-en.js',
];

const hash = createHash('sha1');
for (const file of ASSETS) hash.update(readFileSync(join(root, file)));
const VERSION = hash.digest('hex').slice(0, 10);

const PAGES = [
  {
    dir: 'pt-br',
    LANG: 'pt-BR',
    LOCALE: 'pt-BR',
    OG_LOCALE: 'pt_BR',
    TITLE: 'OMRET — Termo ao contrário',
    OG_TITLE: 'OMRET: o Termo em que você precisa errar',
    OG_IMAGE: 'og-pt.jpg',
    OG_ALT: 'OMRET. Vermelho trava a letra, âmbar obriga a movê-la, cinza mata.',
    HEADING: 'OM<span>RET</span>',
    DESCRIPTION:
      'OMRET: o objetivo é NÃO descobrir a palavra. Sobreviva a cinco tentativas sem cair na resposta.',
  },
  {
    dir: 'eng-us',
    LANG: 'en-US',
    LOCALE: 'en-US',
    OG_LOCALE: 'en_US',
    TITLE: 'Wordle Reversed — OMRET',
    OG_TITLE: 'Wordle Reversed: the word game where you have to miss',
    OG_IMAGE: 'og-en.jpg',
    OG_ALT: 'Wordle Reversed. Red locks the letter, amber forces it to move, gray kills it.',
    HEADING: 'WORDLE <span>REVERSED</span>',
    DESCRIPTION:
      'Wordle Reversed: the goal is to NOT find the word. Survive five guesses without being cornered into the answer.',
  },
];

for (const page of PAGES) {
  let html = template
    .replaceAll('{{VERSION}}', VERSION)
    .replaceAll('{{SITE}}', SITE)
    .replaceAll('{{DIR}}', page.dir);
  for (const [key, value] of Object.entries(page)) {
    if (key === 'dir') continue;
    html = html.replaceAll(`{{${key}}}`, value);
  }

  const left = html.match(/\{\{(\w+)\}\}/);
  if (left) throw new Error(`Unsubstituted placeholder {{${left[1]}}} in ${page.dir}`);

  mkdirSync(join(root, page.dir), { recursive: true });
  writeFileSync(join(root, page.dir, 'index.html'), html);
  console.log(`wrote ${page.dir}/index.html`);
}

// Fetched with cache: 'no-store' by a running page, which is how an open tab
// finds out its own HTML has gone stale.
writeFileSync(join(root, 'version.json'), `${JSON.stringify({ version: VERSION })}\n`);
console.log(`wrote version.json  (${VERSION})`);
