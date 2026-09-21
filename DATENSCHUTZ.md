# Datenschutzerklärung & Technische und Organisatorische Maßnahmen (TOM)

**SchichtPlan Pro** — Stand: 2026-09-21

> **Hinweis:** Dieses Dokument beschreibt wahrheitsgemäß, wie die Software technisch funktioniert und welche Daten sie verarbeitet. Es ersetzt keine rechtliche Prüfung durch eine Datenschutzbeauftragte / einen Datenschutzbeauftragten oder den Betriebsrat. Vor dem produktiven Einsatz mit echten Mitarbeiterdaten sollte dieses Dokument von der zuständigen Stelle geprüft und ggf. um betriebsspezifische Angaben (Verantwortlicher, Kontaktdaten, Aufbewahrungsfristen) ergänzt werden.

---

## 1. Verantwortlicher

Verantwortlich für die Datenverarbeitung ist der Betrieb, der die Software einsetzt (der Arbeitgeber). SchichtPlan Pro ist eine intern betriebene Software ohne eigenen Betreiber-Zugriff auf die Daten — es findet keine Verarbeitung durch Dritte statt (siehe Abschnitt 4).

*[Hier: Name und Kontaktdaten des Betriebs / der verantwortlichen Stelle ergänzen, bevor das Dokument final vorgelegt wird.]*

## 2. Zweck der Datenverarbeitung

SchichtPlan Pro dient der betriebsinternen Personal- und Schichtplanung:

- Zuordnung von Mitarbeitenden zu Maschinen und Schichten (Früh/Spät/Nacht)
- Automatisierte wöchentliche Rotationsplanung
- Erfassung von Abwesenheiten (Urlaub, Krankheit, Karenztage, Zeitausgleich, Weiterbildung, Sonderurlaub) zur Kapazitätsplanung
- Erstellung druckfähiger Wochenschichtpläne (DIN-A4)

Rechtsgrundlage ist im Regelfall die Erfüllung des Arbeitsvertrags bzw. ein berechtigtes betriebliches Interesse an der Personaleinsatzplanung (Art. 6 Abs. 1 lit. b bzw. f DSGVO), ggf. in Verbindung mit einer Betriebsvereinbarung. *[Konkrete Rechtsgrundlage bitte mit dem Betriebsrat/Datenschutzbeauftragten abstimmen.]*

## 3. Verarbeitete Datenkategorien

Die Software speichert pro Abteilung folgende Daten:

### Mitarbeiterdaten
- Vor- und Nachname
- Personalnummer
- Rolle (Teamleiter, Schichtführer, Mitarbeiter, Springer)
- Schichtmodell und Rotationseinstellungen
- Qualifikation für bestimmte Maschinen
- Telefonnummer (**optional**, nur falls von der Schichtleitung eingetragen)
- Freitext-Notizen (**optional**, nur falls eingetragen)

### Abwesenheitsdaten
- Zeitraum der Abwesenheit
- **Art der Abwesenheit**, darunter auch „Krank/AU" — das ist eine **Gesundheitsangabe und damit eine besondere Kategorie personenbezogener Daten nach Art. 9 DSGVO**. Es wird ausschließlich der Status „krank" erfasst, keine Diagnose, keine medizinischen Details.
- Optionale Freitext-Notiz zur Abwesenheit
- Optionale Vertretungszuordnung

### Maschinendaten (keine personenbezogenen Daten)
Maschinenbezeichnung, Standort, Schichtmodell, Status.

### Zugangsdaten
- Das für den Mitarbeiterzugang genutzte Abteilungskürzel ist kein personenbezogenes Datum (kein individuelles Konto pro Person).
- Für den Admin-Zugang wird ein einzelnes, geteiltes Passwort verwendet (siehe Abschnitt 6, TOM).

**Wichtig wegen Art. 9 DSGVO:** Da der Status „Krank/AU" erfasst wird, sollte der Betrieb vor Einsatz prüfen, ob eine Betriebsvereinbarung oder eine andere geeignete Rechtsgrundlage für diese besondere Kategorie vorliegt, und den Zugriffskreis entsprechend eng halten (siehe Abschnitt 6).

