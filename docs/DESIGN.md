# DAS ARCHIV — Design

Wie die Welt gebaut ist, warum sie so aussieht und wo man weitermachen kann.

---

## 1. Leitidee

Das Archiv ist kein Menü, sondern ein **Ort**. Man geht hinein, wird leiser, und die Stücke
stehen in Räumen, die zu ihnen passen. Die Oberfläche ist kein Interface, sondern ein
**Instrument**: schwarz, weiß, dünne Linien, Monospace — wie ein Katalogterminal von 1994.

Die KI ist nicht unsichtbar. Sie hat einen Körper, eine Stimme, eine Meinung und einen Stempel.

---

## 2. Bildsprache

### 2.1 Der Röhrenblick

Die Szene wird nicht in Fenstergröße gerendert, sondern bei **460 Pixel Höhe** in ein
Render-Target und danach über einen Vollbild-Shader wieder auf den Bildschirm gezeichnet.
Das ergibt große, harte Pixel ohne Weichzeichnung.

Der Shader (`src/engine/post.js`) macht vier Dinge:

1. **Scanlines** — `0,92 + 0,08 · sin(y · π)`
2. **Dithering** — 8×8-Bayer-Matrix aus einer Textur, addiert mit Stärke `1,15 / Stufen`
3. **Quantisierung** — fünf Stufen pro Farbkanal (`floor(c · 5 + 0,5) / 5`)
4. **Grading** — Vignette, kaltes Blau in den Schatten, warmes Papierweiß in den Lichtern,
   minimale Körnung

Die Folge: keine weichen Verläufe, sondern Flächen mit Punktraster. Genau der Druck-Look
eines alten Handbuchs.

### 2.2 Farben

| Rolle | Wert |
| --- | --- |
| Nacht / Grund | `#05070c` |
| Papier / Linien | `#e8e2d0` |
| Bernstein (Akzent) | `#ffcf6a` |
| Zyan (der Kurator) | `#6ee7d7` |
| Rot (Teppich, Abstimmung) | `#a3252f` |
| Grün (angenommen) | `#8ee08a` |

Mehr braucht es nicht. Alles andere entsteht durch Dithering zwischen diesen Tönen.

### 2.3 Oberfläche

- 1 px Rahmen, keine Rundungen, keine Schatten außer einem harten schwarzen Versatz
- Monospace überall, Überschriften in Großbuchstaben mit `letter-spacing: 0.16em`
- HUD-Boxen: `#03050a` mit 88 % Deckkraft, 1 px Rand
- Der Zielrahmen ist ein weißes Rechteck um das Objekt, Beschriftung links oben,
  Wert rechts unten — dieselbe Sprache wie das Menü

---

## 3. Grundriss

Alle Maße in Metern, Ursprung in der Hallenmitte. `+z` zeigt zum Eingang, `-z` nach Norden.

```
                            z = -18
                    ┌───────────────────┐
                    │    BIBLIOTHEK     │
                    │      20 × 10      │
                    │  Regale, Tisch    │
                    └─────────┬─────────┘
                              │ 3 m Durchgang
   z = -6   ┌─────────────────┴─────────────────┐
            │                                   │
            │  GALERIE          HALLE           │   SPIELHALLE
            │  12 × 12          20 × 16          │   12 × 12
            │                                   │
            │ 12 Bilder     [ KURATOR ]         │   9 Automaten
            │               Podest r = 2,1      │
            │                                   │
            └─────────────────┬─────────────────┘
                              │ 5,2 m Tor
                        ┌─────┴─────┐
                        │  EINGANG  │        z = +8
                        └───────────┘
        x = -22        x = -10      x = +10        x = +22
```

**Wände** sind Rechtecke mit Durchgängen (`wall()` in `engine/builder.js`); jede Wand
registriert einen Kollider. **Kollision:** Der Spieler ist ein Kreis mit Radius 0,34 m.
`resolve()` schiebt ihn in drei Durchläufen aus allen Rechtecken — kein Physik-Engine, kein Navmesh.

**Decken:** 9 m in der Halle, 6,4 m in den Flügeln.

---

## 4. Der Kurator

