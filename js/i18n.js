/**
 * OMRET — interface strings.
 *
 * Markup carries `data-i18n` keys instead of literal text, so both locale pages
 * are generated from one template and translated at runtime. `{tokens}` in a
 * string are replaced by the params passed to t().
 */

export const LOCALES = {
  'pt-BR': { label: 'Português (Brasil)', short: 'PT-BR', path: 'pt-br' },
  'en-US': { label: 'English (US)', short: 'EN-US', path: 'eng-us' },
};

export const DEFAULT_LOCALE = 'pt-BR';

const STRINGS = {
  // ─────────────────────────────────────────────────────────────────────────
  'pt-BR': {
    'app.title': 'OMRET',
    'app.tagline': 'Termo ao contrário',
    'app.description':
      'OMRET: o objetivo é NÃO descobrir a palavra. Sobreviva a cinco tentativas sem cair na resposta.',

    'header.help': 'Como jogar',
    'header.stats': 'Estatísticas',
    'header.settings': 'Configurações',

    'status.daily': 'Diário nº {n}',
    'status.practice': 'Treino',
    'status.wordsLeft': '{n} palavras restantes',
    'status.wordsLeftOne': '1 palavra restante',
    'status.poolTitle': 'Quantas palavras você ainda pode jogar',

    'help.title': 'Como Jogar',
    'help.lede': 'Adivinhe a palavra <em>cinco vezes</em>. E, aconteça o que acontecer, <strong>não acerte.</strong>',
    'help.intro':
      'Cada tentativa é marcada como no Termo normal. A diferença é que aqui as marcas mandam em você: <strong>a próxima jogada tem que obedecer a elas.</strong>',
    'help.rule.locked':
      '<strong>Vermelho está travado.</strong> O <b>C</b> está na palavra, exatamente nessa casa. Agora ele está soldado à casa 1, então toda tentativa daqui pra frente tem que começar com C.',
    'help.rule.required':
      '<strong>Âmbar precisa se mover.</strong> O <b>I</b> está na palavra, mas não aí. A partir de agora <em>todas</em> as letras âmbar precisam aparecer em <em>todas</em> as suas tentativas, sempre numa casa onde ela nunca esteve. Você nunca pode largar uma no meio do caminho.',
    'help.rule.banned':
      '<strong>Cinza está morta.</strong> O <b>S</b> não está na palavra, então você nunca mais pode digitá-lo. Seguro por enquanto. Só que seu alfabeto acabou de encolher.',
    'help.rule.spent':
      '<strong>Hachurado quer dizer "não tem mais".</strong> Jogue PAPEL contra PARTE e o segundo <b>P</b> apaga. A palavra só tem um P, e o vermelho já ficou com ele. O P continua travado, então você ainda precisa usá-lo. Só as letras cinza lisas acabaram de vez.',

    'help.ex.locked.word': 'CARTA',
    'help.ex.locked.marks': 'l----',
    'help.ex.required.word': 'PILAR',
    'help.ex.required.marks': '-r---',
    'help.ex.banned.word': 'MUSGO',
    'help.ex.banned.marks': '--b--',
    'help.ex.spent.word': 'PAPEL',
    'help.ex.spent.marks': 'llsrb',
    'help.loseTitle': 'Como você perde',
    'help.lose.found': '<strong>Você digita a resposta.</strong> Derrota na hora. Óbvio.',
    'help.lose.cornered':
      '<strong>Você fica encurralado.</strong> As travas e as letras mortas apertam até que a única palavra que você ainda pode jogar <em>é</em> a resposta. A armadilha fecha sozinha.',
    'help.winTitle': 'Como você vence',
    'help.win': 'Sobreviva às cinco tentativas. Desvie por cinco rodadas e você escapa.',
    'help.tip':
      '<strong>A armadilha:</strong> desviar com letras raras parece seguro, mas cada letra cinza que você queima é uma palavra a menos para onde fugir. Jogue seguro demais e você fica sem saída.',
    'help.fineprint': 'As tentativas precisam ser palavras comuns de cinco letras.',
    'help.cta': 'Bora',

    'stats.title': 'Estatísticas',
    'stats.played': 'Jogos',
    'stats.winPct': '% vitórias',
    'stats.streak': 'Sequência<br>atual',
    'stats.maxStreak': 'Melhor<br>sequência',
    'stats.distTitle': 'Distribuição de Sobrevivência',
    'stats.distNote': 'Em qual rodada a armadilha fechou',
    'stats.nextPuzzle': 'Próximo jogo',
    'stats.share': 'Compartilhar',
    'stats.practice': 'Jogar uma rodada de treino',

    'settings.title': 'Configurações',
    'settings.language': 'Idioma',
    'settings.languageDesc': 'Muda para a outra versão do jogo. Cada idioma tem estatísticas próprias.',
    'settings.dark': 'Tema escuro',
    'settings.pool': 'Mostrar palavras restantes',
    'settings.poolDesc': 'Exibe quantas palavras você ainda pode jogar legalmente',
    'settings.common': 'Apenas palavras comuns',
    'settings.commonDesc':
      'Limita as tentativas a cerca de 2.000 palavras do dia a dia. Desligue para liberar qualquer palavra do dicionário, o que deixa a fuga fácil demais.',
    'settings.strict': 'Toda âmbar precisa se mover',
    'settings.strictDesc':
      'Todas as letras âmbar precisam aparecer em toda tentativa, cada uma numa casa nova. Desligue para a regra branda, em que mover uma só já basta.',
    'settings.wordlist': 'Painel de palavras',
    'settings.wordlistDesc':
      'Ferramenta de teste. Lista todas as palavras, riscando e rebaixando cada uma conforme ela deixa de ser jogável.',
    'settings.contrast': 'Alto contraste',
    'settings.contrastDesc': 'Paleta adaptada para daltonismo',
    'settings.practice': 'Modo treino',
    'settings.practiceDesc': 'Rodadas aleatórias ilimitadas. Não afeta suas estatísticas nem sua sequência.',
    'settings.fineprint': 'Mudar as regras reinicia a rodada atual.',

    'panel.title': 'Palavras',
    'panel.tag': 'teste',
    'panel.alive': 'vivas',
    'panel.dead': 'mortas',
    'panel.close': 'Fechar painel de palavras',
    'panel.playable': 'Jogáveis ({n})',
    'panel.killedBy': 'Mortas pela tentativa {t} ({n})',
    'panel.neverPlayable': 'Nunca jogáveis ({n})',

    'toast.short': 'Faltam letras',
    'toast.notWord': 'Palavra não encontrada',
    'toast.notCommon': 'Palavra pouco comum demais',
    'toast.repeat': 'Você já jogou essa palavra',
    'toast.locked': '<b>{letter}</b> está travado na {ord} casa',
    'toast.banned': '<b>{letter}</b> está morto. Não dá para usar de novo',
    'toast.required': 'Você precisa mover {letters} para uma casa onde ainda não esteve',
    'toast.illegal': 'Tentativa inválida',
    'toast.copied': 'Copiado',
    'toast.copyFailed': 'Não foi possível copiar',
    'toast.ruleChanged': '{what}. Rodada reiniciada',
    'toast.strictChanged': 'Regra âmbar alterada',
    'toast.dictChanged': 'Lista de palavras alterada',
    'toast.nowhere': 'Sem saída',
    'toast.or': 'ou',

    'end.survived': 'Sobreviveu',
    'end.survivedBody': 'Cinco tentativas, e você nunca encostou em <b>{word}</b>.',
    'end.found': 'Você acertou',
    'end.foundBody': 'A palavra era <b>{word}</b>. Era justamente o que você tinha que evitar.',
    'end.cornered': 'Encurralado',
    'end.corneredBody': '<b>{word}</b> era a única palavra que você ainda podia jogar.',
    'end.starved': 'Sem palavras',
    'end.starvedBody': 'Não sobrou nenhuma palavra legal. A resposta era <b>{word}</b>.',

    'share.survived': 'Sobrevivi {n}/{max}',
    'share.found': 'Acertei na {n}/{max}, perdi',
    'share.cornered': 'Encurralado na {n}/{max}',

    'ordinal.1': '1ª', 'ordinal.2': '2ª', 'ordinal.3': '3ª', 'ordinal.4': '4ª', 'ordinal.5': '5ª',
  },

  // ─────────────────────────────────────────────────────────────────────────
  'en-US': {
    'app.title': 'WORDLE REVERSED',
    'app.tagline': 'Wordle, backwards',
    'app.description':
      'Wordle Reversed: the goal is to NOT find the word. Survive five guesses without being cornered into the answer.',

    'header.help': 'How to play',
    'header.stats': 'Statistics',
    'header.settings': 'Settings',

    'status.daily': 'Daily #{n}',
    'status.practice': 'Practice',
    'status.wordsLeft': '{n} words left',
    'status.wordsLeftOne': '1 word left',
    'status.poolTitle': 'How many words you could still legally play',

    'help.title': 'How To Play',
    'help.lede': 'Guess the word <em>five times</em>. Whatever you do, <strong>don\'t find it.</strong>',
    'help.intro':
      'Every guess is marked exactly like normal Wordle. The difference is that here the marks give orders: <strong>your next guess has to obey them.</strong>',
    'help.rule.locked':
      '<strong>Red is locked.</strong> <b>C</b> is in the word, in that exact spot. It is welded to slot 1 now, so every guess you make from here has to start with C.',
    'help.rule.required':
      '<strong>Amber must move.</strong> <b>I</b> is in the word but not there. From now on <em>every</em> amber letter has to appear in <em>every</em> guess you make, each time in a slot it has never occupied. You can never quietly drop one.',
    'help.rule.banned':
      '<strong>Gray is dead.</strong> <b>S</b> isn\'t in the word, so you may never type it again. Safe this turn. Your alphabet just got smaller.',
    'help.rule.spent':
      '<strong>Hatched means "no more of these".</strong> Guess REFER against RETCH and that last <b>R</b> greys out. The word has only one R, and the red tile already claimed it. R is still locked, so you still have to use it. Only flat gray letters are really gone.',

    'help.ex.locked.word': 'CRANE',
    'help.ex.locked.marks': 'l----',
    'help.ex.required.word': 'PILOT',
    'help.ex.required.marks': '-r---',
    'help.ex.banned.word': 'MUSKY',
    'help.ex.banned.marks': '--b--',
    'help.ex.spent.word': 'REFER',
    'help.ex.spent.marks': 'llbss',
    'help.loseTitle': 'How you lose',
    'help.lose.found': '<strong>You type the answer.</strong> Instant loss. Obviously.',
    'help.lose.cornered':
      '<strong>You get cornered.</strong> The locks and the dead letters squeeze until the only word you are still allowed to play <em>is</em> the answer. The trap closes on its own.',
    'help.winTitle': 'How you win',
    'help.win': 'Survive all five guesses. Dodge for five turns and you walk away.',
    'help.tip':
      '<strong>The trap:</strong> dodging with obscure letters feels safe, but every gray letter you burn is one less word you can escape into. Play too safe and you\'ll run out of room.',
    'help.fineprint': 'Guesses must be common five-letter words.',
    'help.cta': 'Let\'s go',

    'stats.title': 'Statistics',
    'stats.played': 'Played',
    'stats.winPct': 'Win %',
    'stats.streak': 'Current<br>Streak',
    'stats.maxStreak': 'Max<br>Streak',
    'stats.distTitle': 'Survival Distribution',
    'stats.distNote': 'Which turn the trap closed on you',
    'stats.nextPuzzle': 'Next puzzle',
    'stats.share': 'Share',
    'stats.practice': 'Play a practice round',

    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.languageDesc': 'Switches to the other version of the game. Each language keeps its own stats.',
    'settings.dark': 'Dark Theme',
    'settings.pool': 'Show words remaining',
    'settings.poolDesc': 'Displays how many words you can still legally play',
    'settings.common': 'Common words only',
    'settings.commonDesc':
      'Restricts guesses to everyday words. Turn it off to allow any dictionary word, which makes dodging much too easy.',
    'settings.strict': 'Every amber must move',
    'settings.strictDesc':
      'All amber letters must appear in every guess, each in a new slot. Turn off for the lenient rule where moving any single one is enough.',
    'settings.wordlist': 'Word pool panel',
    'settings.wordlistDesc':
      'Testing aid. Lists every word, crossing out and demoting each one as it becomes unplayable.',
    'settings.contrast': 'High contrast',
    'settings.contrastDesc': 'Colour-blind friendly palette',
    'settings.practice': 'Practice mode',
    'settings.practiceDesc': 'Unlimited random rounds. Doesn\'t affect your stats or streak.',
    'settings.fineprint': 'Changing a rule restarts the current round.',

    'panel.title': 'Word pool',
    'panel.tag': 'testing',
    'panel.alive': 'alive',
    'panel.dead': 'dead',
    'panel.close': 'Close word pool',
    'panel.playable': 'Playable ({n})',
    'panel.killedBy': 'Killed by guess {t} ({n})',
    'panel.neverPlayable': 'Never playable ({n})',

    'toast.short': 'Not enough letters',
    'toast.notWord': 'Not in word list',
    'toast.notCommon': 'Not a common enough word',
    'toast.repeat': 'You already played that word',
    'toast.locked': '<b>{letter}</b> is locked in the {ord} slot',
    'toast.banned': '<b>{letter}</b> is dead. You can\'t use it again',
    'toast.required': 'You must move {letters} to a slot it hasn\'t been in',
    'toast.illegal': 'Not a legal guess',
    'toast.copied': 'Copied to clipboard',
    'toast.copyFailed': 'Could not copy',
    'toast.ruleChanged': '{what}. Round restarted',
    'toast.strictChanged': 'Amber rule changed',
    'toast.dictChanged': 'Word list changed',
    'toast.nowhere': 'Nowhere left to go',
    'toast.or': 'or',

    'end.survived': 'Survived',
    'end.survivedBody': 'Five guesses, and you never touched <b>{word}</b>.',
    'end.found': 'You found it',
    'end.foundBody': 'The word was <b>{word}</b>. That was the one thing you had to avoid.',
    'end.cornered': 'Cornered',
    'end.corneredBody': '<b>{word}</b> was the only word you were still allowed to play.',
    'end.starved': 'Starved',
    'end.starvedBody': 'No legal word remained. The answer was <b>{word}</b>.',

    'share.survived': 'Survived {n}/{max}',
    'share.found': 'Found it on {n}/{max}, lost',
    'share.cornered': 'Cornered on {n}/{max}',

    'ordinal.1': '1st', 'ordinal.2': '2nd', 'ordinal.3': '3rd', 'ordinal.4': '4th', 'ordinal.5': '5th',
  },
};

