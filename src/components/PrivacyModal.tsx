import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Database,
  UserCheck,
  FileText,
  Printer,
  Copy,
  Check,
  AlertTriangle,
  Info,
  Layers,
  Server,
  Trash2,
  Download,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { ArcanePixelsBrand } from './ArcanePixelsBrand';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  departmentCode?: string;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({
  isOpen,
  onClose,
  departmentCode,
}) => {
  const [activeTab, setActiveTab] = useState<'policy' | 'tom' | 'rights' | 'audit'>('policy');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyText = () => {
    const text = document.getElementById('dsgvo-content-area')?.innerText || '';
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col my-auto overflow-hidden print:max-h-none print:shadow-none print:border-none">
        {/* Header (no-print) */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 no-print">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Datenschutzerklärung & DSGVO-Konformität</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold">
                  Vor Einsatz zu prüfen
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                SchichtPlan Pro • Stand: September 2026 • Grundlage für Betriebsrat & DSB, keine Rechtsberatung
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200 text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 border border-slate-200"
              title="Text in Zwischenablage kopieren"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? 'Kopiert!' : 'Kopieren'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200 text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 border border-slate-200"
              title="Datenschutzerklärung drucken"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Drucken</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 cursor-pointer ml-1 text-lg font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation (no-print) */}
        <div className="flex border-b border-slate-200 bg-white px-4 pt-2 gap-2 text-xs font-semibold overflow-x-auto shrink-0 no-print">
          <button
            type="button"
            onClick={() => setActiveTab('policy')}
            className={`py-2 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'policy'
                ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>1. Datenschutzerklärung</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tom')}
            className={`py-2 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'tom'
                ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>2. TOMs (Techn. & Organ. Maßnahmen)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rights')}
            className={`py-2 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'rights'
                ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>3. Betroffenenrechte (Art. 15–21)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`py-2 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'audit'
                ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>4. Datenschutz-Audit & Checkliste</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div id="dsgvo-content-area" className="p-5 sm:p-6 overflow-y-auto space-y-6 text-slate-800 text-sm leading-relaxed">
          {/* Quick Summary Banner */}
          <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 flex items-start gap-3 text-xs text-blue-950">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-sm block text-blue-950">
                Privacy by Design als Grundlage — vollständige Prüfung steht noch aus
              </span>
              <p className="mt-1 text-blue-900">
                Im produktiven Betrieb (lokaler Firmenserver) arbeitet SchichtPlan Pro <strong>ohne Cloud-Tracking</strong>, ohne externe Telemetrie, ohne Werbenetzwerke und ohne Drittanbieter-Cookies. Ob der Einsatz insgesamt DSGVO-konform ist, hängt zusätzlich von Punkten ab, die dieses Dokument bewusst offen ausweist (siehe Tab 4) — u. a. Backup, Audit-Log, Löschfristen und Transportverschlüsselung. Das muss vor dem Produktivbetrieb mit Betriebsrat/DSB geklärt werden.
              </p>
            </div>
          </div>

          {/* TAB 1: Datenschutzerklärung */}
          {(activeTab === 'policy' || window.matchMedia?.('print').matches) && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 border-b pb-2 mb-3">
                  1. Verantwortliche Stelle & Geltungsbereich
                </h3>
                <p className="text-xs text-slate-600 mb-2">
                  Verantwortlich für die Datenverarbeitung im Sinne der Datenschutz-Grundverordnung (DSGVO) sowie des Bundesdatenschutzgesetzes (BDSG) bzw. der jeweiligen nationalen Datenschutzgesetze ist der <strong>Betrieb / Arbeitgeber</strong>, der SchichtPlan Pro auf seinen internen Systemen betreibt.
                </p>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-mono text-slate-700">
                  Verantwortlicher: [Name & Anschrift des betreibenden Unternehmens / der Niederlassung]<br />
                  Datenschutzbeauftragter (DSB): [Kontaktdaten des betrieblichen DSB]<br />
                  Zuständiger Betriebsrat: [Betriebsvereinbarung zur Schichtplanung / Personaleinsatz]
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 border-b pb-2 mb-3">
                  2. Zweck der Datenverarbeitung & Rechtsgrundlagen
                </h3>
                <p className="text-xs text-slate-600 mb-3">
                  Die Erhebung und Verarbeitung der personenbezogenen Daten erfolgt ausschließlich zu folgenden Zwecken:
                </p>
                <ul className="list-disc pl-5 text-xs text-slate-700 space-y-1.5">
                  <li>
                    <strong>Personaleinsatz- und Schichtplanung:</strong> Zuweisung von Beschäftigten zu Maschinen, Anlagen und Schichtmodellen (Früh-, Spät-, Nachtschicht).
                  </li>
                  <li>
                    <strong>Rotations- und Rhythmusverwaltung:</strong> Sicherstellung gesetzlicher und tariflicher Ruhezeiten sowie gerechter Schichtfolgen.
                  </li>
                  <li>
                    <strong>Abwesenheits- und Kapazitätsplanung:</strong> Erfassung von Urlaubstagen, Zeitausgleich, Weiterbildung sowie Arbeitsunfähigkeit (AU) zur Besetzungssicherung.
                  </li>
                  <li>
                    <strong>Erstellung von Schichtplänen:</strong> Druckfähige Aushänge für den Schichtbetrieb (DIN-A4).
                  </li>
                </ul>

                <div className="mt-3 bg-blue-50 p-3 rounded-lg border border-blue-200 text-xs text-blue-900 space-y-1">
                  <span className="font-bold block">Rechtsgrundlagen:</span>
                  <div>• <strong>Art. 6 Abs. 1 lit. b DSGVO i.V.m. § 26 Abs. 1 BDSG:</strong> Erforderlichkeit für die Durchführung des Beschäftigungsverhältnisses.</div>
                  <div>• <strong>Art. 6 Abs. 1 lit. c DSGVO:</strong> Erfüllung rechtlicher Pflichten (z. B. Arbeitszeitgesetz ArbZG, Dokumentation von Ruhezeiten).</div>
                  <div>• <strong>Art. 88 DSGVO i.V.m. Betriebsvereinbarung:</strong> Sofern eine Betriebsvereinbarung zur Schichtplanung vorliegt.</div>
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 border-b pb-2 mb-3">
                  3. Verarbeitete Datenkategorien & Besondere Kategorien (Art. 9 DSGVO)
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="border border-slate-200 rounded-lg p-3">
                    <span className="font-bold text-slate-900 block mb-1">Mitarbeiter-Stammdaten:</span>
                    <p className="text-slate-600">
                      Vor- und Nachname, Personalnummer, betriebliche Rolle (Teamleiter, Schichtführer, Mitarbeiter, Springer), Schichtmodell (1-, 2-, 3-Schicht), Qualifikationen an Maschinen, Telefonnummer (optional), Notizen (optional), Aktivstatus.
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded-lg p-3">
                    <span className="font-bold text-slate-900 block mb-1">Urlaubsansprüche & Sonderregelungen:</span>
                    <p className="text-slate-600">
                      Jahresurlaubskontingent in Tagen (z. B. 30 Tage), Vorjahresübertrag in Tagen, Sonderregelungen/Notizen (z. B. vertragliche Teilzeitquoten oder Zusatzurlaub nach § 208 SGB IX bei Schwerbehinderung/GdB).
                    </p>
                  </div>

                  <div className="border border-amber-300 bg-amber-50/60 rounded-lg p-3">
                    <span className="font-bold text-amber-950 block mb-1 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                      Besondere Kategorien personenbezogener Daten (Art. 9 DSGVO / § 26 Abs. 3 BDSG):
                    </span>
                    <p className="text-amber-900">
                      Die Erfassung von <strong>Arbeitsunfähigkeit / Krankheitsstatus (AU)</strong> sowie ggf. Zusatzurlaub nach § 208 SGB IX stellen Gesundheitsdaten dar.
                    </p>
                    <div className="mt-2 bg-white/80 p-2.5 rounded border border-amber-200 text-slate-700 space-y-1">
                      <div><strong>Strenge Zweckbindung & Datensparsamkeit:</strong> Es werden <u>ausschließlich</u> die Tatsache der Abwesenheit und die Dauer (Start-/Enddatum) erfasst.</div>
                      <div><strong>Keine medizinischen Daten:</strong> Es werden <u>weder Diagnosen, ICD-10-Schlüssel, Befunde noch behandelnde Ärzte</u> erfasst oder verarbeitet.</div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 border-b pb-2 mb-3">
                  4. Keine Datenweitergabe im Produktivbetrieb
                </h3>
                <p className="text-xs text-slate-700">
                  Im vorgesehenen Produktivbetrieb (lokaler Server im Firmennetz) wurde SchichtPlan Pro nach dem Prinzip der <strong>vollständigen Datenhoheit</strong> entwickelt:
                </p>
                <ul className="list-disc pl-5 text-xs text-slate-700 mt-2 space-y-1">
                  <li>Keine Übermittlung an externe Cloud-Anbieter oder US-Server.</li>
                  <li>Keine Einbindung externer Werbenetzwerke, Social-Media-Plugins oder Analyse-Tools (kein Google Analytics, keine Tracking-Pixel).</li>
                  <li>Keine Auswertung durch künstliche Intelligenz (KI) in externen Clouds.</li>
                  <li>Der Software-Hersteller (ArcanePixels) hat <strong>keinerlei Zugriff</strong> auf die Datenbanken oder Planungsstände Ihres Betriebs.</li>
                </ul>

                <div className="mt-3 bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-950 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Ausnahme — aktuelle Vorführ-Demo:</span>
                    Für die Prüfung vor der internen Freigabe läuft parallel eine öffentliche Demo-Version bei <strong>Vercel Inc. (USA)</strong>, einem externen Hosting-Anbieter. Diese Demo speichert keine Daten dauerhaft und enthält ausschließlich fiktive Testdaten — <strong>echte Mitarbeiter- oder Personaldaten dürfen dort unter keinen Umständen eingegeben werden.</strong> Die Demo wird abgeschaltet, sobald ein internes Testsystem im Firmennetz zur Verfügung steht.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Technische und Organisatorische Maßnahmen (TOMs) */}
          {(activeTab === 'tom' || window.matchMedia?.('print').matches) && (
            <div className="space-y-5">
              <h3 className="text-base font-bold text-slate-900 border-b pb-2 mb-3">
                Technische und Organisatorische Maßnahmen (TOM) gem. Art. 32 DSGVO
              </h3>
              <p className="text-xs text-slate-600">
                Zur Gewährleistung eines dem Risiko angemessenen Schutzniveaus wurden folgende Maßnahmen implementiert:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-blue-600" />
                    <span>Mandantentrennung & Zugriffsschutz</span>
                  </div>
                  <p className="text-slate-600">
                    Jede Abteilung wird in einer isolierten JSON-Datenbank verwaltet. Mitarbeiter können ausschließlich die Daten ihrer eigenen Abteilung nach Eingabe des Abteilungskürzels einsehen.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-blue-600" />
                    <span>Passworthashing (scrypt mit Salt)</span>
                  </div>
                  <p className="text-slate-600">
                    Administrative Passwörter werden auf dem Server mit dem kryptografisch sicheren <code>scrypt</code>-Algorithmus (16-Byte kryptografisches Salt, 64-Byte Hash) gespeichert — niemals im Klartext.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Brute-Force-Schutz & Rate-Limiting</span>
                  </div>
                  <p className="text-slate-600">
                    Nach wiederholten fehlgeschlagenen Anmeldeversuchen im Administrationsbereich greift eine temporäre Sperre gegen automatisierte Wörterbuch- und Ausprobier-Angriffe.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-blue-600" />
                    <span>Atomare Dateispeicherung</span>
                  </div>
                  <p className="text-slate-600">
                    Datenbank-Schreibvorgänge erfolgen atomar über temporäre Dateien mit anschließendem Dateisystem-Rename, um Datenkorruption bei plötzlichem Stromausfall oder Serverabsturz zu verhindern.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Betroffenenrechte */}
          {(activeTab === 'rights' || window.matchMedia?.('print').matches) && (
            <div className="space-y-4">
              <h3 className="text-base font-bold text-slate-900 border-b pb-2 mb-3">
                Wahrnehmung der Betroffenenrechte gem. Art. 15–21 DSGVO
              </h3>
              <p className="text-xs text-slate-600">
                Betroffene Beschäftigte haben gegenüber dem verantwortlichen Betrieb folgende Rechte, die mit SchichtPlan Pro direkt erfüllt werden können:
              </p>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-lg border border-slate-200 flex items-start gap-3">
                  <div className="p-1.5 bg-blue-50 text-blue-700 rounded font-bold shrink-0">Art. 15</div>
                  <div>
                    <span className="font-bold text-slate-900 block">Recht auf Auskunft & Datenkopie</span>
                    Über die Funktion <strong>„DB Export (JSON)"</strong> kann jederzeit ein vollständiger, maschinenlesbarer Auszug aller gespeicherten Daten exportiert und dem Mitarbeiter vorgelegt werden.
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 flex items-start gap-3">
                  <div className="p-1.5 bg-blue-50 text-blue-700 rounded font-bold shrink-0">Art. 16</div>
                  <div>
                    <span className="font-bold text-slate-900 block">Recht auf Berichtigung</span>
                    Fehlerhafte Stammdaten, Urlaubsansprüche oder Abwesenheitszeiträume können von autorisierten Schichtleitern direkt in den jeweiligen Modulen korrigiert werden.
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 flex items-start gap-3">
                  <div className="p-1.5 bg-red-50 text-red-700 rounded font-bold shrink-0">Art. 17</div>
                  <div>
                    <span className="font-bold text-slate-900 block">Recht auf Löschung („Vergessenwerden")</span>
                    Ausscheidende Mitarbeiter können mit allen verknüpften Abwesenheiten unwiderruflich gelöscht werden (Mitarbeiterverwaltung → roter Papierkorb).
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 flex items-start gap-3">
                  <div className="p-1.5 bg-amber-50 text-amber-700 rounded font-bold shrink-0">Art. 18</div>
                  <div>
                    <span className="font-bold text-slate-900 block">Recht auf Einschränkung der Verarbeitung</span>
                    Mitarbeiter können vorübergehend auf <em>„Inaktiv"</em> gesetzt werden, sodass sie nicht mehr für neue Schichtzuteilungen eingeplant werden, historische Daten jedoch für Fristen erhalten bleiben.
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 flex items-start gap-3">
                  <div className="p-1.5 bg-blue-50 text-blue-700 rounded font-bold shrink-0">Art. 20</div>
                  <div>
                    <span className="font-bold text-slate-900 block">Recht auf Datenübertragbarkeit</span>
                    Standardisierter JSON-Export ermöglicht den unkomplizierten Transfer der Planungsdaten in andere ERP- oder HR-Systeme.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Audit & Checkliste */}
          {activeTab === 'audit' && (
            <div className="space-y-4 text-xs">
              <h3 className="text-base font-bold text-slate-900 border-b pb-2 mb-3">
                DSGVO-Prüfprotokoll & Audit-Checkliste
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border border-slate-200 rounded-xl overflow-hidden">
                  <thead className="bg-slate-100 text-slate-800 font-bold text-[11px] uppercase">
                    <tr>
                      <th className="p-3">Prüfkriterium</th>
                      <th className="p-3">Technischer Status</th>
                      <th className="p-3">Ergebnis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Keine Third-Party Tracking-Cookies</td>
                      <td className="p-3 text-slate-600">Keine Tracker, keine Werbe-Cookies, kein Profiling</td>
                      <td className="p-3 font-bold text-emerald-700 flex items-center gap-1">
                        <Check className="w-4 h-4" /> Erfüllt
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Keine Weitergabe an Cloud-Server (Produktivbetrieb)</td>
                      <td className="p-3 text-slate-600">100% lokaler Intranet-Betrieb im Firmennetz vorgesehen. Aktuell läuft zusätzlich eine öffentliche, datenfreie Vorführ-Demo bei Vercel (USA) — siehe Tab 1, Abschnitt 4.</td>
                      <td className="p-3 font-bold text-emerald-700 flex items-center gap-1">
                        <Check className="w-4 h-4" /> Erfüllt im Produktivbetrieb
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Datensparsamkeit bei Art. 9 DSGVO</td>
                      <td className="p-3 text-slate-600">Nur Abwesenheitsstatus (AU/Krank), keine Diagnosen</td>
                      <td className="p-3 font-bold text-emerald-700 flex items-center gap-1">
                        <Check className="w-4 h-4" /> Erfüllt
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Kryptografische Passwort-Sicherung</td>
                      <td className="p-3 text-slate-600">scrypt KDF mit individuellem Salt je Admin-Konto</td>
                      <td className="p-3 font-bold text-emerald-700 flex items-center gap-1">
                        <Check className="w-4 h-4" /> Erfüllt
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Datenexport & Löschfunktion</td>
                      <td className="p-3 text-slate-600">Vollständiger JSON-Export & Einzeldatensatzlöschung</td>
                      <td className="p-3 font-bold text-emerald-700 flex items-center gap-1">
                        <Check className="w-4 h-4" /> Erfüllt
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Automatisierte Datensicherung (Backup)</td>
                      <td className="p-3 text-slate-600">Kein automatisiertes Backup der Server-Datendateien vorhanden</td>
                      <td className="p-3 font-bold text-amber-700 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" /> Offen — IT-seitig einrichten
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Personenbezogenes Audit-Log</td>
                      <td className="p-3 text-slate-600">Kein individuelles Mitarbeiter-Login, daher kein lückenloses Log einzelner Änderungen</td>
                      <td className="p-3 font-bold text-amber-700 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" /> Bekannte Einschränkung
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Automatische Löschfristen</td>
                      <td className="p-3 text-slate-600">Daten bleiben bis zur manuellen Löschung bestehen</td>
                      <td className="p-3 font-bold text-amber-700 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" /> Betrieblich festzulegen
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-slate-900">Transportverschlüsselung (TLS/HTTPS)</td>
                      <td className="p-3 text-slate-600">Server läuft aktuell per HTTP im lokalen Netz</td>
                      <td className="p-3 font-bold text-amber-700 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" /> Mit IT-Abteilung abstimmen
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 space-y-1">
                <span className="font-bold block">Empfehlung für die betriebliche Inbetriebnahme:</span>
                <p className="text-[11px] text-blue-800">
                  1. Ändern Sie das Standard-Admin-Passwort bei der Ersteinrichtung.<br />
                  2. Binden Sie den internen Webserver über HTTPS/TLS in Ihr Firmennetz ein.<br />
                  3. Richten Sie eine regelmäßige Datensicherung des Server-Datenverzeichnisses ein.<br />
                  4. Legen Sie mit dem Betriebsrat/DSB eine Löschfrist für Abwesenheits- und Mitarbeiterdaten fest.<br />
                  5. Vereinbaren Sie mit dem Betriebsrat eine standardisierte Betriebsvereinbarung zur Schicht- und Urlaubsplanung.<br />
                  6. Stellen Sie sicher, dass in der öffentlichen Vorführ-Demo (falls noch aktiv) keine echten Personaldaten eingegeben werden.
                </p>
              </div>
            </div>
          )}

          {/* Footer note inside modal */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
            <div>
              Software: <strong>SchichtPlan Pro</strong> • Lizenzfreier lokaler Betrieb
            </div>
            <div className="flex items-center gap-1.5">
              <span>Technisch bereitgestellt von</span>
              <ArcanePixelsBrand theme="light" variant="text" />
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions (no-print) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0 no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs cursor-pointer shadow-xs transition-colors"
          >
            Schließen & Verstanden
          </button>
        </div>
      </div>
    </div>
  );
};
