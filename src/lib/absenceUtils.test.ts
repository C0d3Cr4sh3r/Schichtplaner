import { describe, it, expect } from 'vitest';
import {
  addDaysToDateStr,
  parseISODate,
  toISODateString,
  formatDateKey,
  getAbsenceOnDate,
  buildEmployeeYearAbsenceMap,
  consolidateDatesToAbsences,
  applyStampToEmployeeDate,
  applyRangeStampToEmployee,
  calculateEmployeeVacationSummary,
  getEmployeeAnnualStats,
  detectMachineVacationConflicts,
} from './absenceUtils';
import { Absence, Employee, Machine } from '../types';

// Regression test for the critical bug found in an E2E test run: the return
// statement used `${d}` (the Date object, whose toString() breaks string
// comparisons) instead of `${day}`. This silently truncated every loop that
// walked day-by-day through a multi-day absence to just the first day.
describe('addDaysToDateStr', () => {
  it('adds a single day within a month', () => {
    expect(addDaysToDateStr('2026-10-05', 1)).toBe('2026-10-06');
  });

  it('returns a comparable YYYY-MM-DD string, not a Date-like string', () => {
    const result = addDaysToDateStr('2026-10-05', 1);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('crosses a month boundary', () => {
    expect(addDaysToDateStr('2026-10-31', 1)).toBe('2026-11-01');
  });

  it('crosses a year boundary', () => {
    expect(addDaysToDateStr('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('walks through a full 5-day range and stays comparable at every step', () => {
    let curr = '2026-10-05';
    const end = '2026-10-09';
    const visited: string[] = [];
    while (curr <= end) {
      visited.push(curr);
      curr = addDaysToDateStr(curr, 1);
    }
    expect(visited).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
    ]);
  });

  it('pads single-digit day and month with a leading zero', () => {
    expect(addDaysToDateStr('2026-01-08', 1)).toBe('2026-01-09');
    expect(addDaysToDateStr('2026-09-01', 0)).toBe('2026-09-01');
  });
});

describe('parseISODate / toISODateString', () => {
  it('round-trips a date string without timezone drift', () => {
    const date = parseISODate('2026-03-01');
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(2);
    expect(date.getUTCDate()).toBe(1);
  });
});

describe('formatDateKey', () => {
  it('formats a zero-based month correctly', () => {
    expect(formatDateKey(2026, 0, 1)).toBe('2026-01-01');
    expect(formatDateKey(2026, 11, 31)).toBe('2026-12-31');
  });
});

describe('getAbsenceOnDate', () => {
  const absences: Absence[] = [
    { id: 'a1', departmentCode: 'D', employeeId: 'e1', type: 'urlaub', startDate: '2026-10-05', endDate: '2026-10-09' },
  ];

  it('finds an absence covering a date in the middle of the range', () => {
    expect(getAbsenceOnDate(absences, 'e1', '2026-10-07')?.id).toBe('a1');
  });

  it('finds an absence on the boundary dates', () => {
    expect(getAbsenceOnDate(absences, 'e1', '2026-10-05')?.id).toBe('a1');
    expect(getAbsenceOnDate(absences, 'e1', '2026-10-09')?.id).toBe('a1');
  });

  it('returns undefined just outside the range', () => {
    expect(getAbsenceOnDate(absences, 'e1', '2026-10-04')).toBeUndefined();
    expect(getAbsenceOnDate(absences, 'e1', '2026-10-10')).toBeUndefined();
  });

  it('does not match a different employee', () => {
    expect(getAbsenceOnDate(absences, 'e2', '2026-10-07')).toBeUndefined();
  });
});

describe('buildEmployeeYearAbsenceMap', () => {
  it('maps every day of a multi-day absence, not just the first', () => {
    const absences: Absence[] = [
      { id: 'a1', departmentCode: 'D', employeeId: 'e1', type: 'urlaub', startDate: '2026-10-05', endDate: '2026-10-09' },
    ];
    const map = buildEmployeeYearAbsenceMap(absences, 'e1', 2026);
    expect(map.size).toBe(5);
    expect(map.get('2026-10-05')?.id).toBe('a1');
    expect(map.get('2026-10-09')?.id).toBe('a1');
  });

  it('clips a range that starts before the queried year', () => {
    const absences: Absence[] = [
      { id: 'a1', departmentCode: 'D', employeeId: 'e1', type: 'urlaub', startDate: '2025-12-30', endDate: '2026-01-02' },
    ];
    const map = buildEmployeeYearAbsenceMap(absences, 'e1', 2026);
    expect(map.has('2025-12-30')).toBe(false);
    expect(map.get('2026-01-01')?.id).toBe('a1');
    expect(map.get('2026-01-02')?.id).toBe('a1');
  });
});

describe('consolidateDatesToAbsences', () => {
  it('merges consecutive dates into a single range', () => {
    const datesByType = new Map([['urlaub' as const, ['2026-10-05', '2026-10-06', '2026-10-07']]]);
    const result = consolidateDatesToAbsences(datesByType, 'e1', 'D', []);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ startDate: '2026-10-05', endDate: '2026-10-07' });
  });

  it('splits non-consecutive dates into separate ranges', () => {
    const datesByType = new Map([['urlaub' as const, ['2026-10-05', '2026-10-06', '2026-10-10']]]);
    const result = consolidateDatesToAbsences(datesByType, 'e1', 'D', []);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ startDate: '2026-10-05', endDate: '2026-10-06' });
    expect(result[1]).toMatchObject({ startDate: '2026-10-10', endDate: '2026-10-10' });
  });

  it('handles unsorted input dates', () => {
    const datesByType = new Map([['urlaub' as const, ['2026-10-07', '2026-10-05', '2026-10-06']]]);
    const result = consolidateDatesToAbsences(datesByType, 'e1', 'D', []);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ startDate: '2026-10-05', endDate: '2026-10-07' });
  });
});

