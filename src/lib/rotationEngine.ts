import {
  DepartmentDatabase,
  Employee,
  Machine,
  Absence,
  ShiftId,
  WeekPlanSchedule,
  ManualShiftOverride,
} from '../types';

export const SHIFT_NAMES: Record<ShiftId, string> = {
  frueh: 'Frühschicht (06:00 - 14:00)',
  spaet: 'Spätschicht / Mittag (14:00 - 22:00)',
  nacht: 'Nachtschicht (22:00 - 06:00)',
  frei: 'Freischicht / Zeitausgleich',
};

export const SHIFT_SHORT_NAMES: Record<ShiftId, string> = {
  frueh: 'Früh',
  spaet: 'Spät/Mittag',
  nacht: 'Nacht',
  frei: 'Frei',
};

/**
 * Standard-3-Schicht-Rhythmus der Industrie:
 * 1. Frühschicht -> 2. Nachtschicht -> 3. Spätschicht / Mittagsschicht -> wieder Frühschicht.
 * (Wer jetzt Nachtschicht hat, hat nächste Woche Mittag und die Woche darauf Früh)
 */
export const DEFAULT_3_SHIFT_SEQUENCE: ShiftId[] = ['frueh', 'nacht', 'spaet'];

export const SHIFT_COLORS: Record<ShiftId, { badge: string; border: string; bg: string; text: string }> = {
  frueh: {
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
    border: 'border-amber-400',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
  },
  spaet: {
    badge: 'bg-blue-100 text-blue-900 border-blue-300',
    border: 'border-blue-400',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
  },
  nacht: {
    badge: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    border: 'border-indigo-400',
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
  },
  frei: {
    badge: 'bg-slate-100 text-slate-700 border-slate-300',
    border: 'border-slate-300',
    bg: 'bg-slate-50',
    text: 'text-slate-600',
  },
};

export const WEEKDAYS = [
  { key: 'mo', label: 'Montag', short: 'Mo' },
  { key: 'di', label: 'Dienstag', short: 'Di' },
  { key: 'mi', label: 'Mittwoch', short: 'Mi' },
  { key: 'do', label: 'Donnerstag', short: 'Do' },
  { key: 'fr', label: 'Freitag', short: 'Fr' },
  { key: 'sa', label: 'Samstag', short: 'Sa' },
  { key: 'so', label: 'Sonntag', short: 'So' },
];

/**
 * Calculates ISO 8601 week number and year
 */
export function getISOWeek(date: Date): { year: number; kw: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number, make Sunday's day number 7
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), kw: weekNo };
}

/**
 * Liefert die Anzahl der ISO-8601-Kalenderwochen eines Jahres (52 oder 53).
 * Der 28. Dezember liegt immer in der letzten ISO-Woche des Jahres.
 */
export function getWeeksInISOYear(year: number): number {
  return getISOWeek(new Date(Date.UTC(year, 11, 28))).kw;
}

/**
 * Returns Monday and Sunday Date for a given Year and ISO week
 */
