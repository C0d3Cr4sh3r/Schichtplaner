# Datenschutzerklärung & Technische und Organisatorische Maßnahmen (TOM)

**SchichtPlan Pro** — Stand: 23. September 2026

> **Hinweis:** Dieses Dokument beschreibt wahrheitsgemäß, wie die Software technisch funktioniert und welche Daten sie verarbeitet. Es dient als Vorlage und Dokumentation für die Datenschutzbeauftragte / den Datenschutzbeauftragten (DSB) und den Betriebsrat. Vor dem produktiven Einsatz mit echten Mitarbeiterdaten sollte dieses Dokument um betriebsspezifische Angaben (konkreter Verantwortlicher, Kontaktdaten des DSB, Aufbewahrungsfristen) ergänzt werden.

---

## 1. Verantwortlicher

Verantwortlich für die Datenverarbeitung ist der Betrieb, der die Software einsetzt (der Arbeitgeber). SchichtPlan Pro ist eine intern im Firmennetz betriebene Software ohne Betreiber-Zugriff auf die Daten — es findet keine Verarbeitung durch Dritte statt (siehe Abschnitt 4).

*[Hier: Name und Kontaktdaten des Betriebs / der verantwortlichen Stelle sowie des betrieblichen Datenschutzbeauftragten ergänzen.]*

---

## 2. Zweck der Datenverarbeitung & Rechtsgrundlagen

SchichtPlan Pro dient der betriebsinternen Personal-, Schicht- und Kapazitätsplanung:

- Zuordnung von Beschäftigten zu Maschinen, Fertigungslinien und Schichten (Früh-, Spät-, Nachtschicht)
- Automatisierte wöchentliche Rotationsplanung unter Beachtung von Ruhezeiten und Schichtrhythmen
- Erfassung und Verwaltung von Urlaubsansprüchen (Jahreskontingent, Vorjahresübertrag, Sonderregelungen wie z. B. Zusatzurlaub bei Grad der Behinderung / GdB oder vertragliche Teilzeitquoten)
- Erfassung von Abwesenheiten (Erholungsurlaub, Arbeitsunfähigkeit / AU, Karenztage, Zeitausgleich, Weiterbildung, Sonderurlaub) zur Sicherstellung der Mindestbesetzung
- Erstellung druckfähiger Wochenschichtpläne (DIN-A4) für den Aushang im Betrieb

### Rechtsgrundlagen:
- **Art. 6 Abs. 1 lit. b DSGVO i.V.m. § 26 Abs. 1 BDSG:** Erforderlichkeit für die Durchführung und Abwicklung des Beschäftigungsverhältnisses.
- **Art. 6 Abs. 1 lit. c DSGVO i.V.m. Arbeitszeitgesetz (ArbZG):** Erfüllung gesetzlicher Arbeitsschutz- und Dokumentationspflichten (z. B. Höchstarbeitszeiten, Ruhezeiten).
- **Art. 88 DSGVO i.V.m. Betriebsvereinbarung:** Sofern eine Betriebsvereinbarung zur Schichtplanung oder zum Urlaubsmanagement vorliegt.
- **Art. 9 Abs. 2 lit. b DSGVO i.V.m. § 26 Abs. 3 BDSG:** Für die Erfassung von Arbeitsunfähigkeitszeiten (AU) sowie Schwerbehinderten-Zusatzurlaub nach § 208 SGB IX.

---

## 3. Verarbeitete Datenkategorien

Die Software speichert pro Abteilung ausschließlich zweckgebundene Daten:

### Mitarbeiterdaten (Stammdaten)
- Vor- und Nachname
- Personalnummer
- Betriebliche Rolle (Teamleiter, Schichtführer, Mitarbeiter, Springer)
- Schichtmodell (1-, 2-, 3-Schicht) und individuelle Rotationsabfolgen
- Qualifikationen für bestimmte Maschinen/Anlagen
- Telefonnummer (**optional**, nur falls betrieblich von der Schichtleitung hinterlegt)
- Freitext-Notizen (**optional**)
- Aktiv-Status (zur Einschränkung der Verarbeitung / Archivierung)

### Urlaubs- und Kontingentdaten
- Jahresurlaubsanspruch in Tagen (Regulär i.d.R. 30 Tage)
- Vorjahresübertrag in Resturlaubstagen
- Freitext-Vermerk zu Sonderansprüchen (z. B. „+5 Tage Zusatzurlaub nach § 208 SGB IX (GdB 50%)“, „4-Tage-Woche (24 Tage Jahresanspruch)“)

### Abwesenheitsdaten
- Zeitraum der Abwesenheit (Startdatum, Enddatum)
- **Art der Abwesenheit:**
  - *Urlaub* (Erholungsurlaub)
  - *Krank/AU* (Arbeitsunfähigkeit — **Gesundheitsdatum nach Art. 9 DSGVO**)
  - *Karenz* (Eltern-/Pflegekarenz)
  - *Zeitausgleich* (Überstundenabbau)
  - *Weiterbildung* (Schulung/Fortbildung)
  - *Sonderurlaub* (Hochzeit, Umzug, Pflegefall etc.)
- Optionale Freitext-Notiz zur Abwesenheit
- Optionale Vertretungszuordnung

### Maschinendaten (keine personenbezogenen Daten)
Maschinenbezeichnung, Standort/Halle, Schichtmodell, Mindestbesetzung, Status.

### Zugangsdaten
- Das für den Mitarbeiterzugang genutzte Abteilungskürzel ist kein personenbezogenes Datum (kein individuelles Benutzerkonto pro Person).
- Für den Admin-Bereich wird ein kryptografisch gehashtes Passwort verwendet (siehe Abschnitt 6).