describe('applyStampToEmployeeDate', () => {
  it('stamps a single empty day', () => {
    const result = applyStampToEmployeeDate([], 'D', 'e1', '2026-10-05', 'urlaub');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ startDate: '2026-10-05', endDate: '2026-10-05', type: 'urlaub' });
  });

  it('toggles a stamp off when clicking the same type again', () => {
    const first = applyStampToEmployeeDate([], 'D', 'e1', '2026-10-05', 'urlaub');
    const second = applyStampToEmployeeDate(first, 'D', 'e1', '2026-10-05', 'urlaub');
    expect(second).toHaveLength(0);
  });

  it('extends an existing range when stamping the adjacent day', () => {
    const first = applyStampToEmployeeDate([], 'D', 'e1', '2026-10-05', 'urlaub');
    const second = applyStampToEmployeeDate(first, 'D', 'e1', '2026-10-06', 'urlaub');
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({ startDate: '2026-10-05', endDate: '2026-10-06' });
  });

  it('erases a day out of an existing range', () => {
    const first = applyRangeStampToEmployee([], 'D', 'e1', '2026-10-05', '2026-10-09', 'urlaub');
    const second = applyStampToEmployeeDate(first, 'D', 'e1', '2026-10-07', 'eraser');
    // Erasing the middle day should split into two ranges
    expect(second).toHaveLength(2);
    expect(second[0]).toMatchObject({ startDate: '2026-10-05', endDate: '2026-10-06' });
    expect(second[1]).toMatchObject({ startDate: '2026-10-08', endDate: '2026-10-09' });
  });

  it('does not affect other employees absences', () => {
    const otherEmp: Absence[] = [
      { id: 'a1', departmentCode: 'D', employeeId: 'e2', type: 'krank', startDate: '2026-10-05', endDate: '2026-10-05' },
    ];
    const result = applyStampToEmployeeDate(otherEmp, 'D', 'e1', '2026-10-05', 'urlaub');
    expect(result).toHaveLength(2);
    expect(result.find((a) => a.employeeId === 'e2')).toBeDefined();
  });
});

describe('applyRangeStampToEmployee', () => {
  it('stamps a full 5-day range in one call', () => {
    const result = applyRangeStampToEmployee([], 'D', 'e1', '2026-10-05', '2026-10-09', 'urlaub');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ startDate: '2026-10-05', endDate: '2026-10-09' });
  });

  it('normalizes a reversed start/end range', () => {
    const result = applyRangeStampToEmployee([], 'D', 'e1', '2026-10-09', '2026-10-05', 'urlaub');
    expect(result[0]).toMatchObject({ startDate: '2026-10-05', endDate: '2026-10-09' });
  });

  it('only stamps working days when onlyWorkingDays is set', () => {
    // 2026-10-05 is a Monday, 2026-10-09 is a Friday, 2026-10-03 (Tag der Deutschen
    // Einheit) falls outside this range so all 5 days are plain working days.
    const result = applyRangeStampToEmployee(
      [],
      'D',
      'e1',
      '2026-10-03', // Saturday-adjacent national holiday
      '2026-10-05',
      'urlaub',
      undefined,
      undefined,
      true
    );
    // 2026-10-03 = national holiday, 2026-10-04 = Sunday, 2026-10-05 = Monday (working day)
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ startDate: '2026-10-05', endDate: '2026-10-05' });
  });
});

