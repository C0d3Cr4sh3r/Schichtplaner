import React, { useState } from 'react';
import {
  DepartmentDatabase,
  ShiftId,
  ManualShiftOverride,
  WeekPlanSchedule,
  Employee,
  Machine,
} from '../types';
import {
  generateWeekSchedule,
  generateMultiWeekPlan,
  getISOWeek,
  getDateRangeForKW,
  getWeeksInISOYear,
  SHIFT_NAMES,
  SHIFT_SHORT_NAMES,
  SHIFT_COLORS,
  calculateEmployeeShiftForWeek,
  formatEmployeeName,
} from '../lib/rotationEngine';
import { ABSENCE_CONFIGS, detectMachineVacationConflicts } from '../lib/absenceUtils';
import { VacationConflictAlertPanel } from './VacationConflictAlertPanel';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  AlertTriangle,
  UserCheck,
  Crown,
  Shield,
  Clock,
  Printer,
  Edit2,
  CheckCircle2,
  CalendarRange,
  Users,
  Info,
  RotateCcw,
  Sparkles,
  Check,
} from 'lucide-react';

interface ShiftPlannerViewProps {
  db: DepartmentDatabase;
  onUpdateDB: (updated: DepartmentDatabase) => void;
  onSwitchToPrint: () => void;
}

