import { describe, it, expect } from 'vitest';
import {
  getISOWeek,
  getWeeksInISOYear,
  getDateRangeForKW,
  calculateEmployeeShiftForWeek,
  getEmployeeAbsenceForWeek,
  generateWeekSchedule,
  generateMultiWeekPlan,
} from './rotationEngine';
import { DepartmentDatabase, Employee, Machine, Absence } from '../types';

describe('getISOWeek', () => {
  it('computes the correct ISO week for a known mid-year date', () => {
    // 2026-09-21 is a Monday in ISO week 39
    expect(getISOWeek(new Date(Date.UTC(2026, 8, 21)))).toEqual({ year: 2026, kw: 39 });
  });

  it('assigns Jan 1 to the previous year ISO week when it falls before Thursday', () => {
    // 2027-01-01 is a Friday -> belongs to ISO week 53 of 2026
    const result = getISOWeek(new Date(Date.UTC(2027, 0, 1)));
    expect(result).toEqual({ year: 2026, kw: 53 });
  });
});

// Regression test: rotationEngine.ts previously hard-coded a 52-week wraparound
// in generateMultiWeekPlan, which silently skipped ISO week 53 in years that
// actually have 53 weeks (like 2026). getWeeksInISOYear is the fix.
describe('getWeeksInISOYear', () => {
  it('returns 53 for a known 53-week year (2026)', () => {
    expect(getWeeksInISOYear(2026)).toBe(53);
  });

  it('returns 52 for a known 52-week year (2025)', () => {
    expect(getWeeksInISOYear(2025)).toBe(52);
  });

  it('returns 53 for other known 53-week years (2020, 2032)', () => {
    expect(getWeeksInISOYear(2020)).toBe(53);
    expect(getWeeksInISOYear(2032)).toBe(53);
  });
});

describe('getDateRangeForKW', () => {
  it('returns Monday as the start and Sunday as the end', () => {
    const range = getDateRangeForKW(2026, 39);
    expect(range.start.getUTCDay()).toBe(1); // Monday
    expect(range.end.getUTCDay()).toBe(0); // Sunday
  });

  it('computes the correct week 1 for a year starting on a Thursday', () => {
    // 2026-01-01 is a Thursday, so ISO week 1 of 2026 starts on 2025-12-29
    const range = getDateRangeForKW(2026, 1);
    expect(range.startStr).toBe('29.12.2025');
    expect(range.endStr).toBe('04.01.2026');
  });
});

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'e1',
    departmentCode: 'D',
    personnelNumber: 'T-001',
    firstName: 'Anna',
    lastName: 'Test',
    role: 'mitarbeiter',
    shiftModel: '3-schicht',
    excludedShifts: [],
    customSequence: ['frueh', 'nacht', 'spaet'],
    rotationOffsetWeeks: 0,
    qualifiedMachineIds: [],
    active: true,
    ...overrides,
  };
}

describe('calculateEmployeeShiftForWeek', () => {
  it('follows the custom sequence starting at week 1 for offset 0', () => {
    const emp = makeEmployee({ customSequence: ['frueh', 'nacht', 'spaet'], rotationOffsetWeeks: 0 });
    expect(calculateEmployeeShiftForWeek(emp, 2026, 1)).toBe('frueh');
    expect(calculateEmployeeShiftForWeek(emp, 2026, 2)).toBe('nacht');
    expect(calculateEmployeeShiftForWeek(emp, 2026, 3)).toBe('spaet');
    expect(calculateEmployeeShiftForWeek(emp, 2026, 4)).toBe('frueh'); // wraps around
  });

  it('shifts the starting point according to rotationOffsetWeeks', () => {
    const emp = makeEmployee({ customSequence: ['frueh', 'nacht', 'spaet'], rotationOffsetWeeks: 1 });
    expect(calculateEmployeeShiftForWeek(emp, 2026, 1)).toBe('nacht');
  });

  it('falls back to the default 3-shift sequence when no custom sequence is set', () => {
    const emp = makeEmployee({ customSequence: [] });
    expect(calculateEmployeeShiftForWeek(emp, 2026, 1)).toBe('frueh');
  });

  it('substitutes an excluded shift with the first non-excluded shift in the sequence', () => {
    const emp = makeEmployee({
      customSequence: ['frueh', 'nacht', 'spaet'],
      excludedShifts: ['nacht'],
      rotationOffsetWeeks: 0,
    });
    // Week 2 would normally be 'nacht', which this employee cannot work.
    expect(calculateEmployeeShiftForWeek(emp, 2026, 2)).toBe('frueh');
  });

  it('applies a manual override regardless of the rotation sequence', () => {
    const emp = makeEmployee({ id: 'e1' });
    const override = {
      id: 'ov1',
      year: 2026,
      kw: 1,
      shiftId: 'spaet' as const,
      assignedEmployeeIds: ['e1'],
    };
    expect(calculateEmployeeShiftForWeek(emp, 2026, 1, [override])).toBe('spaet');
  });
});

