/**
 * Was der Kurator über die Dinge im Haus sagt, wenn man sie ansieht.
 * Jedes Objekt im Gebäude ist anfassbar — auch die langweiligen.
 */

export const PROPS = {
  dais: {
    title: 'Podest',
    text: 'Messing, zwei Meter drei. Ich stehe nicht oft darauf. Ein Podest ist ein Versprechen, das man täglich einlösen muss.',
  },
  bank: {
    title: 'Sitzbank',
    text: 'Eiche, dunkel gebeizt, sechs Latten. Wer hier sitzt, bleibt länger als geplant. Das ist der Zweck.',
  },
  bank_galerie: {
    title: 'Sitzbank, Galerie',
    text: 'Die einzige Bank, von der aus man alle zwölf Bilder gleichzeitig sieht. Man erkennt dann, dass sie zusammengehören.',
  },
  pflanze: {
    title: 'Topfpflanze',
    text: 'Sie hat keinen Namen und keine Aufgabe. Sie steht da und ist grün. In einem Archiv ist das eine Seltenheit.',
  },
  absperrung: {
    title: 'Absperrstange',
    text: 'Messing, mit Seil. Sie hält niemanden auf. Sie sagt nur: hier beginnt der Teil, der wichtiger aussieht.',
  },
  tuer: {
    title: 'Eingangstür',
    text: 'Zwei Flügel, vier Meter hoch, von innen verriegelt. Das Haus schließt nicht. Es wartet nur.',
  },
  fenster: {
    title: 'Fenster',
    text: 'Nachts sieht man nur die Straßenlaterne und den Mond. Beides ist älter als das Internet.',
  },
  kronleuchter: {
    title: 'Kronleuchter',
    text: 'Messingring mit sechs Birnen. Er wurde für ein anderes Gebäude gebaut. Wir haben ihn passend gemacht.',
  },
  lesetisch: {
    title: 'Lesetisch',
    text: 'Vier Beine, zwei Lampen, ein Stapel. Wer hier sitzt, liest meistens nicht, sondern blättert.',
  },
  regal: {
    title: 'Regal',
    text: 'Fünf Böden, Eschenholz. Die unteren Fächer sind voll, die oberen leer. Das ist bei Archiven immer so.',
  },
  leiter: {
    title: 'Bibliotheksleiter',
    text: 'Sie rollt auf einer Schiene. Benutzt hat sie seit Jahren niemand. Sie ist trotzdem wichtig.',
  },
  automat: {
    title: 'Spielautomat',
    text: 'Ein Gehäuse, ein Bildschirm, ein Joystick. Die Spiele darin laufen nicht mehr — aber ihr Abbild läuft.',
  },
  rahmen: {
    title: 'Bilderrahmen',
    text: 'Messing und Pappe. Der Rahmen ist teurer als das, was er hält. Das ist bei Museumswürden normal.',
  },
  laeufer: {
    title: 'Teppichläufer',
    text: 'Rot, abgetreten, an den Rändern ausgefranst. Er zeigt den Weg, den alle gehen. Auch du.',
  },
  prozessor: {
    title: 'Verbindungskern',
    text: 'Der Kern. Hier endet der Tunnel und beginnt die Leitung nach draußen. Wenn es hier kalt ist, bin ich es auch.',
  },
  server: {
    title: 'Serverrack',
    text: 'Vierzig Höheneinheiten, meistens leer. Die Lampen blinken trotzdem. Das ist die ehrlichste Form von Betrieb.',
  },
  verbindungsterminal: {
    title: 'Verbindungsterminal',
    text: 'Mein Anschluss an die Welt. Steht die Leitung, bin ich hier. Steht sie nicht, bin ich auch hier — nur leiser.',
  },
  tunnel_tuer: {
    title: 'Stahltür',
    text: 'Schwer, gedämmt, ohne Fenster. Von der Bibliothek aus führt sie in den Tunnel. Niemand fragt, warum ein Museum einen Tunnel hat.',
  },
  rohr: {
    title: 'Leitungsrohr',
    text: 'Warmwasser, Kaltwasser, Daten. Zwei davon sind wichtiger als die anderen.',
  },
  luke: {
    title: 'Bodenluke',
    text: 'Ein Schacht in den Keller. Darunter liegt nichts, was du sehen willst. Ich habe nachgesehen.',
  },
  lampe: {
    title: 'Deckenleuchte',
    text: 'Ein Baldachin aus Messing, eine Birne, warmes Licht. Sie brennt seit Jahren. Ich habe sie nie ausgehen sehen.',
  },
  kabel: {
    title: 'Kabelkanal',
    text: 'Vier Leitungen: Strom, Netzwerk, Telefon, Reserve. Die Reserve ist die wichtigste.',
  },
  sschild: {
    title: 'Hausschild',
    text: 'DAS ARCHIV. Darunter: Deutsches Internet-Museum. Darunter, sehr klein: seit 1994.',
  },
};

export function propData(id) {
  return PROPS[id] || { title: 'Objekt', text: 'Ein Gegenstand ohne Geschichte. Noch.' };
}