export const ShiftPlannerView: React.FC<ShiftPlannerViewProps> = ({
  db,
  onUpdateDB,
  onSwitchToPrint,
}) => {
  const today = new Date();
  const currentWeekInfo = getISOWeek(today);

  const [selectedYear, setSelectedYear] = useState<number>(currentWeekInfo.year);
  const [selectedKW, setSelectedKW] = useState<number>(currentWeekInfo.kw);
  // Default to 4 weeks as requested ("4 Wochen vorgegeben, manuell eingebbar")
  const [horizon, setHorizon] = useState<number>(4);

  // Manual override modal states
  const [editingSlot, setEditingSlot] = useState<{
    machineId?: string;
    shiftId: ShiftId;
    kw: number;
    year: number;
    currentEmployeeIds: string[];
    isShiftLeaderSlot?: boolean;
  } | null>(null);

  const [editingShiftLeaderSlot, setEditingShiftLeaderSlot] = useState<{
    shiftId: ShiftId;
    kw: number;
    year: number;
    currentLeaderIds: string[];
  } | null>(null);

  const [editingEmployeeShift, setEditingEmployeeShift] = useState<{
    employee: Employee;
    year: number;
    kw: number;
    currentShift: ShiftId;
    isAbsentText?: string;
  } | null>(null);

  const currentSchedule = generateWeekSchedule(db, selectedYear, selectedKW);
  const multiWeekSchedules = horizon > 1 ? generateMultiWeekPlan(db, selectedYear, selectedKW, horizon) : [];

  const handlePrevWeek = () => {
    if (selectedKW === 1) {
      const prevYear = selectedYear - 1;
      setSelectedKW(getWeeksInISOYear(prevYear));
      setSelectedYear(prevYear);
    } else {
      setSelectedKW((k) => k - 1);
    }
  };

  const handleNextWeek = () => {
    if (selectedKW >= getWeeksInISOYear(selectedYear)) {
      setSelectedKW(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedKW((k) => k + 1);
    }
  };

  const handleResetToCurrent = () => {
    setSelectedYear(currentWeekInfo.year);
    setSelectedKW(currentWeekInfo.kw);
  };

  // Save manual machine override
  const handleSaveOverride = (employeeIds: string[]) => {
    if (!editingSlot) return;

    // Filter out existing override for this slot
    const existing = db.manualOverrides.filter(
      (o) =>
        !(
          o.year === editingSlot.year &&
          o.kw === editingSlot.kw &&
          o.machineId === editingSlot.machineId &&
          o.shiftId === editingSlot.shiftId
        )
    );

    const newOverride: ManualShiftOverride = {
      id: `ov-${Date.now()}`,
      year: editingSlot.year,
      kw: editingSlot.kw,
      machineId: editingSlot.machineId,
      shiftId: editingSlot.shiftId,
      assignedEmployeeIds: employeeIds,
    };

    const updatedOverrides = [...existing, newOverride];
    onUpdateDB({
      ...db,
      manualOverrides: updatedOverrides,
    });
    setEditingSlot(null);
  };

  const handleClearOverride = () => {
    if (!editingSlot) return;
    const existing = db.manualOverrides.filter(
      (o) =>
        !(
          o.year === editingSlot.year &&
          o.kw === editingSlot.kw &&
          o.machineId === editingSlot.machineId &&
          o.shiftId === editingSlot.shiftId
        )
    );
    onUpdateDB({
      ...db,
      manualOverrides: existing,
    });
    setEditingSlot(null);
  };

  // Save manual shift leader override (single or multiple)
  const handleSaveShiftLeaderOverride = (leaderIds: string[] | null) => {
    if (!editingShiftLeaderSlot) return;
    const existing = db.manualOverrides.filter(
      (o) =>
        !(
          o.year === editingShiftLeaderSlot.year &&
          o.kw === editingShiftLeaderSlot.kw &&
          o.shiftId === editingShiftLeaderSlot.shiftId &&
          o.note === 'shift-leader'
        )
    );

    const updatedOverrides = [...existing];
    if (leaderIds && leaderIds.length > 0) {
      updatedOverrides.push({
        id: `ov-sf-${Date.now()}`,
        year: editingShiftLeaderSlot.year,
        kw: editingShiftLeaderSlot.kw,
        shiftId: editingShiftLeaderSlot.shiftId,
        assignedEmployeeIds: leaderIds,
        note: 'shift-leader',
      });
    }

    onUpdateDB({
      ...db,
      manualOverrides: updatedOverrides,
    });
    setEditingShiftLeaderSlot(null);
  };

  // Save manual employee shift override in multi-week planning
  const handleSaveEmployeeShiftOverride = (targetShift: ShiftId | null) => {
    if (!editingEmployeeShift) return;

    const existing = db.manualOverrides.filter(
      (o) =>
        !(
          o.year === editingEmployeeShift.year &&
          o.kw === editingEmployeeShift.kw &&
          o.assignedEmployeeIds.includes(editingEmployeeShift.employee.id) &&
          o.note === 'emp-override'
        )
    );

    const updatedOverrides = [...existing];
    if (targetShift) {
      updatedOverrides.push({
        id: `ov-emp-${Date.now()}`,
        year: editingEmployeeShift.year,
        kw: editingEmployeeShift.kw,
        shiftId: targetShift,
        assignedEmployeeIds: [editingEmployeeShift.employee.id],
        note: 'emp-override',
      });
    }

    onUpdateDB({
      ...db,
      manualOverrides: updatedOverrides,
    });
    setEditingEmployeeShift(null);
  };

  // Reset all overrides for the currently selected week
  const handleResetWeekOverrides = () => {
    const remaining = db.manualOverrides.filter(
      (o) => !(o.year === selectedYear && o.kw === selectedKW)
    );
    onUpdateDB({
      ...db,
      manualOverrides: remaining,
    });
  };

  const weekOverridesCount = db.manualOverrides.filter(
    (o) => o.year === selectedYear && o.kw === selectedKW
  ).length;

  return (
    <div className="space-y-6">
      {/* Control Bar: Week Navigation & Projection Horizon */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Left: Week selector & jump buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={handlePrevWeek}
              className="p-1.5 rounded hover:bg-white hover:shadow-xs text-slate-700 transition-all cursor-pointer"
              title="Vorherige Kalenderwoche"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 text-sm font-bold text-slate-800 font-mono flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>KW {selectedKW} / {selectedYear}</span>
            </div>
            <button
              onClick={handleNextWeek}
              className="p-1.5 rounded hover:bg-white hover:shadow-xs text-slate-700 transition-all cursor-pointer"
              title="Nächste Kalenderwoche"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleResetToCurrent}
            className="text-xs px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium transition-colors cursor-pointer"
          >
            Aktuelle KW ({currentWeekInfo.kw})
          </button>

          <span className="text-xs text-slate-500 font-medium hidden sm:inline">
            Zeitraum: {currentSchedule.startDateStr} – {currentSchedule.endDateStr}
          </span>
        </div>

        {/* Right: Horizon selection (Manuell eingebbar, 4 Wochen vorgegeben) */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1">
            <CalendarRange className="w-3.5 h-3.5 text-blue-600" />
            Vorausplanung:
          </span>

          {/* Stepper & Number Input for manual entry */}
          <div className="flex items-center bg-slate-100 border border-slate-300 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setHorizon((h) => Math.max(1, h - 1))}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-white text-slate-700 font-bold transition-colors cursor-pointer text-xs"
              title="1 Woche weniger"
            >
              -
            </button>
            <div className="flex items-center px-1">
              <input
                type="number"
                min={1}
                max={52}
                value={horizon}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) {
                    setHorizon(Math.max(1, Math.min(52, val)));
                  } else {
                    setHorizon(1);
                  }
                }}
                className="w-10 text-center bg-white border border-slate-300 rounded px-1 py-0.5 text-xs font-bold text-slate-900 font-mono shadow-2xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
              <span className="text-[11px] text-slate-600 font-medium ml-1 mr-0.5">
                {horizon === 1 ? 'Wo' : 'Wo'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setHorizon((h) => Math.min(52, h + 1))}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-white text-slate-700 font-bold transition-colors cursor-pointer text-xs"
              title="1 Woche mehr"
            >
              +
            </button>
          </div>

          {/* Quick presets */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-medium">
            {[
              { val: 1, label: '1W (Detail)' },
              { val: 2, label: '2W' },
              { val: 4, label: '4W (Vorgabe)' },
              { val: 8, label: '8W' },
              { val: 12, label: '12W' },
            ].map(({ val, label }) => (
              <button
                key={val}
                type="button"
                onClick={() => setHorizon(val)}
                className={`px-2 py-1 rounded-md transition-all cursor-pointer text-[11px] ${
                  horizon === val
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={onSwitchToPrint}
            className="ml-1 hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" />
            A4 Druckansicht
          </button>
        </div>

      </div>

      {/* Manual Planning Guidance & Status Bar */}
      <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-start sm:items-center gap-2.5">
          <span className="p-1 rounded-md bg-blue-100 text-blue-700 shrink-0 mt-0.5 sm:mt-0">
            <Info className="w-4 h-4" />
          </span>
          <div>
            <span className="font-bold text-blue-950 block sm:inline mr-1.5">
              Manuelle Schichtplanung & Eingriff:
            </span>
            <span className="text-blue-800">
              Sie können die Planung jederzeit manuell anpassen! Klicken oder tippen Sie einfach auf Schichtführer, beliebige Maschinenslots oder Mitarbeiterschichten in der Vorausplanung.
            </span>
          </div>
        </div>

        {weekOverridesCount > 0 && (
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto bg-white/80 border border-blue-300 px-2.5 py-1 rounded-lg">
            <span className="text-[11px] font-mono text-blue-900 font-semibold">
              {weekOverridesCount} manuelle Anpassung(en) in KW {selectedKW}
            </span>
            <button
              type="button"
              onClick={handleResetWeekOverrides}
              className="text-[11px] text-red-600 hover:text-red-800 font-medium underline cursor-pointer ml-1"
              title="Alle manuellen Anpassungen dieser Woche zurücksetzen"
            >
              Zurücksetzen
            </button>
          </div>
        )}
      </div>

      {/* Vacation / Absence Overlap Alert Panel for Machines */}
      <VacationConflictAlertPanel db={db} />

      {/* Understaffing or warning banner if any */}
      {currentSchedule.machineAssignments.some((m) => m.understaffed.frueh || m.understaffed.spaet || m.understaffed.nacht) && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex items-start gap-3 text-amber-900 text-xs sm:text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block">Achtung: Mindestbesetzung in dieser Woche unterschritten!</span>
            <p className="text-amber-800 text-xs">
              Einige Maschinen haben weniger zugewiesene Mitarbeiter als in der Mindestbesetzung konfiguriert. 
              Dies kann durch Urlaubszeiten, Krankheit oder fehlende Springer verursacht werden. Prüfen Sie die gelben Warnfelder unten.
            </p>
          </div>
        </div>
      )}

      {/* Leadership row (Teamleiter & Schichtführer) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Teamleiter Box */}
        <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-800 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              Teamleitung (Woche)
            </span>
            <span className="text-[10px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded font-mono font-medium">
              TL
            </span>
          </div>
          <div className="mt-2">
            {currentSchedule.teamLeader ? (
              <div>
                <h4 className="font-bold text-base text-white">
                  {formatEmployeeName(currentSchedule.teamLeader)}
                </h4>
                <p className="text-xs text-slate-400 font-mono">
                  {currentSchedule.teamLeader.personnelNumber ? currentSchedule.teamLeader.personnelNumber : ''} {currentSchedule.teamLeader.phone && `• ${currentSchedule.teamLeader.phone}`}
                </p>
              </div>
            ) : (
              <span className="text-xs text-slate-400 italic">Kein Teamleiter hinterlegt</span>
            )}
          </div>
        </div>

        {/* Schichtführer Früh */}
        {(() => {
          const isOverridden = db.manualOverrides.some(
            (o) => o.year === selectedYear && o.kw === selectedKW && o.shiftId === 'frueh' && o.note === 'shift-leader'
          );
          const leaders = Array.isArray(currentSchedule.shiftLeaders.frueh)
            ? currentSchedule.shiftLeaders.frueh
            : currentSchedule.shiftLeaders.frueh
            ? [currentSchedule.shiftLeaders.frueh]
            : [];
          return (
            <div
              onClick={() =>
                setEditingShiftLeaderSlot({
                  shiftId: 'frueh',
                  kw: selectedKW,
                  year: selectedYear,
                  currentLeaderIds: leaders.map((l) => l.id),
                })
              }
              className="bg-amber-50/70 rounded-xl p-4 border border-amber-200 flex flex-col justify-between cursor-pointer hover:shadow-md hover:ring-2 hover:ring-amber-300 transition-all group relative"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-600" />
                  Schichtführer Früh {leaders.length > 1 && `(${leaders.length})`}
                  <Edit2 className="w-3 h-3 text-amber-600 opacity-50 group-hover:opacity-100 transition-opacity ml-1" />
                </span>
                <div className="flex items-center gap-1">
                  {isOverridden && (
                    <span className="text-[9px] bg-amber-700 text-white px-1.5 py-0.5 rounded font-bold font-mono">
                      Manuell
                    </span>
                  )}
                  <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-mono font-bold">
                    06 - 14 Uhr
                  </span>
                </div>
              </div>
              <div className="mt-2 space-y-1.5">
                {leaders.length > 0 ? (
                  leaders.map((leader) => (
                    <div key={leader.id} className="bg-white/80 border border-amber-200/80 rounded-md p-1.5">
                      <h4 className="font-bold text-sm text-slate-900 leading-tight">
                        {formatEmployeeName(leader)}
                      </h4>
                      <p className="text-xs text-slate-600 font-mono">
                        {leader.personnelNumber || ''} {leader.phone && `• ${leader.phone}`}
                      </p>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-amber-700 italic">Nicht besetzt / Ausfall (Klicken zum Zuweisen)</span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Schichtführer Spät / Mittag */}
        {(() => {
          const isOverridden = db.manualOverrides.some(
            (o) => o.year === selectedYear && o.kw === selectedKW && o.shiftId === 'spaet' && o.note === 'shift-leader'
          );
          const leaders = Array.isArray(currentSchedule.shiftLeaders.spaet)
            ? currentSchedule.shiftLeaders.spaet
            : currentSchedule.shiftLeaders.spaet
            ? [currentSchedule.shiftLeaders.spaet]
            : [];
          return (
            <div
              onClick={() =>
                setEditingShiftLeaderSlot({
                  shiftId: 'spaet',
                  kw: selectedKW,
                  year: selectedYear,
                  currentLeaderIds: leaders.map((l) => l.id),
                })
              }
              className="bg-blue-50/70 rounded-xl p-4 border border-blue-200 flex flex-col justify-between cursor-pointer hover:shadow-md hover:ring-2 hover:ring-blue-300 transition-all group relative"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-blue-600" />
                  Schichtführer Spät / Mittag {leaders.length > 1 && `(${leaders.length})`}
                  <Edit2 className="w-3 h-3 text-blue-600 opacity-50 group-hover:opacity-100 transition-opacity ml-1" />
                </span>
                <div className="flex items-center gap-1">
                  {isOverridden && (
                    <span className="text-[9px] bg-blue-700 text-white px-1.5 py-0.5 rounded font-bold font-mono">
                      Manuell
                    </span>
                  )}
                  <span className="text-[10px] bg-blue-200 text-blue-900 px-1.5 py-0.5 rounded font-mono font-bold">
                    14 - 22 Uhr
                  </span>
                </div>
              </div>
              <div className="mt-2 space-y-1.5">
                {leaders.length > 0 ? (
                  leaders.map((leader) => (
                    <div key={leader.id} className="bg-white/80 border border-blue-200/80 rounded-md p-1.5">
                      <h4 className="font-bold text-sm text-slate-900 leading-tight">
                        {formatEmployeeName(leader)}
                      </h4>
                      <p className="text-xs text-slate-600 font-mono">
                        {leader.personnelNumber || ''} {leader.phone && `• ${leader.phone}`}
                      </p>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-blue-700 italic">Nicht besetzt / Ausfall (Klicken zum Zuweisen)</span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Schichtführer Nacht */}
        {(() => {
          const isOverridden = db.manualOverrides.some(
            (o) => o.year === selectedYear && o.kw === selectedKW && o.shiftId === 'nacht' && o.note === 'shift-leader'
          );
          const leaders = Array.isArray(currentSchedule.shiftLeaders.nacht)
            ? currentSchedule.shiftLeaders.nacht
            : currentSchedule.shiftLeaders.nacht
            ? [currentSchedule.shiftLeaders.nacht]
            : [];
          return (
            <div
              onClick={() =>
                setEditingShiftLeaderSlot({
                  shiftId: 'nacht',
                  kw: selectedKW,
                  year: selectedYear,
                  currentLeaderIds: leaders.map((l) => l.id),
                })
              }
              className="bg-indigo-50/70 rounded-xl p-4 border border-indigo-200 flex flex-col justify-between cursor-pointer hover:shadow-md hover:ring-2 hover:ring-indigo-300 transition-all group relative"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-indigo-600" />
                  Schichtführer Nacht {leaders.length > 1 && `(${leaders.length})`}
                  <Edit2 className="w-3 h-3 text-indigo-600 opacity-50 group-hover:opacity-100 transition-opacity ml-1" />
                </span>
                <div className="flex items-center gap-1">
                  {isOverridden && (
                    <span className="text-[9px] bg-indigo-700 text-white px-1.5 py-0.5 rounded font-bold font-mono">
                      Manuell
                    </span>
                  )}
                  <span className="text-[10px] bg-indigo-200 text-indigo-900 px-1.5 py-0.5 rounded font-mono font-bold">
                    22 - 06 Uhr
                  </span>
                </div>
              </div>
              <div className="mt-2 space-y-1.5">
                {leaders.length > 0 ? (
                  leaders.map((leader) => (
                    <div key={leader.id} className="bg-white/80 border border-indigo-200/80 rounded-md p-1.5">
                      <h4 className="font-bold text-sm text-slate-900 leading-tight">
                        {formatEmployeeName(leader)}
                      </h4>
                      <p className="text-xs text-slate-600 font-mono">
                        {leader.personnelNumber || ''} {leader.phone && `• ${leader.phone}`}
                      </p>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-indigo-700 italic">Nicht besetzt / Ruhe (Klicken zum Zuweisen)</span>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Main Single Week Table: Machines x Shifts */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">
              Maschineneinteilung & Schichten für KW {selectedKW}
            </h3>
            <span className="text-xs text-slate-500">
              (Automatische wöchentliche Rotation aktiv)
            </span>
          </div>

          <span className="text-xs text-slate-500 font-medium">
            Klick auf ein Feld zum manuellen Überschreiben / Zuweisen
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-700 font-semibold">
                <th className="py-3 px-4 w-1/4">Maschine / Anlage</th>
                <th className="py-3 px-4 w-1/4 bg-amber-50/80 text-amber-900 border-l border-r border-amber-200">
                  <div className="flex items-center justify-between">
                    <span>Frühschicht (06:00 - 14:00)</span>
                    <span className="text-[10px] font-mono bg-amber-200 px-1.5 py-0.5 rounded">F</span>
                  </div>
                </th>
                <th className="py-3 px-4 w-1/4 bg-blue-50/80 text-blue-900 border-r border-blue-200">
                  <div className="flex items-center justify-between">
                    <span>Spätschicht (14:00 - 22:00)</span>
                    <span className="text-[10px] font-mono bg-blue-200 px-1.5 py-0.5 rounded">S</span>
                  </div>
                </th>
                <th className="py-3 px-4 w-1/4 bg-indigo-50/80 text-indigo-900">
                  <div className="flex items-center justify-between">
                    <span>Nachtschicht (22:00 - 06:00)</span>
                    <span className="text-[10px] font-mono bg-indigo-200 px-1.5 py-0.5 rounded">N</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {currentSchedule.machineAssignments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    Keine aktiven Maschinen in dieser Abteilung hinterlegt. Nutzen Sie den Reiter "Maschinen".
                  </td>
                </tr>
              ) : (
                currentSchedule.machineAssignments.map(({ machine, shifts, understaffed }) => (
                  <tr key={machine.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Machine Column */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-xs bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded">
                              {machine.code}
                            </span>
                            <span className="font-semibold text-slate-900">{machine.name}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{machine.area}</p>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                          {machine.shiftModel}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                        <span>Soll F/S/N:</span>
                        <span className="font-mono text-slate-600 font-medium">
                          {machine.minStaffPerShift.frueh} / {machine.minStaffPerShift.spaet} / {machine.minStaffPerShift.nacht}
                        </span>
                      </div>
                    </td>

                    {/* Frühschicht Slot */}
                    {(() => {
                      const isOverridden = db.manualOverrides.some(
                        (o) => o.year === selectedYear && o.kw === selectedKW && o.machineId === machine.id && o.shiftId === 'frueh'
                      );
                      return (
                        <td
                          onClick={() =>
                            setEditingSlot({
                              machineId: machine.id,
                              shiftId: 'frueh',
                              kw: selectedKW,
                              year: selectedYear,
                              currentEmployeeIds: shifts.frueh.map((e) => e.id),
                            })
                          }
                          className={`py-3 px-4 border-l border-r border-amber-100 cursor-pointer hover:bg-amber-100/50 transition-colors ${
                            understaffed.frueh ? 'bg-amber-100/40' : 'bg-amber-50/20'
                          }`}
                        >
                          <div className="space-y-1.5">
                            {isOverridden && (
                              <div className="flex justify-end">
                                <span className="text-[9px] bg-amber-200 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded font-bold font-mono">
                                  ✎ Manuell
                                </span>
                              </div>
                            )}
                            {shifts.frueh.map((emp) => (
                              <div
                                key={emp.id}
                                className="bg-white border border-amber-200 rounded-md p-1.5 shadow-2xs flex items-center justify-between"
                              >
                                <div>
                                  <span className="font-medium text-slate-900 block">
                                    {formatEmployeeName(emp)}
                                  </span>
                                  {emp.personnelNumber && (
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      {emp.personnelNumber}
                                    </span>
                                  )}
                                </div>
                                <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100" />
                              </div>
                            ))}
                            {shifts.frueh.length === 0 && (
                              <span className="text-amber-800/60 italic text-[11px]">Keine Einteilung (Klicken zum Zuweisen)</span>
                            )}
                            {understaffed.frueh && (
                              <div className="flex items-center gap-1 text-[10px] text-amber-700 font-semibold pt-1">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>Unterbesetzt (Soll: {machine.minStaffPerShift.frueh})</span>
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })()}

                    {/* Spätschicht Slot */}
                    {(() => {
                      const isOverridden = db.manualOverrides.some(
                        (o) => o.year === selectedYear && o.kw === selectedKW && o.machineId === machine.id && o.shiftId === 'spaet'
                      );
                      return (
                        <td
                          onClick={() => {
                            if (machine.shiftModel === '1-schicht') return;
                            setEditingSlot({
                              machineId: machine.id,
                              shiftId: 'spaet',
                              kw: selectedKW,
                              year: selectedYear,
                              currentEmployeeIds: shifts.spaet.map((e) => e.id),
                            });
                          }}
                          className={`py-3 px-4 border-r border-blue-100 transition-colors ${
                            machine.shiftModel === '1-schicht'
                              ? 'bg-slate-100/50 cursor-not-allowed opacity-50'
                              : 'cursor-pointer hover:bg-blue-100/50 ' +
                                (understaffed.spaet ? 'bg-blue-100/40' : 'bg-blue-50/20')
                          }`}
                        >
                          {machine.shiftModel === '1-schicht' ? (
                            <span className="text-slate-400 italic text-[11px]">Maschine nicht aktiv in Spätschicht</span>
                          ) : (
                            <div className="space-y-1.5">
                              {isOverridden && (
                                <div className="flex justify-end">
                                  <span className="text-[9px] bg-blue-200 text-blue-900 border border-blue-300 px-1.5 py-0.5 rounded font-bold font-mono">
                                    ✎ Manuell
                                  </span>
                                </div>
                              )}
                              {shifts.spaet.map((emp) => (
                                <div
                                  key={emp.id}
                                  className="bg-white border border-blue-200 rounded-md p-1.5 shadow-2xs flex items-center justify-between"
                                >
                                  <div>
                                    <span className="font-medium text-slate-900 block">
                                      {formatEmployeeName(emp)}
                                    </span>
                                    {emp.personnelNumber && (
                                      <span className="text-[10px] text-slate-500 font-mono">
                                        {emp.personnelNumber}
                                      </span>
                                    )}
                                  </div>
                                  <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100" />
                                </div>
                              ))}
                              {shifts.spaet.length === 0 && (
                                <span className="text-blue-800/60 italic text-[11px]">Keine Einteilung (Klicken zum Zuweisen)</span>
                              )}
                              {understaffed.spaet && (
                                <div className="flex items-center gap-1 text-[10px] text-blue-700 font-semibold pt-1">
                                  <AlertTriangle className="w-3 h-3 text-blue-600" />
                                  <span>Unterbesetzt (Soll: {machine.minStaffPerShift.spaet})</span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })()}

                    {/* Nachtschicht Slot */}
                    {(() => {
                      const isOverridden = db.manualOverrides.some(
                        (o) => o.year === selectedYear && o.kw === selectedKW && o.machineId === machine.id && o.shiftId === 'nacht'
                      );
                      return (
                        <td
                          onClick={() => {
                            if (machine.shiftModel !== '3-schicht') return;
                            setEditingSlot({
                              machineId: machine.id,
                              shiftId: 'nacht',
                              kw: selectedKW,
                              year: selectedYear,
                              currentEmployeeIds: shifts.nacht.map((e) => e.id),
                            });
                          }}
                          className={`py-3 px-4 transition-colors ${
                            machine.shiftModel !== '3-schicht'
                              ? 'bg-slate-100/50 cursor-not-allowed opacity-50'
                              : 'cursor-pointer hover:bg-indigo-100/50 ' +
                                (understaffed.nacht ? 'bg-indigo-100/40' : 'bg-indigo-50/20')
                          }`}
                        >
                          {machine.shiftModel !== '3-schicht' ? (
                            <span className="text-slate-400 italic text-[11px]">Maschine nicht aktiv in Nachtschicht</span>
                          ) : (
                            <div className="space-y-1.5">
                              {isOverridden && (
                                <div className="flex justify-end">
                                  <span className="text-[9px] bg-indigo-200 text-indigo-900 border border-indigo-300 px-1.5 py-0.5 rounded font-bold font-mono">
                                    ✎ Manuell
                                  </span>
                                </div>
                              )}
                              {shifts.nacht.map((emp) => (
                                <div
                                  key={emp.id}
                                  className="bg-white border border-indigo-200 rounded-md p-1.5 shadow-2xs flex items-center justify-between"
                                >
                                  <div>
                                    <span className="font-medium text-slate-900 block">
                                      {formatEmployeeName(emp)}
                                    </span>
                                    {emp.personnelNumber && (
                                      <span className="text-[10px] text-slate-500 font-mono">
                                        {emp.personnelNumber}
                                      </span>
                                    )}
                                  </div>
                                  <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100" />
                                </div>
                              ))}
                              {shifts.nacht.length === 0 && (
                                <span className="text-indigo-800/60 italic text-[11px]">Keine Einteilung (Klicken zum Zuweisen)</span>
                              )}
                              {understaffed.nacht && (
                                <div className="flex items-center gap-1 text-[10px] text-indigo-700 font-semibold pt-1">
                                  <AlertTriangle className="w-3 h-3 text-indigo-600" />
                                  <span>Unterbesetzt (Soll: {machine.minStaffPerShift.nacht})</span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })()}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Absences in current week card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Urlaubs & Krankheitsübersicht der Woche */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-red-500" />
              Abwesenheiten in KW {selectedKW} (Urlaub & Krank)
            </h4>
            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-mono">
              {currentSchedule.absentEmployees.length} gemeldet
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {currentSchedule.absentEmployees.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">
                Keine Abwesenheiten für diese Kalenderwoche hinterlegt. Vollbesetzung verfügbar.
              </p>
            ) : (
              currentSchedule.absentEmployees.map(({ employee, type, affectedDaysText }) => (
                <div
                  key={employee.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                        type === 'krank'
                          ? 'bg-red-100 text-red-800 border border-red-300'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {type === 'krank' ? 'K (Krank)' : 'U (Urlaub)'}
                    </span>
                    <div>
                      <span className="font-semibold text-slate-900">
                        {formatEmployeeName(employee)}
                      </span>
                      {employee.personnelNumber && (
                        <span className="text-[11px] text-slate-500 ml-1 font-mono">
                          ({employee.personnelNumber})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                      {affectedDaysText}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Springer & Unassigned Pool */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-600" />
              Verfügbarer Springer- & Freischicht-Pool
            </h4>
            <span className="text-xs text-slate-500">
              KW {selectedKW}
            </span>
          </div>

          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Frei / Zeitausgleich ({currentSchedule.unassignedStaff.frei.length})
                </span>
                <div className="mt-1 space-y-1">
                  {currentSchedule.unassignedStaff.frei.map((e) => (
                    <div key={e.id} className="text-slate-700 font-medium">
                      {formatEmployeeName(e)}
                    </div>
                  ))}
                  {currentSchedule.unassignedStaff.frei.length === 0 && (
                    <span className="text-slate-400 italic text-[11px]">Niemand planmäßig frei</span>
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Springer / Reserve
                </span>
                <div className="mt-1 space-y-1">
                  {db.employees
                    .filter((e) => e.role === 'springer')
                    .map((e) => (
                      <div key={e.id} className="text-slate-700 font-medium flex items-center justify-between">
                        <span>{formatEmployeeName(e)}</span>
                        <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 rounded font-mono">
                          {SHIFT_SHORT_NAMES[calculateEmployeeShiftForWeek(e, selectedYear, selectedKW, db.manualOverrides)]}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Week Forward Projection Grid (2, 4, 7 oder 10 Wochen) */}
      {horizon > 1 && multiWeekSchedules.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CalendarRange className="w-4 h-4 text-blue-600" />
                  Vorausplanung & Rotationszyklus ({horizon} Wochen im Voraus)
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full">
                  Rhythmus: Früh → Nacht → Spät (Mittag)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatische wöchentliche Weiterschaltung gemäß Sequenz (Wer jetzt Nacht hat, hat nächste Woche Mittag und danach Früh).
              </p>
            </div>
            <span className="text-xs font-mono bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-md font-semibold">
              Horizont: {multiWeekSchedules[0]?.kw} bis {multiWeekSchedules[multiWeekSchedules.length - 1]?.kw}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <th className="py-2.5 px-3 text-left font-semibold sticky left-0 bg-slate-100 z-10 border-r border-slate-200 w-48">
                    Mitarbeiter / Rolle
                  </th>
                  <th className="py-2.5 px-2 text-left font-semibold border-r border-slate-200 w-28">
                    Schichtmodell
                  </th>
                  {multiWeekSchedules.map((ws) => (
                    <th
                      key={`${ws.year}-${ws.kw}`}
                      className="py-2.5 px-2 text-center font-semibold border-r border-slate-200 min-w-[75px]"
                    >
                      <div className="font-bold text-slate-900">KW {ws.kw}</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        {ws.startDateStr.substring(0, 5)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {db.employees
                  .filter((e) => e.active)
                  .map((emp) => {
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 font-medium text-slate-900 sticky left-0 bg-white hover:bg-slate-50 z-10 border-r border-slate-200">
                          <div className="flex items-center justify-between">
                            <span>{formatEmployeeName(emp)}</span>
                            {emp.role === 'teamleiter' && (
                              <span className="text-[9px] bg-slate-900 text-amber-300 px-1 rounded font-bold">TL</span>
                            )}
                            {emp.role === 'schichtfuehrer' && (
                              <span className="text-[9px] bg-blue-100 text-blue-800 px-1 rounded font-bold">SF</span>
                            )}
                            {emp.role === 'springer' && (
                              <span className="text-[9px] bg-purple-100 text-purple-800 px-1 rounded font-bold">SP</span>
                            )}
                          </div>
                          {emp.personnelNumber && (
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {emp.personnelNumber}
                            </span>
                          )}
                        </td>

                        <td className="py-2 px-2 text-slate-600 font-mono text-[11px] border-r border-slate-200">
                          {emp.shiftModel}
                          {emp.excludedShifts.length > 0 && (
                            <span className="text-[9px] text-red-600 block" title="Ausgeschlossene Schichten">
                              Ohne {emp.excludedShifts.map((s) => SHIFT_SHORT_NAMES[s]).join(', ')}
                            </span>
                          )}
                        </td>

                        {multiWeekSchedules.map((ws) => {
                          const shift = calculateEmployeeShiftForWeek(emp, ws.year, ws.kw, db.manualOverrides);
                          const isAbsent = ws.absentEmployees.find((a) => a.employee.id === emp.id);
                          const color = SHIFT_COLORS[shift];
                          const isOverridden = db.manualOverrides.some(
                            (o) =>
                              o.year === ws.year &&
                              o.kw === ws.kw &&
                              o.assignedEmployeeIds.includes(emp.id) &&
                              o.note === 'emp-override'
                          );

                          return (
                            <td
                              key={`${ws.year}-${ws.kw}`}
                              onClick={() =>
                                setEditingEmployeeShift({
                                  employee: emp,
                                  year: ws.year,
                                  kw: ws.kw,
                                  currentShift: shift,
                                  isAbsentText: isAbsent
                                    ? `${isAbsent.type.toUpperCase()}: ${isAbsent.affectedDaysText}`
                                    : undefined,
                                })
                              }
                              className="py-1.5 px-2 text-center border-r border-slate-200 font-mono cursor-pointer hover:bg-blue-50/80 transition-colors group"
                              title={`${emp.firstName} ${emp.lastName} in KW ${ws.kw}: ${SHIFT_NAMES[shift]} (Klicken zum Ändern)`}
                            >
                              {isAbsent ? (
                                <span
                                  title={`${ABSENCE_CONFIGS[isAbsent.type]?.label || isAbsent.type.toUpperCase()}: ${isAbsent.affectedDaysText} (Klicken zum Anpassen)`}
                                  className={`inline-block w-full py-1 rounded text-[11px] font-bold border ${
                                    ABSENCE_CONFIGS[isAbsent.type]?.badgeClass || 'bg-amber-100 text-amber-900 border-amber-300'
                                  }`}
                                >
                                  {ABSENCE_CONFIGS[isAbsent.type]?.shortCode || isAbsent.type.substring(0, 2).toUpperCase()}
                                </span>
                              ) : (
                                <span
                                  className={`inline-flex items-center justify-center gap-0.5 w-full py-1 rounded text-[11px] font-bold border ${color.badge} ${
                                    isOverridden ? 'ring-2 ring-blue-500 shadow-2xs' : ''
                                  }`}
                                >
                                  <span>{SHIFT_SHORT_NAMES[shift]}</span>
                                  {isOverridden && (
                                    <span className="text-[9px] text-blue-700 font-bold ml-0.5" title="Manuell übersteuert">
                                      ✎
                                    </span>
                                  )}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-600 border-t border-slate-100">
            <span className="font-semibold text-slate-700">Legende:</span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-200 border border-amber-300" />
              Früh (06-14h)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-200 border border-blue-300" />
              Spät (14-22h)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-indigo-200 border border-indigo-300" />
              Nacht (22-06h)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-slate-200 border border-slate-300" />
              Frei
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[10px] text-center">U</span>
              Urlaub
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-100 text-red-800 border border-red-300 font-bold text-[10px] text-center">K</span>
              Krank / AU
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-purple-100 text-purple-900 border border-purple-300 font-bold text-[10px] text-center">KT</span>
              Karenztag
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-sky-100 text-sky-900 border border-sky-300 font-bold text-[10px] text-center">ZA</span>
              Frei / ZA
            </span>
            <span className="flex items-center gap-1 text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              <span>✎</span>
              Manuell übersteuert (Klick auf Zelle zum Ändern)
            </span>
          </div>
        </div>
      )}

      {/* Manual Slot Override Modal (Machine Slot) */}
      {editingSlot && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Mitarbeiter manuell zuweisen / überschreiben
                </h3>
                <p className="text-xs text-slate-500">
                  KW {editingSlot.kw} / {editingSlot.year} • Schicht: {SHIFT_NAMES[editingSlot.shiftId]}
                </p>
              </div>
              <button
                onClick={() => setEditingSlot(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto grow">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                Mitarbeiter auswählen (Mehrfachauswahl möglich):
              </label>

              <div className="space-y-1.5 border border-slate-200 rounded-lg p-2 max-h-72 overflow-y-auto">
                {db.employees
                  .filter((e) => e.active)
                  .map((emp) => {
                    const isSelected = editingSlot.currentEmployeeIds.includes(emp.id);
                    const isExcluded = emp.excludedShifts?.includes(editingSlot.shiftId);
                    return (
                      <div
                        key={emp.id}
                        onClick={() => {
                          const next = isSelected
                            ? editingSlot.currentEmployeeIds.filter((id) => id !== emp.id)
                            : [...editingSlot.currentEmployeeIds, emp.id];
                          setEditingSlot({ ...editingSlot, currentEmployeeIds: next });
                        }}
                        title={isExcluded ? `Achtung: ${emp.firstName} ${emp.lastName} ist für ${SHIFT_NAMES[editingSlot.shiftId]} als ausgeschlossen hinterlegt.` : undefined}
                        className={`p-2.5 rounded-md border flex items-center justify-between cursor-pointer transition-colors text-xs ${
                          isSelected
                            ? 'bg-blue-50 border-blue-400 text-blue-900'
                            : isExcluded
                            ? 'bg-amber-50 border-amber-300 hover:bg-amber-100 text-slate-800'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div>
                          <span className="font-semibold block">
                            {emp.firstName} {emp.lastName}
                            {isExcluded && (
                              <span className="ml-1.5 text-[10px] font-bold text-amber-700">
                                ⚠ Schicht ausgeschlossen
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {emp.personnelNumber} • {emp.role} • Modell: {emp.shiftModel}
                          </span>
                        </div>

                        {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={handleClearOverride}
                className="text-xs text-red-600 hover:text-red-800 font-medium cursor-pointer"
              >
                Auf Automatik zurücksetzen
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSlot(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveOverride(editingSlot.currentEmployeeIds)}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium cursor-pointer shadow-xs"
                >
                  Übernehmen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Shift Leader Override Modal */}
      {editingShiftLeaderSlot && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Schichtführer manuell zuweisen / überschreiben
                </h3>
                <p className="text-xs text-slate-500">
                  KW {editingShiftLeaderSlot.kw} / {editingShiftLeaderSlot.year} • Schicht: {SHIFT_NAMES[editingShiftLeaderSlot.shiftId]}
                </p>
              </div>
              <button
                onClick={() => setEditingShiftLeaderSlot(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto grow">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                Mitarbeiter auswählen (Mehrfachauswahl möglich):
              </label>

              <div className="space-y-1.5 border border-slate-200 rounded-lg p-2 max-h-72 overflow-y-auto">
                {/* Qualified leaders first, then other employees */}
                {[...db.employees]
                  .filter((e) => e.active)
                  .sort((a, b) => {
                    const scoreA = a.role === 'schichtfuehrer' ? 2 : a.role === 'teamleiter' ? 1 : 0;
                    const scoreB = b.role === 'schichtfuehrer' ? 2 : b.role === 'teamleiter' ? 1 : 0;
                    return scoreB - scoreA;
                  })
                  .map((emp) => {
                    const isSelected = editingShiftLeaderSlot.currentLeaderIds.includes(emp.id);
                    return (
                      <div
                        key={emp.id}
                        onClick={() => {
                          const exists = editingShiftLeaderSlot.currentLeaderIds.includes(emp.id);
                          const next = exists
                            ? editingShiftLeaderSlot.currentLeaderIds.filter((id) => id !== emp.id)
                            : [...editingShiftLeaderSlot.currentLeaderIds, emp.id];
                          setEditingShiftLeaderSlot({
                            ...editingShiftLeaderSlot,
                            currentLeaderIds: next,
                          });
                        }}
                        className={`p-2.5 rounded-md border flex items-center justify-between cursor-pointer transition-colors text-xs ${
                          isSelected
                            ? 'bg-blue-50 border-blue-400 text-blue-900'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold block">
                              {formatEmployeeName(emp)}
                            </span>
                            {emp.role === 'schichtfuehrer' && (
                              <span className="text-[9px] bg-blue-100 text-blue-800 px-1 rounded font-bold">
                                SF
                              </span>
                            )}
                            {emp.role === 'teamleiter' && (
                              <span className="text-[9px] bg-slate-900 text-amber-300 px-1 rounded font-bold">
                                TL
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {emp.personnelNumber ? `${emp.personnelNumber} • ` : ''}{emp.role} • Modell: {emp.shiftModel} {emp.phone && `• Tel: ${emp.phone}`}
                          </span>
                        </div>

                        {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => handleSaveShiftLeaderOverride(null)}
                className="text-xs text-red-600 hover:text-red-800 font-medium cursor-pointer"
              >
                Auf Automatik zurücksetzen
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingShiftLeaderSlot(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleSaveShiftLeaderOverride(editingShiftLeaderSlot.currentLeaderIds)
                  }
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium cursor-pointer shadow-xs"
                >
                  Übernehmen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Employee Shift Override Modal (Multi-week cell clicked) */}
      {editingEmployeeShift && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Schicht manuell anpassen
                </h3>
                <p className="text-xs text-slate-500">
                  {formatEmployeeName(editingEmployeeShift.employee)} {editingEmployeeShift.employee.personnelNumber ? `(${editingEmployeeShift.employee.personnelNumber}) ` : ''}• KW {editingEmployeeShift.kw} / {editingEmployeeShift.year}
                </p>
              </div>
              <button
                onClick={() => setEditingEmployeeShift(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto grow">
              {editingEmployeeShift.isAbsentText && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  <span className="font-bold block">Abwesenheit hinterlegt:</span>
                  <span>{editingEmployeeShift.isAbsentText}</span>
                </div>
              )}

              <p className="text-xs text-slate-600">
                Wählen Sie die Schicht für diesen Mitarbeiter in KW {editingEmployeeShift.kw} aus:
              </p>

              <div className="grid grid-cols-1 gap-2">
                {([
                  { id: 'frueh' as ShiftId, name: 'Frühschicht', time: '06:00 - 14:00 Uhr', color: 'border-amber-300 bg-amber-50/60 hover:bg-amber-100/70 text-amber-950' },
                  { id: 'spaet' as ShiftId, name: 'Spät- / Mittagsschicht', time: '14:00 - 22:00 Uhr', color: 'border-blue-300 bg-blue-50/60 hover:bg-blue-100/70 text-blue-950' },
                  { id: 'nacht' as ShiftId, name: 'Nachtschicht', time: '22:00 - 06:00 Uhr', color: 'border-indigo-300 bg-indigo-50/60 hover:bg-indigo-100/70 text-indigo-950' },
                  { id: 'frei' as ShiftId, name: 'Freischicht / Ausgleich', time: 'Planmäßig frei', color: 'border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800' },
                ]).map((s) => {
                  const isSelected = editingEmployeeShift.currentShift === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSaveEmployeeShiftOverride(s.id)}
                      className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${s.color} ${
                        isSelected ? 'ring-2 ring-blue-600 font-bold' : ''
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-xs">{s.name}</div>
                        <div className="text-[11px] opacity-75 font-mono">{s.time}</div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => handleSaveEmployeeShiftOverride(null)}
                className="text-xs text-red-600 hover:text-red-800 font-medium cursor-pointer"
              >
                Auf Rotations-Automatik zurücksetzen
              </button>

              <button
                type="button"
                onClick={() => setEditingEmployeeShift(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