---

## 4. Besondere Schutzmaßnahmen für Gesundheitsdaten (Art. 9 DSGVO)

Da die Abwesenheitsarten „Krank/AU“ und ggf. Vermerke zu Schwerbehindertenzusatzurlaub (GdB) verarbeitet werden, gelten strenge Grundsätze:

1. **Strikte Datensparsamkeit:** Es wird ausschließlich der Status der Abwesenheit erfasst. **Es werden niemals Diagnosen, ICD-10-Codes, Arztberichte oder medizinische Details erfasst oder gespeichert.**
2. **Zweckbindung:** Die Daten dienen einzig der Kapazitäts- und Schichtbesetzungsplanung sowie der Urlaubsanspruchsführung.
3. **Zugriffskreis:** Der Zugriff ist auf Personen mit Kenntnis des Abteilungskürzels bzw. die Schicht-/Betriebsleitung beschränkt.

---

## 5. Empfänger der Daten / Datenweitergabe an Dritte

**Es findet grundsätzlich keine Datenübermittlung an Dritte statt.** Die Anwendung ist so konzipiert, dass sie vollständig ohne externe Cloud-Dienste läuft:

- **Kein Tracking / Keine Telemetrie:** Keine Einbindung von Google Analytics, Facebook Pixeln oder Werbenetzwerken.
- **Keine Cloud-Datenbank:** Alle Daten liegen lokal auf dem firmeneigenen Server im Intranet (`./data/departments/*.json`).
- **Kein Entwickler-Zugriff:** Der Software-Hersteller (ArcanePixels) hat zu keinem Zeitpunkt Zugriff auf Ihre Unternehmens- oder Mitarbeiterdaten.

---

## 6. Speicherdauer & Löschkonzept (Art. 17 DSGVO)

- Daten bleiben gespeichert, bis sie manuell durch berechtigte Personen (Schichtleitung / Admin) geändert oder gelöscht werden.
- **Mitarbeiterlöschung:** Scheidet ein Mitarbeiter aus, kann er mitsamt aller verknüpften Abwesenheiten über die Mitarbeiterverwaltung unwiderruflich gelöscht werden.
- **Abteilungsauflösung:** Ganze Abteilungen können im Admin-Bereich gelöscht werden.
- **Archivierung:** Mitarbeiter können auf „Inaktiv“ gesetzt werden, um sie aus der aktiven Schichtplanung herauszunehmen, ohne bestehende historische Daten zu vernichten.

---

## 7. Technische und organisatorische Maßnahmen (TOM) gem. Art. 32 DSGVO

### 7.1 Mandantentrennung & Zugriffskontrolle
- Jede Abteilung ist in einer eigenständigen, physisch getrennten JSON-Datei gespeichert.
- Zugriff auf eine Abteilung erfolgt isoliert über das jeweilige Abteilungskürzel.

### 7.2 Authentifizierung & Passworthashing
- Das Admin-Passwort wird auf dem Server mittels **scrypt** (kryptografisches 16-Byte Salt, 64-Byte Schlüssel) gehasht gespeichert. Ein Speichern im Klartext findet auf dem Server nicht statt.
- **Brute-Force-Schutz:** Nach 5 fehlgeschlagenen Anmeldeversuchen sperrt der Server Anfragen für 30 Sekunden.
- **Fallback für die statisch gehostete Demo (Vercel, ohne eigenen Server):** Da die öffentliche Vorführversion keinen Express-Server besitzt, gibt es dort einen clientseitigen Passwort-Vergleich als Ersatz — dieser vergleicht gegen einen Wert im Browser-`localStorage`, nicht gehasht. Dieser Fallback ist im echten Betrieb wirkungslos: Sobald der Browser einmal erfolgreich mit einem echten Intranet-Server gesprochen hat, wird das dauerhaft vermerkt (auch über einen Neustart der App hinweg) und der clientseitige Vergleich danach nie wieder verwendet, selbst wenn der Server kurzzeitig nicht erreichbar ist. Auf dem produktiv betriebenen Firmenserver ist die Authentifizierung damit ausschließlich serverseitig und gehasht.

### 7.3 Datenintegrität & Atomare Speicherung
- Schreibvorgänge auf die JSON-Datenbankdateien erfolgen **atomar** (Erstellung einer temporären Datei mit anschließendem POSIX-Rename). Ein Absturz oder Stromausfall führt nicht zu beschädigten Dateien.
- Optimistisches Locking über Versionsnummern verhindert unbemerktes Überschreiben bei parallelem Arbeiten im Intranet.

### 7.4 Datensicherheit & Export
- Über die Funktion **„DB Export (JSON)“** können jederzeit vollständige Backups erstellt werden.

---

## 8. Betroffenenrechte (Art. 15–21 DSGVO)

Beschäftigte haben das Recht auf:
- **Auskunft (Art. 15 DSGVO) & Datenübertragbarkeit (Art. 20 DSGVO):** Erfüllbar über die Export-Funktion (maschinenlesbares JSON).
- **Berichtigung (Art. 16 DSGVO):** Sofortige Korrektur in den jeweiligen Modulen.
- **Löschung (Art. 17 DSGVO):** Löschung von Datensätzen per Klick.
- **Einschränkung der Verarbeitung (Art. 18 DSGVO):** Status „Inaktiv“ bei ruhenden Arbeitsverhältnissen.

---

*Dieses Dokument entspricht dem aktuellen Stand der Software SchichtPlan Pro (Version 2026.9).*
