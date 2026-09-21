import React, { useState } from 'react';
import { DepartmentDatabase, Absence, AbsenceType } from '../types';
import {
  CalendarOff,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  UserCheck,
  CalendarDays,
  List,
  Sparkles,
  Filter,
} from 'lucide-react';
import { YearlyAbsenceCalendar } from './YearlyAbsenceCalendar';
import { ABSENCE_CONFIGS } from '../lib/absenceUtils';

interface AbsenceManagerProps {
  db: DepartmentDatabase;
  onUpdateDB: (updated: DepartmentDatabase) => void;
}

export const AbsenceManager: React.FC<AbsenceManagerProps> = ({ db, onUpdateDB }) => {
  const [activeTab, setActiveTab] = useState<'calendar' | 'table'>('calendar');
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [tableTypeFilter, setTableTypeFilter] = useState<string>('all');

  const today = new Date().toISOString().split('T')[0];

  const handleOpenNew = () => {
    const newAbs: Absence = {
      id: `abs-${Date.now()}`,
      departmentCode: db.departmentCode,
      employeeId: db.employees[0]?.id || '',
      type: 'urlaub',
      startDate: today,
      endDate: today,
      note: '',
    };
    setEditingAbsence(newAbs);
    setIsNew(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAbsence) return;

    let updatedList = [...db.absences];
    if (isNew) {
      updatedList.push(editingAbsence);
    } else {
      updatedList = updatedList.map((a) => (a.id === editingAbsence.id ? editingAbsence : a));
    }

    onUpdateDB({
      ...db,
      absences: updatedList,
    });
    setEditingAbsence(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Diesen Abwesenheitseintrag löschen?')) {
      onUpdateDB({
        ...db,
        absences: db.absences.filter((a) => a.id !== id),
      });
    }
  };

  const filteredAbsences = db.absences.filter((a) => {
    if (tableTypeFilter === 'all') return true;
    return a.type === tableTypeFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header with View Mode Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CalendarOff className="w-5 h-5 text-red-500" />
              Urlaubs-, Fehlzeiten- & Jahreskalender
            </h2>
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 text-xs font-mono font-bold border border-blue-200">
              {db.departmentCode}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Mitarbeiter untereinander gelistet. Tage anklicken zum Stempeln (Urlaub, Krank, Karenztag, Frei).
            Fließt direkt in Schichtrotation und Maschinenbesetzung ein.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Switcher between Stempel-Jahreskalender and Tabellenansicht */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-white text-blue-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
              <span>Jahreskalender (Stempel)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'table'
                  ? 'bg-white text-blue-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Tabellarische Liste ({db.absences.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenNew}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Neuer Eintrag</span>
          </button>
        </div>
      </div>

      {/* RENDER ACTIVE VIEW */}
      {activeTab === 'calendar' ? (
        <YearlyAbsenceCalendar db={db} onUpdateDB={onUpdateDB} />
      ) : (
        /* Tabular list of absences */
        <div className="space-y-4">
          {/* Info notice about weekly vs daily calculation */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-start gap-3 text-blue-950 text-xs">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Regelkonforme Schichtberechnung & Mindestbesetzung:</span>
              Jeder eingestempelte Tag (Urlaub, Krank, Karenztag, Frei) wird direkt den Mitarbeitern zugewiesen.
              Im Wochenplan werden abwesende Mitarbeiter vor Unterbesetzung gewarnt, im Schichtführer-Dienst automatisch
              vertreten und in der Mehrwochen-Matrix farblich markiert.
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-semibold text-slate-700">Filter nach Art:</span>
              <select
                value={tableTypeFilter}
                onChange={(e) => setTableTypeFilter(e.target.value)}
                className="border border-slate-200 rounded-lg px-2.5 py-1 text-xs bg-white text-slate-700"
              >
                <option value="all">Alle Arten anzeigen ({db.absences.length})</option>
                <option value="urlaub">Nur Urlaub (U)</option>
                <option value="krank">Nur Krank / AU (K)</option>
                <option value="karenz">Nur Karenztage (KT)</option>
                <option value="zeitausgleich">Nur Zeitausgleich / Frei (ZA)</option>
                <option value="weiterbildung">Nur Weiterbildung (W)</option>
                <option value="sonderurlaub">Nur Sonderurlaub (SU)</option>
              </select>
            </div>

            <div className="text-slate-500 font-mono text-[11px]">
              {filteredAbsences.length} Einträge gefunden
            </div>
          </div>

          {/* Absences Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <th className="py-3 px-4">Art / Stempel</th>
                    <th className="py-3 px-4">Mitarbeiter</th>
                    <th className="py-3 px-4">Zeitraum (Von - Bis)</th>
                    <th className="py-3 px-4">Dauer</th>
                    <th className="py-3 px-4">Eingeteilte Vertretung</th>
                    <th className="py-3 px-4">Notiz / Grund</th>
                    <th className="py-3 px-4 text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredAbsences.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        Keine Abwesenheiten für diesen Filter vorhanden. Nutzen Sie den Jahreskalender, um Tage direkt mit dem Stempel zu markieren!
                      </td>
                    </tr>
                  ) : (
                    filteredAbsences.map((abs) => {
                      const emp = db.employees.find((e) => e.id === abs.employeeId);
                      const sub = db.employees.find((e) => e.id === abs.substituteEmployeeId);
                      const cfg = ABSENCE_CONFIGS[abs.type] || {
                        label: abs.type,
                        shortCode: 'X',
                        badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
                      };

                      const start = new Date(abs.startDate);
                      const end = new Date(abs.endDate);
                      const diffDays =
                        Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                      return (
                        <tr key={abs.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 font-mono font-bold text-[11px] px-2.5 py-0.5 rounded-full border ${cfg.badgeClass}`}
                            >
                              <span>[{cfg.shortCode}]</span>
                              <span>{cfg.label}</span>
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            {emp ? (
                              <div>
                                <span className="font-semibold text-slate-900">
                                  {emp.firstName} {emp.lastName}
                                </span>
                                <span className="text-[11px] text-slate-500 font-mono block">
                                  {emp.personnelNumber} • {emp.role}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Unbekannter MA</span>
                            )}
                          </td>

                          <td className="py-3 px-4 font-mono font-medium text-slate-800">
                            {new Date(abs.startDate).toLocaleDateString('de-DE')} –{' '}
                            {new Date(abs.endDate).toLocaleDateString('de-DE')}
                          </td>

                          <td className="py-3 px-4 text-slate-600 font-mono">
                            {diffDays} {diffDays === 1 ? 'Tag' : 'Tage'}
                          </td>

                          <td className="py-3 px-4">
                            {sub ? (
                              <div className="flex items-center gap-1.5 text-slate-900">
                                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                                <span>
                                  {sub.firstName} {sub.lastName}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">-</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                            {abs.note || '-'}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setEditingAbsence({ ...abs });
                                  setIsNew(false);
                                }}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer transition-colors"
                                title="Bearbeiten"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(abs.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer transition-colors"
                                title="Löschen"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Manual Absence Modal */}
      {editingAbsence && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">
                {isNew ? 'Abwesenheit erfassen' : 'Abwesenheit bearbeiten'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingAbsence(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Mitarbeiter *</label>
              <select
                required
                value={editingAbsence.employeeId}
                onChange={(e) => setEditingAbsence({ ...editingAbsence, employeeId: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-blue-500 bg-white"
              >
                {db.employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.lastName}, {emp.firstName} ({emp.personnelNumber} - {emp.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Art der Abwesenheit *</label>
              <select
                value={editingAbsence.type}
                onChange={(e) =>
                  setEditingAbsence({ ...editingAbsence, type: e.target.value as AbsenceType })
                }
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-blue-500 bg-white"
              >
                <option value="urlaub">Urlaub (U) - Geplanter Erholungsurlaub</option>
                <option value="krank">Krank / AU (K) - Arbeitsunfähigkeit</option>
                <option value="karenz">Karenztag (KT) - Karenz / Pflegefreistellung</option>
                <option value="zeitausgleich">Zeitausgleich / Frei (ZA) - Überstundenausgleich</option>
                <option value="weiterbildung">Weiterbildung / Schulung (W)</option>
                <option value="sonderurlaub">Sonderurlaub (SU) - Sonderfreistellung</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Von Datum *</label>
                <input
                  type="date"
                  required
                  value={editingAbsence.startDate}
                  onChange={(e) => setEditingAbsence({ ...editingAbsence, startDate: e.target.value })}
                  className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2.5 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Bis Datum *</label>
                <input
                  type="date"
                  required
                  value={editingAbsence.endDate}
                  onChange={(e) => setEditingAbsence({ ...editingAbsence, endDate: e.target.value })}
                  className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2.5 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Vertretung (Optional)
              </label>
              <select
                value={editingAbsence.substituteEmployeeId || ''}
                onChange={(e) =>
                  setEditingAbsence({ ...editingAbsence, substituteEmployeeId: e.target.value || undefined })
                }
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-blue-500 bg-white"
              >
                <option value="">-- Keine feste Vertretung zugewiesen --</option>
                {db.employees
                  .filter((e) => e.id !== editingAbsence.employeeId)
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.lastName}, {emp.firstName} ({emp.role})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Notiz / Bemerkung</label>
              <input
                type="text"
                value={editingAbsence.note || ''}
                onChange={(e) => setEditingAbsence({ ...editingAbsence, note: e.target.value })}
                placeholder="Z.B. Attest liegt vor, Sommerurlaub gebucht..."
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingAbsence(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium cursor-pointer shadow-xs"
              >
                Speichern
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
