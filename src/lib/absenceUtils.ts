import { Absence, AbsenceType } from '../types';
import { isWorkingDay } from './holidayUtils';

export interface AbsenceTypeConfig {
  type: AbsenceType;
  label: string;
  shortCode: string;
  description: string;
  badgeClass: string;
  cellBgClass: string;
  stampBgClass: string;
  textColor: string;
  borderColor: string;
}

export const ABSENCE_CONFIGS: Record<AbsenceType, AbsenceTypeConfig> = {
  urlaub: {
    type: 'urlaub',
    label: 'Urlaub',
    shortCode: 'U',
    description: 'Erholungsurlaub / Urlaubstage',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    cellBgClass: 'bg-emerald-500 text-white font-bold',
    stampBgClass: 'bg-emerald-600 text-white hover:bg-emerald-700',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-300',
  },
  krank: {
    type: 'krank',
    label: 'Krank / AU',
    shortCode: 'K',
    description: 'Arbeitsunfähigkeit / Attest',
    badgeClass: 'bg-red-100 text-red-900 border-red-300',
    cellBgClass: 'bg-red-500 text-white font-bold',
    stampBgClass: 'bg-red-600 text-white hover:bg-red-700',
    textColor: 'text-red-700',
    borderColor: 'border-red-300',
  },
  karenz: {
    type: 'karenz',
    label: 'Karenztag',
    shortCode: 'KT',
    description: 'Karenztag / Pflegefreistellung / Elternzeit',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-300',
    cellBgClass: 'bg-purple-500 text-white font-bold',
    stampBgClass: 'bg-purple-600 text-white hover:bg-purple-700',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-300',
  },
  zeitausgleich: {
    type: 'zeitausgleich',
    label: 'Frei / ZA',
    shortCode: 'ZA',
    description: 'Zeitausgleich / Überstundenfrei',
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-300',
    cellBgClass: 'bg-sky-500 text-white font-bold',
    stampBgClass: 'bg-sky-600 text-white hover:bg-sky-700',
    textColor: 'text-sky-700',
    borderColor: 'border-sky-300',
  },
  weiterbildung: {
    type: 'weiterbildung',
    label: 'Weiterbildung',
    shortCode: 'W',
    description: 'Schulung / Qualifikation / Lehrgang',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    cellBgClass: 'bg-amber-500 text-white font-bold',
    stampBgClass: 'bg-amber-600 text-white hover:bg-amber-700',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-300',
  },
  sonderurlaub: {
    type: 'sonderurlaub',
    label: 'Sonderurlaub',
    shortCode: 'SU',
    description: 'Sonderurlaub (z.B. Umzug, Hochzeit, Jubiläum)',
    badgeClass: 'bg-teal-100 text-teal-900 border-teal-300',
    cellBgClass: 'bg-teal-500 text-white font-bold',
    stampBgClass: 'bg-teal-600 text-white hover:bg-teal-700',
    textColor: 'text-teal-700',
    borderColor: 'border-teal-300',
  },
};

/**
 * Format a Date object as YYYY-MM-DD string in local UTC
 */
