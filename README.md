# SchichtPlan Pro

Industrieller Schicht- und Wochenplaner mit Maschinenverwaltung, automatischer wöchentlicher Rotation, Abwesenheitserfassung, DIN-A4-Layout-Editor und abteilungsisoliertem Login.

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
- Der Browser hält zusätzlich einen lokalen Cache (`localStorage`) für den zuletzt geladenen Abteilungsstand, ausschließlich als Lese-Fallback, falls der Server kurzzeitig nicht erreichbar ist. Geschrieben wird ausschließlich über den Server.

### Live-Synchronisation

Mehrere Nutzer können gleichzeitig dieselbe Abteilung geöffnet haben. Der Browser fragt alle 4 Sekunden den aktuellen Stand vom Server ab (Polling) und aktualisiert die Ansicht, wenn sich etwas geändert hat. Ein eigener, gerade laufender Speichervorgang wird dabei nicht überschrieben.

### Authentifizierung

- **Mitarbeiter-Zugang:** Eintritt über ein Abteilungskürzel (z.B. `FERT-A`), keine individuellen Benutzerkonten oder Passwörter pro Mitarbeiter.
- **Admin-Zugang:** Ein einzelnes, geteiltes Admin-Passwort für Verwaltungsfunktionen (neue Abteilungen anlegen, löschen). Das Passwort wird serverseitig mit `scrypt` gehasht gespeichert (Node.js-Bordmittel, keine externe Abhängigkeit), nie im Klartext. Nach 5 Fehlversuchen sperrt der Server Anmeldeversuche von derselben Adresse für 30 Sekunden.

## Projektstruktur

```
server.ts                  Express-Server, REST-API, Datei-I/O
src/
  App.tsx                  Haupt-Komponente, lädt/speichert die aktuelle Abteilung
  types.ts                 Zentrale TypeScript-Datentypen
  lib/
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
```

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