let current = DEFAULT_LOCALE;

export function setLocale(locale) {
  current = STRINGS[locale] ? locale : DEFAULT_LOCALE;
  return current;
}

export const getLocale = () => current;

/** Look up a string and substitute {tokens}. */
export function t(key, params = {}) {
  const table = STRINGS[current] || STRINGS[DEFAULT_LOCALE];
  let s = table[key] ?? STRINGS[DEFAULT_LOCALE][key] ?? key;
  for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

/**
 * Build the little worked examples in "how to play" from the locale's own
 * words, so a Portuguese player is taught with Portuguese.
 *
 * Each example is a word plus one mark per letter:
 *   l locked · r required · b banned · s spent (no more copies) · - unmarked
 */
const MARK_CLASS = { l: 'locked', r: 'required', b: 'banned', s: 'spent', '-': '' };

export function renderExamples(root = document) {
  for (const row of root.querySelectorAll('[data-example]')) {
    const name = row.dataset.example;
    const word = t(`help.ex.${name}.word`);
    const marks = t(`help.ex.${name}.marks`);

    row.textContent = '';
    [...word].forEach((letter, i) => {
      const cell = document.createElement('div');
      cell.className = `mini ${MARK_CLASS[marks[i]] ?? ''}`.trim();
      cell.textContent = letter;
      row.appendChild(cell);
    });
  }
}

/** Fill every element carrying an i18n attribute. */
export function applyI18n(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  }
  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    el.title = t(el.dataset.i18nTitle);
  }
  renderExamples(root);
}
