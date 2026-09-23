import React, { useState } from 'react';
import { DepartmentDatabase, PrintLayoutSettings, ShiftId } from '../types';
import {
  generateWeekSchedule,
  getISOWeek,
  SHIFT_SHORT_NAMES,
  formatEmployeeName,
  formatEmployeeLastFirst,
} from '../lib/rotationEngine';
import {
  Printer,
  Sliders,
  Maximize2,
  Minimize2,
  FileCheck,
  Building,
  Eye,
  Check,
  RotateCcw,
  Sparkles,
  Calendar,
} from 'lucide-react';

interface LayoutEditorAndPrintProps {
  db: DepartmentDatabase;
  onUpdateDB: (updated: DepartmentDatabase) => void;
}

export const LayoutEditorAndPrint: React.FC<LayoutEditorAndPrintProps> = ({ db, onUpdateDB }) => {
  const currentWeekInfo = getISOWeek(new Date());
  const [printKW, setPrintKW] = useState<number>(currentWeekInfo.kw);
  const [printYear, setPrintYear] = useState<number>(currentWeekInfo.year);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(true);

  const settings = db.layoutSettings;

  const updateSettings = (partial: Partial<PrintLayoutSettings>) => {
    onUpdateDB({
      ...db,
      layoutSettings: {
        ...settings,
        ...partial,
      },
    });
  };

  const schedule = generateWeekSchedule(db, printYear, printKW);

  const handlePrint = () => {
    window.print();
  };

  // Pre-configured template presets
  const applyPreset = (preset: 'standard' | 'minimal' | 'executive') => {
    if (preset === 'standard') {
      updateSettings({
        colorTheme: 'monochrome',
        orientation: 'landscape',
        scalePercent: 88,
        fontSize: 'compact',
        showTeamLeadBox: true,
        showShiftLeaderRow: true,
        showMachineDetails: true,
        showStaffPhone: true,
        showLegend: true,
        showNotesField: true,
        showSignatures: true,
      });
    } else if (preset === 'minimal') {
      updateSettings({
        colorTheme: 'monochrome',
        orientation: 'landscape',
        scalePercent: 80,
        fontSize: 'compact',
        showTeamLeadBox: false,
        showShiftLeaderRow: true,
        showMachineDetails: false,
        showStaffPhone: false,
        showLegend: true,
        showNotesField: false,
        showSignatures: true,
      });
    } else if (preset === 'executive') {
      updateSettings({
        colorTheme: 'shift-colored',
        orientation: 'landscape',
        scalePercent: 85,
        fontSize: 'compact',
        showTeamLeadBox: true,
        showShiftLeaderRow: true,
        showMachineDetails: true,
        showStaffPhone: true,
        showLegend: true,
        showNotesField: true,
        showSignatures: true,
      });
    }
  };

  // Compute theme classes
  const getThemeClasses = () => {
    switch (settings.colorTheme) {
      case 'monochrome':
        return {
          wrapper: 'bg-white text-black border-black',
          headerBg: 'bg-slate-100 text-black border-black',
          tableHeader: 'bg-slate-100 text-black border-black',
          tableBorder: 'border-slate-400',
          badgeF: 'bg-slate-100 text-black border border-black',
          badgeS: 'bg-slate-200 text-black border border-black',
          badgeN: 'bg-slate-300 text-black border border-black',
        };
      case 'shift-colored':
        return {
          wrapper: 'bg-white text-slate-900 border-slate-300',
          headerBg: 'bg-slate-900 text-white border-slate-800',
          tableHeader: 'bg-slate-100 text-slate-900 border-slate-300',
          tableBorder: 'border-slate-200',
          badgeF: 'bg-amber-100 text-amber-950 border border-amber-300',
          badgeS: 'bg-blue-100 text-blue-950 border border-blue-300',
          badgeN: 'bg-indigo-100 text-indigo-950 border border-indigo-300',
        };
      case 'high-contrast':
        return {
          wrapper: 'bg-white text-black border-black',
          headerBg: 'bg-black text-white border-black',
          tableHeader: 'bg-slate-200 text-black border-black',
          tableBorder: 'border-black',
          badgeF: 'bg-white text-black border-2 border-black font-black',
          badgeS: 'bg-slate-200 text-black border-2 border-black font-black',
          badgeN: 'bg-black text-white border-2 border-black font-black',
        };
      case 'industrial-blue':
      default:
        return {
          wrapper: 'bg-white text-slate-900 border-slate-300',
          headerBg: 'bg-slate-800 text-white border-slate-700',
          tableHeader: 'bg-slate-100 text-slate-800 border-slate-300',
          tableBorder: 'border-slate-200',
          badgeF: 'bg-amber-50 text-amber-900 border border-amber-300',
          badgeS: 'bg-blue-50 text-blue-900 border border-blue-300',
          badgeN: 'bg-indigo-50 text-indigo-900 border border-indigo-300',
        };
    }
  };

  const themeClasses = getThemeClasses();

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            DIN-A4 Layout-Editor & Druckvorlage
          </h2>
          <p className="text-xs text-slate-500">
            Passen Sie das Layout so an, dass der gesamte Wochenplan exakt auf ein DIN-A4 Blatt passt.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Week Selector for Print */}
          <div className="flex items-center gap-1 text-xs border border-slate-200 rounded-lg p-1 bg-slate-50">
            <Calendar className="w-3.5 h-3.5 text-slate-500 ml-1" />
            <span className="font-semibold text-slate-700">Druck für KW:</span>
            <select
              value={printKW}
              onChange={(e) => setPrintKW(parseInt(e.target.value))}
              className="bg-white border border-slate-200 rounded px-2 py-0.5 font-mono font-bold"
            >
              {Array.from({ length: 52 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  KW {w}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setIsEditorOpen(!isEditorOpen)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>{isEditorOpen ? 'Editor einklappen' : 'Layout bearbeiten'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Jetzt Drucken / PDF</span>
          </button>
        </div>
      </div>

      {/* Collapsible Layout Editor Panel */}
      {isEditorOpen && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 no-print">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Layout-Vorlagen-Parameter
              </span>
              <span className="text-xs text-slate-500">
                (Änderungen werden live im A4-Blatt unten dargestellt)
              </span>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-500 text-[11px] mr-1">Schnellvorlagen:</span>
              <button
                type="button"
                onClick={() => applyPreset('standard')}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium cursor-pointer text-[11px]"
              >
                Standard (A4 1-Seite)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('minimal')}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium cursor-pointer text-[11px]"
              >
                Ultra-Kompakt
              </button>
              <button
                type="button"
                onClick={() => applyPreset('executive')}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium cursor-pointer text-[11px]"
              >
                Farbcodiert
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            {/* 1. Format & Skalierung */}
            <div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-800 uppercase tracking-wider block text-[11px]">
                1. Format & Skalierung
              </span>

              <div>
                <label className="text-slate-600 block mb-1">Ausrichtung:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateSettings({ orientation: 'landscape' })}
                    className={`py-1.5 px-2 rounded border text-center font-medium cursor-pointer ${
                      settings.orientation === 'landscape'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    Querformat (A4)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ orientation: 'portrait' })}
                    className={`py-1.5 px-2 rounded border text-center font-medium cursor-pointer ${
                      settings.orientation === 'portrait'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    Hochformat (A4)
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-slate-600">A4-Skalierung:</label>
                  <span className="font-mono font-bold text-blue-600">{settings.scalePercent}%</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={100}
                  step={2}
                  value={settings.scalePercent}
                  onChange={(e) => updateSettings({ scalePercent: parseInt(e.target.value) })}
                  className="w-full accent-blue-600"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Verkleinern (z.B. 80-88%), damit viele Maschinen auf genau 1 Blatt passen.
                </p>
              </div>

              <div>
                <label className="text-slate-600 block mb-1">Schriftgröße Tabelleninhalt:</label>
                <select
                  value={settings.fontSize}
                  onChange={(e) => updateSettings({ fontSize: e.target.value as any })}
                  className="w-full bg-white border border-slate-300 rounded p-1.5"
                >
                  <option value="compact">Kompakt (optimal für 1 Seite)</option>
                  <option value="normal">Normal</option>
                  <option value="large">Groß (für Schaukasten)</option>
                </select>
              </div>
            </div>

            {/* 2. Farbdesign & Druckstil */}
            <div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-800 uppercase tracking-wider block text-[11px]">
                2. Druckstil & Farben
              </span>

              <div>
                <label className="text-slate-600 block mb-1">Farbschema:</label>
                <select
                  value={settings.colorTheme}
                  onChange={(e) => updateSettings({ colorTheme: e.target.value as any })}
                  className="w-full bg-white border border-slate-300 rounded p-1.5"
                >
                  <option value="monochrome">Schwarz/Weiß (Toner-schonend)</option>
                  <option value="shift-colored">Farbige Schichten (F: Gelb, S: Blau, N: Indigo)</option>
                  <option value="industrial-blue">Industrie Anthrazit / Blau</option>
                  <option value="high-contrast">Hoher Kontrast (Dicke Linien)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-600 block mb-1">Firmenname / Header:</label>
                <input
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => updateSettings({ companyName: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-1.5"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1">Plan-Titel:</label>
                <input
                  type="text"
                  value={settings.documentTitle}
                  onChange={(e) => updateSettings({ documentTitle: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-1.5"
                />
              </div>
            </div>

            {/* 3. Sichtbare Blöcke */}
            <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-800 uppercase tracking-wider block text-[11px]">
                3. Sichtbare Elemente
              </span>

              {[
                { key: 'showTeamLeadBox', label: 'Teamleiter & Führungskopf' },
                { key: 'showShiftLeaderRow', label: 'Schichtführerzeile (F/S/N)' },
                { key: 'showMachineDetails', label: 'Maschinen-Soll/Bereichs-Details' },
                { key: 'showStaffPhone', label: 'Telefonnummern der Schichtführer' },
                { key: 'showLegend', label: 'Schichtkürzel-Legende (F, S, N, U, K)' },
                { key: 'showNotesField', label: 'Wochennotizen & Sicherheitsfeld' },
                { key: 'showSignatures', label: 'Unterschriftenzeilen für Freigabe' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean((settings as any)[key])}
                    onChange={(e) => updateSettings({ [key]: e.target.checked } as any)}
                    className="rounded text-blue-600 accent-blue-600"
                  />
                  <span className="text-[11px]">{label}</span>
                </label>
              ))}
            </div>

            {/* 4. Notizen & Unterschriften Labels */}
            <div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-800 uppercase tracking-wider block text-[11px]">
                4. Notizen & Freigabe-Felder
              </span>

              <div>
                <label className="text-slate-600 block mb-1">Text im Notizenfeld:</label>
                <textarea
                  rows={2}
                  value={settings.customNotesText}
                  onChange={(e) => updateSettings({ customNotesText: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-1 text-[11px]"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1">Unterschrift 1:</label>
                <input
                  type="text"
                  value={settings.signature1Label}
                  onChange={(e) => updateSettings({ signature1Label: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-1 text-[11px]"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1">Unterschrift 2:</label>
                <input
                  type="text"
                  value={settings.signature2Label}
                  onChange={(e) => updateSettings({ signature2Label: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-1 text-[11px]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visual DIN A4 Canvas Wrapper */}
      <div className="flex justify-center p-2 sm:p-4 bg-slate-200/80 rounded-xl overflow-x-auto print-area-wrapper">
        {/* The Exact DIN A4 Page */}
        <div
          id="din-a4-printable-sheet"
          className={`bg-white shadow-xl border border-slate-300 transition-all ${
            settings.orientation === 'landscape' ? 'a4-landscape-page' : 'a4-portrait-page'
          } p-5 flex flex-col justify-between`}
          style={{
            transformOrigin: 'top center',
            fontSize:
              settings.fontSize === 'compact' ? '9px' : settings.fontSize === 'large' ? '12px' : '10px',
            lineHeight: 1.2,
          }}
        >
          {/* Inner content wrapped in scale factor */}
          <div
            className="flex-1 flex flex-col justify-between"
            style={{
              transform: `scale(${settings.scalePercent / 100})`,
              transformOrigin: 'top left',
              width: `${(100 / settings.scalePercent) * 100}%`,
              height: `${(100 / settings.scalePercent) * 100}%`,
            }}
          >
            {/* 1. Header with Company, Department and Calendar Week */}
            <div className={`pb-2 mb-2 border-b-2 ${themeClasses.tableBorder}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base tracking-tight font-display uppercase">
                      {settings.companyName}
                    </span>
                    <span className="text-xs px-2 py-0.5 font-mono font-bold rounded bg-slate-200 text-slate-800">
                      ABTEILUNG: {db.departmentCode}
                    </span>
                  </div>
                  <h1 className="text-sm font-bold uppercase tracking-wide text-slate-900 mt-0.5">
                    {settings.documentTitle}
                  </h1>
                  <p className="text-[10px] text-slate-600">
                    {db.departmentName} • {settings.documentSubtitle}
                  </p>
                </div>

                <div className="text-right">
                  <div className="inline-block bg-black text-white px-3 py-1 font-mono font-extrabold text-sm tracking-wider">
                    KW {printKW} / {printYear}
                  </div>
                  <div className="text-[10px] text-slate-700 font-mono mt-0.5">
                    {schedule.startDateStr} bis {schedule.endDateStr}
                  </div>
                  <div className="text-[9px] text-slate-500">
                    Stand: {new Date().toLocaleDateString('de-DE')}
                  </div>
                </div>
              </div>

              {/* Optional Leadership row */}
              {(settings.showTeamLeadBox || settings.showShiftLeaderRow) && (
                <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-300 text-[10px]">
                  {settings.showTeamLeadBox && (
                    <div className="p-1.5 rounded bg-slate-100 border border-slate-300">
                      <span className="font-bold text-[9px] uppercase tracking-wider block text-slate-600">
                        Teamleitung:
                      </span>
                      <span className="font-bold text-slate-900 block">
                        {schedule.teamLeader
                          ? `${schedule.teamLeader.firstName} ${schedule.teamLeader.lastName}`
                          : 'Klaus Bauer'}
                      </span>
                      {settings.showStaffPhone && schedule.teamLeader?.phone && (
                        <span className="font-mono text-[9px] text-slate-600">{schedule.teamLeader.phone}</span>
                      )}
                    </div>
                  )}

                  {settings.showShiftLeaderRow && (
                    <>
                      <div className="p-1.5 rounded bg-amber-50/80 border border-amber-200">
                        <span className="font-bold text-[9px] uppercase tracking-wider block text-amber-900">
                          Schichtführer Früh:
                        </span>
                        {(() => {
                          const leaders = Array.isArray(schedule.shiftLeaders.frueh)
                            ? schedule.shiftLeaders.frueh
                            : schedule.shiftLeaders.frueh
                            ? [schedule.shiftLeaders.frueh]
                            : [];
                          if (leaders.length === 0) {
                            return <span className="text-slate-400 italic text-[10px]">Nicht besetzt</span>;
                          }
                          return leaders.map((leader) => (
                            <div key={leader.id} className="mt-0.5">
                              <span className="font-bold text-slate-900 block leading-tight">
                                {formatEmployeeName(leader)}
                              </span>
                              {settings.showStaffPhone && leader.phone && (
                                <span className="font-mono text-[9px] text-slate-600 block">
                                  {leader.phone}
                                </span>
                              )}
                            </div>
                          ));
                        })()}
                      </div>

                      <div className="p-1.5 rounded bg-blue-50/80 border border-blue-200">
                        <span className="font-bold text-[9px] uppercase tracking-wider block text-blue-900">
                          Schichtführer Spät / Mittag:
                        </span>
                        {(() => {
                          const leaders = Array.isArray(schedule.shiftLeaders.spaet)
                            ? schedule.shiftLeaders.spaet
                            : schedule.shiftLeaders.spaet
                            ? [schedule.shiftLeaders.spaet]
                            : [];
                          if (leaders.length === 0) {
                            return <span className="text-slate-400 italic text-[10px]">Nicht besetzt</span>;
                          }
                          return leaders.map((leader) => (
                            <div key={leader.id} className="mt-0.5">
                              <span className="font-bold text-slate-900 block leading-tight">
                                {formatEmployeeName(leader)}
                              </span>
                              {settings.showStaffPhone && leader.phone && (
                                <span className="font-mono text-[9px] text-slate-600 block">
                                  {leader.phone}
                                </span>
                              )}
                            </div>
                          ));
                        })()}
                      </div>

                      <div className="p-1.5 rounded bg-indigo-50/80 border border-indigo-200">
                        <span className="font-bold text-[9px] uppercase tracking-wider block text-indigo-900">
                          Schichtführer Nacht:
                        </span>
                        {(() => {
                          const leaders = Array.isArray(schedule.shiftLeaders.nacht)
                            ? schedule.shiftLeaders.nacht
                            : schedule.shiftLeaders.nacht
                            ? [schedule.shiftLeaders.nacht]
                            : [];
                          if (leaders.length === 0) {
                            return <span className="text-slate-400 italic text-[10px]">Nicht besetzt</span>;
                          }
                          return leaders.map((leader) => (
                            <div key={leader.id} className="mt-0.5">
                              <span className="font-bold text-slate-900 block leading-tight">
                                {formatEmployeeName(leader)}
                              </span>
                              {settings.showStaffPhone && leader.phone && (
                                <span className="font-mono text-[9px] text-slate-600 block">
                                  {leader.phone}
                                </span>
                              )}
                            </div>
                          ));
                        })()}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 2. Main Table */}
            <div className="flex-1 overflow-hidden">
              <table className="w-full border-collapse border border-black text-[10px]">
                <thead>
                  <tr className="bg-slate-200 text-black font-bold border-b border-black">
                    <th className="py-1.5 px-2 border-r border-black w-1/4 text-left">
                      Maschine / Anlage
                    </th>
                    <th className="py-1.5 px-2 border-r border-black w-1/4 text-left">
                      Frühschicht (06:00 - 14:00)
                    </th>
                    <th className="py-1.5 px-2 border-r border-black w-1/4 text-left">
                      Spätschicht / Mittag (14:00 - 22:00)
                    </th>
                    <th className="py-1.5 px-2 border-black w-1/4 text-left">
                      Nachtschicht (22:00 - 06:00)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.machineAssignments.map(({ machine, shifts }) => (
                    <tr key={machine.id} className="border-b border-slate-300">
                      <td className="py-1 px-2 border-r border-black bg-slate-50 font-medium">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold">{machine.code}</span>
                          <span className="text-[8px] font-mono uppercase bg-white border border-slate-300 px-1 rounded">
                            {machine.shiftModel}
                          </span>
                        </div>
                        <div className="font-semibold text-slate-900 leading-tight">{machine.name}</div>
                        {settings.showMachineDetails && (
                          <div className="text-[8px] text-slate-500">
                            {machine.area} (Soll: {machine.minStaffPerShift.frueh}/{machine.minStaffPerShift.spaet}/{machine.minStaffPerShift.nacht})
                          </div>
                        )}
                      </td>

                      {/* Früh */}
                      <td className="py-1 px-2 border-r border-black align-top">
                        {shifts.frueh.map((e) => (
                          <div key={e.id} className="leading-tight font-medium">
                            • {formatEmployeeLastFirst(e)}{' '}
                            {e.personnelNumber && (
                              <span className="font-mono text-[8px] text-slate-500">({e.personnelNumber})</span>
                            )}
                          </div>
                        ))}
                        {shifts.frueh.length === 0 && (
                          <span className="text-slate-400 italic text-[9px]">-</span>
                        )}
                      </td>

                      {/* Spät */}
                      <td className="py-1 px-2 border-r border-black align-top">
                        {machine.shiftModel === '1-schicht' ? (
                          <span className="text-slate-400 italic text-[9px]">(Ruhe)</span>
                        ) : (
                          shifts.spaet.map((e) => (
                            <div key={e.id} className="leading-tight font-medium">
                              • {formatEmployeeLastFirst(e)}{' '}
                              {e.personnelNumber && (
                                <span className="font-mono text-[8px] text-slate-500">({e.personnelNumber})</span>
                              )}
                            </div>
                          ))
                        )}
                        {machine.shiftModel !== '1-schicht' && shifts.spaet.length === 0 && (
                          <span className="text-slate-400 italic text-[9px]">-</span>
                        )}
                      </td>

                      {/* Nacht */}
                      <td className="py-1 px-2 align-top">
                        {machine.shiftModel !== '3-schicht' ? (
                          <span className="text-slate-400 italic text-[9px]">(Ruhe)</span>
                        ) : (
                          shifts.nacht.map((e) => (
                            <div key={e.id} className="leading-tight font-medium">
                              • {formatEmployeeLastFirst(e)}{' '}
                              {e.personnelNumber && (
                                <span className="font-mono text-[8px] text-slate-500">({e.personnelNumber})</span>
                              )}
                            </div>
                          ))
                        )}
                        {machine.shiftModel === '3-schicht' && shifts.nacht.length === 0 && (
                          <span className="text-slate-400 italic text-[9px]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Absences row inside print */}
              {schedule.absentEmployees.length > 0 && (
                <div className="mt-1.5 p-1.5 bg-slate-100 border border-slate-400 rounded text-[9px]">
                  <span className="font-bold text-slate-900 mr-1">Abwesenheiten (Urlaub / Krank / Karenz):</span>
                  {schedule.absentEmployees.map((a, i) => (
                    <span key={a.employee.id} className="inline-block mr-2 font-medium">
                      [{a.type === 'krank' ? 'K' : a.type === 'urlaub' ? 'U' : a.type === 'karenz' ? 'KT' : a.type === 'zeitausgleich' ? 'ZA' : a.type === 'weiterbildung' ? 'W' : 'SU'}] {formatEmployeeLastFirst(a.employee)} ({a.affectedDaysText})
                      {i < schedule.absentEmployees.length - 1 ? ',' : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Footer: Notes, Legend & Signatures */}
            <div className="pt-2 mt-2 border-t border-black text-[9px] space-y-1.5">
              <div className="flex justify-between items-start gap-4">
                {/* Legend */}
                {settings.showLegend && (
                  <div className="text-slate-600">
                    <span className="font-bold text-slate-900">Legende:</span> F = Frühschicht • S = Spät-/Mittagsschicht • N = Nachtschicht • U = Urlaub • K = Krank • KT = Karenztag • ZA = Frei/Zeitausgleich • SF = Schichtführer • TL = Teamleiter
                  </div>
                )}

                {/* Custom Notes */}
                {settings.showNotesField && (
                  <div className="flex-1 text-slate-700 bg-slate-50 p-1 border border-slate-300 rounded font-mono text-[8px]">
                    <span className="font-bold">Hinweis:</span> {settings.customNotesText}
                  </div>
                )}
              </div>

              {/* Signatures */}
              {settings.showSignatures && (
                <div className="grid grid-cols-2 gap-8 pt-4">
                  <div className="border-t border-black pt-0.5 text-center">
                    <span className="block font-semibold text-[9px]">{settings.signature1Label}</span>
                    <span className="text-[8px] text-slate-500">Datum, Unterschrift</span>
                  </div>
                  <div className="border-t border-black pt-0.5 text-center">
                    <span className="block font-semibold text-[9px]">{settings.signature2Label}</span>
                    <span className="text-[8px] text-slate-500">Datum, Unterschrift</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
