import React, { useState, useMemo, useRef } from 'react';
import { DepartmentDatabase, Employee, AbsenceType } from '../types';
import {
  ABSENCE_CONFIGS,
  MONTH_NAMES_DE,
  MONTH_SHORT_DE,
  formatDateKey,
  applyStampToEmployeeDate,
  applyRangeStampToEmployee,
  getEmployeeAnnualStats,
  addDaysToDateStr,
  parseISODate,
  detectMachineVacationConflicts,
} from '../lib/absenceUtils';
import { getISOWeek } from '../lib/rotationEngine';
import { getHolidayForDate, getHolidaysForYear, countVacationWorkingDays, PublicHoliday } from '../lib/holidayUtils';
import { VacationConflictAlertPanel } from './VacationConflictAlertPanel';
import {
  ChevronLeft,
  ChevronRight,
  Eraser,
  CalendarRange,
  Calendar as CalendarIcon,
  CheckCircle2,
  Info,
  Users,
  AlertTriangle,
  HelpCircle,
  Clock,
  Sparkles,
  CalendarCheck,
  Flag,
} from 'lucide-react';

interface YearlyAbsenceCalendarProps {
  db: DepartmentDatabase;
  onUpdateDB: (updated: DepartmentDatabase) => void;
}

type StampSelection = AbsenceType | 'eraser' | null;
type ViewGranularity = 'month' | 'quarter' | 'year';

