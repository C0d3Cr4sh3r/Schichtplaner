import React, { useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  Cpu,
  Users,
  CalendarOff,
  Printer,
  Database,
  ArrowRight,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  FileText,
  Lock,
  Download,
  Share2,
  HelpCircle,
  ShieldCheck,
  Zap,
  Clock,
  Layers,
  Sliders,
  Check,
} from 'lucide-react';

export const UserManual: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('all');
  const [rotationSimWeek, setRotationSimWeek] = useState<number>(1);
  const [simSequence, setSimSequence] = useState<string[]>(['frueh', 'nacht', 'spaet']);
  const [simOffset, setSimOffset] = useState<number>(0);

  // Simulator for visual demonstration of the rotation engine
  const getSimulatedShiftForWeek = (weekNum: number) => {
    const adjustedWeek = weekNum + simOffset - 1;
    const index = ((adjustedWeek % simSequence.length) + simSequence.length) % simSequence.length;
    const shift = simSequence[index];

    switch (shift) {
      case 'frueh':
        return { label: 'Frühschicht (06:00 - 14:00)', bg: 'bg-amber-100 text-amber-900 border-amber-300' };
      case 'spaet':
        return { label: 'Spätschicht (14:00 - 22:00)', bg: 'bg-blue-100 text-blue-900 border-blue-300' };
      case 'nacht':
        return { label: 'Nachtschicht (22:00 - 06:00)', bg: 'bg-slate-800 text-white border-slate-900' };
      default:
        return { label: 'Frei / Ruhetag (Wochenruhe)', bg: 'bg-slate-100 text-slate-600 border-slate-300' };
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[700px] flex flex-col md:flex-row print:shadow-none print:border-none">
      {/* Sidebar navigation (hidden on print) */}
      <div className="w-full md:w-72 bg-slate-50 border-r border-slate-200 p-4 md:sticky md:top-[120px] h-auto md:h-[calc(100vh-160px)] overflow-y-auto no-print">
        <div className="flex items-center gap-2 mb-4 px-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <h2 className="font-display font-bold text-slate-800 text-sm tracking-wide uppercase">
            Inhaltsverzeichnis
          </h2>
        </div>

        <div className="space-y-1">
          {[
            { id: 'all', label: 'Komplettes Handbuch', icon: FileText },
            { id: 'allgemein', label: '1. Übersicht, Login & Sicherheit', icon: ShieldCheck },
            { id: 'schichtplanung', label: '2. Schicht- & Wochenplaner', icon: CalendarDays },
            { id: 'rotation', label: '3. Rotations-Engine & Zyklen', icon: RotateCw },
            { id: 'maschinen', label: '4. Maschinenverwaltung & Profile', icon: Cpu },
            { id: 'abwesenheiten', label: '5. Urlaub, Feiertage & Konflikte', icon: CalendarOff },
            { id: 'layout', label: '6. DIN-A4 Layout & PDF-Druck', icon: Printer },
            { id: 'backup', label: '7. Backup, Sync & Speicher', icon: Database },
            { id: 'datenschutz', label: '8. Datenschutz & DSGVO', icon: ShieldCheck },
            { id: 'faq', label: '9. FAQ & Fehlerbehebung', icon: HelpCircle },
          ].map((sec) => {
            const Icon = sec.icon;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg text-left transition-all cursor-pointer ${
                  activeSection === sec.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 pt-4 border-t border-slate-200 px-2">
          <button
            onClick={handlePrint}
            className="w-full py-2.5 px-3 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Als PDF drucken</span>
          </button>
          <p className="text-[10px] text-slate-500 mt-2 text-center leading-relaxed">
            Nutzen Sie „Als PDF speichern“ im System-Druckdialog für den perfekten Export.
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 md:p-10 overflow-y-auto max-w-4xl print:p-0 print:overflow-visible">
        {/* Header */}
        <div className="border-b border-slate-200 pb-6 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-600 text-xs font-bold tracking-wide uppercase mb-1">
              <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Betriebliche Anwenderdokumentation</span>
            </div>
            <h1 className="font-display font-extrabold text-slate-900 text-2xl md:text-3xl tracking-tight">
              SchichtPlan <span className="text-blue-600">Pro</span> Benutzerhandbuch
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Ausführliche Dokumentation für Schichtführer, Meister, Planer & Abteilungsleiter
            </p>
          </div>
          <button
            onClick={handlePrint}
            className="no-print sm:flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <Printer className="w-4 h-4" />
            Dokument drucken (PDF)
          </button>
        </div>

        {/* Section 1: Overview, Login & Security */}
        {(activeSection === 'all' || activeSection === 'allgemein') && (
          <section id="allgemein" className="mb-12 scroll-mt-20 print:mb-8 break-inside-avoid-page">
            <h2 className="font-display font-extrabold text-slate-900 text-xl mb-4 flex items-center gap-2 pb-1.5 border-b border-slate-100">
              <span className="text-blue-600">1.</span> Systemübersicht, Login & Intranet-Sicherheit
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              <strong>SchichtPlan Pro</strong> ist eine spezialisierte Komplettlösung zur Planung von industriellen
              Schichten, Maschinenbelegungen und Urlaubsabwesenheiten im produzierenden Gewerbe. SchichtPlan Pro ist
              primär für den Betrieb auf einem zentralen Server im <strong>Firmen-Intranet</strong> ausgelegt: In diesem
              Modus werden zu keinem Zeitpunkt Mitarbeiter- oder Produktionsdaten an externe Cloud-Dienste übermittelt.
              Ist kein solcher Server erreichbar (z. B. bei einer Demo- oder Cloud-Installation), wechselt die
              Anwendung automatisch in einen <strong>Browser-Modus</strong> und speichert alle Daten ausschließlich
              lokal auf dem jeweiligen Gerät. Für den produktiven Betrieb mit mehreren Nutzern ist stets der
              Intranet-Server-Modus vorgesehen.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                <h3 className="font-semibold text-blue-900 text-sm mb-1.5 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Strikte Abteilungs-Isolation
                </h3>
                <p className="text-blue-800 text-xs leading-relaxed">
                  Jede Fertigungs- oder Logistikgruppe meldet sich mit einem festen <strong>Abteilungskürzel</strong>{' '}
                  (z. B. <code>FERT-A</code>, <code>MONT-01</code>) an. Die Datenbanken der einzelnen Abteilungen
                  liegen in getrennten Dateien auf dem Server. Eine Datenvermischung zwischen Abteilungen ist technisch
                  ausgeschlossen.
                </p>
              </div>

              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
                <h3 className="font-semibold text-emerald-900 text-sm mb-1.5 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  Sichere Authentifizierung (scrypt)
                </h3>
                <p className="text-emerald-800 text-xs leading-relaxed">
                  Passwörter für Abteilungen und den Administrationsbereich werden serverseitig mit dem kryptografischen
                  Standard <strong>scrypt mit zufälligem Salt</strong> gehasht. Passwörter liegen niemals im Klartext
                  vor.
                </p>
              </div>
            </div>

            {/* Visual Diagram: Intranet & Sync Flow */}
            <div className="border border-slate-200 bg-slate-50/60 rounded-xl p-5 mb-6">
              <h4 className="font-display font-bold text-slate-800 text-xs tracking-wider uppercase mb-3 text-center">
                Visualisierung: Intranet-Synchronisation & Konfliktschutz
              </h4>
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-2">
                {/* Client Browser A */}
                <div className="flex flex-col items-center bg-white border border-slate-200 p-3 rounded-lg shadow-2xs w-44 text-center">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-1">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">Planer A (Halle 1)</span>
                  <span className="text-[10px] text-slate-500">Bearbeitet KW 14</span>
                  <div className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 mt-2 font-mono">
                    Version: #42
                  </div>
                </div>

                <div className="flex flex-col items-center shrink-0">
                  <span className="text-[10px] text-emerald-600 font-mono font-bold">Auto-Polling (4s)</span>
                  <div className="flex items-center gap-1 my-1">
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>

                {/* Shared Server Storage */}
                <div className="flex flex-col items-center bg-blue-50 border-2 border-blue-300 p-4 rounded-xl shadow-xs w-48 text-center relative">
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                    Intranet-Server
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white mb-1.5 mt-1 shadow-sm">
                    <Database className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-blue-900">Zentraler Speicher</span>
                  <span className="text-[10px] text-blue-700">Abteilung: FERT-A</span>
                  <div className="text-[9px] bg-emerald-100 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded font-mono mt-2">
                    Atomare Schreibvorgänge
                  </div>
                </div>

                <div className="flex flex-col items-center shrink-0">
                  <span className="text-[10px] text-emerald-600 font-mono font-bold">Live-Aktualisierung</span>
                  <div className="flex items-center gap-1 my-1">
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>

                {/* Client Browser B */}
                <div className="flex flex-col items-center bg-white border border-slate-200 p-3 rounded-lg shadow-2xs w-44 text-center">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-1">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">Meister-PC (Büro)</span>
                  <span className="text-[10px] text-slate-500">Live-Ansicht</span>
                  <div className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 mt-2 font-mono">
                    Version: #42 (Sync)
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 text-center mt-3 leading-normal max-w-xl mx-auto">
                <strong>Mehrbenutzer-Betrieb mit Optimistic Locking:</strong> Beim gleichzeitigen Bearbeiten prüft das
                System Versionsnummern. Überschreibt ein Kollege gleichzeitig Daten, wird der Nutzer gewarnt und die
                Daten werden zusammengeführt.
              </p>
            </div>
          </section>
        )}

        {/* Section 2: Shift Planner */}
        {(activeSection === 'all' || activeSection === 'schichtplanung') && (
          <section id="schichtplanung" className="mb-12 scroll-mt-20 print:mb-8 break-inside-avoid-page">
            <h2 className="font-display font-extrabold text-slate-900 text-xl mb-4 flex items-center gap-2 pb-1.5 border-b border-slate-100">
              <span className="text-blue-600">2.</span> Der wöchentliche Schicht- & Wochenplaner
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              Der Wochenplaner ist das zentrale Arbeitswerkzeug für die Einteilung der Belegschaft in der ausgewählten
              Kalenderwoche (KW).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-3xs">
                <h4 className="font-bold text-slate-800 text-xs tracking-wide uppercase mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                  Automatische Zuteilungslogik
                </h4>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Qualifikationsabgleich:</strong> Nur Mitarbeiter mit gültiger Maschineneinweisung werden
                      zugeordnet.
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Stammmaschinen-Priorität:</strong> Mitarbeiter mit hinterlegter Stammmaschine werden
                      bevorzugt eingeteilt.
                    </span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Abwesenheitsfilter:</strong> Urlaub, Krankheit oder Zeitausgleich schließen Mitarbeiter
                      automatisch aus.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-3xs">
                <h4 className="font-bold text-slate-800 text-xs tracking-wide uppercase mb-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-amber-500 rounded-full" />
                  Manuelle Korrekturen (Overrides)
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  Der Planer kann jederzeit eingreifen: Durch Klick auf ein beliebiges Tabellenfeld können Mitarbeiter
                  manuell hinzugefügt, abgezogen oder getauscht werden.
                </p>
                <div className="text-[11px] bg-amber-50 border border-amber-200 rounded-lg p-2 text-amber-900 flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Manuell übersteuerte Zuweisungen werden dezent mit einem Farbindikator markiert.</span>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                Schichtleiter, Vorarbeiter & Wochennotizen
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Jede Kalenderwoche verfügt über feste Zuweisungsfelder für Schichtführer (Früh-, Spät-, Nachtschicht)
                und Meister vom Dienst sowie ein freies <strong>Notizenfeld</strong> (z. B. für geplante Rüstvorgänge,
                Wartungsfenster oder Sicherheitsunterweisungen), das auf dem Ausdruck prominent erscheint.
              </p>
            </div>
          </section>
        )}

        {/* Section 3: Rotation Engine */}
        {(activeSection === 'all' || activeSection === 'rotation') && (
          <section id="rotation" className="mb-12 scroll-mt-20 print:mb-8 break-inside-avoid-page">
            <h2 className="font-display font-extrabold text-slate-900 text-xl mb-4 flex items-center gap-2 pb-1.5 border-b border-slate-100">
              <span className="text-blue-600">3.</span> Die Schicht-Rotations-Engine
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              Die mathematische Rotations-Engine errechnet automatisch für jede Kalenderwoche des Jahres die korrekte
              Schicht für jeden Mitarbeiter, inklusive korrekter Behandlung von 52- bzw. 53-Wochen-ISO-Jahren. Der
              werkseitige Standard-Rhythmus für neue Mitarbeiter im 3-Schicht-Betrieb lautet{' '}
              <strong>Früh → Nacht → Spät</strong> und wird beim Anlegen eines neuen Mitarbeiters automatisch
              vorausgewählt.
            </p>

            <div className="border border-slate-200 bg-slate-50 rounded-xl p-5 mb-6">
              <h3 className="font-bold text-slate-800 text-xs tracking-wider uppercase text-center mb-4">
                Interaktiver Schichtrotations-Simulator
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Rotationszyklus</label>
                  <select
                    className="w-full text-xs p-2 border border-slate-300 rounded bg-white"
                    onChange={(e) => setSimSequence(e.target.value.split(','))}
                  >
                    <option value="frueh,nacht,spaet">Früh ➡️ Nacht ➡️ Spät (Werkseitiger Standard, 3 Wochen)</option>
                    <option value="frueh,spaet,nacht,frei">Früh ➡️ Spät ➡️ Nacht ➡️ Frei (4 Wochen)</option>
                    <option value="frueh,spaet,frei">Früh ➡️ Spät ➡️ Frei (3 Wochen)</option>
                    <option value="frueh,frueh,spaet,frei">Früh ➡️ Früh ➡️ Spät ➡️ Frei (4 Wochen)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Start-Offset (Wochen)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={simOffset}
                    onChange={(e) => setSimOffset(Number(e.target.value))}
                    className="w-full text-xs p-2 border border-slate-300 rounded bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Simulations-Woche
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="1"
                      max="52"
                      value={rotationSimWeek}
                      onChange={(e) => setRotationSimWeek(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono font-bold text-slate-800 bg-slate-200 px-2 py-1 rounded">
                      KW {rotationSimWeek}
                    </span>
                  </div>
                </div>
              </div>

              {/* Simulation Result */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    Berechnete Schichtzuweisung
                  </div>
                  <div className="text-sm font-extrabold text-slate-800 mt-0.5">Mitarbeiter-Status</div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    Formel: ((KW + Offset - 1) % Zykluslänge)
                  </div>
                </div>

                <div
                  className={`px-4 py-2 border rounded-lg font-bold text-sm tracking-wide shadow-2xs ${getSimulatedShiftForWeek(rotationSimWeek).bg}`}
                >
                  {getSimulatedShiftForWeek(rotationSimWeek).label}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-slate-600 text-xs">
              <p>
                <strong>Start-Offset (Wochenverschiebung):</strong> Mitarbeiter in derselben Schichtgruppe erhalten
                unterschiedliche Offsets, sodass die Schichten gleichmäßig besetzt sind.
              </p>
              <p>
                <strong>Schichtausschluss (Excluded Shifts):</strong> Kann ein Mitarbeiter z. B. aus gesundheitlichen
                Gründen keine Nachtschicht leisten, wird diese Schichtart in seinen Stammdaten deaktiviert. Die Engine
                teilt ihn in diesen Wochen automatisch als <code>Frei</code> ein.
              </p>
            </div>
          </section>
        )}

        {/* Section 4: Machine Management */}
        {(activeSection === 'all' || activeSection === 'maschinen') && (
          <section id="maschinen" className="mb-12 scroll-mt-20 print:mb-8 break-inside-avoid-page">
            <h2 className="font-display font-extrabold text-slate-900 text-xl mb-4 flex items-center gap-2 pb-1.5 border-b border-slate-100">
              <span className="text-blue-600">4.</span> Maschinenverwaltung & Personalbedarf
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              Jede Maschine im Maschinenpark wird mit spezifischen Anforderungsprofilen konfiguriert.
            </p>

            <div className="border border-slate-200 rounded-xl overflow-hidden mb-6 shadow-3xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 font-bold text-slate-700">
                  <tr>
                    <th className="p-3">Konfigurationsfeld</th>
                    <th className="p-3">Funktion & Auswirkung auf die Planung</th>
                    <th className="p-3">Beispiel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-600">
                  <tr>
                    <td className="p-3 font-mono font-bold text-slate-800">Maschinencode</td>
                    <td className="p-3">Eindeutiges Werkskürzel (wird auch im Druckplan ausgegeben).</td>
                    <td className="p-3 font-mono">CNC-02</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-bold text-slate-800">Schichtmodell</td>
                    <td className="p-3">
                      Legt fest, ob die Maschine in 1-Schicht, 2-Schichten oder 3-Schichten läuft.
                    </td>
                    <td className="p-3">3-Schicht (Früh/Spät/Nacht)</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-bold text-slate-800">Soll-Besetzung</td>
                    <td className="p-3">Mindest- und Maximalanzahl an Bedienern je Schicht.</td>
                    <td className="p-3">Min: 1 / Max: 2</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono font-bold text-slate-800">Wartungsstatus</td>
                    <td className="p-3">
                      Maschinen in Wartung oder Stillstand werden automatisch im Plan ausgegraut.
                    </td>
                    <td className="p-3 font-semibold text-amber-700">Wartung KW 18</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4">
              <h4 className="font-bold text-sm mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Automatische Unterbesetzungswarnung
              </h4>
              <p className="text-xs leading-relaxed">
                Wird die Mindestbesetzung einer Maschine in einer Schicht nicht erreicht, warnt das System im
                Wochenplan sofort optisch mit einer Bedarfsdifferenz.
              </p>
            </div>
          </section>
        )}

        {/* Section 5: Absences & Holidays */}
        {(activeSection === 'all' || activeSection === 'abwesenheiten') && (
          <section id="abwesenheiten" className="mb-12 scroll-mt-20 print:mb-8 break-inside-avoid-page">
            <h2 className="font-display font-extrabold text-slate-900 text-xl mb-4 flex items-center gap-2 pb-1.5 border-b border-slate-100">
              <span className="text-blue-600">5.</span> Urlaubs- & Abwesenheitserfassung
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              Der integrierte Jahres-Abwesenheitskalender ermöglicht die schnelle Erfassung von Urlaub,
              Arbeitsunfähigkeit (AU), Zeitausgleich und Weiterbildung.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-3xs">
                <h4 className="font-bold text-slate-800 text-xs tracking-wide uppercase mb-2 flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-blue-600" />
                  Stempel-Werkzeug & Bereichsauswahl
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed mb-2">
                  Wählen Sie einen Abwesenheitstyp (z. B. Urlaub oder Krankheit) als aktiven Stempel. Klicken oder
                  ziehen Sie über Tage, um ganze Zeiträume in Sekunden zu stempeln.
                </p>
                <div className="text-[11px] bg-slate-100 rounded p-2 text-slate-700">
                  🧹 Mit dem <strong>Radiergummi</strong> können eingetragene Tage einfach per Klick wieder entfernt
                  werden.
                </div>
                <div className="text-[11px] bg-amber-50 border border-amber-200 rounded p-2 text-amber-800 mt-2">
                  ⚠️ Beim Öffnen des Kalenders ist <strong>standardmäßig kein Stempel aktiv</strong> — ein
                  versehentlicher Klick auf ein Kalenderfeld trägt also nichts ein. Erst nach bewusster Auswahl
                  eines Stempels werden Klicks auf Tage wirksam.
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-3xs">
                <h4 className="font-bold text-slate-800 text-xs tracking-wide uppercase mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Feiertagsautomatik & Netto-Tage
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed mb-2">
                  Gesetzliche Feiertage (z. B. Neujahr, Karfreitag, Tag der Arbeit, Weihnachten) werden automatisch
                  erkannt und lassen sich über den Button „Feiertage" oberhalb des Kalenders farblich ein- oder
                  ausblenden.
                </p>
                <div className="text-[11px] bg-emerald-50 border border-emerald-200 rounded p-2 text-emerald-800">
                  Urlaubstage werden nur für tatsächliche Arbeitstage (Mo-Fr, ohne Feiertage) vom Jahreskontingent
                  abgezogen!
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-3xs">
                <h4 className="font-bold text-slate-800 text-xs tracking-wide uppercase mb-2 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Urlaubskontingent & Kontostand
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed mb-2">
                  Jeder Mitarbeiter hat ein individuelles Jahres-Urlaubskontingent (Standard: 30 Tage) inklusive
                  Vorjahresübertrag und Sonderregelungen (z. B. Zusatzurlaub bei Schwerbehinderung). Klicken Sie im
                  Kalender auf das Urlaubskonto-Badge eines Mitarbeiters, um Kontingent und Kontostand einzusehen
                  oder anzupassen.
                </p>
                <div className="text-[11px] bg-red-50 border border-red-200 rounded p-2 text-red-800">
                  Überschreitet ein Mitarbeiter sein Kontingent, warnt das System automatisch mit einer
                  übersichtlichen Liste aller betroffenen Mitarbeiter.
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-3xs">
                <h4 className="font-bold text-slate-800 text-xs tracking-wide uppercase mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Automatische Konflikterkennung an Maschinen
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Überschneiden sich die Urlaubs- oder Abwesenheitszeiten mehrerer für dieselbe Maschine
                  eingewiesener Mitarbeiter, warnt das System automatisch — sichtbar als Zähler-Badge im Tab
                  „Urlaub & Krankheit" sowie als farbliche Markierung der betroffenen Kalendertage.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Section 6: Print and Layout */}
        {(activeSection === 'all' || activeSection === 'layout') && (
          <section id="layout" className="mb-12 scroll-mt-20 print:mb-8 break-inside-avoid-page">
            <h2 className="font-display font-extrabold text-slate-900 text-xl mb-4 flex items-center gap-2 pb-1.5 border-b border-slate-100">
              <span className="text-blue-600">6.</span> DIN-A4 Druck- & Layout-Editor
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              Für Aushänge am schwarzen Brett oder in der Werkhalle bietet SchichtPlan Pro eine optimierte
              Druckaufbereitung.
            </p>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 mb-6">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide mb-3">
                Layout-Optionen im Überblick:
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Ausrichtung:</strong> Hochformat (Portrait) oder Querformat (Landscape).
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Skalierung:</strong> Variable Skalierung (50 % – 100 %) zur perfekten A4-Passung.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Unterschriftenzeilen:</strong> Zwei frei beschriftbare Felder (Standard: „Schichtleitung
                    (geprüft)" und „Betriebsrat / Abteilungsleitung (freigegeben)"), im Layout-Editor beliebig
                    umbenennbar — z. B. auf Meister, Planer oder andere betriebliche Funktionen.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Clean Print:</strong> Automatische Ausblendung aller Buttons, Menüs und Toolbars beim
                    Drucken.
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Section 7: Backup and Data Safety */}
        {(activeSection === 'all' || activeSection === 'backup') && (
          <section id="backup" className="mb-12 scroll-mt-20 print:mb-8 break-inside-avoid-page">
            <h2 className="font-display font-extrabold text-slate-900 text-xl mb-4 flex items-center gap-2 pb-1.5 border-b border-slate-100">
              <span className="text-blue-600">7.</span> Datensicherung & Wiederherstellung
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              Vollständige Datenhoheit ohne externe Abhängigkeiten: Alle Daten können mit einem Klick exportiert und
              gesichert werden.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="border border-slate-200 bg-white p-4 rounded-xl shadow-3xs">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-2">
                  <Download className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-slate-800 text-xs tracking-wide uppercase mb-1">
                  JSON-Backup exportieren
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Erstellt eine vollständige Sicherungsdatei des gesamten Abteilungsbestands inklusive Mitarbeitern,
                  Maschinen, Schichtplänen und Abwesenheiten.
                </p>
              </div>

              <div className="border border-slate-200 bg-white p-4 rounded-xl shadow-3xs">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-2">
                  <Share2 className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-slate-800 text-xs tracking-wide uppercase mb-1">
                  Backup importieren & Restore
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Ermöglicht die sofortige Wiederherstellung eines früheren Planungsstands per Drag-and-Drop der
                  Backup-Datei.
                </p>
              </div>

              <div className="border border-slate-200 bg-white p-4 rounded-xl shadow-3xs sm:col-span-2">
                <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 mb-2">
                  <Clock className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-slate-800 text-xs tracking-wide uppercase mb-1">
                  Automatische tägliche Server-Backups
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Läuft die Anwendung im Intranet-Server-Modus, sichert der Server bei jeder Änderung zusätzlich
                  automatisch den Stand des Vortages (30 Tage aufbewahrt, danach automatisch aufgeräumt). Diese
                  automatischen Backups finden Sie im Bereich „DB Export/DB Import" — dort lässt sich mit einem
                  Klick auf ein bestimmtes Datum der Stand von diesem Tag wiederherstellen, ganz ohne manuellen
                  Export/Import.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Section 8: Datenschutz & DSGVO */}
        {(activeSection === 'all' || activeSection === 'datenschutz') && (
          <section id="datenschutz" className="mb-12 scroll-mt-20 print:mb-8 break-inside-avoid-page">
            <h2 className="font-display font-extrabold text-slate-900 text-xl mb-4 flex items-center gap-2 pb-1.5 border-b border-slate-100">
              <span className="text-blue-600">8.</span> Datenschutz, DSGVO & Sicherheit
            </h2>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-950">
                <span className="font-bold block text-sm mb-1 text-blue-900">
                  Privacy by Design als Grundlage — Prüfung durch Betriebsrat/DSB vor Produktivbetrieb nötig
                </span>
                SchichtPlan Pro wurde speziell für industrielle Betriebe mit hohen Datenschutz- und
                Betriebsratsanforderungen entwickelt. Im Intranet-Server-Modus findet keine Datenverarbeitung in
                externen Clouds oder durch Dritte statt. Details, offene Punkte (u. a. Backup, Audit-Log,
                Löschfristen, Transportverschlüsselung) und die vollständige Datenschutzerklärung finden Sie im
                Bereich „Datenschutzerklärung & DSGVO" (verlinkt im Footer der Anwendung).
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 border border-slate-200 rounded-xl bg-white space-y-1.5">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    Besondere Kategorien (Art. 9 DSGVO)
                  </span>
                  <p className="text-slate-600 leading-relaxed">
                    Bei Arbeitsunfähigkeit (AU) und Sonderurlaub/GdB werden ausschließlich Datum und Status erfasst. Es werden <strong>keinerlei Diagnosen, Befunde oder medizinische Details</strong> gespeichert.
                  </p>
                </div>

                <div className="p-3.5 border border-slate-200 rounded-xl bg-white space-y-1.5">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-blue-600" />
                    Passwort-Sicherheit (scrypt)
                  </span>
                  <p className="text-slate-600 leading-relaxed">
                    Admin-Passwörter werden serverseitig mit dem kryptografischen Algorithmus <code>scrypt</code> inklusive individuellem Salt gehasht. Ein Brute-Force-Schutz blockiert wiederholte Fehlversuche.
                  </p>
                  <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 leading-relaxed">
                    Bei der Ersteinrichtung ist ein Standard-Administratorpasswort hinterlegt, das Login-Formular
                    zeigt es zur Erinnerung an, solange es nicht geändert wurde. Ändern Sie es umgehend über
                    „Passwort ändern" im Admin-Bereich.
                  </p>
                </div>

                <div className="p-3.5 border border-slate-200 rounded-xl bg-white space-y-1.5">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-blue-600" />
                    Betroffenenrechte (Art. 15–21)
                  </span>
                  <p className="text-slate-600 leading-relaxed">
                    Über den <strong>DB Export</strong> kann jederzeit eine strukturierte JSON-Auskunft erteilt werden. Mitarbeiter können inaktiviert oder dauerhaft gelöscht werden.
                  </p>
                </div>

                <div className="p-3.5 border border-slate-200 rounded-xl bg-white space-y-1.5">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-blue-600" />
                    Mandantentrennung
                  </span>
                  <p className="text-slate-600 leading-relaxed">
                    Jede Abteilung besitzt ihre eigene, isolierte Datenbankdatei im Firmen-Intranet. Keine Vermischung mit anderen Werksbereichen.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Section 9: FAQ and Troubleshooting */}
        {(activeSection === 'all' || activeSection === 'faq') && (
          <section id="faq" className="mb-12 scroll-mt-20 print:mb-8 break-inside-avoid-page">
            <h2 className="font-display font-extrabold text-slate-900 text-xl mb-4 flex items-center gap-2 pb-1.5 border-b border-slate-100">
              <span className="text-blue-600">9.</span> FAQ & Häufige Fragen
            </h2>

            <div className="space-y-4">
              <div className="border border-slate-200 rounded-xl p-4 bg-white">
                <h4 className="font-bold text-slate-800 text-xs mb-1 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-blue-600" />
                  Was passiert, wenn zwei Personen gleichzeitig den Plan bearbeiten?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  SchichtPlan Pro nutzt ein optimistisches Versionskontrollsystem. Wird ein Konflikt erkannt, informiert
                  das System die Anwender und verhindert das versehentliche Überschreiben von Daten.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white">
                <h4 className="font-bold text-slate-800 text-xs mb-1 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-blue-600" />
                  Wie erstelle ich eine neue Abteilung im System?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Klicken Sie auf der Login-Seite auf den Button „Admin-Login / Neue Abteilung" oder in der
                  Kopfzeile der Anwendung auf den Button „Admin" (jeweils mit Schloss-Symbol).
                  Nach Eingabe des Admin-Passworts können neue Abteilungen mit individuellem Kürzel und Namen angelegt
                  werden.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-white">
                <h4 className="font-bold text-slate-800 text-xs mb-1 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-blue-600" />
                  Werden Daten beim Schließen des Browsers gelöscht?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Nein. Alle Daten werden automatisch auf dem Server im Verzeichnis <code>data/</code> gespeichert und
                  bleiben dauerhaft erhalten.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="border-t border-slate-200 pt-6 mt-12 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-4">
          <span>© 2026 SchichtPlan Pro • Betriebliche Dokumentation</span>
          <span className="flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            Sicher im Firmen-Intranet betrieben
          </span>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            font-size: 11pt !important;
          }
          .no-print {
            display: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:border-none {
            border: none !important;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
          .print\\:overflow-visible {
            overflow: visible !important;
          }
          .break-inside-avoid-page {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
};