### 4.1 Warum diese Gestalt

Ein Archiv ist ein Ort der Karten, Ausdrucke und Stempel. Also besteht der Körper aus
Punktmatrix-Stoff: ein Mantel, der aussieht wie Endlospapier, das unten ausfranst.

Ein Gesicht aus Fleisch wäre eine Lüge. Also ist der Kopf ein **Bildschirm** mit einem grob
gerasterten Porträt — ein gescanntes Gesicht, das alle paar Sekunden die Miene wechselt.
Die Scanzeile darüber ist die einzige Mimik, die wirklich zählt.

Der Stempel in der rechten Hand ist keine Dekoration: er schlägt zu, wenn ein Urteil fällt.

### 4.2 Bauteile

| Teil | Geometrie | Material |
| --- | --- | --- |
| Mantel | `CylinderGeometry(0,3 → 0,52; 1,55)` offen, 16 Segmente | Lambert, Nadelstreifen-Canvas |
| Futter | gleicher Zylinder, etwas kleiner | fast schwarz |
| Saum | 9 × `PlaneGeometry(0,2 × 0,32)` auf r = 0,55 | Papier |
| Gürtel | `TorusGeometry(0,37; 0,018)` bei y = 1,04 | Messing |
| Schulterring | `TorusGeometry(0,3; 0,03)` | Messing |
| Kopfrahmen | Box 0,42 × 0,5 × 0,2 | Messing |
| Kopf | Box 0,38 × 0,46 × 0,23 | fast schwarz |
| Gesicht | Plane 0,31 × 0,39, 128 × 160 px | unbelichtet, 4 Mienen |
| Scanzeile | Plane 0,31 × 0,018 | zyan, additiv, wandert |
| Antenne | Zylinder + Kugel | Messing + rotes Blinklicht |
| Stempel | Box 0,22 + Zylinder + Kugel | Messing |
| Bodensockel | 4 × Box, 1,7 m Quadrat | weiß, 22 % Deckkraft |

Gesamthöhe ca. 2,3 m. Kopf skaliert mit 1,22 für mehr Präsenz.

### 4.3 Mienen

Vier Texturen (`faceTexture()` in `engine/textures.js`):

- `neutral` — gerader Mund
- `streng` — Mundwinkel nach unten, Brauen zusammen
- `freundlich` — Mundwinkel nach oben
- `closed` — geschlossene Augen (Blinzeln, 130 ms)

Die Miene wechselt alle 5,5–9,5 Sekunden. Zusätzlich blinzelt er alle 2,8–5,2 Sekunden.
Ein `setTimeout` schließt die Augen — bewusst simpel.

### 4.4 Animation

| Bewegung | Formel |
| --- | --- |
| Schweben | `sin(t · 0,85) · 0,03` |
| Saum weht | `sin(t · 1,1 + i · 0,7) · 0,05` pro Bahn |
| Scanzeile | alle 2,6 s von oben nach unten, Opazität als Sinusbogen |
| Blick folgt | Yaw-Annäherung mit `dt · 3` |
| Stempel | `slam()` → 0,34 m Abschlag, Rückfederung über 0,4 s |
| Aufnahmelicht | blinkt mit 3 Hz |

---

## 5. Räume und Platzierung

### Galerie (Westen)

12 Bilder, 1,42 m im Quadrat, Mitte auf 2,15 m — Unterkante 1,29 m, also auf Augenhöhe.
4 an der Stirnwand, je 4 an den Längswänden. Jedes Bild: Messingrahmen, Passepartout,
Postertextur, Schild mit Titel und Jahr, Lichtschein, Leuchte darüber. Eine Bank steht quer.

### Spielhalle (Osten)

9 Automaten: 5 an der Stirnwand, je 2 an den Längswänden. Korpus 1,0 × 1,95 × 0,78 m,
Marquee in der Akzentfarbe, Bildschirm mit Postertextur, Bedienpult mit Joystick, Lichtspur
auf dem Boden. Schachbrettboden in Violett/Schwarz, Neonlicht in Pink.

### Bibliothek (Norden)