## 4. Empfänger der Daten / Datenweitergabe an Dritte

**Es findet grundsätzlich keine Datenübermittlung an Dritte statt.** Die Anwendung ist bewusst so gebaut, dass sie ohne jede Cloud-Anbindung läuft:

- Kein externer API-Aufruf zur Laufzeit (keine KI-Dienste, keine Analytics, kein Tracking, keine Cloud-Datenbank).
- Alle Daten liegen ausschließlich als Dateien auf dem Server, der im lokalen Firmennetz betrieben wird.
- Kein Zugriff des Software-Entwicklers (ArcanePixels) auf die Betriebsdaten — es gibt keine Fernwartungs- oder Telemetrie-Funktion.

**Ausnahme — aktuelle Testphase:** Für die Vorführung/Prüfung vor der internen Freigabe läuft aktuell eine öffentlich erreichbare **Demo-Version bei Vercel Inc.** (USA), einem externen Hosting-Anbieter. Diese Demo:

- enthält ausschließlich **fiktive Testdaten**, keine echten Namen, Personalnummern oder sonstigen Daten realer Mitarbeitender,
- dient ausschließlich der technischen Vorführung,
- wird **abgeschaltet, sobald ein internes Testsystem im Firmennetz zur Verfügung steht**.

Solange diese Demo läuft, dürfen dort **keine echten Personaldaten** eingegeben werden. Für den produktiven Einsatz ist ausschließlich der lokale Betrieb im Firmennetz vorgesehen (siehe README.md, Abschnitt „Architektur").

## 5. Speicherdauer / Löschung

Daten bleiben gespeichert, bis sie manuell durch eine berechtigte Person (Admin-Zugang) geändert oder gelöscht werden, bzw. bis eine ganze Abteilung gelöscht wird. Es gibt aktuell **keine automatische Löschfrist**. *[Empfehlung: betriebliche Löschregelung festlegen, z.B. Abwesenheitsdaten nach Ablauf der gesetzlichen Aufbewahrungspflichten löschen — diese Funktion müsste bei Bedarf noch ergänzt werden.]*

## 6. Technische und organisatorische Maßnahmen (TOM)

### 6.1 Zutrittskontrolle
Der Server läuft auf einem firmeneigenen Rechner im lokalen Netz. Physischer Zutrittsschutz zu diesem Rechner liegt in der Verantwortung des Betriebs (z.B. Serverraum, Zugriffsschutz auf den Host).

### 6.2 Zugangskontrolle
- Mitarbeitende betreten ihre Abteilung über ein Abteilungskürzel. Es findet keine individuelle Authentifizierung pro Person statt — die Zugangskontrolle beschränkt sich auf die Abteilungsebene.
- Der Admin-Bereich (Abteilungen anlegen/löschen, Passwort ändern) ist durch ein Passwort geschützt.
- Das Admin-Passwort wird serverseitig **gehasht** gespeichert (Node.js `crypto.scrypt`, mit individuellem Salt pro Passwort), niemals im Klartext.
- Nach 5 fehlgeschlagenen Anmeldeversuchen sperrt der Server weitere Versuche von derselben Netzwerkadresse für 30 Sekunden (Schutz gegen automatisiertes Ausprobieren).
- Das mitgelieferte Standardpasswort sollte unmittelbar nach der Ersteinrichtung geändert werden.

### 6.3 Zugriffskontrolle (innerhalb der Anwendung)
- Jede Abteilung ist als eigene, getrennte Datei gespeichert — Mitarbeitende einer Abteilung sehen ausschließlich die Daten ihrer eigenen Abteilung, nicht die anderer Abteilungen.
- Der Krankheitsstatus ist im Kalender für alle Personen sichtbar, die Zugang zur jeweiligen Abteilung haben (typischerweise die Schicht-/Betriebsleitung sowie ggf. das Team). Der Zugriffskreis ergibt sich aus der Weitergabe des Abteilungskürzels und sollte vom Betrieb entsprechend eng gehalten werden.

### 6.4 Weitergabekontrolle
- Keine Datenübertragung an Dritte im Produktivbetrieb (siehe Abschnitt 4).
- Datenübertragung zwischen Browser und Server erfolgt innerhalb des lokalen Netzes. *[Empfehlung: HTTPS/TLS für die interne Verbindung einrichten, falls das Firmennetz das erfordert — aktuell läuft die Anwendung per HTTP, was in einem vertrauenswürdigen, abgeschotteten LAN ein geringeres Risiko darstellt als im Internet, aber vor Produktivbetrieb mit der IT-Abteilung abgestimmt werden sollte.]*

### 6.5 Eingabekontrolle
Jede Änderung an einer Abteilung erhält einen Zeitstempel (`lastModified`) und eine fortlaufende Versionsnummer. Dadurch ist erkennbar, wann zuletzt Änderungen vorgenommen wurden. Es gibt aktuell **kein detailliertes Audit-Log** (wer genau welche einzelne Änderung vorgenommen hat), da es keine individuelle Anmeldung pro Mitarbeiter gibt — dies ist eine bekannte Einschränkung, siehe Abschnitt 7.

### 6.6 Verfügbarkeitskontrolle
- Alle Schreibvorgänge auf die Datenbankdateien erfolgen atomar (über eine temporäre Datei mit anschließendem Umbenennen), damit ein Absturz des Servers mitten im Speichern nicht zu einer beschädigten oder leeren Datei führt.
- Bei gleichzeitiger Bearbeitung derselben Abteilung durch mehrere Personen wird ein Konflikt erkannt (optimistisches Locking über eine Versionsnummer) und die zuletzt gespeicherte Änderung nicht stillschweigend überschrieben.
- Es gibt aktuell **kein automatisiertes Backup** der Datendateien. *[Empfehlung: regelmäßige Datensicherung des `data`-Verzeichnisses durch die IT-Abteilung einrichten.]*

### 6.7 Auftragskontrolle / Auftragsverarbeitung
Da keine Datenverarbeitung durch Dritte stattfindet (mit Ausnahme der temporären, datenfreien Vercel-Demo, siehe Abschnitt 4), ist im Produktivbetrieb **kein Auftragsverarbeitungsvertrag (AVV)** erforderlich.

## 7. Bekannte Einschränkungen (Stand dieses Dokuments)

Für die vollständige rechtliche Bewertung transparent aufgeführt:

- Keine individuelle Benutzeranmeldung pro Mitarbeiter, dadurch kein lückenloses Audit-Log auf Personenebene.
- Keine automatische Löschfrist für Abwesenheits- oder Mitarbeiterdaten.
- Keine automatisierte Datensicherung.
- Datenübertragung im lokalen Netz aktuell ohne Verschlüsselung (HTTP statt HTTPS) — vor Produktivbetrieb mit der IT abzustimmen.
- Die Zugriffstrennung erfolgt auf Abteilungsebene, nicht auf Ebene einzelner Datenfelder (z.B. sieht jede Person mit Abteilungszugang auch den Krankheitsstatus aller Kolleg:innen der Abteilung).

## 8. Betroffenenrechte

Mitarbeitende haben das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung ihrer Daten (Art. 15–18 DSGVO). Da alle Daten lokal und ohne Cloud-Anbindung gespeichert werden, können Auskunfts- und Löschanfragen direkt über den Admin-Zugang der Software bearbeitet werden (Export als JSON über die „DB Export"-Funktion, Bearbeitung/Löschung einzelner Datensätze über die Mitarbeiterverwaltung).

---

*Dieses Dokument wurde auf Basis des tatsächlichen Codestands erstellt (Commit-Stand siehe Git-Historie des Repositories) und sollte bei wesentlichen Änderungen an der Architektur (z.B. Einführung neuer externer Dienste) aktualisiert werden.*