export function formatDateKey(year: number, monthZeroBased: number, day: number): string {
  const m = String(monthZeroBased + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * Get date string from Date object
 */
export function toISODateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses YYYY-MM-DD into a Date (at midnight UTC to prevent timezone shifts)
 */
export function parseISODate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Adds days to an ISO date string
 */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const d = parseISODate(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Find what absence (if any) applies to an employee on a specific date YYYY-MM-DD
 */
export function getAbsenceOnDate(
  absences: Absence[],
  employeeId: string,
  dateStr: string
): Absence | undefined {
  return absences.find(
    (a) => a.employeeId === employeeId && dateStr >= a.startDate && dateStr <= a.endDate
  );
}

/**
 * Fast lookup map of dateStr -> Absence for a specific employee and year
 */
export function buildEmployeeYearAbsenceMap(
  absences: Absence[],
  employeeId: string,
  year: number
): Map<string, Absence> {
  const map = new Map<string, Absence>();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const relevant = absences.filter(
    (a) => a.employeeId === employeeId && a.startDate <= yearEnd && a.endDate >= yearStart
  );

  for (const abs of relevant) {
    let curr = abs.startDate < yearStart ? yearStart : abs.startDate;
    const end = abs.endDate > yearEnd ? yearEnd : abs.endDate;
    while (curr <= end) {
      map.set(curr, abs);
      curr = addDaysToDateStr(curr, 1);
    }
  }

  return map;
}

/**
 * Consolidate a list of individual dates of the same absence type into contiguous intervals
 */
export function consolidateDatesToAbsences(
  datesByType: Map<AbsenceType, string[]>,
  employeeId: string,
  deptCode: string,
  existingAbsences: Absence[]
): Absence[] {
  const result: Absence[] = [];

  datesByType.forEach((dates, type) => {
    if (dates.length === 0) return;
    const sorted = [...new Set(dates)].sort();

    let rangeStart = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i <= sorted.length; i++) {
      const curr = sorted[i];
      const isNextDay = curr && addDaysToDateStr(prev, 1) === curr;

      if (!isNextDay) {
        // Find if an existing note applied to this range
        const matchingExisting = existingAbsences.find(
          (a) => a.employeeId === employeeId && a.type === type && (a.startDate === rangeStart || a.endDate === prev)
        );

        result.push({
          id: `abs-${employeeId}-${rangeStart}-${prev}`,
          departmentCode: deptCode,
          employeeId,
          type,
          startDate: rangeStart,
          endDate: prev,
          note: matchingExisting?.note,
          substituteEmployeeId: matchingExisting?.substituteEmployeeId,
        });

        if (curr) {
          rangeStart = curr;
          prev = curr;
        }
      } else {
        prev = curr;
      }
    }
  });

  return result;
}

/**
 * Apply a stamp (or eraser) to a single date for an employee.
 * Rebuilds and consolidates the employee's absences cleanly.
 */
export function applyStampToEmployeeDate(
  allAbsences: Absence[],
  deptCode: string,
  employeeId: string,
  dateStr: string,
  stamp: AbsenceType | 'eraser'
): Absence[] {
  // 1. Separate this employee's absences from all other employees
  const otherEmployeesAbsences = allAbsences.filter((a) => a.employeeId !== employeeId);
  const empAbsences = allAbsences.filter((a) => a.employeeId === employeeId);

  // 2. Expand all dates currently covered for this employee into a Map<dateStr, AbsenceType>
  const dateTypeMap = new Map<string, AbsenceType>();
  for (const a of empAbsences) {
    let curr = a.startDate;
    while (curr <= a.endDate) {
      dateTypeMap.set(curr, a.type);
      curr = addDaysToDateStr(curr, 1);
    }
  }

  // 3. Apply stamp
  if (stamp === 'eraser') {
    dateTypeMap.delete(dateStr);
  } else {
    // If already has this stamp, toggle it off!
    if (dateTypeMap.get(dateStr) === stamp) {
      dateTypeMap.delete(dateStr);
    } else {
      dateTypeMap.set(dateStr, stamp);
    }
  }

  // 4. Regroup dates by type
  const datesByType = new Map<AbsenceType, string[]>();
  dateTypeMap.forEach((type, dStr) => {
    if (!datesByType.has(type)) datesByType.set(type, []);
    datesByType.get(type)!.push(dStr);
  });

  // 5. Consolidate into new ranges
  const newEmpAbsences = consolidateDatesToAbsences(datesByType, employeeId, deptCode, empAbsences);

  return [...otherEmployeesAbsences, ...newEmpAbsences];
}

/**
 * Apply stamp to a range of dates (e.g. from Monday to Friday)
 */
export function applyRangeStampToEmployee(
  allAbsences: Absence[],
  deptCode: string,
  employeeId: string,
  startDateStr: string,
  endDateStr: string,
  stamp: AbsenceType | 'eraser',
  note?: string,
  substituteId?: string
): Absence[] {
  const otherEmployeesAbsences = allAbsences.filter((a) => a.employeeId !== employeeId);
  const empAbsences = allAbsences.filter((a) => a.employeeId === employeeId);

  const dateTypeMap = new Map<string, AbsenceType>();
  for (const a of empAbsences) {
    let curr = a.startDate;
    while (curr <= a.endDate) {
      dateTypeMap.set(curr, a.type);
      curr = addDaysToDateStr(curr, 1);
    }
  }

  // Normalize range
  let start = startDateStr < endDateStr ? startDateStr : endDateStr;
  const end = startDateStr < endDateStr ? endDateStr : startDateStr;

  while (start <= end) {
    if (stamp === 'eraser') {
      dateTypeMap.delete(start);
    } else {
      dateTypeMap.set(start, stamp);
    }
    start = addDaysToDateStr(start, 1);
  }

  const datesByType = new Map<AbsenceType, string[]>();
  dateTypeMap.forEach((type, dStr) => {
    if (!datesByType.has(type)) datesByType.set(type, []);
    datesByType.get(type)!.push(dStr);
  });

  const newEmpAbsences = consolidateDatesToAbsences(datesByType, employeeId, deptCode, empAbsences);

  if (note || substituteId) {
    newEmpAbsences.forEach((a) => {
      if (a.startDate >= startDateStr && a.endDate <= endDateStr) {
        if (note) a.note = note;
        if (substituteId) a.substituteEmployeeId = substituteId;
      }
    });
  }

  return [...otherEmployeesAbsences, ...newEmpAbsences];
}

/**
 * Calculate annual statistics for an employee (total days per absence type in a year)
 * Urlaub and Zeitausgleich count actual working days (excluding weekends and legal holidays),
 * while sickness/karenz can reflect calendar days.
 */
export function getEmployeeAnnualStats(
  absences: Absence[],
  employeeId: string,
  year: number
): Record<AbsenceType, number> & { urlaubWorkingDays: number } {
  const stats: Record<AbsenceType, number> & { urlaubWorkingDays: number } = {
    urlaub: 0,
    urlaubWorkingDays: 0,
    krank: 0,
    karenz: 0,
    zeitausgleich: 0,
    weiterbildung: 0,
    sonderurlaub: 0,
  };

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const empAbs = absences.filter(
    (a) => a.employeeId === employeeId && a.startDate <= yearEnd && a.endDate >= yearStart
  );

  empAbs.forEach((a) => {
    let curr = a.startDate < yearStart ? yearStart : a.startDate;
    const e = a.endDate > yearEnd ? yearEnd : a.endDate;

    while (curr <= e) {
      if (stats[a.type] !== undefined) {
        stats[a.type] += 1;
      }
      // For vacation, also track working days (not weekend, not legal holiday)
      if (a.type === 'urlaub') {
        if (isWorkingDay(curr)) {
          stats.urlaubWorkingDays += 1;
        }
      }
      curr = addDaysToDateStr(curr, 1);
    }
  });

  return stats;
}

export const MONTH_NAMES_DE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

export const MONTH_SHORT_DE = [
  'Jan',
  'Feb',
  'Mär',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Dez',
];

/**
 * Interface representing an overlap conflict between employees on machines
 * where they work (preferredMachineId / assigned machine).
 */
export interface VacationMachineConflict {
  id: string; // Unique conflict key
  machineId: string;
  machineName: string;
  machineCode: string;
  minStaff: number;
  startDate: string; // First overlapping day (YYYY-MM-DD)
  endDate: string; // Last overlapping day in this block
  overlappingDaysCount: number;
  employees: {
    employee: import('../types').Employee;
    absenceType: AbsenceType;
    absenceStartDate: string;
    absenceEndDate: string;
    absenceNote?: string;
  }[];
}

/**
 * Checks for vacation/absence overlaps on machines where employees work.
 * Specifically checks the machines where workers are assigned/work (preferredMachineId or qualifiedMachineIds)
 * to detect when multiple employees assigned to that machine take vacation/absence at the same time,
 * causing an operational conflict.
 */
export function detectMachineVacationConflicts(
  employees: import('../types').Employee[],
  machines: import('../types').Machine[],
  absences: Absence[],
  checkAbsenceTypes: AbsenceType[] = ['urlaub', 'sonderurlaub', 'zeitausgleich', 'karenz']
): VacationMachineConflict[] {
  const activeEmployees = employees.filter((e) => e.active);
  const activeMachines = machines.filter((m) => m.status === 'aktiv');

  // Filter relevant absences (vacations, special leave, compensatory time off, parental)
  const relevantAbsences = absences.filter((a) => checkAbsenceTypes.includes(a.type));
  if (relevantAbsences.length < 2 || activeMachines.length === 0) {
    return [];
  }

  // 1. Build a map of machineId -> list of workers who normally work at this machine
  // (We check preferredMachineId, or fallback to first qualifiedMachineId if no preferred is set)
  const machineWorkersMap = new Map<string, import('../types').Employee[]>();
  for (const m of activeMachines) {
    machineWorkersMap.set(m.id, []);
  }

  for (const emp of activeEmployees) {
    // Determine the machine(s) where this employee actively works
    const targetMachineIds: string[] = [];
    if (emp.preferredMachineId) {
      targetMachineIds.push(emp.preferredMachineId);
    } else if (emp.qualifiedMachineIds && emp.qualifiedMachineIds.length > 0) {
      // If no primary preferred machine, their first/primary assigned machine
      targetMachineIds.push(emp.qualifiedMachineIds[0]);
    }

    for (const mId of targetMachineIds) {
      if (machineWorkersMap.has(mId)) {
        machineWorkersMap.get(mId)!.push(emp);
      }
    }
  }

  const conflicts: VacationMachineConflict[] = [];

  // 2. For each machine that has at least 2 workers, check date overlaps
  for (const machine of activeMachines) {
    const workersAtMachine = machineWorkersMap.get(machine.id) || [];
    if (workersAtMachine.length < 2) continue;

    const workerIds = new Set(workersAtMachine.map((w) => w.id));

    // Get all relevant absences for workers of this machine
    const machineAbsences = relevantAbsences.filter((a) => workerIds.has(a.employeeId));
    if (machineAbsences.length < 2) continue;

    // Collect all unique dates with absences for these workers
    const dateToAbsences = new Map<
      string,
      {
        employee: import('../types').Employee;
        absence: Absence;
      }[]
    >();

    for (const abs of machineAbsences) {
      const emp = workersAtMachine.find((w) => w.id === abs.employeeId);
      if (!emp) continue;

      let curr = abs.startDate;
      while (curr <= abs.endDate) {
        if (!dateToAbsences.has(curr)) {
          dateToAbsences.set(curr, []);
        }
        // Avoid duplicate entries for the same employee on the same date
        const existing = dateToAbsences.get(curr)!;
        if (!existing.some((x) => x.employee.id === emp.id)) {
          existing.push({ employee: emp, absence: abs });
        }
        curr = addDaysToDateStr(curr, 1);
      }
    }

    // Find dates where at least 2 workers on this machine are absent simultaneously
    const conflictDates: string[] = [];
    dateToAbsences.forEach((list, dateStr) => {
      if (list.length >= 2) {
        conflictDates.push(dateStr);
      }
    });

    if (conflictDates.length === 0) continue;

    conflictDates.sort();

    // Group contiguous date blocks into conflict periods
    let blockStart = conflictDates[0];
    let prev = conflictDates[0];
    let currentInvolvedEmployees = new Map<
      string,
      {
        employee: import('../types').Employee;
        absenceType: AbsenceType;
        absenceStartDate: string;
        absenceEndDate: string;
        absenceNote?: string;
      }
    >();

    const addEmployeesForDate = (dateStr: string) => {
      const items = dateToAbsences.get(dateStr) || [];
      for (const item of items) {
        if (!currentInvolvedEmployees.has(item.employee.id)) {
          currentInvolvedEmployees.set(item.employee.id, {
            employee: item.employee,
            absenceType: item.absence.type,
            absenceStartDate: item.absence.startDate,
            absenceEndDate: item.absence.endDate,
            absenceNote: item.absence.note,
          });
        }
      }
    };

    addEmployeesForDate(blockStart);

    const flushBlock = (start: string, end: string) => {
      const d1 = parseISODate(start);
      const d2 = parseISODate(end);
      const daysCount = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // Minimum required staffing on any active shift of this machine
      const minStaff = Math.max(
        machine.minStaffPerShift.frueh || 1,
        machine.minStaffPerShift.spaet || 0,
        machine.minStaffPerShift.nacht || 0
      );

      conflicts.push({
        id: `conflict-${machine.id}-${start}-${end}`,
        machineId: machine.id,
        machineName: machine.name,
        machineCode: machine.code,
        minStaff,
        startDate: start,
        endDate: end,
        overlappingDaysCount: daysCount,
        employees: Array.from(currentInvolvedEmployees.values()),
      });
    };

    for (let i = 1; i < conflictDates.length; i++) {
      const curr = conflictDates[i];
      const isConsecutive = addDaysToDateStr(prev, 1) === curr;

      if (isConsecutive) {
        addEmployeesForDate(curr);
        prev = curr;
      } else {
        flushBlock(blockStart, prev);
        blockStart = curr;
        prev = curr;
        currentInvolvedEmployees = new Map();
        addEmployeesForDate(curr);
      }
    }

    flushBlock(blockStart, prev);
  }

  // Sort conflicts by start date ascending
  return conflicts.sort((a, b) => a.startDate.localeCompare(b.startDate));
}