5 Regale (3 Stirnwand, 2 Seiten), je 4,8 × 3,4 m. Füllbände als `InstancedMesh` (~250 pro Regal,
ein Draw-Call). Die 17 Exponate stehen als größere Bände auf dem mittleren Boden, mit Messingband
und Schild. Lesetisch mit zwei Lampen.

### Halle (Mitte)

Podest mit Kurator, zwei Terminals (GREMIUM rechts, EINREICHUNG links), zwei Bänke, zwei Pflanzen,
vier Absperrstangen, Teppichläufer, Wandleuchten, Deckenbalken.

---

## 6. Licht

Kein Backen, keine Schattenkarte. Das Licht wird über Materialien und Emissionsflächen getragen.

| Licht | Farbe | Intensität |
| --- | --- | --- |
| Ambient | `#2a4468` | 2,1 |
| Hemisphere | `#9ab8e4` / `#0d1016` | 1,5 |
| Directional | `#9fc0ff` | 0,55 |
| Halle warm | `#ffd0a0` | 250 / 220 |
| Galerie | `#ffd0a0` | 130 |
| Spielhalle | `#ff6aa8` | 2 × 60 |
| Bibliothek | `#ffd0a0` | 120 |
| Aura Kurator | `#6ee7d7` | 40 |
| Frontlicht Kurator | `#ffe6c8` | 55 |
| Eingang | `#ffb457` | 70 |

Tone Mapping: ACES Filmic, Belichtung 1,15. Die Quantisierung im Shader nimmt dem Bild danach
die Weichheit — deshalb darf das Licht ruhig kräftig sein.

---

## 7. Texturen

Es gibt keine Bilddateien im Projekt. Alles entsteht zur Laufzeit:

1. `data/art.js` erzeugt je Exponat ein SVG (Verlauf, Raster, Motiv, Jahr, Seltenheit).
2. `engine/textures.js` lädt das SVG als Blob in ein `Image` und zeichnet es auf ein Canvas.
3. Das Canvas wird zur `CanvasTexture` — für Rahmen, Automaten und das DOM-Panel.

Böden, Wände, Papier, Mantel und Gesichter sind prozedurale Canvas-Texturen mit Rauschen,
Fugen und Verläufen.

---

## 8. Spielschleife

```
state.js
├─ restore(entry)      → als angesehen vermerken, Protokoll
├─ castVote(id, ±1)    → Quorum prüfen, ggf. aufnehmen
├─ submit(input)       → curator.judge(), Kandidat anlegen
└─ liveEntries()       → Bestand + aufgenommene Kandidaten
```

`logic.js` ist rein (kein DOM, kein Storage) und wird von `tests/logic.test.mjs` geprüft.
`state.js` ist die einzige Stelle, die `localStorage` berührt (`das-archiv.v2`).

**Es gibt keine Punkte, keine Ränge und keine Aufträge.** Ein Archiv belohnt nichts.
Der einzige Zähler ist „angesehen": wie viele Stücke man wirklich geöffnet hat.
Damit fällt auch jede Belohnungsschleife weg — was bleibt, ist Neugier.

### Das Quorum

```
netto = (Ja + Startja) − (Nein + Startnein) + Kuratorvotum × 2
aufgenommen, wenn netto ≥ 5
```

Der Kurator hat effektiv zwei Stimmen: spürbar, aber überstimmbar. Krautchan startet bei −5 —
dort müsste das Gremium ihn schon deutlich wollen, und genau diese Diskussion ist das Exponat.

### Die KI

`curator.js` ist die Schnittstelle. Heute regelbasiert:

```js
judge({ title, url, note }, archive)
// → { score, verdict, reasons[], text, kind, rarity, host }
```

Heuristiken: Domain im deutschen Sprachraum (+14), bekannte Domain im Bestand (−40),
Werbemuster (−60), Signale für Netzkultur (+6 je Treffer), Jahreszahl (+8), brauchbare Notiz (+6).

**Sprachmodell einhängen:** `judge()` durch einen `fetch` auf eine Edge Function ersetzen,
Signatur beibehalten. Das UI kennt nur `verdict`, `score`, `reasons` und `text`.
Dasselbe gilt für `react()`, `briefing()` und `explainCandidate()`.

---