export function getDateRangeForKW(year: number, kw: number): { start: Date; end: Date; startStr: string; endStr: string } {
  // Simple algorithm to find the Monday of week KW
  const simple = new Date(Date.UTC(year, 0, 1 + (kw - 1) * 7));
  const dow = simple.getUTCDay();
  const ISOweekStart = simple;
  if (dow <= 4) {
    ISOweekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  } else {
    ISOweekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  }

  const monday = new Date(ISOweekStart);
  const sunday = new Date(ISOweekStart);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const fmt = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${day}.${m}.${y}`;
  };

  return {
    start: monday,
    end: sunday,
    startStr: fmt(monday),
    endStr: fmt(sunday),
  };
}

/**
 * Calculates which shift an employee is scheduled for in a given ISO week
 * Based on custom sequence, rotation offset, excluded shifts, and role
 */
export function calculateEmployeeShiftForWeek(
  emp: Employee,
  year: number,
  kw: number,
  manualOverrides: ManualShiftOverride[] = []
): ShiftId {
  // 1. Check if there's a direct manual override for this employee in this week
  const override = manualOverrides.find(
    (o) => o.year === year && o.kw === kw && o.assignedEmployeeIds.includes(emp.id) && o.dayIndex === undefined
  );
  if (override) {
    return override.shiftId;
  }

  // 2. Base sequence logic
  const sequence: ShiftId[] =
    emp.customSequence && emp.customSequence.length > 0
      ? emp.customSequence
      : DEFAULT_3_SHIFT_SEQUENCE;

  const cycleLength = sequence.length;
  if (cycleLength === 0) return 'frueh';

  // Rotation offset: week index calculation
  // We use kw + rotationOffsetWeeks
  const offset = emp.rotationOffsetWeeks || 0;
  const index = Math.abs((kw - 1 + offset) % cycleLength);
  let assigned: ShiftId = sequence[index];

  // If assigned shift is in excludedShifts, fall back to first non-excluded shift in sequence
  if (emp.excludedShifts && emp.excludedShifts.includes(assigned)) {
    const valid = sequence.find((s) => !emp.excludedShifts.includes(s));
    assigned = valid || 'frueh';
  }

  return assigned;
}

/**
 * Check employee absences for a given week
 */
export function getEmployeeAbsenceForWeek(
  employeeId: string,
  absences: Absence[],
  weekStart: Date,
  weekEnd: Date
): { isAbsent: boolean; absence?: Absence; affectedDaysText: string; dailyAbsence: boolean[] } {
  const dailyAbsence: boolean[] = [false, false, false, false, false, false, false];
  let matchedAbsence: Absence | undefined;

  for (let d = 0; d < 7; d++) {
    const currentDay = new Date(weekStart);
    currentDay.setUTCDate(weekStart.getUTCDate() + d);
    const dayStr = currentDay.toISOString().split('T')[0];

    const found = absences.find(
      (a) => a.employeeId === employeeId && dayStr >= a.startDate && dayStr <= a.endDate
    );

    if (found) {
      dailyAbsence[d] = true;
      if (!matchedAbsence) matchedAbsence = found;
    }
  }

  const isAbsent = dailyAbsence.some((v) => v);
  if (!isAbsent || !matchedAbsence) {
    return { isAbsent: false, affectedDaysText: '', dailyAbsence };
  }

  // Determine affected days description (e.g. "Mo-Fr", "Mo, Di", "Ganze Woche")
  const activeDays = dailyAbsence
    .map((active, idx) => (active ? WEEKDAYS[idx].short : null))
    .filter(Boolean) as string[];

  let affectedDaysText = activeDays.join(', ');
  if (dailyAbsence.slice(0, 5).every((v) => v) && !dailyAbsence[5] && !dailyAbsence[6]) {
    affectedDaysText = 'Mo - Fr';
  } else if (dailyAbsence.every((v) => v)) {
    affectedDaysText = 'Ganze Woche (Mo-So)';
  }

  return { isAbsent: true, absence: matchedAbsence, affectedDaysText, dailyAbsence };
}

/**
 * Generates the complete weekly schedule for a given department and week
 */
export function generateWeekSchedule(
  db: DepartmentDatabase,
  year: number,
  kw: number
): WeekPlanSchedule {
  const { startStr, endStr, start, end } = getDateRangeForKW(year, kw);
  const activeEmployees = db.employees.filter((e) => e.active);

  // Group employees by role
  const teamLeaders = activeEmployees.filter((e) => e.role === 'teamleiter');
  const shiftLeaders = activeEmployees.filter((e) => e.role === 'schichtfuehrer');
  const workers = activeEmployees.filter((e) => e.role === 'mitarbeiter' || e.role === 'springer');

  // Track absences
  const absentEmployees: WeekPlanSchedule['absentEmployees'] = [];
  const absentEmployeeIds = new Set<string>();

  activeEmployees.forEach((emp) => {
    const abs = getEmployeeAbsenceForWeek(emp.id, db.absences, start, end);
    if (abs.isAbsent && abs.absence) {
      absentEmployees.push({
        employee: emp,
        type: abs.absence.type,
        affectedDaysText: abs.affectedDaysText,
      });
      // If absent for 3 or more days of the week, count as full-week absent for auto staffing
      const count = abs.dailyAbsence.filter(Boolean).length;
      if (count >= 3) {
        absentEmployeeIds.add(emp.id);
      }
    }
  });

  // 1. Teamleiter selection
  const assignedTeamLeader = teamLeaders.find((tl) => !absentEmployeeIds.has(tl.id)) || teamLeaders[0];

  // 2. Schichtführer distribution per shift
  const assignedShiftLeaders: WeekPlanSchedule['shiftLeaders'] = {
    frueh: undefined,
    spaet: undefined,
    nacht: undefined,
  };

  // Find shift leaders according to rotation
  const leadersByShift: Record<ShiftId, Employee[]> = {
    frueh: [],
    spaet: [],
    nacht: [],
    frei: [],
  };

  shiftLeaders.forEach((sf) => {
    const shift = calculateEmployeeShiftForWeek(sf, year, kw, db.manualOverrides);
    leadersByShift[shift].push(sf);
  });

  // Assign primary leader per active shift
  (['frueh', 'spaet', 'nacht'] as const).forEach((s) => {
    // Check manual override for shift leader
    const leaderOverride = db.manualOverrides.find(
      (o) => o.year === year && o.kw === kw && o.shiftId === s && o.note === 'shift-leader'
    );
    if (leaderOverride && leaderOverride.assignedEmployeeIds.length > 0) {
      const manualLeaders = db.employees.filter((e) => leaderOverride.assignedEmployeeIds.includes(e.id));
      if (manualLeaders.length > 0) {
        assignedShiftLeaders[s] = manualLeaders.length === 1 ? manualLeaders[0] : manualLeaders;
        return;
      }
    }

    // If multiple shift leaders are rotated into this shift, include them all
    const available = leadersByShift[s].filter((sf) => !absentEmployeeIds.has(sf.id));
    if (available.length > 1) {
      assignedShiftLeaders[s] = available;
    } else if (available.length === 1) {
      assignedShiftLeaders[s] = available[0];
    } else if (leadersByShift[s].length > 0) {
      assignedShiftLeaders[s] = leadersByShift[s].length === 1 ? leadersByShift[s][0] : leadersByShift[s];
    }
  });

  // If a shift has no leader due to absence, try to pick from 'frei' or fallback
  (['frueh', 'spaet', 'nacht'] as const).forEach((s) => {
    if (!assignedShiftLeaders[s]) {
      const assignedIds = new Set<string>();
      Object.values(assignedShiftLeaders).forEach((val) => {
        if (!val) return;
        if (Array.isArray(val)) val.forEach((v) => assignedIds.add(v.id));
        else assignedIds.add(val.id);
      });

      const backup = shiftLeaders.find(
        (sf) => !absentEmployeeIds.has(sf.id) && !assignedIds.has(sf.id)
      );
      if (backup) {
        assignedShiftLeaders[s] = backup;
      }
    }
  });

  // 3. Machine assignments
  const activeMachines = db.machines.filter((m) => m.status === 'aktiv');

  // Employee shift mapping
  const workersByShift: Record<ShiftId, Employee[]> = {
    frueh: [],
    spaet: [],
    nacht: [],
    frei: [],
  };

  workers.forEach((w) => {
    const shift = calculateEmployeeShiftForWeek(w, year, kw, db.manualOverrides);
    workersByShift[shift].push(w);
  });

  // Track assigned employees so no employee is assigned to multiple machines in same shift
  const assignedIds = new Set<string>();

  const machineAssignments: WeekPlanSchedule['machineAssignments'] = activeMachines.map((machine) => {
    const shifts: { frueh: Employee[]; spaet: Employee[]; nacht: Employee[] } = {
      frueh: [],
      spaet: [],
      nacht: [],
    };

    (['frueh', 'spaet', 'nacht'] as const).forEach((s) => {
      // Check if machine operates in this shift
      const isActiveInShift =
        machine.shiftModel === '3-schicht' ||
        (machine.shiftModel === '2-schicht' && (s === 'frueh' || s === 'spaet')) ||
        (machine.shiftModel === '1-schicht' && s === 'frueh');

      if (!isActiveInShift) {
        return;
      }

      // Check manual overrides for this machine and shift
      const override = db.manualOverrides.find(
        (o) => o.year === year && o.kw === kw && o.machineId === machine.id && o.shiftId === s && o.dayIndex === undefined
      );

      if (override && override.assignedEmployeeIds.length > 0) {
        const manualEmps = override.assignedEmployeeIds
          .map((id) => db.employees.find((e) => e.id === id))
          .filter(Boolean) as Employee[];
        shifts[s] = manualEmps;
        manualEmps.forEach((e) => assignedIds.add(e.id));
        return;
      }

      // Candidates: workers scheduled for this shift
      const candidates = workersByShift[s].filter(
        (emp) =>
          !assignedIds.has(emp.id) &&
          !absentEmployeeIds.has(emp.id) &&
          (emp.preferredMachineId === machine.id || emp.qualifiedMachineIds?.includes(machine.id))
      );

      // Desired staff count
      const needed = machine.minStaffPerShift[s] || 1;
      const selected = candidates.slice(0, needed);
      selected.forEach((e) => {
        shifts[s].push(e);
        assignedIds.add(e.id);
      });

      // If still understaffed, allow other qualified workers scheduled for this shift
      if (shifts[s].length < needed) {
        const fallbacks = workersByShift[s].filter(
          (emp) => !assignedIds.has(emp.id) && !absentEmployeeIds.has(emp.id)
        );
        const more = fallbacks.slice(0, needed - shifts[s].length);
        more.forEach((e) => {
          shifts[s].push(e);
          assignedIds.add(e.id);
        });
      }
    });

    const understaffed = {
      frueh:
        (machine.minStaffPerShift.frueh || 0) > 0 &&
        shifts.frueh.filter((e) => !absentEmployeeIds.has(e.id)).length < machine.minStaffPerShift.frueh,
      spaet:
        machine.shiftModel !== '1-schicht' &&
        (machine.minStaffPerShift.spaet || 0) > 0 &&
        shifts.spaet.filter((e) => !absentEmployeeIds.has(e.id)).length < machine.minStaffPerShift.spaet,
      nacht:
        machine.shiftModel === '3-schicht' &&
        (machine.minStaffPerShift.nacht || 0) > 0 &&
        shifts.nacht.filter((e) => !absentEmployeeIds.has(e.id)).length < machine.minStaffPerShift.nacht,
    };

    return {
      machine,
      shifts,
      understaffed,
    };
  });

  // Remaining unassigned employees
  const unassignedStaff: WeekPlanSchedule['unassignedStaff'] = {
    frueh: workersByShift.frueh.filter((w) => !assignedIds.has(w.id)),
    spaet: workersByShift.spaet.filter((w) => !assignedIds.has(w.id)),
    nacht: workersByShift.nacht.filter((w) => !assignedIds.has(w.id)),
    frei: workersByShift.frei.filter((w) => !assignedIds.has(w.id)),
  };

  return {
    year,
    kw,
    startDateStr: startStr,
    endDateStr: endStr,
    teamLeader: assignedTeamLeader,
    shiftLeaders: assignedShiftLeaders,
    machineAssignments,
    unassignedStaff,
    absentEmployees,
  };
}

/**
 * Calculates a multi-week projection for any number of weeks in advance (e.g. 1 to 52 weeks, default 4)
 */
export function generateMultiWeekPlan(
  db: DepartmentDatabase,
  startYear: number,
  startKW: number,
  horizonWeeks: number = 4
): WeekPlanSchedule[] {
  const result: WeekPlanSchedule[] = [];
  const requestedWeeks = typeof horizonWeeks === 'number' && !isNaN(horizonWeeks) ? horizonWeeks : 4;
  const safeWeeks = Math.max(1, Math.min(52, Math.round(requestedWeeks)));

  let curYear = startYear;
  let curKW = startKW;

  for (let i = 0; i < safeWeeks; i++) {
    result.push(generateWeekSchedule(db, curYear, curKW));
    curKW++;
    // Wraparound am tatsächlichen Jahresende (52 oder 53 ISO-Wochen, je nach Jahr)
    if (curKW > getWeeksInISOYear(curYear)) {
      curKW = 1;
      curYear++;
    }
  }

  return result;
}

/**
 * Format employee display name gracefully even when firstName, lastName or personnelNumber are omitted/blank
 */
export function formatEmployeeName(emp?: Partial<Employee> | null, defaultFallback: string = 'Mitarbeiter'): string {
  if (!emp) return defaultFallback;
  const parts = [emp.firstName?.trim(), emp.lastName?.trim()].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  if (emp.personnelNumber?.trim()) return emp.personnelNumber.trim();
  return defaultFallback;
}

/**
 * Format employee as "LastName, FirstName" or single name / personnel number
 */
export function formatEmployeeLastFirst(emp?: Partial<Employee> | null, defaultFallback: string = 'Mitarbeiter'): string {
  if (!emp) return defaultFallback;
  const first = emp.firstName?.trim();
  const last = emp.lastName?.trim();
  if (last && first) return `${last}, ${first}`;
  if (last) return last;
  if (first) return first;
  if (emp.personnelNumber?.trim()) return emp.personnelNumber.trim();
  return defaultFallback;
}

/**
 * Get 1-2 character initials for avatar circles
 */
export function getEmployeeInitials(emp?: Partial<Employee> | null, defaultFallback: string = 'M'): string {
  if (!emp) return defaultFallback;
  const first = emp.firstName?.trim();
  const last = emp.lastName?.trim();
  if (first && last) return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  if (first) return first.substring(0, 2).toUpperCase();
  if (last) return last.substring(0, 2).toUpperCase();
  if (emp.personnelNumber?.trim()) return emp.personnelNumber.trim().substring(0, 2).toUpperCase();
  return defaultFallback;
}

