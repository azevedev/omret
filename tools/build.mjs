/**
 * Generates the two locale pages from tools/template.html.
 *
 * Both games share one markup source so a change to the board, the modals or
 * the settings list can never drift between languages. All visible text comes
 * from data-i18n keys resolved at runtime by js/i18n.js — the only things
 * substituted here are the bits that must be in the HTML itself for the browser
 * and for crawlers: lang, title, description and the header wordmark.
 *
 *   node tools/build.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const template = readFileSync(join(root, 'tools/template.html'), 'utf8');

const PAGES = [
  {
    dir: 'pt-br',
    LANG: 'pt-BR',
    LOCALE: 'pt-BR',
    TITLE: 'OMRET — Termo ao contrário',
    HEADING: 'OM<span>RET</span>',
    DESCRIPTION:
      'OMRET — o objetivo é NÃO descobrir a palavra. Sobreviva a cinco tentativas sem cair na resposta.',
  },
  {
    dir: 'eng-us',
    LANG: 'en-US',
    LOCALE: 'en-US',
    TITLE: 'Wordle Reversed — OMRET',
    HEADING: 'WORDLE <span>REVERSED</span>',
    DESCRIPTION:
      'Wordle Reversed — the goal is to NOT find the word. Survive five guesses without being cornered into the answer.',
  },
];

for (const page of PAGES) {
  let html = template;
  for (const [key, value] of Object.entries(page)) {
    if (key === 'dir') continue;
    html = html.replaceAll(`{{${key}}}`, value);
  }

  const left = html.match(/\{\{(\w+)\}\}/);
  if (left) throw new Error(`Unsubstituted placeholder {{${left[1]}}} in ${page.dir}`);

  mkdirSync(join(root, page.dir), { recursive: true });
  writeFileSync(join(root, page.dir, 'index.html'), html);
  console.log(`wrote ${page.dir}/index.html  (${page.LOCALE})`);
}
