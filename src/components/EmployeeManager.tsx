import React, { useState } from 'react';
import {
  DepartmentDatabase,
  Employee,
  RoleId,
  ShiftId,
  ShiftModelType,
} from '../types';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Crown,
  Shield,
  ArrowRight,
  Filter,
  CheckSquare,
  Square,
  Clock,
  Phone,
  HelpCircle,
  Check,
} from 'lucide-react';
import { SHIFT_SHORT_NAMES, SHIFT_NAMES, formatEmployeeName } from '../lib/rotationEngine';

interface EmployeeManagerProps {
  db: DepartmentDatabase;
  onUpdateDB: (updated: DepartmentDatabase) => void;
}

export const EmployeeManager: React.FC<EmployeeManagerProps> = ({ db, onUpdateDB }) => {
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpenNew = () => {
    const newEmp: Employee = {
      id: `e-${Date.now()}`,
      departmentCode: db.departmentCode,
      personnelNumber: '',
      firstName: '',
      lastName: '',
      role: 'mitarbeiter',
      shiftModel: '3-schicht',
      excludedShifts: [],
      customSequence: ['frueh', 'nacht', 'spaet'],
      rotationOffsetWeeks: 0,
      qualifiedMachineIds: [],
      preferredMachineId: db.machines[0]?.id,
      phone: '',
      notes: '',
      active: true,
      yearlyVacationQuota: 30,
      vacationCarryoverDays: 0,
      vacationSpecialNotes: '',
    };
    setEditingEmployee(newEmp);
    setIsNew(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    // Graceful fallback if completely empty
    const sanitizedEmp: Employee = {
      ...editingEmployee,
      firstName: editingEmployee.firstName?.trim() || '',
      lastName: editingEmployee.lastName?.trim() || '',
      personnelNumber: editingEmployee.personnelNumber?.trim() || '',
    };

    // If completely blank, give a friendly shift worker label
    if (!sanitizedEmp.firstName && !sanitizedEmp.lastName && !sanitizedEmp.personnelNumber) {
      sanitizedEmp.firstName = `Mitarbeiter`;
      sanitizedEmp.lastName = `${db.employees.length + 1}`;
    }

    let updatedList = [...db.employees];
    if (isNew) {
      updatedList.push(sanitizedEmp);
    } else {
      updatedList = updatedList.map((emp) => (emp.id === sanitizedEmp.id ? sanitizedEmp : emp));
    }

    onUpdateDB({
      ...db,
      employees: updatedList,
    });
    setEditingEmployee(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Möchten Sie diesen Mitarbeiter wirklich entfernen?')) {
      // Verwaiste Referenzen auf den gelöschten Mitarbeiter mit aufräumen,
      // sonst bleiben tote IDs in manuellen Schicht-Überschreibungen und
      // Abwesenheiten stehen (z.B. eine manuelle Nachtschicht-Zuweisung, die
      // dann auf niemanden mehr zeigt).
      onUpdateDB({
        ...db,
        employees: db.employees.filter((e) => e.id !== id),
        absences: db.absences
          .filter((a) => a.employeeId !== id)
          .map((a) => (a.substituteEmployeeId === id ? { ...a, substituteEmployeeId: undefined } : a)),
        manualOverrides: db.manualOverrides
          .map((o) => ({ ...o, assignedEmployeeIds: o.assignedEmployeeIds.filter((eid) => eid !== id) }))
          .filter((o) => o.assignedEmployeeIds.length > 0),
      });
    }
  };

  // Helper to adjust sequence when shift model or exclusions change
  const handleModelChange = (model: ShiftModelType) => {
    if (!editingEmployee) return;
    let sequence: ShiftId[] = ['frueh', 'nacht', 'spaet'];
    if (model === '1-schicht') {
      sequence = ['frueh'];
    } else if (model === '2-schicht') {
      sequence = ['frueh', 'spaet'];
    }
    setEditingEmployee({
      ...editingEmployee,
      shiftModel: model,
      customSequence: sequence,
    });
  };

  const toggleExcludedShift = (shift: ShiftId) => {
    if (!editingEmployee) return;
    const exists = editingEmployee.excludedShifts.includes(shift);
    const nextExcluded = exists
      ? editingEmployee.excludedShifts.filter((s) => s !== shift)
      : [...editingEmployee.excludedShifts, shift];

    // Remove from customSequence if newly excluded
    const nextSeq = editingEmployee.customSequence.filter((s) => !nextExcluded.includes(s));
    setEditingEmployee({
      ...editingEmployee,
      excludedShifts: nextExcluded,
      customSequence: nextSeq.length > 0 ? nextSeq : ['frueh'],
    });
  };

  // Sequence reordering or adding steps
  const addStepToSequence = (shift: ShiftId) => {
    if (!editingEmployee) return;
    setEditingEmployee({
      ...editingEmployee,
      customSequence: [...editingEmployee.customSequence, shift],
    });
  };

  const removeStepFromSequence = (index: number) => {
    if (!editingEmployee || editingEmployee.customSequence.length <= 1) return;
    const next = [...editingEmployee.customSequence];
    next.splice(index, 1);
    setEditingEmployee({
      ...editingEmployee,
      customSequence: next,
    });
  };

  const filteredEmployees = db.employees.filter((emp) => {
    if (roleFilter !== 'all' && emp.role !== roleFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        (emp.firstName && emp.firstName.toLowerCase().includes(q)) ||
        (emp.lastName && emp.lastName.toLowerCase().includes(q)) ||
        (emp.personnelNumber && emp.personnelNumber.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Mitarbeiterliste & Schicht-Rotationsverwaltung ({db.departmentCode})
          </h2>
          <p className="text-xs text-slate-500">
            Schichtart (1, 2, 3 Schichten), Ausschlüsse (z.B. keine Nachtschicht), manuelle Rotationsreihenfolge und Führungsrollen.
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Mitarbeiter anlegen
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-500 font-semibold flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Rolle:
          </span>
          {[
            { id: 'all', label: 'Alle Rollen' },
            { id: 'teamleiter', label: 'Teamleiter' },
            { id: 'schichtfuehrer', label: 'Schichtführer' },
            { id: 'mitarbeiter', label: 'Mitarbeiter' },
            { id: 'springer', label: 'Springer' },
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => setRoleFilter(r.id)}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                roleFilter === r.id
                  ? 'bg-slate-900 text-white font-medium'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Nach Name oder Personalnr. suchen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 w-full sm:w-64"
        />
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <th className="py-3 px-4">Mitarbeiter / Pers.-Nr.</th>
                <th className="py-3 px-4">Rolle</th>
                <th className="py-3 px-4">Urlaubsanspruch (Jahr)</th>
                <th className="py-3 px-4">Schichtmodell</th>
                <th className="py-3 px-4">Rotationssequenz (Manuell)</th>
                <th className="py-3 px-4">Eingewiesene Maschinen</th>
                <th className="py-3 px-4">Telefon / Kontakt</th>
                <th className="py-3 px-4 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Keine Mitarbeiter gefunden.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const quota = emp.yearlyVacationQuota ?? 30;
                  const carry = emp.vacationCarryoverDays ?? 0;
                  const total = quota + carry;

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 text-sm">
                          {formatEmployeeName(emp)}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                          {emp.personnelNumber?.trim() ? (
                            <span>{emp.personnelNumber}</span>
                          ) : (
                            <span className="text-slate-400 font-sans italic text-[10px]">Keine Pers.-Nr.</span>
                          )}
                          {!emp.active && (
                            <span className="text-red-600 bg-red-50 px-1.5 rounded text-[10px]">
                              Inaktiv
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-4">
                        {emp.role === 'teamleiter' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                            <Crown className="w-3 h-3 text-amber-700" />
                            Teamleiter
                          </span>
                        )}
                        {emp.role === 'schichtfuehrer' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-300 px-2 py-0.5 rounded-full">
                            <Shield className="w-3 h-3 text-blue-700" />
                            Schichtführer
                          </span>
                        )}
                        {emp.role === 'mitarbeiter' && (
                          <span className="text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                            Mitarbeiter
                          </span>
                        )}
                        {emp.role === 'springer' && (
                          <span className="text-[11px] font-medium bg-purple-100 text-purple-900 px-2 py-0.5 rounded-full">
                            Springer / Aushilfe
                          </span>
                        )}
                      </td>

                      {/* Vacation Quota */}
                      <td className="py-3 px-4 font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded border border-emerald-200">
                            {total} Tage
                          </span>
                          {carry > 0 && (
                            <span className="text-[10px] text-slate-500" title={`Basis ${quota} + Übertrag ${carry}`}>
                              (+{carry} Vorjahr)
                            </span>
                          )}
                        </div>
                        {emp.vacationSpecialNotes && (
                          <span className="text-[10px] text-slate-500 truncate max-w-[150px] block mt-0.5" title={emp.vacationSpecialNotes}>
                            {emp.vacationSpecialNotes}
                          </span>
                        )}
                      </td>

                      {/* Shift Model & Exclusions */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-medium text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                          {emp.shiftModel}
                        </span>
                        {emp.excludedShifts.length > 0 && (
                          <div className="text-[10px] text-red-600 mt-1">
                            Kein: {emp.excludedShifts.map((s) => SHIFT_SHORT_NAMES[s]).join(', ')}
                          </div>
                        )}
                      </td>

                      {/* Custom Rotation Sequence */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 font-mono text-[11px]">
                          {emp.customSequence.map((s, idx) => (
                            <React.Fragment key={idx}>
                              <span
                                className={`px-1.5 py-0.5 rounded font-bold ${
                                  s === 'frueh'
                                    ? 'bg-amber-100 text-amber-900'
                                    : s === 'spaet'
                                    ? 'bg-blue-100 text-blue-900'
                                    : s === 'nacht'
                                    ? 'bg-indigo-100 text-indigo-900'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {SHIFT_SHORT_NAMES[s]}
                              </span>
                              {idx < emp.customSequence.length - 1 && (
                                <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Start-Offset: +{emp.rotationOffsetWeeks || 0} Wochen
                        </div>
                      </td>

                      {/* Machines */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {emp.qualifiedMachineIds.map((mId) => {
                            const m = db.machines.find((x) => x.id === mId);
                            if (!m) return null;
                            const isPref = emp.preferredMachineId === mId;
                            return (
                              <span
                                key={mId}
                                className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                  isPref
                                    ? 'bg-blue-50 text-blue-800 border border-blue-300 font-bold'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {m.code}
                              </span>
                            );
                          })}
                          {emp.qualifiedMachineIds.length === 0 && (
                            <span className="text-slate-400 italic text-[11px]">Keine Zuweisung</span>
                          )}
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        {emp.phone ? (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{emp.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingEmployee({ ...emp });
                              setIsNew(false);
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer transition-colors"
                            title="Bearbeiten"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(emp.id)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer transition-colors"
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

      {/* Employee Modal: Complete Shift Model & Manual Sequence configuration */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-auto max-h-[94vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600 shrink-0" />
                <span>{isNew ? 'Neuen Mitarbeiter anlegen' : 'Mitarbeiter & Schicht bearbeiten'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingEmployee(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Friendly hint about optional fields */}
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 flex items-start gap-2 text-xs text-blue-900">
              <span className="font-bold text-blue-600 shrink-0">💡</span>
              <p>
                <strong>Schichtplan-Fokus:</strong> Alle Felder sind optional. Für den Schichtplan genügt ein Vorname, Nachname, Spitzname oder Arbeitsplatz-Kürzel. Die Personalnummer ist nicht zwingend erforderlich.
              </p>
            </div>

            {/* Basic Info (All Optional) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Vorname / Rufname <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={editingEmployee.firstName || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, firstName: e.target.value })}
                  placeholder="Z.B. Thomas oder Tom"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nachname / Anzeigename <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={editingEmployee.lastName || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, lastName: e.target.value })}
                  placeholder="Z.B. Müller oder Bediener 1"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Personalnummer <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={editingEmployee.personnelNumber || ''}
                  onChange={(e) =>
                    setEditingEmployee({ ...editingEmployee, personnelNumber: e.target.value })
                  }
                  placeholder="Z.B. P-1015 (oder leer)"
                  className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2.5 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Role & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Rolle / Führungsfunktion *
                </label>
                <select
                  value={editingEmployee.role}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value as RoleId })}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-blue-500"
                >
                  <option value="mitarbeiter">Mitarbeiter / Bediener (Standard)</option>
                  <option value="schichtfuehrer">Schichtführer (führt Schichtgruppe F/S/N)</option>
                  <option value="teamleiter">Teamleiter (übergeordnete Leitung)</option>
                  <option value="springer">Springer / Aushilfsreserve</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Notfall-Telefon / Erreichbarkeit
                </label>
                <input
                  type="text"
                  value={editingEmployee.phone || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, phone: e.target.value })}
                  placeholder="+49 171 ..."
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Shift Model & Excluded Shifts */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Schichtart & Ausschlüsse
                </span>
                <span className="text-[11px] text-slate-500">1, 2 oder 3 Schichten</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">Schichtmodell:</label>
                  <select
                    value={editingEmployee.shiftModel}
                    onChange={(e) => handleModelChange(e.target.value as ShiftModelType)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
                  >
                    <option value="3-schicht">3-Schicht (Früh, Spät, Nacht)</option>
                    <option value="2-schicht">2-Schicht (Früh, Spät)</option>
                    <option value="1-schicht">1-Schicht (nur feste Schicht)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Möglichkeit Schichten auszuschließen:
                  </label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(['frueh', 'spaet', 'nacht'] as ShiftId[]).map((s) => {
                      const isExcluded = editingEmployee.excludedShifts.includes(s);
                      return (
                        <button
                          type="button"
                          key={s}
                          onClick={() => toggleExcludedShift(s)}
                          className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-colors cursor-pointer ${
                            isExcluded
                              ? 'bg-red-50 text-red-700 border-red-300 font-semibold'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {isExcluded ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                          Kein {SHIFT_SHORT_NAMES[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Manual Rotation Sequence Editor or Fixed Shift for 1-Schicht */}
              <div className="pt-2 border-t border-slate-200">
                {editingEmployee.shiftModel === '1-schicht' ? (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-800 block">
                      Feste Schicht für diesen Mitarbeiter (1-Schicht-Betrieb):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(['frueh', 'spaet', 'nacht'] as ShiftId[]).map((s) => {
                        const isSelected = editingEmployee.customSequence[0] === s;
                        return (
                          <button
                            type="button"
                            key={s}
                            onClick={() =>
                              setEditingEmployee({
                                ...editingEmployee,
                                customSequence: [s],
                                rotationOffsetWeeks: 0,
                              })
                            }
                            className={`p-2.5 rounded-lg border text-left flex items-center justify-between cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-400 text-blue-950 font-semibold'
                                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="block text-xs font-bold">
                                {s === 'frueh' ? 'Frühschicht' : s === 'spaet' ? 'Spät / Mittag' : 'Nachtschicht'}
                              </span>
                              <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                                {s === 'frueh' ? '06:00 - 14:00' : s === 'spaet' ? '14:00 - 22:00' : '22:00 - 06:00'}
                              </span>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0 ml-2" />}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      ℹ️ Im 1-Schicht-Modell arbeitet der Mitarbeiter dauerhaft in dieser ausgewählten Schicht ohne wöchentliche Rotation.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                      <label className="text-xs font-bold text-slate-800">
                        Rotationsreihenfolge (Woche für Woche):
                      </label>
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[11px] text-slate-500 mr-0.5">Schritt +:</span>
                        {(['frueh', 'nacht', 'spaet', 'frei'] as ShiftId[]).map((s) => (
                          <button
                            type="button"
                            key={s}
                            onClick={() => addStepToSequence(s)}
                            className="text-[10px] font-bold px-2 py-1 rounded border bg-white hover:bg-slate-100 text-slate-700 cursor-pointer shadow-2xs"
                          >
                            +{SHIFT_SHORT_NAMES[s]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Preset Buttons for Quick Selection */}
                    <div className="bg-slate-100/80 p-2.5 rounded-lg border border-slate-200 space-y-1.5">
                      <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                        {editingEmployee.shiftModel === '2-schicht'
                          ? 'Schnell-Vorlagen für 2-Schicht Rhythmus:'
                          : 'Schnell-Vorlagen für 3-Schicht (Früh → Nacht → Spät/Mittag):'}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {editingEmployee.shiftModel === '2-schicht' ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  customSequence: ['frueh', 'spaet'],
                                  rotationOffsetWeeks: 0,
                                })
                              }
                              className="text-[10px] bg-white hover:bg-blue-50 hover:border-blue-300 border border-slate-300 text-slate-800 font-medium px-2.5 py-1 rounded transition-colors"
                            >
                              1. Startet mit Früh (F → S)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  customSequence: ['spaet', 'frueh'],
                                  rotationOffsetWeeks: 0,
                                })
                              }
                              className="text-[10px] bg-white hover:bg-amber-50 hover:border-amber-300 border border-slate-300 text-slate-800 font-medium px-2.5 py-1 rounded transition-colors"
                            >
                              2. Startet mit Spät/Mittag (S → F)
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  customSequence: ['frueh', 'nacht', 'spaet'],
                                  rotationOffsetWeeks: 0,
                                })
                              }
                              className="text-[10px] bg-white hover:bg-blue-50 hover:border-blue-300 border border-slate-300 text-slate-800 font-medium px-2.5 py-1 rounded transition-colors"
                            >
                              1. Startet mit Früh (F → N → S)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  customSequence: ['nacht', 'spaet', 'frueh'],
                                  rotationOffsetWeeks: 0,
                                })
                              }
                              className="text-[10px] bg-white hover:bg-indigo-50 hover:border-indigo-300 border border-slate-300 text-slate-800 font-medium px-2.5 py-1 rounded transition-colors"
                            >
                              2. Startet mit Nacht (N → S → F)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  customSequence: ['spaet', 'frueh', 'nacht'],
                                  rotationOffsetWeeks: 0,
                                })
                              }
                              className="text-[10px] bg-white hover:bg-amber-50 hover:border-amber-300 border border-slate-300 text-slate-800 font-medium px-2.5 py-1 rounded transition-colors"
                            >
                              3. Startet mit Spät/Mittag (S → F → N)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingEmployee({
                                  ...editingEmployee,
                                  customSequence: ['frueh', 'nacht', 'spaet', 'frei'],
                                  rotationOffsetWeeks: 0,
                                })
                              }
                              className="text-[10px] bg-white hover:bg-slate-50 border border-slate-300 text-slate-600 px-2.5 py-1 rounded transition-colors"
                            >
                              4-Wochen inkl. Frei
                            </button>
                          </>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-600 italic">
                        ℹ️ Rhythmus: Wer jetzt Nacht hat, hat nächste Woche Spät/Mittag und danach Früh.
                      </p>
                    </div>

                    {/* Step pills */}
                    <div className="flex flex-wrap items-center gap-1.5 p-2 bg-white rounded-lg border border-slate-200">
                      {editingEmployee.customSequence.map((s, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded border border-slate-300 text-xs font-mono">
                            <span className="text-slate-500 font-sans text-[10px]">W{idx + 1}:</span>
                            <span className="font-bold text-slate-900">{SHIFT_SHORT_NAMES[s]}</span>
                            {editingEmployee.customSequence.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeStepFromSequence(idx)}
                                className="text-slate-400 hover:text-red-600 ml-1 text-xs font-bold"
                                title="Entfernen"
                              >
                                ×
                              </button>
                            )}
                          </div>
                          {idx < editingEmployee.customSequence.length - 1 && (
                            <span className="text-slate-400 text-xs font-bold">→</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Offset setting */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-slate-100/60 rounded-lg border border-slate-200">
                      <div>
                        <span className="text-xs font-semibold text-slate-800 block">
                          Start-Verschiebung im Zyklus (Wochen-Offset):
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          Versetzt den Mitarbeiter gegenüber Kollegen (0, 1, 2 Wochen)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={editingEmployee.rotationOffsetWeeks}
                          onChange={(e) =>
                            setEditingEmployee({
                              ...editingEmployee,
                              rotationOffsetWeeks: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-16 h-8 text-xs border border-slate-300 rounded p-1 font-mono text-center bg-white"
                        />
                        <span className="text-xs text-slate-600">Woche(n)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Machine Qualifications (Mobile Optimized) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-800">
                    Eingewiesene Maschinen & Qualifikationen:
                  </label>
                  <span className="text-[11px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-mono">
                    {editingEmployee.qualifiedMachineIds.length} von {db.machines.length}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingEmployee({
                        ...editingEmployee,
                        qualifiedMachineIds: db.machines.map((m) => m.id),
                      })
                    }
                    className="text-blue-600 hover:text-blue-800 font-medium text-[11px] cursor-pointer"
                  >
                    Alle auswählen
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingEmployee({
                        ...editingEmployee,
                        qualifiedMachineIds: [],
                        preferredMachineId: undefined,
                      })
                    }
                    className="text-slate-500 hover:text-slate-700 text-[11px] cursor-pointer"
                  >
                    Keine
                  </button>
                </div>
              </div>

              {/* 1 column on mobile screens, 2 columns on sm+ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 sm:max-h-56 overflow-y-auto p-2 border border-slate-200 rounded-lg bg-slate-50/60">
                {db.machines.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 sm:col-span-2">
                    Keine Maschinen in dieser Abteilung vorhanden.
                  </div>
                ) : (
                  db.machines.map((m) => {
                    const isChecked = editingEmployee.qualifiedMachineIds.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-3 cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-blue-50/90 border-blue-400 ring-1 ring-blue-300 text-blue-950 shadow-2xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                        onClick={() => {
                          const next = isChecked
                            ? editingEmployee.qualifiedMachineIds.filter((id) => id !== m.id)
                            : [...editingEmployee.qualifiedMachineIds, m.id];
                          setEditingEmployee({
                            ...editingEmployee,
                            qualifiedMachineIds: next,
                            preferredMachineId:
                              editingEmployee.preferredMachineId === m.id
                                ? next[0]
                                : editingEmployee.preferredMachineId,
                          });
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-xs bg-slate-200 px-1.5 py-0.5 rounded text-slate-800">
                              {m.code}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {m.shiftModel}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-slate-900 block truncate mt-1" title={m.name}>
                            {m.name}
                          </span>
                          <span className="text-[10px] text-slate-500 block truncate">
                            {m.area}
                          </span>
                        </div>
                        <div className="shrink-0 flex items-center ml-2">
                          {isChecked ? (
                            <div className="w-5 h-5 rounded bg-blue-600 text-white flex items-center justify-center shadow-xs">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded border-2 border-slate-300 bg-white" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Vacation Entitlement & Special Quotas (Urlaubsanspruch & Sonderregelungen) */}
            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                    Jahresurlaubsanspruch & Sonderurlaub
                  </span>
                  <span className="text-[11px] font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-md">
                    Gesamt: {(editingEmployee.yearlyVacationQuota ?? 30) + (editingEmployee.vacationCarryoverDays ?? 0)} Tage
                  </span>
                </div>
                <span className="text-[11px] text-emerald-700 hidden sm:inline">
                  Automatische Warnung bei Überschreitung
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Regulärer Jahresurlaub (Tage) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    required
                    value={editingEmployee.yearlyVacationQuota ?? 30}
                    onChange={(e) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        yearlyVacationQuota: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2.5 bg-white focus:border-emerald-500"
                    placeholder="Standard: 30"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Gesetzlicher / tariflicher Standard: 30 Tage (oder mehr bei Zusatzvereinbarungen)
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Resturlaub aus Vorjahr (Übertrag)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={editingEmployee.vacationCarryoverDays ?? 0}
                    onChange={(e) =>
                      setEditingEmployee({
                        ...editingEmployee,
                        vacationCarryoverDays: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2.5 bg-white focus:border-emerald-500"
                    placeholder="0"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Wird zum Jahresanspruch addiert
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Sonderurlaub / Prozent-Regelung / Begründung (Optional)
                </label>
                <input
                  type="text"
                  value={editingEmployee.vacationSpecialNotes ?? ''}
                  onChange={(e) =>
                    setEditingEmployee({
                      ...editingEmployee,
                      vacationSpecialNotes: e.target.value,
                    })
                  }
                  placeholder="Z.B. '5 Tage Zusatzurlaub wegen 50% GdB', 'Teilzeit 80% (24 Tage)', 'Betriebszugehörigkeit >15 Jahre'"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Hier eintragen, warum dieser Mitarbeiter mehr oder abweichende Tage (z. B. wegen GdB-Prozenten oder Teilzeit) hat.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingEmployee(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium cursor-pointer shadow-xs"
              >
                Mitarbeiter speichern
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