export const YearlyAbsenceCalendar: React.FC<YearlyAbsenceCalendarProps> = ({ db, onUpdateDB }) => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-11
  const todayKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(
    currentDate.getDate()
  ).padStart(2, '0')}`;

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [viewGranularity, setViewGranularity] = useState<ViewGranularity>('month');
  // Kein Stempel beim Öffnen aktiv, damit ein versehentlicher Klick auf eine Zelle nichts
  // einträgt, bevor man bewusst einen Stempel gewählt hat.
  const [activeStamp, setActiveStamp] = useState<StampSelection>(null);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showHolidays, setShowHolidays] = useState<boolean>(true);

  // Range stamp modal state
  const [rangeModalOpen, setRangeModalOpen] = useState(false);
  const [rangeEmployeeId, setRangeEmployeeId] = useState<string>(db.employees[0]?.id || '');
  const [rangeStartDate, setRangeStartDate] = useState<string>(todayKey);
  const [rangeEndDate, setRangeEndDate] = useState<string>(todayKey);
  const [rangeStamp, setRangeStamp] = useState<AbsenceType>('urlaub');
  const [rangeNote, setRangeNote] = useState<string>('');

  // Mouse drag selection state
  const isMouseDownRef = useRef(false);
  const dragEmployeeIdRef = useRef<string | null>(null);
  // Während eines Drags werden Stempel lokal gesammelt (State für sofortige
  // visuelle Rückmeldung + Ref als Sync-Zugriff in den Maus-Handlern) und
  // erst bei mouseUp in EINEM Save geschickt, statt pro überstrichener
  // Zelle einen eigenen Server-Request auszulösen. Verhindert, dass beim
  // schnellen Ziehen über mehrere Tage viele parallele PUTs entstehen, die
  // sich gegenseitig überholen können (letzte Server-Antwort statt letzte
  // tatsächliche Aktion gewinnt) - ohne dabei die bisherige Live-Vorschau
  // beim Ziehen zu verlieren.
  const isDraggingRef = useRef(false);
  const dragAbsencesRef = useRef(db.absences);
  const [dragPreviewAbsences, setDragPreviewAbsences] = useState<typeof db.absences | null>(null);
  const displayAbsences = dragPreviewAbsences ?? db.absences;

  // Filtered employees
  const employees = useMemo(() => {
    return db.employees
      .filter((e) => e.active)
      .filter((e) => (filterRole === 'all' ? true : e.role === filterRole))
      .filter((e) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          e.firstName.toLowerCase().includes(q) ||
          e.lastName.toLowerCase().includes(q) ||
          e.personnelNumber.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Schichtführer / Teamleiter first, then alphabetical
        const scoreA = a.role === 'teamleiter' ? 3 : a.role === 'schichtfuehrer' ? 2 : 1;
        const scoreB = b.role === 'teamleiter' ? 3 : b.role === 'schichtfuehrer' ? 2 : 1;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.lastName.localeCompare(b.lastName);
      });
  }, [db.employees, filterRole, searchQuery]);

  // Compute days to display based on view granularity
  const daysInView = useMemo(() => {
    const holidaysMap = getHolidaysForYear(selectedYear);

    const days: {
      dateKey: string;
      dayNum: number;
      dayOfWeek: number; // 0 = So, 1 = Mo ... 6 = Sa
      weekdayShort: string;
      isWeekend: boolean;
      monthIndex: number;
      monthName: string;
      kw: number;
      holiday?: PublicHoliday;
    }[] = [];

    const weekdaysDe = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

    const createDayObj = (year: number, m: number, d: number) => {
      const dateKey = formatDateKey(year, m, d);
      const dt = new Date(year, m, d);
      const dow = dt.getDay();
      const iso = getISOWeek(dt);
      const holiday = holidaysMap.get(dateKey);
      return {
        dateKey,
        dayNum: d,
        dayOfWeek: dow,
        weekdayShort: weekdaysDe[dow],
        isWeekend: dow === 0 || dow === 6,
        monthIndex: m,
        monthName: MONTH_SHORT_DE[m],
        kw: iso.kw,
        holiday,
      };
    };

    if (viewGranularity === 'month') {
      const numDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      for (let d = 1; d <= numDays; d++) {
        days.push(createDayObj(selectedYear, selectedMonth, d));
      }
    } else if (viewGranularity === 'quarter') {
      // 3 months around current quarter
      const quarterStartMonth = Math.floor(selectedMonth / 3) * 3;
      for (let m = quarterStartMonth; m < quarterStartMonth + 3; m++) {
        const numDays = new Date(selectedYear, m + 1, 0).getDate();
        for (let d = 1; d <= numDays; d++) {
          days.push(createDayObj(selectedYear, m, d));
        }
      }
    } else {
      // Full year (all 12 months)
      for (let m = 0; m < 12; m++) {
        const numDays = new Date(selectedYear, m + 1, 0).getDate();
        for (let d = 1; d <= numDays; d++) {
          days.push(createDayObj(selectedYear, m, d));
        }
      }
    }

    return days;
  }, [selectedYear, selectedMonth, viewGranularity]);

  // Group days by Calendar Week for header
  const kwGroups = useMemo(() => {
    const groups: { kw: number; count: number }[] = [];
    let currentKw: number | null = null;
    let count = 0;

    daysInView.forEach((d) => {
      if (currentKw === null) {
        currentKw = d.kw;
        count = 1;
      } else if (d.kw === currentKw) {
        count++;
      } else {
        groups.push({ kw: currentKw, count });
        currentKw = d.kw;
        count = 1;
      }
    });

    if (currentKw !== null) {
      groups.push({ kw: currentKw, count });
    }

    return groups;
  }, [daysInView]);

  // Group days by Month for header in quarter and year views
  const monthGroups = useMemo(() => {
    const groups: { monthIndex: number; monthName: string; count: number }[] = [];
    let currentM: number | null = null;
    let count = 0;

    daysInView.forEach((d) => {
      if (currentM === null) {
        currentM = d.monthIndex;
        count = 1;
      } else if (d.monthIndex === currentM) {
        count++;
      } else {
        groups.push({ monthIndex: currentM, monthName: MONTH_NAMES_DE[currentM], count });
        currentM = d.monthIndex;
        count = 1;
      }
    });

    if (currentM !== null) {
      groups.push({ monthIndex: currentM, monthName: MONTH_NAMES_DE[currentM], count });
    }

    return groups;
  }, [daysInView]);

  // Quick stamp a single day — tut nichts, solange kein Stempel bewusst gewählt wurde.
  // Während eines Drags (isDraggingRef) wird nur lokal gesammelt (dragAbsencesRef)
  // und nicht gespeichert - das passiert gebündelt in handleMouseUp.
  const handleCellClick = (employeeId: string, dateKey: string) => {
    if (!activeStamp) return;

    const sourceAbsences = isDraggingRef.current ? dragAbsencesRef.current : db.absences;
    const updatedAbsences = applyStampToEmployeeDate(
      sourceAbsences,
      db.departmentCode,
      employeeId,
      dateKey,
      activeStamp
    );

    if (isDraggingRef.current) {
      dragAbsencesRef.current = updatedAbsences;
      setDragPreviewAbsences(updatedAbsences);
      return;
    }

    onUpdateDB({
      ...db,
      absences: updatedAbsences,
    });
  };

  // Drag stamping
  const handleCellMouseEnter = (employeeId: string, dateKey: string) => {
    if (isMouseDownRef.current && dragEmployeeIdRef.current === employeeId) {
      handleCellClick(employeeId, dateKey);
    }
  };

  const handleCellMouseDown = (employeeId: string, dateKey: string) => {
    isMouseDownRef.current = true;
    dragEmployeeIdRef.current = employeeId;
    isDraggingRef.current = true;
    dragAbsencesRef.current = db.absences;
    handleCellClick(employeeId, dateKey);
  };

  const handleMouseUp = () => {
    isMouseDownRef.current = false;
    dragEmployeeIdRef.current = null;
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      const finalAbsences = dragAbsencesRef.current;
      setDragPreviewAbsences(null);
      // Nur speichern, wenn sich während des Drags tatsächlich etwas geändert hat.
      if (finalAbsences !== db.absences) {
        onUpdateDB({
          ...db,
          absences: finalAbsences,
        });
      }
    }
  };

  // Quick range stamp submission
  const handleSaveRangeStamp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rangeEmployeeId || !rangeStartDate || !rangeEndDate) return;

    const updated = applyRangeStampToEmployee(
      db.absences,
      db.departmentCode,
      rangeEmployeeId,
      rangeStartDate,
      rangeEndDate,
      rangeStamp,
      rangeNote.trim() || undefined
    );

    onUpdateDB({
      ...db,
      absences: updated,
    });
    setRangeModalOpen(false);
    setRangeNote('');
  };

  // Open range modal pre-filled for an employee
  const handleOpenRangeForEmployee = (emp: Employee) => {
    setRangeEmployeeId(emp.id);
    const startOfCurrentMonth = formatDateKey(selectedYear, selectedMonth, 1);
    setRangeStartDate(startOfCurrentMonth);
    setRangeEndDate(startOfCurrentMonth);
    setRangeStamp(activeStamp && activeStamp !== 'eraser' ? activeStamp : 'urlaub');
    setRangeModalOpen(true);
  };

  // Quick week stamp (Mo-Fr of currently selected month day)
  const handleStampWorkWeek = (emp: Employee, kw: number) => {
    // Find all days of this kw in view
    const kwDays = daysInView.filter((d) => d.kw === kw && !d.isWeekend);
    if (kwDays.length === 0) return;

    const firstDay = kwDays[0].dateKey;
    const lastDay = kwDays[kwDays.length - 1].dateKey;

    const updated = applyRangeStampToEmployee(
      db.absences,
      db.departmentCode,
      emp.id,
      firstDay,
      lastDay,
      activeStamp && activeStamp !== 'eraser' ? activeStamp : 'urlaub',
      `Woche KW ${kw}`
    );

    onUpdateDB({
      ...db,
      absences: updated,
    });
  };

  // Calculate day absence totals across department (for warning/capacity indicator)
  // Nutzt displayAbsences, damit Zähler/Konflikte während eines Drags live
  // mitgehen statt erst nach dem Loslassen zu springen.
  const dayAbsenceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    daysInView.forEach((d) => {
      let count = 0;
      displayAbsences.forEach((a) => {
        if (d.dateKey >= a.startDate && d.dateKey <= a.endDate) {
          count++;
        }
      });
      counts[d.dateKey] = count;
    });
    return counts;
  }, [daysInView, displayAbsences]);

  // Fast lookup for machine vacation conflicts: Map<employeeId, Set<conflictDateStr>>
  const employeeConflictDatesMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const conflicts = detectMachineVacationConflicts(db.employees, db.machines, displayAbsences);
    for (const conf of conflicts) {
      for (const empItem of conf.employees) {
        if (!map.has(empItem.employee.id)) {
          map.set(empItem.employee.id, new Set());
        }
        let cur = conf.startDate;
        while (cur <= conf.endDate) {
          map.get(empItem.employee.id)!.add(cur);
          cur = addDaysToDateStr(cur, 1);
        }
      }
    }
    return map;
  }, [db.employees, db.machines, displayAbsences]);

  return (
    <div className="space-y-4" onMouseUp={handleMouseUp}>
      {/* Vacation / Absence Overlap Alert Panel for Machines */}
      <VacationConflictAlertPanel
        db={db}
        onSelectDateRange={(startDate) => {
          const dateObj = parseISODate(startDate);
          setSelectedYear(dateObj.getUTCFullYear());
          setSelectedMonth(dateObj.getUTCMonth());
        }}
        onOpenEditAbsence={(employeeId, startDate, endDate) => {
          setRangeEmployeeId(employeeId);
          setRangeStartDate(startDate);
          setRangeEndDate(endDate);
          setRangeStamp('urlaub');
          setRangeModalOpen(true);
        }}
      />

      {/* Top Banner: Controls, Year & Stamp Palette */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        {/* Navigation & Year Selector */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedYear((y) => y - 1)}
                className="p-1.5 rounded-lg hover:bg-white text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                title="Vorheriges Jahr"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="font-mono font-bold text-base px-2 text-slate-900">
                {selectedYear}
              </span>

              <button
                type="button"
                onClick={() => setSelectedYear((y) => y + 1)}
                className="p-1.5 rounded-lg hover:bg-white text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                title="Nächstes Jahr"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Today Jump */}
            <button
              type="button"
              onClick={() => {
                setSelectedYear(currentYear);
                setSelectedMonth(currentMonth);
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <CalendarCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Heute</span>
            </button>

            {/* Public Holidays Toggle */}
            <button
              type="button"
              onClick={() => setShowHolidays((v) => !v)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                showHolidays
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
              title="Gesetzliche Feiertage im Kalender ein-/ausblenden"
            >
              <Flag className={`w-3.5 h-3.5 ${showHolidays ? 'text-amber-600' : 'text-slate-400'}`} />
              <span>Feiertage</span>
            </button>

            {/* Granularity Switcher: Month / Quarter / Full Year */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-medium">
              <button
                type="button"
                onClick={() => setViewGranularity('month')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  viewGranularity === 'month'
                    ? 'bg-white text-blue-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monat
              </button>
              <button
                type="button"
                onClick={() => setViewGranularity('quarter')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  viewGranularity === 'quarter'
                    ? 'bg-white text-blue-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Quartal
              </button>
              <button
                type="button"
                onClick={() => setViewGranularity('year')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  viewGranularity === 'year'
                    ? 'bg-white text-blue-700 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ganzes Jahr
              </button>
            </div>
          </div>

          {/* Quick Range Stamping Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setRangeEmployeeId(db.employees[0]?.id || '');
                setRangeStartDate(todayKey);
                setRangeEndDate(todayKey);
                setRangeStamp(activeStamp && activeStamp !== 'eraser' ? activeStamp : 'urlaub');
                setRangeModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <CalendarRange className="w-4 h-4" />
              <span>Zeitraum stempeln</span>
            </button>
          </div>
        </div>

        {/* Month Selector Pills (visible if view is month or quarter) */}
        {viewGranularity !== 'year' && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1 border-t border-slate-100 pt-3 text-xs scrollbar-thin">
            {MONTH_NAMES_DE.map((name, idx) => {
              const isSelected = selectedMonth === idx;
              const isCurrent = idx === currentMonth && selectedYear === currentYear;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setSelectedMonth(idx)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-slate-900 text-white font-bold shadow-2xs'
                      : 'hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  {name}
                  {isCurrent && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* STAMP TOOLBAR (Stempel-Leiste) */}
        <div className="pt-3 border-t border-slate-100 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Stempel-Werkzeuge:
              </span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                (Wählen Sie einen Stempel und klicken Sie auf die Tage der Mitarbeiter)
              </span>
            </div>

            {/* Quick helper tip */}
            <div className="text-[11px] text-slate-500 font-medium">
              Tipp: Klick = Stempeln • Nochmaliger Klick = Zurücksetzen
            </div>
          </div>

          {/* Stamp Buttons Palette */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                'urlaub',
                'krank',
                'karenz',
                'zeitausgleich',
                'weiterbildung',
                'sonderurlaub',
              ] as AbsenceType[]
            ).map((type) => {
              const cfg = ABSENCE_CONFIGS[type];
              const isSelected = activeStamp === type;

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActiveStamp(isSelected ? null : type)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs ${
                    isSelected
                      ? 'ring-2 ring-blue-600 ring-offset-2 scale-[1.02] ' + cfg.stampBgClass
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                  title={`${cfg.label} (${cfg.shortCode}): ${cfg.description}`}
                >
                  <span
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-800 border border-slate-300'
                    }`}
                  >
                    {cfg.shortCode}
                  </span>
                  <span>{cfg.label}</span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 ml-0.5" />}
                </button>
              );
            })}

            {/* Radiergummi / Eraser */}
            <button
              type="button"
              onClick={() => setActiveStamp(activeStamp === 'eraser' ? null : 'eraser')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs ${
                activeStamp === 'eraser'
                  ? 'bg-slate-800 text-white border-slate-900 ring-2 ring-slate-800 ring-offset-2'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title="Radierer: Klick auf einen Tag entfernt bestehende Abwesenheiten"
            >
              <Eraser className="w-4 h-4 text-rose-500" />
              <span>Radierer (Löschen)</span>
              {activeStamp === 'eraser' && <CheckCircle2 className="w-3.5 h-3.5 ml-0.5" />}
            </button>
          </div>

          {/* Active Stamp Banner */}
          <div
            className={`border rounded-xl px-3 py-2 flex items-center justify-between text-xs ${
              activeStamp
                ? 'bg-slate-50 border-slate-200 text-slate-700'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">Aktiver Stempel:</span>
              {!activeStamp ? (
                <span className="inline-flex items-center gap-1 font-bold text-amber-800">
                  <HelpCircle className="w-3.5 h-3.5" /> Kein Stempel gewählt
                </span>
              ) : activeStamp === 'eraser' ? (
                <span className="inline-flex items-center gap-1 font-bold text-rose-700">
                  <Eraser className="w-3.5 h-3.5" /> Radierer (Entfernen)
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold ${ABSENCE_CONFIGS[activeStamp].badgeClass}`}
                >
                  <span className="font-black font-mono">[{ABSENCE_CONFIGS[activeStamp].shortCode}]</span>
                  <span>{ABSENCE_CONFIGS[activeStamp].label}</span>
                </span>
              )}
              <span className={activeStamp ? 'text-slate-500 hidden md:inline' : 'hidden md:inline'}>
                —{' '}
                {!activeStamp
                  ? 'Klicks auf Tage bewirken nichts. Erst oben einen Stempel wählen.'
                  : activeStamp === 'eraser'
                  ? 'Klicken Sie auf Tage, um sie zu leeren.'
                  : ABSENCE_CONFIGS[activeStamp].description}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Quick filters */}
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="text-[11px] border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700"
              >
                <option value="all">Alle Rollen ({db.employees.length})</option>
                <option value="teamleiter">Nur Teamleiter</option>
                <option value="schichtfuehrer">Nur Schichtführer</option>
                <option value="mitarbeiter">Mitarbeiter & Springer</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Calendar Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden select-none">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              {/* Top Month Header Row (shown if quarter or year view) */}
              {viewGranularity !== 'month' && (
                <tr className="bg-slate-100/90 text-slate-800 text-xs font-bold border-b border-slate-200">
                  <th className="sticky left-0 z-20 bg-slate-100 py-2 px-3 border-r border-slate-200 w-56 sm:w-64 min-w-[14rem]">
                    Monate
                  </th>
                  {monthGroups.map((mg, i) => (
                    <th
                      key={`${mg.monthIndex}-${i}`}
                      colSpan={mg.count}
                      className="py-1.5 px-2 text-center border-r border-slate-200 uppercase tracking-wider text-[11px] font-mono text-slate-700 bg-slate-100"
                    >
                      {mg.monthName} ({selectedYear})
                    </th>
                  ))}
                  <th className="py-2 px-3 text-center border-l border-slate-200 w-36 min-w-[9rem] bg-slate-100">
                    Jahres-Summen
                  </th>
                </tr>
              )}

              {/* KW (Calendar Week) Header Row */}
              <tr className="bg-slate-50 text-slate-600 text-[11px] font-semibold border-b border-slate-200">
                <th className="sticky left-0 z-20 bg-slate-50 py-1.5 px-3 border-r border-slate-200 text-slate-700 font-bold">
                  {viewGranularity === 'month' ? MONTH_NAMES_DE[selectedMonth] : 'Mitarbeiter'}
                </th>
                {kwGroups.map((kwg, i) => (
                  <th
                    key={`${kwg.kw}-${i}`}
                    colSpan={kwg.count}
                    className="py-1 px-1 text-center border-r border-slate-200 font-mono text-[10px] text-blue-800 bg-blue-50/50"
                  >
                    KW {kwg.kw}
                  </th>
                ))}
                <th className="py-1 px-2 text-center border-l border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
                  Statistik {selectedYear}
                </th>
              </tr>

              {/* Days & Weekdays Header Row */}
              <tr className="bg-white text-slate-700 text-xs border-b border-slate-200">
                <th className="sticky left-0 z-20 bg-white py-2 px-3 border-r border-slate-200 font-medium text-slate-500 text-[11px]">
                  Mitarbeiter ({employees.length})
                </th>

                {daysInView.map((d) => {
                  const isToday = d.dateKey === todayKey;
                  const isHoliday = showHolidays && !!d.holiday;
                  return (
                    <th
                      key={d.dateKey}
                      title={isHoliday ? d.holiday!.name : undefined}
                      className={`p-1 text-center border-r border-slate-200 font-mono min-w-[28px] sm:min-w-[32px] ${
                        isHoliday
                          ? 'bg-amber-50 text-amber-800'
                          : d.isWeekend
                          ? 'bg-slate-100/70 text-slate-400'
                          : 'bg-white text-slate-800'
                      } ${isToday ? 'bg-blue-50 font-bold' : ''}`}
                    >
                      <div className="text-[9px] uppercase leading-none opacity-70">
                        {d.weekdayShort}
                      </div>
                      <div
                        className={`text-xs mt-0.5 ${
                          isToday
                            ? 'w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center mx-auto'
                            : ''
                        }`}
                      >
                        {d.dayNum}
                      </div>
                      {isHoliday && (
                        <div className="text-[8px] leading-none mt-0.5 text-amber-700 truncate max-w-[32px] mx-auto">
                          {d.holiday!.shortName}
                        </div>
                      )}
                    </th>
                  );
                })}

                {/* Total Stats Column */}
                <th className="py-2 px-3 text-center border-l border-slate-200 text-[11px] font-semibold text-slate-700 bg-slate-50">
                  U • K • KT • ZA
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={daysInView.length + 2} className="py-10 text-center text-slate-400">
                    Keine Mitarbeiter gefunden.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const stats = getEmployeeAnnualStats(displayAbsences, emp.id, selectedYear);
                  const empConflictDates = employeeConflictDatesMap.get(emp.id);
                  const hasAnyConflict = empConflictDates && empConflictDates.size > 0;

                  return (
                    <tr key={emp.id} className="hover:bg-blue-50/20 transition-colors">
                      {/* Left Sticky Employee Info */}
                      <td className={`sticky left-0 z-10 bg-white group-hover:bg-slate-50 py-2 px-3 border-r border-slate-200 shadow-xs ${
                        hasAnyConflict ? 'border-l-4 border-l-amber-500' : ''
                      }`}>
                        <div className="flex items-center justify-between gap-1">
                          <div className="truncate">
                            <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                              <span>{emp.lastName}, {emp.firstName}</span>
                              {hasAnyConflict && (
                                <span
                                  className="w-2 h-2 rounded-full bg-amber-500 shrink-0 inline-block animate-pulse"
                                  title="Achtung: Überschneidung mit Kollegen an gleicher Maschine!"
                                />
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5">
                              <span>{emp.personnelNumber}</span>
                              <span>•</span>
                              <span className="capitalize">{emp.role}</span>
                            </div>
                          </div>

                          {/* Quick range button on hover */}
                          <button
                            type="button"
                            onClick={() => handleOpenRangeForEmployee(emp)}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors"
                            title={`Zeitraum für ${emp.firstName} ${emp.lastName} stempeln`}
                          >
                            <CalendarRange className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Day Cells */}
                      {daysInView.map((d) => {
                        // Check if employee has absence on this day
                        const absence = displayAbsences.find(
                          (a) =>
                            a.employeeId === emp.id &&
                            d.dateKey >= a.startDate &&
                            d.dateKey <= a.endDate
                        );

                        const isToday = d.dateKey === todayKey;
                        const isConflictDay = empConflictDates?.has(d.dateKey);
                        const isHoliday = showHolidays && !!d.holiday;

                        return (
                          <td
                            key={d.dateKey}
                            onMouseDown={() => handleCellMouseDown(emp.id, d.dateKey)}
                            onMouseEnter={() => handleCellMouseEnter(emp.id, d.dateKey)}
                            className={`p-0.5 border-r border-slate-200 text-center transition-colors cursor-pointer hover:ring-1 hover:ring-blue-400 ${
                              isConflictDay
                                ? 'bg-amber-100/60 ring-1 ring-amber-400/80'
                                : isHoliday
                                ? 'bg-amber-50/70'
                                : d.isWeekend
                                ? 'bg-slate-100/50'
                                : 'bg-white'
                            } ${isToday ? 'ring-1 ring-blue-300' : ''}`}
                            title={
                              isConflictDay
                                ? `⚠️ MASCHINEN-ÜBERSCHNEIDUNG: ${emp.firstName} ${emp.lastName} hat am ${d.dateKey} zeitgleich mit einem anderen Mitarbeiter an der Maschine Urlaub/Abwesenheit!`
                                : absence
                                ? `${emp.firstName} ${emp.lastName} • ${d.dateKey}: ${
                                    ABSENCE_CONFIGS[absence.type]?.label || absence.type
                                  }${absence.note ? ` (${absence.note})` : ''}${
                                    isHoliday ? ` • Feiertag: ${d.holiday!.name}` : ''
                                  }`
                                : isHoliday
                                ? `${emp.firstName} ${emp.lastName} • ${d.dateKey}: Feiertag (${d.holiday!.name})`
                                : `${emp.firstName} ${emp.lastName} • ${d.dateKey} (Klicken zum Stempeln)`
                            }
                          >
                            {absence ? (
                              <div
                                className={`w-full py-1.5 rounded text-[10px] font-black font-mono transition-transform hover:scale-105 shadow-2xs relative ${
                                  ABSENCE_CONFIGS[absence.type]?.cellBgClass || 'bg-slate-600 text-white'
                                } ${isConflictDay ? 'outline-2 outline-amber-500' : ''}`}
                              >
                                {ABSENCE_CONFIGS[absence.type]?.shortCode || 'X'}
                                {isConflictDay && (
                                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 border border-white" />
                                )}
                              </div>
                            ) : (
                              <div className="w-full h-7 rounded hover:bg-slate-100/80 transition-colors flex items-center justify-center text-[10px] text-slate-300 opacity-0 hover:opacity-100">
                                +
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Right Annual Stats Column */}
                      <td className="py-2 px-3 border-l border-slate-200 text-center bg-slate-50/70 font-mono text-[11px]">
                        <div className="flex items-center justify-center gap-1.5">
                          <span
                            className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold"
                            title={`Urlaub: ${stats.urlaub} Kalendertage (davon ${stats.urlaubWorkingDays} echte Arbeitstage ohne Wochenenden/Feiertage)`}
                          >
                            U: {stats.urlaub}
                          </span>
                          <span
                            className="px-1.5 py-0.5 rounded bg-red-100 text-red-900 border border-red-300 font-bold"
                            title={`Krank: ${stats.krank} Tage`}
                          >
                            K: {stats.krank}
                          </span>
                          {stats.karenz > 0 && (
                            <span
                              className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 font-bold"
                              title={`Karenz: ${stats.karenz} Tage`}
                            >
                              KT: {stats.karenz}
                            </span>
                          )}
                          {stats.zeitausgleich > 0 && (
                            <span
                              className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-300 font-bold"
                              title={`Zeitausgleich: ${stats.zeitausgleich} Tage`}
                            >
                              ZA: {stats.zeitausgleich}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Total Absent per Day Row (Department Capacity Watch) */}
            <tfoot>
              <tr className="bg-slate-100 text-slate-700 text-[10px] font-bold border-t-2 border-slate-300">
                <td className="sticky left-0 z-10 bg-slate-100 py-2 px-3 border-r border-slate-200 font-semibold text-slate-800">
                  Abwesend gesamt (Tag)
                </td>
                {daysInView.map((d) => {
                  const count = dayAbsenceCounts[d.dateKey] || 0;
                  const isHigh = count >= 3;
                  return (
                    <td
                      key={d.dateKey}
                      className={`p-1 text-center border-r border-slate-200 font-mono ${
                        isHigh ? 'bg-amber-100 text-amber-900 font-bold' : ''
                      }`}
                      title={`${count} Mitarbeiter abwesend am ${d.dateKey}`}
                    >
                      {count > 0 ? count : '-'}
                    </td>
                  );
                })}
                <td className="py-2 px-3 text-center border-l border-slate-200 text-slate-500 font-mono text-[10px]">
                  Tagessummen
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Range Stamp Modal (Zeitraum stempeln) */}
      {rangeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <form
            onSubmit={handleSaveRangeStamp}
            className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <CalendarRange className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Zeitraum stempeln
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRangeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Employee Selection */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Mitarbeiter auswählen *
              </label>
              <select
                required
                value={rangeEmployeeId}
                onChange={(e) => setRangeEmployeeId(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-blue-500 bg-white"
              >
                {db.employees
                  .filter((e) => e.active)
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.lastName}, {emp.firstName} ({emp.personnelNumber} - {emp.role})
                    </option>
                  ))}
              </select>
            </div>

            {/* Stamp Type */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Stempel-Typ *
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    'urlaub',
                    'krank',
                    'karenz',
                    'zeitausgleich',
                    'weiterbildung',
                    'sonderurlaub',
                  ] as AbsenceType[]
                ).map((t) => {
                  const cfg = ABSENCE_CONFIGS[t];
                  const isSel = rangeStamp === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setRangeStamp(t)}
                      className={`p-2 rounded-lg border text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                        isSel
                          ? 'border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-500'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-[10px]">{cfg.shortCode}</span>
                        <span>{cfg.label}</span>
                      </div>
                      {isSel && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Start and End Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Von Datum *
                </label>
                <input
                  type="date"
                  required
                  value={rangeStartDate}
                  onChange={(e) => setRangeStartDate(e.target.value)}
                  className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2.5 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Bis Datum *
                </label>
                <input
                  type="date"
                  required
                  value={rangeEndDate}
                  onChange={(e) => setRangeEndDate(e.target.value)}
                  className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2.5 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <span className="font-semibold">Schnellwahl:</span>
              <button
                type="button"
                onClick={() => {
                  setRangeEndDate(addDaysToDateStr(rangeStartDate, 4)); // 5 days (Mo-Fr)
                }}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                +1 Woche (5 Tage)
              </button>
              <button
                type="button"
                onClick={() => {
                  setRangeEndDate(addDaysToDateStr(rangeStartDate, 11)); // 2 weeks
                }}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                +2 Wochen
              </button>
            </div>

            {/* Optional Note */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Notiz / Grund (Optional)
              </label>
              <input
                type="text"
                value={rangeNote}
                onChange={(e) => setRangeNote(e.target.value)}
                placeholder="Z.B. Sommerurlaub genehmigt, AU bis Freitag..."
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:border-blue-500"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setRangeModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium cursor-pointer shadow-xs"
              >
                Zeitraum stempeln
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