describe('getEmployeeAnnualStats', () => {
  it('counts all days of a multi-day vacation, not just the first', () => {
    const absences: Absence[] = [
      { id: 'a1', departmentCode: 'D', employeeId: 'e1', type: 'urlaub', startDate: '2026-10-05', endDate: '2026-10-09' },
    ];
    const stats = getEmployeeAnnualStats(absences, 'e1', 2026);
    expect(stats.urlaub).toBe(5);
    expect(stats.urlaubWorkingDays).toBe(5);
  });

  it('excludes weekends and national holidays from urlaubWorkingDays but counts them in urlaub', () => {
    // 2026-10-03 (Sat) is Tag der Deutschen Einheit, 2026-10-04 is Sunday.
    const absences: Absence[] = [
      { id: 'a1', departmentCode: 'D', employeeId: 'e1', type: 'urlaub', startDate: '2026-10-02', endDate: '2026-10-05' },
    ];
    const stats = getEmployeeAnnualStats(absences, 'e1', 2026);
    expect(stats.urlaub).toBe(4); // calendar days: Fr, Sat(holiday), Sun, Mon
    expect(stats.urlaubWorkingDays).toBe(2); // only Fri 10-02 and Mon 10-05
  });

  it('does not count sick days as urlaubWorkingDays', () => {
    const absences: Absence[] = [
      { id: 'a1', departmentCode: 'D', employeeId: 'e1', type: 'krank', startDate: '2026-10-05', endDate: '2026-10-07' },
    ];
    const stats = getEmployeeAnnualStats(absences, 'e1', 2026);
    expect(stats.krank).toBe(3);
    expect(stats.urlaubWorkingDays).toBe(0);
  });
});

describe('calculateEmployeeVacationSummary', () => {
  const baseEmployee: Employee = {
    id: 'e1',
    departmentCode: 'D',
    personnelNumber: 'T-001',
    firstName: 'Anna',
    lastName: 'Test',
    role: 'mitarbeiter',
    shiftModel: '3-schicht',
    excludedShifts: [],
    customSequence: [],
    rotationOffsetWeeks: 0,
    qualifiedMachineIds: [],
    active: true,
    yearlyVacationQuota: 2,
  };

  it('flags overdraw when taken working days exceed the quota', () => {
    const absences: Absence[] = [
      { id: 'a1', departmentCode: 'D', employeeId: 'e1', type: 'urlaub', startDate: '2026-10-05', endDate: '2026-10-09' },
    ];
    const summary = calculateEmployeeVacationSummary(baseEmployee, absences, 2026);
    expect(summary.takenWorkingDays).toBe(5);
    expect(summary.totalEntitlement).toBe(2);
    expect(summary.isOverdrawn).toBe(true);
    expect(summary.overdrawnDays).toBe(3);
    expect(summary.remainingDays).toBe(-3);
  });

  it('does not flag overdraw when within quota', () => {
    const absences: Absence[] = [
      { id: 'a1', departmentCode: 'D', employeeId: 'e1', type: 'urlaub', startDate: '2026-10-05', endDate: '2026-10-05' },
    ];
    const summary = calculateEmployeeVacationSummary(baseEmployee, absences, 2026);
    expect(summary.isOverdrawn).toBe(false);
    expect(summary.overdrawnDays).toBe(0);
    expect(summary.remainingDays).toBe(1);
  });

  it('defaults to a 30-day quota when none is set', () => {
    const emp: Employee = { ...baseEmployee, yearlyVacationQuota: undefined };
    const summary = calculateEmployeeVacationSummary(emp, [], 2026);
    expect(summary.baseQuota).toBe(30);
  });

  it('adds carryover days to the total entitlement', () => {
    const emp: Employee = { ...baseEmployee, yearlyVacationQuota: 25, vacationCarryoverDays: 3 };
    const summary = calculateEmployeeVacationSummary(emp, [], 2026);
    expect(summary.totalEntitlement).toBe(28);
  });
});