describe('getEmployeeAbsenceForWeek', () => {
  const weekStart = new Date(Date.UTC(2026, 8, 21)); // Monday 2026-09-21
  const weekEnd = new Date(Date.UTC(2026, 8, 27)); // Sunday 2026-09-27

  it('detects a full-week absence', () => {
    const absences: Absence[] = [
      { id: 'a1', departmentCode: 'D', employeeId: 'e1', type: 'urlaub', startDate: '2026-09-21', endDate: '2026-09-27' },
    ];
    const result = getEmployeeAbsenceForWeek('e1', absences, weekStart, weekEnd);
    expect(result.isAbsent).toBe(true);
    expect(result.affectedDaysText).toBe('Ganze Woche (Mo-So)');
  });

  it('detects a Mon-Fri absence and labels it accordingly', () => {
    const absences: Absence[] = [
      { id: 'a1', departmentCode: 'D', employeeId: 'e1', type: 'urlaub', startDate: '2026-09-21', endDate: '2026-09-25' },
    ];
    const result = getEmployeeAbsenceForWeek('e1', absences, weekStart, weekEnd);
    expect(result.isAbsent).toBe(true);
    expect(result.affectedDaysText).toBe('Mo - Fr');
  });

  it('returns not-absent when there is no matching absence', () => {
    const result = getEmployeeAbsenceForWeek('e1', [], weekStart, weekEnd);
    expect(result.isAbsent).toBe(false);
  });
});

function makeDb(overrides: Partial<DepartmentDatabase> = {}): DepartmentDatabase {
  return {
    departmentCode: 'D',
    departmentName: 'Test-Abteilung',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastModified: '2026-01-01T00:00:00.000Z',
    machines: [],
    employees: [],
    absences: [],
    manualOverrides: [],
    layoutSettings: {
      orientation: 'landscape',
      colorTheme: 'monochrome',
      scalePercent: 88,
      fontSize: 'compact',
      companyName: 'Test',
      documentTitle: 'Test',
      documentSubtitle: 'Test',
      departmentDisplayName: 'Test',
      showTeamLeadBox: true,
      showShiftLeaderRow: true,
      showMachineDetails: true,
      showStaffPhone: true,
      showLegend: true,
      showNotesField: true,
      customNotesText: '',
      showSignatures: true,
      signature1Label: '',
      signature2Label: '',
    },
    ...overrides,
  };
}

describe('generateWeekSchedule', () => {
  it('produces a schedule with the correct week metadata', () => {
    const db = makeDb();
    const schedule = generateWeekSchedule(db, 2026, 39);
    expect(schedule.year).toBe(2026);
    expect(schedule.kw).toBe(39);
  });

  it('marks an employee as understaffed absent when they are excluded from all machines', () => {
    const machine: Machine = {
      id: 'm1',
      departmentCode: 'D',
      code: 'M-01',
      name: 'Test',
      area: 'Halle 1',
      shiftModel: '3-schicht',
      minStaffPerShift: { frueh: 1, spaet: 1, nacht: 1 },
      status: 'aktiv',
    };
    const emp = makeEmployee({ qualifiedMachineIds: ['m1'] });
    const db = makeDb({ machines: [machine], employees: [emp] });
    const schedule = generateWeekSchedule(db, 2026, 39);
    expect(schedule.machineAssignments).toHaveLength(1);
  });
});

describe('generateMultiWeekPlan', () => {
  it('generates exactly the requested number of weeks', () => {
    const db = makeDb();
    const plan = generateMultiWeekPlan(db, 2026, 1, 4);
    expect(plan).toHaveLength(4);
  });

  it('clamps the horizon to a minimum of 1 week', () => {
    const db = makeDb();
    const plan = generateMultiWeekPlan(db, 2026, 1, 0);
    expect(plan).toHaveLength(1);
  });

  // Regression test: this exact sequence (KW 50 -> 53 -> 1/2027) previously
  // skipped KW 53 because the wraparound was hard-coded at > 52.
  it('does not skip ISO week 53 when crossing the 2026/2027 year boundary', () => {
    const db = makeDb();
    const plan = generateMultiWeekPlan(db, 2026, 50, 6);
    const weekLabels = plan.map((w) => `${w.year}-${w.kw}`);
    expect(weekLabels).toEqual([
      '2026-50',
      '2026-51',
      '2026-52',
      '2026-53',
      '2027-1',
      '2027-2',
    ]);
  });

  it('wraps correctly at the end of a normal 52-week year (2025)', () => {
    const db = makeDb();
    const plan = generateMultiWeekPlan(db, 2025, 51, 4);
    const weekLabels = plan.map((w) => `${w.year}-${w.kw}`);
    expect(weekLabels).toEqual(['2025-51', '2025-52', '2026-1', '2026-2']);
  });
});