## 9. Technische Entscheidungen

| Entscheidung | Grund |
| --- | --- |
| Three.js lokal in `vendor/` | offline, keine Versiondrift |
| Kein Build-Schritt | ES-Module direkt im Browser |
| Render-Target + Shader | der Look entsteht im Bild, nicht in den Modellen |
| Prozedurale Geometrie | keine Assets, keine Lizenzfragen |
| SVG-Poster zur Laufzeit | ~2 KB Quelltext statt 40 KB PNG |
| `InstancedMesh` für Bücher | hunderte Bände in einem Draw-Call |
| Kollision als Rechtecke | robust, schnell, lesbar |
| Pointer Lock + Touch | Desktop und Tablet mit demselben Code |

### Bekannte Grenzen

- **Kein Ton.** Atmosphäre entsteht nur visuell.
- **Keine Schatten.** Kontaktschatten sind gemalte Flecken.
- **Die KI ist regelbasiert.** Sie klingt eigenständig, denkt aber nicht.
- **Stimmen sind lokal.** Das Gremium ist simuliert; echte Abstimmungen brauchen einen Server.
- **Jahreszahlen sind gerundet.** Wo Quellen unsicher sind, steht es im Text.

---

## 10. Erweiterungspunkte

1. **Neue Exponate:** Eintrag in `data/seed.js` (+ optional ein Motiv in `data/art.js`).
2. **Neuer Raum:** Rechteck in `LAYOUT`, vier Wände, Durchgang, Schild, Licht.
3. **Spielbarer Automat:** `playable: true` setzen, im Cabinet eine Canvas-Ebene öffnen.
4. **Echter Kurator:** Edge Function mit Sprachmodell, `judge()` umstellen.
5. **Gemeinsames Gremium:** Supabase-Tabelle `votes`, RLS, Realtime — lokale Logik als Fallback.

---

## 11. Der Kurator als Figur

Er ist keine Statue. `src/ai/agent.js` gibt ihm einen Tagesablauf aus 19 Wegpunkten:

```
Halle → Galerie (Stirnwand, Seitenwand) → Halle → Bibliothek (Regal, Tisch)
      → Halle → Spielhalle (Automaten, Neonwand) → Halle → Podest
```

| Eigenschaft | Wert |
| --- | --- |
| Geschwindigkeit | 1,05 m/s |
| Pause pro Wegpunkt | 1,0 – 6,0 s |
| Kollision | Rechtecke ohne Podest, Radius 0,42 |
| Schwebehöhe | 0,20 m auf dem Podest, 0,02 m im Raum |
| Denkt alle | 16 – 32 s |
| Sucht alle | 95 – 165 s (erster Fund nach 40 s) |

Beim Stehen dreht er den Kopf zum Spieler, beim Laufen in die Gehrichtung. Der Kopf folgt
über `curator.update(dt, focus)` zusätzlich dem Kamerapunkt — er schaut dich an, auch wenn
der Körper weitergeht.

### Gedanken

Ein Pool aus neun Sätzen, einige mit echtem Zustand (Bestand, offene Vorgänge, Punkte).
Sie erscheinen im HUD unter seinem Namen, Status wechselt auf `DENKT`.

### Eigene Funde

`src/ai/research.js` enthält 14 echte deutsche Phänomene, die nicht im Startbestand sind:
Fireball, MetaGer, StayFriends, Jappy, Spin.de, Chefkoch, Mobile.de, Idealo, MyVideo,
Bildblog, GIGA, 4Players, XING, Spreeblick.

`pickFind()` nimmt das nächste unbenutzte Stück, `addCuratorFind()` legt es als Kandidat an
(`source: 'curator'`, Kuratorvotum +1, zwei Startstimmen). Damit kann eine einzige Stimme
im Gremium die Aufnahme entscheiden — der Kurator hat vorgearbeitet.

### Gespräch

`src/ai/dialogue.js` erkennt Absichten per regulärem Ausdruck und antwortet aus dem echten
Zustand: Bestand, offene Kandidaten, angesehene Stücke. Er kann:

- ein Exponat empfehlen und direkt öffnen (`action: 'open:<id>'`)
- die Abstimmung öffnen (`action: 'ballot'`)
- sofort etwas suchen (`action: 'find'`)
- zu einem Titel aus dem Bestand Auskunft geben (Titelsuche, dann `text` und `note`)

Fällt keine Absicht, sagt er das — und zwar ohne zu erfinden. Das ist die einzige Regel,
die er nicht bricht.

**Modell später:** `reply()` bekommt `(message, ctx)` und gibt `{ text, action }` zurück.
Ein Sprachmodell kann diese Funktion ersetzen, ohne dass UI oder Spielstand sich ändern.

---

## 12. Bewegung

| Größe | Wert |
| --- | --- |
| Gehen | 3,2 m/s |
| Rennen | 6,6 m/s |
| Beschleunigung | 16 /s |
| Sprunggeschwindigkeit | 5,6 m/s |
| Schwerkraft | 19 m/s² |
| Sprunghöhe | ca. 0,82 m |
| Sichtfeld | 74°, beim Rennen 84° |

**Sprint-Animation:** höhere Schrittfrequenz, doppelte Bob-Amplitude, leichtes Rollen der Kamera
und ein weiches Aufziehen des Sichtfelds. In der dritten Person schwingen Beine und Arme
deutlich weiter, der Oberkörper lehnt sich vor.

**Dritte Person (`V`):** Kamera 3,8 m hinter und 0,75 m seitlich versetzt, Blick auf die
Schulter. Die Figur (`src/engine/visitor.js`) ist ein Mantel mit Schal, zwei Beinen und zwei
Armen; Hüft- und Schulterschwung laufen gegenphasig.

**Maus:** primär Pointer Lock. Verweigert der Browser die Sperre, dreht Ziehen die Sicht —
ein Klick nach dem Ziehen löst keine Interaktion aus.

---

## 13. Interaktion

Kein Rahmen, keine Ecken, kein Label über dem Objekt. Stattdessen:

1. Zwei senkrechte Messlinien an den Rändern des Objekts (1 px, 32 % Deckkraft).
2. Eine Scanzeile fährt alle 2,4 s von oben nach unten.
3. Darunter hängt ein **Katalogzettel**: gestanztes Loch, Titel, Jahr und Seltenheit,
   `E` als Taste. Verbunden mit dem Objekt durch eine 12 px lange Senkrechte.

Das ist die Bildsprache eines Archivs — Beschriftung, nicht Auswahl.

---

## 14. Sprache

Das Spiel duzt, aber es gendert nicht. Es gibt keine Rangnamen mehr — nur Tätigkeiten:
ansehen, abstimmen, nominieren, schreiben.

Ebenso im Text: „finanziert von Freiwilligen", „man vertraut dir", „der Hinweis zur Einreichung".
Kein `:in`, kein `*`, keine Partizipkonstruktionen.
---

## 15. Die Leitung

Der Browser ist ein Client. `scripts/bridge.mjs` hält den Zustand und den Takt.

```
Browser ──EventSource──▶ /brain/stream    (Gedanken, Ziele, Funde, Status)
        ──POST────────▶ /brain/message   (Frage, Antwort)
        ──POST────────▶ /brain/state     (Bestand, angesehen, benutzte Funde)
```

| Betriebsart | Bedingung | Antwortquelle |
| --- | --- | --- |
| `live` | `ARCHIV_API_KEY` gesetzt | Sprachmodell, JSON-Antwort |
| `local` | kein Schlüssel | dieselbe Logik im Server |
| `offline` | Leitung tot | Notbetrieb im Browser |

Der Takt liegt in der Brücke: alle 26 s (lokal) bzw. 45 s (live) ein Gedanke,
alle 110 s ein Fund aus dem offenen Bestand. Der Browser führt nur aus — Bewegung,
Kamera, Kollision bleiben lokal, weil Physik nicht über eine Leitung gehört.

Die Entscheidung, **wohin** der Kurator geht, kommt als `{type:"go", target:"galerie"}`
und wird auf den nächsten Wegpunkt dieser Raumgruppe abgebildet.

---

## 16. Der Tunnel

Hinter der Bibliothek, durch eine Stahltür bei x = 7, z = −18:

```
Bibliothek ──[Tür]── Korridor 4 × 9 m ── Verbindungsraum 12 × 7 m
                     Beton, Kabel, Neon        Kern, Racks, Terminal
```

- **Korridor:** 4 m breit, 3,1 m hoch, drei Neonröhren, Kabeltrassen an der Decke,
  zwei Rohre an der Wand, zwei Wandleuchten.
- **Verbindungsraum:** 12 × 7 m, 4,2 m hoch. Verbindungskern (Messingsockel, Glasrohr,
  zwei Ringe), zwei Serverracks mit LEDs, Bodenluke, Terminal an der Stirnwand.
- **Terminal:** zeigt `LIVE`, `LOKAL` oder `OFFLINE`. Die Farbe des Kerns und der
  Punktlichter folgt dem Zustand.
- **Kollision:** alle Wände über `wall()`; der Gang ist begehbar, der Kurator hat
  eigene Wegpunkte dort unten.

Der Tunnel ist die sichtbare Form der Verbindung: ein Ort, an dem das Haus aufhört
und die Leitung anfängt.

---

## 17. Jedes Objekt

Im Haus gibt es keine Kulisse. Jedes Möbelstück, jede Leuchte, jedes Bauteil hat eine
unsichtbare Klickfläche (`mark()` in `world.js`), einen Eintrag in `data/props.js` und
einen Text in der Stimme des Kurators.

| Objekt | Text (Auszug) |
| --- | --- |
| Sitzbank | „Wer hier sitzt, bleibt länger als geplant. Das ist der Zweck." |
| Topfpflanze | „Sie hat keinen Namen und keine Aufgabe. Sie steht da und ist grün." |
| Absperrstange | „Sie hält niemanden auf. Sie sagt nur: hier beginnt der Teil, der wichtiger aussieht." |
| Kronleuchter | „Er wurde für ein anderes Gebäude gebaut. Wir haben ihn passend gemacht." |
| Verbindungskern | „Hier endet der Tunnel und beginnt die Leitung nach draußen." |
| Bodenluke | „Darunter liegt nichts, was du sehen willst. Ich habe nachgesehen." |

Die Klickflächen sind 0,6 m höher als das Objekt, damit man nicht pixelgenau zielen muss.
Das Podest hat vier Randflächen statt einer großen — sonst würde es den Kurator verdecken.

---

## 18. Wände

Sechs freie Flächen im Haus sind beschreibbar. Keine Rahmen, keine Regale — nur Wand.

| Kennung | Ort | Größe |
| --- | --- | --- |
| `halle-west` | Westwand der Halle | 4,6 × 3,0 m |
| `halle-ost` | Ostwand der Halle | 4,6 × 3,0 m |
| `halle-nord-west` | Nordwand, links | 4,6 × 2,8 m |
| `halle-nord-ost` | Nordwand, rechts | 4,6 × 2,8 m |
| `tunnel-west` | Tunnel, Westseite | 5,0 × 2,4 m |
| `vault-nord` | Verbindungsraum | 4,2 × 2,6 m |

Jede Wand hat eine Leinwand mit 1024 × 512 Pixeln. Sie wird als transparente Textur auf eine
Fläche vor der Wand gelegt (`engine/graffiti.js`).

**Was gespeichert wird, sind keine Bilder, sondern Striche.** Ein Strich ist eine Liste
normalisierter Punkte, eine Farbe und eine Stärke:

```json
{ "color": "#ffcf6a", "width": 5, "points": [[0.2,0.3],[0.4,0.35],[0.5,0.5]] }
```

Das hält die Daten klein, macht sie auflösungsunabhängig und erlaubt es, jede Wand neu zu
zeichnen, wenn jemand anders etwas hinzufügt.

**Notizen** sind Text mit einer Position auf der Leinwand. Sie werden als Papierkarte mit
Stift, Faltung und sechs Zeilen Umbruch gezeichnet.

**Ablauf**

