import React, { useState } from 'react';
import { DepartmentDatabase, AbsenceType } from '../types';
import {
  detectMachineVacationConflicts,
  VacationMachineConflict,
  ABSENCE_CONFIGS,
} from '../lib/absenceUtils';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Calendar,
  UserX,
  Clock,
  ExternalLink,
  Info,
  CheckCircle2,
  CalendarRange,
} from 'lucide-react';

interface VacationConflictAlertPanelProps {
  db: DepartmentDatabase;
  onSelectDateRange?: (startDate: string, endDate: string) => void;
  onOpenEditAbsence?: (employeeId: string, startDate: string, endDate: string) => void;
}

export const VacationConflictAlertPanel: React.FC<VacationConflictAlertPanelProps> = ({
  db,
  onSelectDateRange,
  onOpenEditAbsence,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filterMachineId, setFilterMachineId] = useState<string>('all');

  // Detect all vacation / absence overlaps on machines where employees work
  const allConflicts = React.useMemo(() => {
    return detectMachineVacationConflicts(db.employees, db.machines, db.absences);
  }, [db.employees, db.machines, db.absences]);

  const filteredConflicts = React.useMemo(() => {
    if (filterMachineId === 'all') return allConflicts;
    return allConflicts.filter((c) => c.machineId === filterMachineId);
  }, [allConflicts, filterMachineId]);

  if (allConflicts.length === 0) {
    return null;
  }

  // Count total unique employees involved across all conflicts
  const uniqueEmployeeIds = new Set<string>();
  allConflicts.forEach((c) => {
    c.employees.forEach((e) => uniqueEmployeeIds.add(e.employee.id));
  });

  return (
    <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl shadow-xs overflow-hidden transition-all">
      {/* Header Bar */}
      <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-100/70 border-b border-amber-200">
        <div className="flex items-start sm:items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs font-bold">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                Urlaubs- & Abwesenheits-Überschneidungen an Maschinen
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-xs font-bold border border-amber-300">
                {allConflicts.length} {allConflicts.length === 1 ? 'Konflikt' : 'Konflikte'} ({uniqueEmployeeIds.size} Mitarbeiter)
              </span>
            </div>
            <p className="text-xs text-amber-900/80 mt-0.5">
              An diesen Maschinen haben zeitgleich mehrere zugewiesene Mitarbeiter Urlaub/Abwesenheit eingetragen.
              Überprüfen Sie die Zeiträume, bis die Überschneidungen passend geändert wurden.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          {allConflicts.length > 1 && (
            <select
              value={filterMachineId}
              onChange={(e) => setFilterMachineId(e.target.value)}
              className="text-xs bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium cursor-pointer shadow-2xs focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">Alle Maschinen ({allConflicts.length})</option>
              {Array.from(new Set(allConflicts.map((c) => c.machineId))).map((mId) => {
                const m = db.machines.find((x) => x.id === mId);
                const count = allConflicts.filter((c) => c.machineId === mId).length;
                return (
                  <option key={mId} value={mId}>
                    {m ? `${m.code} - ${m.name}` : mId} ({count})
                  </option>
                );
              })}
            </select>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-amber-200/80 hover:bg-amber-200 text-amber-900 transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold px-2.5"
            title={isExpanded ? 'Details einklappen' : 'Details ausklappen'}
          >
            {isExpanded ? (
              <>
                <span>Einklappen</span>
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Anzeigen ({filteredConflicts.length})</span>
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Expanded Conflict Cards */}
      {isExpanded && (
        <div className="p-3.5 sm:p-4 space-y-3 max-h-[480px] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredConflicts.map((conflict) => {
              const machine = db.machines.find((m) => m.id === conflict.machineId);

              return (
                <div
                  key={conflict.id}
                  className="bg-white rounded-xl border border-amber-200 shadow-2xs p-3.5 flex flex-col justify-between gap-3 hover:border-amber-400 transition-colors"
                >
                  {/* Top: Machine info & Date badge */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                          <Cpu className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                            <span className="font-mono text-blue-600">{conflict.machineCode}</span>
                            <span>{conflict.machineName}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {machine?.area || 'Produktion'} • Mindestbesetzung:{' '}
                            <span className="font-bold text-slate-700">{conflict.minStaff} Pers.</span>
                          </div>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-amber-900 font-mono text-[11px] font-bold shrink-0">
                        {conflict.overlappingDaysCount}{' '}
                        {conflict.overlappingDaysCount === 1 ? 'Tag' : 'Tage'}
                      </span>
                    </div>

                    {/* Overlap period indicator */}
                    <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2 text-xs flex items-center justify-between text-amber-950 font-medium mb-3">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-700" />
                        <span>Überschneidungs-Zeitraum:</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        {formatDateDisplay(conflict.startDate)} – {formatDateDisplay(conflict.endDate)}
                      </span>
                    </div>

                    {/* List of overlapping employees on this machine */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                        <UserX className="w-3.5 h-3.5 text-amber-600" />
                        <span>Betroffene Mitarbeiter zeitgleich abwesend:</span>
                      </div>

                      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
                        {conflict.employees.map(({ employee, absenceType, absenceStartDate, absenceEndDate, absenceNote }) => {
                          const config = ABSENCE_CONFIGS[absenceType];
                          return (
                            <div
                              key={employee.id}
                              className="p-2 bg-white hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-700 shrink-0">
                                  {employee.firstName.charAt(0)}
                                  {employee.lastName.charAt(0)}
                                </div>
                                <div className="truncate">
                                  <span className="font-bold text-slate-900">
                                    {employee.lastName}, {employee.firstName}
                                  </span>
                                  <span className="text-[10px] text-slate-400 ml-1.5 font-mono">
                                    ({employee.personnelNumber})
                                  </span>
                                  {absenceNote && (
                                    <span className="text-[10px] text-slate-500 italic block truncate">
                                      „{absenceNote}“
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    config?.badgeClass || 'bg-slate-100 text-slate-700'
                                  }`}
                                  title={config?.label}
                                >
                                  {config?.shortCode || absenceType}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                                  {formatDateDisplay(absenceStartDate)} - {formatDateDisplay(absenceEndDate)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Actions for this conflict */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                    <span className="text-[10px] text-slate-400">
                      Wird ausgeblendet, sobald Urlaub verschoben wird.
                    </span>

                    {onSelectDateRange && (
                      <button
                        type="button"
                        onClick={() => onSelectDateRange(conflict.startDate, conflict.endDate)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold text-[11px] transition-colors cursor-pointer"
                        title="Diesen Zeitraum im Kalender fokussieren"
                      >
                        <CalendarRange className="w-3 h-3 text-amber-700" />
                        <span>Im Kalender anzeigen</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

function formatDateDisplay(isoStr: string): string {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-');
  return `${d}.${m}.${y}`;
}