describe('detectMachineVacationConflicts', () => {
  const machine: Machine = {
    id: 'm1',
    departmentCode: 'D',
    code: 'M-01',
    name: 'Test-Maschine',
    area: 'Halle 1',
    shiftModel: '3-schicht',
    minStaffPerShift: { frueh: 1, spaet: 1, nacht: 1 },
    status: 'aktiv',
  };

  const makeEmp = (id: string): Employee => ({
    id,
    departmentCode: 'D',
    personnelNumber: id,
    firstName: id,
    lastName: id,
    role: 'mitarbeiter',
    shiftModel: '3-schicht',
    excludedShifts: [],
    customSequence: [],
    rotationOffsetWeeks: 0,
    qualifiedMachineIds: ['m1'],
    active: true,
  });

  it('detects an overlap when two employees on the same machine take vacation on the same day', () => {
    const employees = [makeEmp('e1'), makeEmp('e2')];
    const absences: Absence[] = [
      { id: 'a1', departmentCode: 'D', employeeId: 'e1', type: 'urlaub', startDate: '2026-10-05', endDate: '2026-10-07' },
      { id: 'a2', departmentCode: 'D', employeeId: 'e2', type: 'urlaub', startDate: '2026-10-06', endDate: '2026-10-08' },
    ];
    const conflicts = detectMachineVacationConflicts(employees, [machine], absences);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].startDate).toBe('2026-10-06');
    expect(conflicts[0].endDate).toBe('2026-10-07');
    expect(conflicts[0].employees.map((e) => e.employee.id).sort()).toEqual(['e1', 'e2']);
  });

  it('does not flag sick leave as a conflict by default', () => {
    const employees = [makeEmp('e1'), makeEmp('e2')];
    const absences: Absence[] = [
      { id: 'a1', departmentCode: 'D', employeeId: 'e1', type: 'krank', startDate: '2026-10-05', endDate: '2026-10-07' },
      { id: 'a2', departmentCode: 'D', employeeId: 'e2', type: 'krank', startDate: '2026-10-05', endDate: '2026-10-07' },
    ];
    const conflicts = detectMachineVacationConflicts(employees, [machine], absences);
    expect(conflicts).toHaveLength(0);
  });

  it('does not flag employees on different machines', () => {
    const machine2: Machine = { ...machine, id: 'm2', code: 'M-02' };
    const employees = [
      { ...makeEmp('e1'), qualifiedMachineIds: ['m1'] },
      { ...makeEmp('e2'), qualifiedMachineIds: ['m2'] },
    ];
    const absences: Absence[] = [
      { id: 'a1', departmentCode: 'D', employeeId: 'e1', type: 'urlaub', startDate: '2026-10-05', endDate: '2026-10-07' },
      { id: 'a2', departmentCode: 'D', employeeId: 'e2', type: 'urlaub', startDate: '2026-10-05', endDate: '2026-10-07' },
    ];
    const conflicts = detectMachineVacationConflicts(employees, [machine, machine2], absences);
    expect(conflicts).toHaveLength(0);
  });

  it('does not flag a single employee on vacation alone', () => {
    const employees = [makeEmp('e1'), makeEmp('e2')];
    const absences: Absence[] = [
      { id: 'a1', departmentCode: 'D', employeeId: 'e1', type: 'urlaub', startDate: '2026-10-05', endDate: '2026-10-07' },
    ];
    const conflicts = detectMachineVacationConflicts(employees, [machine], absences);
    expect(conflicts).toHaveLength(0);
  });

  it('ignores inactive employees', () => {
    const employees = [makeEmp('e1'), { ...makeEmp('e2'), active: false }];
    const absences: Absence[] = [
      { id: 'a1', departmentCode: 'D', employeeId: 'e1', type: 'urlaub', startDate: '2026-10-05', endDate: '2026-10-07' },
      { id: 'a2', departmentCode: 'D', employeeId: 'e2', type: 'urlaub', startDate: '2026-10-05', endDate: '2026-10-07' },
    ];
    const conflicts = detectMachineVacationConflicts(employees, [machine], absences);
    expect(conflicts).toHaveLength(0);
  });
});
