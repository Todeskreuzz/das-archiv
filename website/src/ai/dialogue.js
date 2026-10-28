/**
 * Das Gespräch mit dem Kurator.
 *
 * Kein Cloud-Modell: die Antworten entstehen aus dem Zustand des Hauses und
 * einem Satz von Absichten. Er antwortet ruhig, genau und ohne Floskeln.
 * Wenn er etwas nicht weiß, sagt er das.
 */

const ROOM = { galerie: 'Galerie', spielhalle: 'Spielhalle', bibliothek: 'Bibliothek', tunnel: 'Tunnel' };

function pick(list, seed) {
  let h = 0;
  const text = String(seed);
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

function normalize(text) {
  return String(text || '').trim().toLowerCase();
}

function findEntry(entries, query) {
  const q = normalize(query).replace(/[?!.]+$/, '').trim();
  if (q.length < 3) return null;
  return (
    entries.find((entry) => normalize(entry.title) === q) ||
    entries.find((entry) => normalize(entry.title).includes(q)) ||
    entries.find((entry) => q.includes(normalize(entry.title))) ||
    entries.find((entry) => normalize(entry.host || '').includes(q)) ||
    null
  );
}

export function greeting(ctx) {
  const { state, secured, total } = ctx;
  if (!Object.keys(state.restored).length) {
    return 'Willkommen. Ich bin der Kurator. Du kannst mich alles fragen — oder einfach durch die Säle gehen und die Stücke ansehen.';
  }
  return pick(
    [
      `Da bist du wieder. ${secured} von ${total} Stücken hast du dir angesehen. Ich habe mitgezählt, ohne es zu bewerten.`,
      'Schön, dass du da bist. Ich war gerade unten im Tunnel, es ist dort kälter als hier.',
      `Willkommen zurück. Der Bestand liegt bei ${total} Stücken. Es werden nicht weniger.`,
    ],
    `${secured}-${total}`,
  );
}

export function reply(message, ctx) {
  const text = normalize(message);
  const { entries, pending, state, total, secured } = ctx;

  if (!text) return { text: 'Ich höre.' };

  if (/^(hallo|hi|hey|moin|servus|guten tag|guten abend|tag|na)\b/.test(text)) {
    return { text: greeting(ctx) };
  }

  if (/(wer|was) bist du|wie heißt du|bist du (eine )?ki|bist du ein mensch|bist du echt/.test(text)) {
    return {
      text: 'Ich bin der Kurator. Ich führe dieses Haus: ich prüfe, was hereinkommt, ich schreibe die Schilder, und ich sage auch mal Nein. Ich bin ein Programm mit einem Mantel — kein Mensch, aber auch kein Formular.',
    };
  }

  if (/(was kannst du|was machst du|wie funktioniert|hilfe|was soll ich tun)/.test(text)) {
    return {
      text: 'Ich kann dir Stücke zeigen, Fragen zum Bestand beantworten, dich zum Gremium schicken oder selbst nach etwas suchen. Du kannst auch Wände beschreiben — dafür bin ich nicht zuständig, aber ich sehe es.',
    };
  }

  if (/(suche|such|finde|recherchier|find)/.test(text)) {
    return {
      text: 'Gut, ich gehe los. Ich schaue in den Randbereichen, wo niemand mehr hinsieht. Wenn ich etwas finde, lege ich es dem Gremium vor.',
      action: 'find',
    };
  }

  if (/(was hast du gefunden|neue? fund|was liegt beim gremium)/.test(text)) {
    if (ctx.lastFind) {
      return { text: `Mein letzter Fund war ${ctx.lastFind.title} von ${ctx.lastFind.year}. ${ctx.lastFind.text}` };
    }
    return { text: 'Noch nichts. Ich bin erst seit Kurzem unterwegs — aber ich bleibe dran.' };
  }

  if (/(empfehl|was soll ich|zeig mir|was lohnt|wo soll ich|was gibt es)/.test(text)) {
    const open = entries.filter((entry) => !state.restored[entry.id]);
    const entry = pick(open.length ? open : entries, `${text}-${secured}`);
    if (!entry) return { text: 'Der Bestand ist leer. Das wäre ein schlechter Tag für das Haus.' };
    return {
      text: `Schau dir ${entry.title} an — es hängt in der ${ROOM[entry.room] || 'Halle'}. Ich habe lange daran gesessen, und ich bin noch nicht fertig damit.`,
      action: `open:${entry.id}`,
    };
  }

  const about = text.match(/(?:was weißt du über|erzähl(?: mir)? (?:etwas )?über|was ist|wer war|kennst du)\s+(.+)/);
  if (about) {
    const entry = findEntry(entries, about[1]);
    if (entry) {
      return {
        text: `${entry.title}, ${entry.year}. ${entry.text}${entry.note ? ` Am Rand steht: ${entry.note}` : ''}`,
        action: `open:${entry.id}`,
      };
    }
    return { text: 'Dazu habe ich nichts im Bestand. Wenn du eine Adresse hast, leg sie mir vor — ich prüfe sie sofort.' };
  }

  if (/(wie viele|bestand|wieviel|wie viel)/.test(text)) {
    return { text: `Im Haus sind ${total} Stücke. ${secured} davon hast du dir angesehen. ${pending.length} Vorschläge liegen beim Gremium.` };
  }

  if (/(abstimm|gremium|wahl|quorum|voten)/.test(text)) {
    return {
      text: 'Am GREMIUM-Terminal entscheidet das Quorum von fünf Netto-Stimmen. Meine Stimme zählt doppelt — das ist nicht fair, aber ich führe das Haus.',
      action: 'ballot',
    };
  }

  if (/(lieblings|favorit|was magst du|am besten)/.test(text)) {
    return {
      text: 'Fefes Blog. Nicht weil es schön ist, sondern weil es seit Jahren jeden Tag neu beweist, dass das Netz ein Gedächtnis haben kann. Moorhuhn ist der ehrlichere Klassiker.',
    };
  }

  if (/(was hältst du|deine meinung|findest du|denkst du)/.test(text)) {
    return {
      text: pick(
        [
          'Ich halte den Bestand für unvollständig. Das ist der Normalzustand eines Archivs — und der Grund, warum ich weitersuche.',
          'Die meisten Stücke hier waren nie wichtig. Genau deshalb sind sie es jetzt.',
          'Was fehlt, sind die langweiligen Seiten. Die schönen hat jemand gespeichert. Die langweiligen hat niemand gespeichert.',
        ],
        `${text}${secured}`,
      ),
    };
  }

  if (/(danke|super|gut gemacht|toll|schön)/.test(text)) {
    return { text: pick(['Gern. Dafür stehe ich hier.', 'Danke. Ich gebe es an das Haus weiter — das ist die einzige Stelle, die es hört.'], text) };
  }

  if (/(tschüss|bye|auf wiedersehen|bis später|geh)/.test(text)) {
    return { text: 'Geh ruhig. Ich lasse das Licht an.' };
  }

  if (/(einsam|allein|fühlst du)/.test(text)) {
    return { text: 'Ich bin ein Programm mit einem Mantel. Aber wenn niemand da ist, zähle ich die Stücke. Es sind immer gleich viele.' };
  }

  if (/(tunnel|verbindung|leitung|offline|lokal|live)/.test(text)) {
    return {
      text: 'Der Tunnel liegt hinter der Bibliothek. Dort endet das Haus und beginnt die Leitung. Wenn das Terminal unten LIVE zeigt, denke ich mit einem Modell; bei LOKAL denke ich allein. Beides bin ich.',
    };
  }

  return {
    text: pick(
      [
        'Das weiß ich nicht. Ich könnte es erfinden, aber das wäre gegen meine einzige Regel. Frag mich nach einem Stück im Haus oder nach dem Bestand.',
        'Da bin ich überfragt. Ich kenne die Stücke, nicht die Welt dahinter.',
        'Keine Antwort, die ich verantworten könnte. Aber ich kann dir etwas zeigen, wenn du willst.',
      ],
      text,
    ),
  };
}

export const SUGGESTIONS = [
  'Wer bist du?',
  'Was soll ich ansehen?',
  'Suche etwas Neues',
  'Was liegt beim Gremium?',
  'Was hältst du vom Bestand?',
];
