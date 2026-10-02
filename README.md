# SchichtPlan Pro

Industrieller Schicht- und Wochenplaner mit Maschinenverwaltung, automatischer wöchentlicher Rotation, Abwesenheitserfassung, DIN-A4-Layout-Editor und abteilungsisoliertem Login. Dazu eine **Instandhaltungsliste** (Störungsmeldungen mit Standort, Maschine, Dringlichkeit und Erledigt-Status) mit eigener Kürzel-Anmeldung.

Diese README beschreibt den technischen Aufbau: eingesetzte Frameworks, Architektur, Datenhaltung und Betrieb. Für die rechtliche Einordnung (Datenschutz) siehe [DATENSCHUTZ.md](./DATENSCHUTZ.md).

## Status

Aktuell eine öffentlich erreichbare **Demo-Version auf Vercel** mit Testdaten (keine echten Personaldaten). Diese Demo dient nur der Vorführung/Prüfung durch die Firma und ist kein Produktivsystem. Sobald ein internes Testsystem im Firmennetz steht, wird die Vercel-Demo abgeschaltet — siehe Abschnitt [Demo auf Vercel](#demo-auf-vercel-temporär) für Details zur sauberen Trennung.

## Tech-Stack

| Bereich | Technologie | Version |
|---|---|---|
| Frontend-Framework | React | 19 |
| Build-Tool / Dev-Server | Vite | 8 |
| Sprache | TypeScript | 7 |
| Styling | Tailwind CSS | 4 (`@tailwindcss/vite`) |
| Icons | lucide-react | 0.546 |
| Backend-Server | Express | 4 |
| Server-Laufzeit (Dev) | tsx (TypeScript direkt ausführen) | 4 |
| Server-Bundling (Prod) | esbuild | 0.28 |

Keine weiteren Laufzeit-Abhängigkeiten. Insbesondere: **keine Datenbank-Engine, kein ORM, kein Cloud-SDK, keine externe API-Anbindung**.

## Architektur

```
Browser (React SPA)
   │  fetch() gegen /api/...
   ▼
Express-Server (server.ts)
   │  liest/schreibt JSON-Dateien
   ▼
Lokales Dateisystem (data/)
```

- **Kein separates Datenbanksystem.** Jede Abteilung ist eine einzelne JSON-Datei unter `data/departments/<KÜRZEL>.json`. Der Express-Server ist die einzige Instanz, die diese Dateien liest und schreibt.
- **Ein Prozess, ein Server.** `server.ts` startet sowohl die REST-API (`/api/...`) als auch (im Entwicklungsmodus) den Vite-Dev-Server für das Frontend. Im Produktivbetrieb (`npm run build && npm start`) liefert derselbe Express-Prozess die gebauten statischen Dateien aus.
- **Kein Internetzugriff zur Laufzeit erforderlich.** Der Server bindet an `0.0.0.0:3000` und ist damit im lokalen Netz erreichbar; es werden keine externen APIs, CDNs oder Cloud-Dienste zur Laufzeit kontaktiert.

### Datenhaltung im Detail

- `data/departments/<KÜRZEL>.json` — eine Datei pro Abteilung, enthält Mitarbeiter, Maschinen, Abwesenheiten, manuelle Schichtkorrekturen und Layout-Einstellungen für den Ausdruck.
- `data/system.json` — Admin-Passwort (gehasht, siehe unten) und Systemstand.
- Alle Schreibvorgänge laufen atomar (temp-Datei + rename), damit ein Absturz mitten im Schreiben nie eine leere/kaputte Datei hinterlässt.
- Jede Abteilung hat eine Versionsnummer (`version`). Speichert ein Client mit einer veralteten Version (weil zwischenzeitlich jemand anderes gespeichert hat), lehnt der Server das ab (HTTP 409) und liefert den aktuellen Stand zurück — verhindert, dass gleichzeitige Bearbeitung durch zwei Nutzer die Änderung des jeweils anderen stillschweigend überschreibt.
- Die Instandhaltungsliste liegt getrennt davon in `data/maintenance/<LISTENKÜRZEL>.json` (siehe Abschnitt [Instandhaltungsliste](#instandhaltungsliste)).
- Der Browser hält zusätzlich einen lokalen Cache (`localStorage`) für den zuletzt geladenen Abteilungsstand, ausschließlich als Lese-Fallback, falls der Server kurzzeitig nicht erreichbar ist. Geschrieben wird ausschließlich über den Server.

### Live-Synchronisation

Mehrere Nutzer können gleichzeitig dieselbe Abteilung geöffnet haben. Der Browser fragt alle 4 Sekunden den aktuellen Stand vom Server ab (Polling) und aktualisiert die Ansicht, wenn sich etwas geändert hat. Ein eigener, gerade laufender Speichervorgang wird dabei nicht überschrieben.

### Instandhaltungsliste

Eigener Bereich neben dem Schichtplan, erreichbar über den Umschalter auf der Startseite („Schichtplan“ / „Instandhaltungsliste“).

- **Anmeldung:** Listenkürzel (z. B. `INSTANDHALTUNG`) plus **persönliches Kürzel** (z. B. Initialen). Das Kürzel der Anmeldung wird automatisch als Ersteller/Bearbeiter/Erledigt-von an jeden Eintrag geschrieben. Die Sitzung gilt nur für den Browser-Tab (`sessionStorage`), damit an gemeinsam genutzten PCs nicht unter fremdem Kürzel weitergearbeitet wird.
- **Rollen:** *Melder* (Meldungen anlegen, eigene offene Meldungen ändern/löschen) und *Instandhaltung* (zusätzlich als erledigt melden/wieder öffnen, alle Meldungen ändern/löschen, Kürzel und Standorte verwalten). Der Server erzwingt diese Rollen.
- **Felder je Meldung:** Standort, Bereich, Maschine (Freitext mit Vorschlägen aus bisherigen Einträgen), Beschreibung, Art (mechanisch/elektrisch), Dringlichkeit (niedrig/normal/hoch/sofort), laufende Nummer, Status offen → *provisorisch behoben* (läuft wieder, endgültige Reparatur steht aus; Notiz Pflicht, optionale Wiedervorlage „Nachbearbeiten bis“ mit Überfällig-Markierung, bleibt in der Liste) → erledigt (mit optionaler Notiz). Die Standorte sind je Liste konfigurierbar.
- **Zuweisung:** Die Instandhaltung kann eine offene Meldung einer Person mit Rolle Instandhaltung zuweisen („Zuständig: XY“); es gibt den Filter „Mir zugewiesen“.
- **Hinweise (persönlich):** Pro Kürzel lässt sich einstellen, für welche **Standorte** es Hinweise zu neuen und dringenden Meldungen bekommt (leer = keine). Zusätzlich bekommt jede Person Hinweise, wenn ihr eine Meldung zugewiesen wird oder ihre eigene Meldung von jemand anderem provisorisch behoben/erledigt wird. Hinweise werden aus den Daten abgeleitet (kein gemeinsamer Posteingang); ob etwas „neu“ ist, entscheidet ein **persönlicher Gelesen-Marker pro Kürzel** (`seenAt`) — dass jemand anderes etwas gelesen hat, ändert für die übrigen nichts. Der Server liefert Marker anderer Personen nie aus (keine Lesebestätigungen). Darstellung: Banner über der Liste für alle ungelesenen Hinweise (rot bei Dringendem — Sofort-Meldung im eigenen Standort, Zuweisung —, sonst blau), Glocke mit Zähler, „NEU“-Markierung an den Karten und Zähler im Tab-Titel. Wirksam nur, solange die Liste im Browser geöffnet ist (kein Push/E-Mail; Browser-Benachrichtigungen setzen HTTPS voraus).
- **Verwaltung im Admin-Bereich:** Listen anlegen/löschen und Kürzel/Standorte verwalten setzt das Admin-Passwort voraus (vom Server geprüft). Es wird bewusst keine Standardliste automatisch angelegt.
- **Ein Kürzel ist eine Kennzeichnung, keine Authentifizierung:** es gibt kein Passwort/keine PIN. Der Server prüft nur, ob das Kürzel zur Liste gehört und aktiv ist. Wer ein Kürzel kennt, kann sich damit anmelden.
- **Gleichzeitiges Arbeiten:** Anders als beim Schichtplan wird nicht das ganze Dokument überschrieben, sondern jede Aktion (anlegen, ändern, erledigen, löschen) einzeln auf dem Server angewendet — als eine synchrone Folge „lesen → Regeln anwenden → atomar schreiben“ ohne `await` dazwischen. Gleichzeitig angelegte Meldungen gehen deshalb nicht verloren und erhalten eindeutige Nummern. Jeder Eintrag hat eine Revisionsnummer (`rev`): ändern zwei Personen denselben Eintrag gleichzeitig, wird die zweite Änderung mit HTTP 409 abgelehnt und die Oberfläche zeigt den aktuellen Stand. Die Ansicht aktualisiert sich alle 4 Sekunden (der Server antwortet bei unverändertem Stand nur kurz).
- **Fehler werden nie verschluckt:** Schlägt eine Aktion fehl (Server weg, Konflikt, fehlende Berechtigung), erscheint eine Meldung — es gibt keinen stillen lokalen Fallback. Bleibt die Antwort aus (Zeitüberschreitung), ist unklar, ob der Server die Aktion noch ausgeführt hat; die Meldung sagt das ausdrücklich, und man soll erst die Liste prüfen, bevor man es erneut versucht (sonst droht ein doppelter Eintrag). Nur im statisch gehosteten Demo-Modus (siehe unten) läuft die Liste lokal im Browser und ist als „Demo (nur dieser Browser)“ gekennzeichnet.
- **Backup:** Vor der ersten Änderung des Tages wird der bisherige Stand nach `data/backups/maintenance/<KÜRZEL>.<JJJJ-MM-TT>.json` kopiert (30 Tage Aufbewahrung, ebenfalls vor dem Löschen einer Liste). Wiederherstellen: Server stoppen, Sicherungsdatei nach `data/maintenance/<KÜRZEL>.json` kopieren, Server starten (geöffnete Browser-Fenster übernehmen den zurückgespielten Stand beim nächsten Abgleich automatisch). Eine Wiederherstellung in der Oberfläche gibt es für Listen noch nicht.
- **Fachlogik** (Rechte, Validierung, Konflikte) liegt in `src/lib/maintenanceLogic.ts` — ohne Abhängigkeiten, vom Server und vom Demo-Modus gemeinsam genutzt und per Unit-Tests abgedeckt.

API (JSON; Header `X-Kuerzel` bzw. `X-Admin-Password`, jeweils URL-kodiert):

| Methode & Pfad | Zweck | Berechtigung |
|---|---|---|
| `POST /api/maintenance/:code/login` | Anmeldung prüfen | – |
| `GET /api/maintenance/:code[?version=N]` | Liste lesen (bei gleicher Version nur `{unchanged:true}`) | aktives Kürzel |
| `POST /api/maintenance/:code/entries` | Meldung anlegen | aktives Kürzel |
| `PATCH /api/maintenance/:code/entries/:id` | Meldung ändern (`baseRev` nötig) | Ersteller (offen) / Instandhaltung |
| `POST /api/maintenance/:code/entries/:id/done` | erledigt / wieder öffnen (`baseRev`, `done`, `note`) | Instandhaltung |
| `POST /api/maintenance/:code/entries/:id/provisional` | „Provisorisch behoben“ setzen/zurücknehmen (`baseRev`, `provisional`, `note` – Pflicht beim Setzen, optional `due` als `JJJJ-MM-TT`) | Instandhaltung |
| `POST /api/maintenance/:code/entries/:id/assign` | Meldung zuweisen/Zuweisung aufheben (`baseRev`, `assignee`) | Instandhaltung |
| `POST /api/maintenance/:code/seen` | eigenen Gelesen-Marker setzen (`upTo`) | aktives Kürzel |
| `DELETE /api/maintenance/:code/entries/:id?baseRev=N` | Meldung löschen | Ersteller (offen) / Instandhaltung |
| `POST/PATCH/DELETE /api/maintenance/:code/users[/:kuerzel]` | Kürzel verwalten | Instandhaltung / Admin |
| `PATCH /api/maintenance/:code/settings` | Standorte, Listenname | Instandhaltung / Admin |
| `GET/POST /api/maintenance`, `DELETE /api/maintenance/:code` | Listen übersehen/anlegen/löschen | Admin-Passwort |

### Authentifizierung

- **Mitarbeiter-Zugang:** Eintritt über ein Abteilungskürzel (z.B. `FERT-A`), keine individuellen Benutzerkonten oder Passwörter pro Mitarbeiter.
- **Admin-Zugang:** Ein einzelnes, geteiltes Admin-Passwort für Verwaltungsfunktionen (neue Abteilungen anlegen, löschen, Instandhaltungslisten verwalten). Der Server prüft das Passwort bei allen diesen Aktionen selbst (Header `X-Admin-Password`); auch das Neuanlegen einer Abteilung per `PUT` verlangt es. Normales Speichern einer bestehenden Abteilung braucht es nicht. Das Passwort wird serverseitig mit `scrypt` gehasht gespeichert (Node.js-Bordmittel, keine externe Abhängigkeit), nie im Klartext. Nach 5 Fehlversuchen sperrt der Server Anmeldeversuche von derselben Adresse für 30 Sekunden.

## Projektstruktur

```
server.ts                  Express-Server, REST-API, Datei-I/O
src/
  App.tsx                  Haupt-Komponente, lädt/speichert die aktuelle Abteilung
  types.ts                 Zentrale TypeScript-Datentypen
  lib/
    maintenanceLogic.ts      Instandhaltungsliste: Regeln, Rechte, Validierung (ohne Abhängigkeiten, getestet)
    maintenanceStorage.ts    Instandhaltungsliste: Server-Zugriff (+ Demo-Modus im Browser)
    storage.ts              Client-seitige API-Aufrufe gegen den Server
    rotationEngine.ts        Berechnet die wöchentliche Schichtrotation
    absenceUtils.ts          Abwesenheits-Logik, Konfliktprüfung
    holidayUtils.ts          Gesetzliche Feiertage (DACH), Osterformel
  components/               React-Komponenten (Kalender, Mitarbeiterverwaltung, Login, Druck-Layout, ...)
data/                       Laufzeit-Datenbank (JSON-Dateien, nicht Teil des Repos, siehe .gitignore)
```

## Entwicklung

```bash
npm install
npm run dev        # startet Server + Vite-Dev-Server auf Port 3000
npm run lint        # TypeScript-Check ohne Build (tsc --noEmit)
npm test            # Unit-Tests (vitest)
```

Umgebungsvariablen (optional): `PORT` (Standard 3000) und `DATA_DIR` (Standard `./data`) — z. B. um zum Testen eine zweite Instanz mit eigenem Datenordner zu starten, ohne die echten Daten anzufassen.

## Produktivbetrieb (geplant)

```bash
npm run build       # baut Frontend (Vite) und bündelt den Server (esbuild)
npm start           # startet den gebauten Server (dist/server.cjs)
```

Vorgesehen für den Betrieb auf einem Rechner im Firmennetz (Windows- oder Linux-Server), ohne Internetanbindung notwendig. Der Port (Standard 3000) muss nur innerhalb des lokalen Netzes erreichbar sein.

## Demo auf Vercel (temporär)

Für die Prüfung/Freigabe durch die Firma läuft aktuell eine öffentliche Demo-Instanz auf Vercel, da noch kein internes Testsystem existiert. Wichtig:

- Die Demo enthält ausschließlich Testdaten, keine echten Namen, Personalnummern oder sonstigen Daten von Mitarbeitenden.
- Diese Hosting-Form ist **nicht** die vorgesehene Zielarchitektur (siehe oben: lokal, ohne externen Anbieter) und wird abgeschaltet, sobald ein internes Testsystem zur Verfügung steht.
- Es existiert keine Vercel-spezifische Konfigurationsdatei im Repository — die Demo ist eine reine Hosting-Instanz desselben Codes, kein architektonischer Bestandteil des Projekts.

## Lizenz

Wird open source gestellt, falls die interne Freigabe durch die Firma nicht erfolgt (siehe [DATENSCHUTZ.md](./DATENSCHUTZ.md) für den Hintergrund).