1. `GET /graffiti` liefert alle Wände beim Start.
2. `E` an einer Wand öffnet die Tafel: Leinwand, vier Stifte, Stärke, Notizfeld.
3. `POST /graffiti` schickt einen Strich oder eine Notiz.
4. Die Brücke speichert in `website/data/graffiti.json` und schickt ein SSE-Ereignis
   `{type:"graffiti"}` an alle anderen — sie sehen die Zeichnung sofort.

Grenzen: 400 Striche und 60 Notizen pro Wand. Alte Einträge fallen zuerst heraus.

---

## 19. Der Scanner

`scripts/scout.mjs`, alle 90 Sekunden von der Brücke aufgerufen.

| Schritt | Regel |
| --- | --- |
| Warteschlange | 10 Startseiten, danach Links bis Tiefe 2 |
| Erlaubnis | `robots.txt`, nur die `*`-Gruppe, längste Regel gewinnt |
| Abruf | 7 s Timeout, 400 KB Grenze, eigener User-Agent |
| Auswertung | Titel, Meta-Beschreibung, erster Absatz, Sprache, Links |
| Bewertung | TLD +20, Sprache +15, Titel +10, Beschreibung +12, Signalwörter +18 |
| Schwelle | 48 Punkte, Beschreibung mindestens 40 Zeichen |
| Doppelung | bekannte URLs aus dem Spielstand werden übersprungen |

Der Fund wird als Kandidat gebaut (`source: 'scanner'`, Kuratorvotum +1, zwei Startstimmen)
und per SSE an alle Besucher geschickt. Mit Schlüssel schreibt das Modell die Beschreibung,
ohne Schlüssel der Scanner selbst.

## 20. Das Depot

Halle östlich des Verbindungsraums: 14 × 12 m, 5,2 m hoch, Zugang durch eine Öffnung
bei x = 13, z = −30.

- Vier Regalreihen (x = 16 / 19,2 / 22,4 / 25,6), je 4 Böden, 12 Plätze pro Boden.
- Jedes Stück im Bestand wird zu einer Kiste (0,5 × 0,34 × 0,62 m), verteilt über alle
  Reihen, farbig nach Raum: Galerie bernstein, Spielhalle pink, Bibliothek zyan.
- Kisten sind anklickbar und öffnen das Exponat.
- Am Eingang ein Katalogscreen: öffnet die vollständige Liste.

## 21. Freie Notizen

`M` wirft einen Strahl auf die Wände (`paintables` in `builder.js`) und heftet dort eine
Fläche von 1,7 × 0,95 m an. Gespeichert wird die Position und die Flächennormale:

```json
{ "decal": { "p": [x, y, z], "n": [nx, ny, nz], "w": 1.7, "h": 0.95 } }
```

Die Fläche hat eine eigene 1024 × 512-Leinwand, dieselbe Tafel wie die festen Wände.
Beim Laden werden alle Notizen aus `graffiti.json` an ihren Koordinaten wieder aufgebaut.

## 22. Persona

`persona/curator.md` wird beim Start gelesen und bei **jeder** Anfrage an das Modell
mitgeschickt: Charakter, Sprechweise, Wissen über das Haus, Projektgeschichte, Grenzen.
Das ist der Unterschied zwischen „ein Modell antwortet" und „der Kurator antwortet".

---

## 23. Das Gedächtnis

`scripts/memory.mjs`, gespeichert in `data/memory.json`.

| Eigenschaft | Wert |
| --- | --- |
| Inhalt | Rollen `user` / `curator` mit Text und Zeitstempel |
| Grenze | 80 Turns, älteste fallen zuerst heraus |
| Übergabe (live) | die letzten 8 Turns als Teil des Prompts |
| Übergabe (lokal) | die letzten 6 Turns an `reply()` |
| Anzeige | `GET /brain/history`, geladen beim Öffnen des Chats |

Beim Öffnen des Gesprächsfensters holt der Client den Verlauf und zeigt ihn an.
Der Kurator erkennt eine doppelte Frage und sagt es. Im Live-Modus bekommt das
Modell den Verlauf als Text mit — damit es nicht jede Sitzung neu anfängt.

Das Gedächtnis liegt auf dem Server, nicht im Browser. Ein gelöschter Browser-Speicher
löscht nur den eigenen Stand, nicht das, was der Kurator behalten hat.
