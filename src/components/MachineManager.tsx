import React, { useState } from 'react';
import { DepartmentDatabase, Machine, ShiftModelType } from '../types';
import { Cpu, Plus, Edit2, Trash2, Check, AlertCircle, Wrench, Building2, Users } from 'lucide-react';

interface MachineManagerProps {
  db: DepartmentDatabase;
  onUpdateDB: (updated: DepartmentDatabase) => void;
}

export const MachineManager: React.FC<MachineManagerProps> = ({ db, onUpdateDB }) => {
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [isNew, setIsNew] = useState(false);

  const handleOpenNew = () => {
    const newM: Machine = {
      id: `m-${Date.now()}`,
      departmentCode: db.departmentCode,
      code: `M-${String(db.machines.length + 1).padStart(2, '0')}`,
      name: '',
      area: 'Halle 1',
      shiftModel: '3-schicht',
      minStaffPerShift: { frueh: 1, spaet: 1, nacht: 1 },
      status: 'aktiv',
      notes: '',
    };
    setEditingMachine(newM);
    setIsNew(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMachine) return;

    let updatedList = [...db.machines];
    if (isNew) {
      updatedList.push(editingMachine);
    } else {
      updatedList = updatedList.map((m) => (m.id === editingMachine.id ? editingMachine : m));
    }

    onUpdateDB({
      ...db,
      machines: updatedList,
    });
    setEditingMachine(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Möchten Sie diese Maschine wirklich aus der Datenbank entfernen?')) {
      // Verwaiste Referenzen auf die gelöschte Maschine mit aufräumen, sonst
      // bleiben tote IDs in Mitarbeiter-Qualifikationen und manuellen
      // Schicht-Überschreibungen stehen.
      onUpdateDB({
        ...db,
        machines: db.machines.filter((m) => m.id !== id),
        employees: db.employees.map((e) => ({
          ...e,
          qualifiedMachineIds: e.qualifiedMachineIds.filter((mid) => mid !== id),
          preferredMachineId: e.preferredMachineId === id ? undefined : e.preferredMachineId,
        })),
        manualOverrides: db.manualOverrides.filter((o) => o.machineId !== id),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-600" />
            Maschinen- & Anlagenverwaltung ({db.departmentCode})
          </h2>
          <p className="text-xs text-slate-500">
            Definieren Sie Maschinen, Schichtbetriebsmodelle (1, 2 oder 3 Schichten) und Soll-Mindestbesetzungen.
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Neue Maschine anlegen
        </button>
      </div>

      {/* Grid of machines */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {db.machines.map((machine) => {
          const qualifiedEmployees = db.employees.filter(
            (e) => e.qualifiedMachineIds?.includes(machine.id) || e.preferredMachineId === machine.id
          );

          return (
            <div
              key={machine.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        {machine.code}
                      </span>
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                          machine.status === 'aktiv'
                            ? 'bg-emerald-100 text-emerald-800'
                            : machine.status === 'wartung'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {machine.status}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm">{machine.name}</h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingMachine({ ...machine });
                        setIsNew(false);
                      }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                      title="Bearbeiten"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(machine.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                      title="Löschen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>{machine.area}</span>
                </div>

                {machine.notes && (
                  <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                    {machine.notes}
                  </p>
                )}

                {/* Staffing Requirements */}
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-700 font-medium">
                    <span>Betriebsmodell:</span>
                    <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                      {machine.shiftModel}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1 pt-1 text-center font-mono text-[11px]">
                    <div className="bg-amber-50 border border-amber-200 rounded p-1">
                      <span className="text-amber-800 block text-[9px] font-bold">FRÜH</span>
                      <span className="font-bold text-amber-950">{machine.minStaffPerShift.frueh} Pers.</span>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded p-1">
                      <span className="text-blue-800 block text-[9px] font-bold">SPÄT</span>
                      <span className="font-bold text-blue-950">
                        {machine.shiftModel === '1-schicht' ? '-' : `${machine.minStaffPerShift.spaet} Pers.`}
                      </span>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-200 rounded p-1">
                      <span className="text-indigo-800 block text-[9px] font-bold">NACHT</span>
                      <span className="font-bold text-indigo-950">
                        {machine.shiftModel === '3-schicht' ? `${machine.minStaffPerShift.nacht} Pers.` : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  {qualifiedEmployees.length} Mitarbeiter eingewiesen
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Machine Edit Modal */}
      {editingMachine && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Cpu className="w-5 h-5 text-blue-600" />
                {isNew ? 'Neue Maschine anlegen' : 'Maschinendetails bearbeiten'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingMachine(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Maschinenkürzel / Nummer *
                </label>
                <input
                  type="text"
                  required
                  value={editingMachine.code}
                  onChange={(e) => setEditingMachine({ ...editingMachine, code: e.target.value.toUpperCase() })}
                  placeholder="Z.B. CNC-03"
                  className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Status</label>
                <select
                  value={editingMachine.status}
                  onChange={(e) =>
                    setEditingMachine({
                      ...editingMachine,
                      status: e.target.value as 'aktiv' | 'wartung' | 'stillstand',
                    })
                  }
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="aktiv">Aktiv / In Produktion</option>
                  <option value="wartung">In planmäßiger Wartung</option>
                  <option value="stillstand">Stillstand / Reparatur</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Bezeichnung der Maschine / Anlage *
              </label>
              <input
                type="text"
                required
                value={editingMachine.name}
                onChange={(e) => setEditingMachine({ ...editingMachine, name: e.target.value })}
                placeholder="Z.B. DMG Mori 5-Achs Bearbeitungszentrum"
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Bereich / Halle</label>
                <input
                  type="text"
                  value={editingMachine.area}
                  onChange={(e) => setEditingMachine({ ...editingMachine, area: e.target.value })}
                  placeholder="Z.B. Halle 2 - West"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Schichtbetriebsmodell *
                </label>
                <select
                  value={editingMachine.shiftModel}
                  onChange={(e) =>
                    setEditingMachine({
                      ...editingMachine,
                      shiftModel: e.target.value as ShiftModelType,
                    })
                  }
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="3-schicht">3-Schicht (Früh, Spät, Nacht)</option>
                  <option value="2-schicht">2-Schicht (Früh, Spät)</option>
                  <option value="1-schicht">1-Schicht (Nur Früh / Tagschicht)</option>
                </select>
              </div>
            </div>

            {/* Mindestbesetzung */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Mindestbesetzung je Schicht (Soll-Personal)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[11px] text-amber-800 font-medium block">Frühschicht</span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={editingMachine.minStaffPerShift.frueh}
                    onChange={(e) =>
                      setEditingMachine({
                        ...editingMachine,
                        minStaffPerShift: {
                          ...editingMachine.minStaffPerShift,
                          frueh: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-blue-800 font-medium block">Spätschicht</span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    disabled={editingMachine.shiftModel === '1-schicht'}
                    value={editingMachine.minStaffPerShift.spaet}
                    onChange={(e) =>
                      setEditingMachine({
                        ...editingMachine,
                        minStaffPerShift: {
                          ...editingMachine.minStaffPerShift,
                          spaet: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono disabled:opacity-50"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-indigo-800 font-medium block">Nachtschicht</span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    disabled={editingMachine.shiftModel !== '3-schicht'}
                    value={editingMachine.minStaffPerShift.nacht}
                    onChange={(e) =>
                      setEditingMachine({
                        ...editingMachine,
                        minStaffPerShift: {
                          ...editingMachine.minStaffPerShift,
                          nacht: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Notizen & Wartungshinweise
              </label>
              <textarea
                rows={2}
                value={editingMachine.notes || ''}
                onChange={(e) => setEditingMachine({ ...editingMachine, notes: e.target.value })}
                placeholder="Z.B. Benötigt Kran-Führerschein für Rüstung..."
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingMachine(null)}
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
