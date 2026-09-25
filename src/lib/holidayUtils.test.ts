import { describe, it, expect } from 'vitest';
import { getEasterSunday, getHolidaysForYear, getHolidayForDate, isWorkingDay, countVacationWorkingDays } from './holidayUtils';

describe('getEasterSunday', () => {
  // Known real-world Easter Sunday dates, verified against public calendars.
  const knownDates: [number, number, number][] = [
    [2024, 3, 31],
    [2025, 4, 20],
    [2026, 4, 5],
    [2027, 3, 28],
    [2028, 4, 16],
  ];

  it.each(knownDates)('computes Easter Sunday for %i as %i-%i', (year, month, day) => {
    expect(getEasterSunday(year)).toEqual({ month, day });
  });
});

describe('getHolidaysForYear', () => {
  it('includes fixed national holidays', () => {
    const holidays = getHolidaysForYear(2026);
    expect(holidays.get('2026-01-01')?.name).toBe('Neujahr');
    expect(holidays.get('2026-05-01')?.name).toBe('Tag der Arbeit');
    expect(holidays.get('2026-10-03')?.name).toBe('Tag der Deutschen Einheit');
    expect(holidays.get('2026-12-25')?.name).toBe('1. Weihnachtstag');
  });

  it('computes movable Easter-based holidays relative to Easter Sunday 2026-04-05', () => {
    const holidays = getHolidaysForYear(2026);
    expect(holidays.has('2026-04-03')).toBe(true); // Karfreitag (Easter - 2)
    expect(holidays.has('2026-04-05')).toBe(true); // Ostersonntag
    expect(holidays.has('2026-04-06')).toBe(true); // Ostermontag
    expect(holidays.has('2026-05-14')).toBe(true); // Christi Himmelfahrt (Easter + 39)
    expect(holidays.has('2026-05-25')).toBe(true); // Pfingstmontag (Easter + 50)
  });

  it('computes Buß- und Bettag as the Wednesday before Nov 23', () => {
    const holidays2024 = getHolidaysForYear(2024);
    const holidays2025 = getHolidaysForYear(2025);
    const holidays2026 = getHolidaysForYear(2026);
    expect(holidays2024.has('2024-11-20')).toBe(true);
    expect(holidays2025.has('2025-11-19')).toBe(true);
    expect(holidays2026.has('2026-11-18')).toBe(true);
  });

  it('returns a stable, cached result for repeated calls', () => {
    const first = getHolidaysForYear(2030);
    const second = getHolidaysForYear(2030);
    expect(first).toBe(second);
  });

  it('computes a different holiday set for a different year', () => {
    const holidays2026 = getHolidaysForYear(2026);
    const holidays2027 = getHolidaysForYear(2027);
    expect(holidays2026.get('2026-04-05')).toBeDefined();
    expect(holidays2027.get('2026-04-05')).toBeUndefined();
  });
});

describe('getHolidayForDate', () => {
  it('finds a holiday by date string', () => {
    expect(getHolidayForDate('2026-01-01')?.name).toBe('Neujahr');
  });

  it('returns undefined for a non-holiday date', () => {
    expect(getHolidayForDate('2026-06-15')).toBeUndefined();
  });

  it('returns undefined for malformed input', () => {
    expect(getHolidayForDate('')).toBeUndefined();
    expect(getHolidayForDate('2026')).toBeUndefined();
  });
});

describe('isWorkingDay', () => {
  it('treats Saturday and Sunday as non-working days', () => {
    expect(isWorkingDay('2026-10-03')).toBe(false); // Saturday, also a holiday
    expect(isWorkingDay('2026-10-04')).toBe(false); // Sunday
  });

  it('treats a national holiday on a weekday as a non-working day', () => {
    expect(isWorkingDay('2026-12-25')).toBe(false); // Friday, 1. Weihnachtstag
  });

  it('treats a regular weekday as a working day', () => {
    expect(isWorkingDay('2026-10-05')).toBe(true); // Monday, no holiday
  });

  it('treats a regional-only holiday as a working day (only national holidays block)', () => {
    // Heilige Drei Könige is regional (BW, BY, ST, AT), not national
    expect(isWorkingDay('2026-01-06')).toBe(true);
  });
});

describe('countVacationWorkingDays', () => {
  it('counts a Mon-Fri range with no holidays as 5 working days', () => {
    const result = countVacationWorkingDays('2026-10-05', '2026-10-09');
    expect(result.workingDays).toBe(5);
    expect(result.weekendDays).toBe(0);
    expect(result.holidaysCount).toBe(0);
  });

  it('excludes a national holiday from working days without counting it as weekend', () => {
    // 2026-10-03 is a Saturday AND Tag der Deutschen Einheit
    const result = countVacationWorkingDays('2026-10-01', '2026-10-05');
    expect(result.weekendDays).toBe(2); // Sat 10-03, Sun 10-04
    expect(result.workingDays).toBe(3); // Thu, Fri, Mon
    expect(result.holidaysCount).toBe(0); // the holiday fell on a weekend, not double-counted
  });

  it('counts a weekday holiday separately from working days', () => {
    // 2026-12-25 is a Friday (1. Weihnachtstag)
    const result = countVacationWorkingDays('2026-12-21', '2026-12-25');
    expect(result.holidaysCount).toBe(1);
    expect(result.holidaysList[0].name).toBe('1. Weihnachtstag');
  });

  it('counts a single-day range correctly', () => {
    const result = countVacationWorkingDays('2026-10-05', '2026-10-05');
    expect(result.workingDays).toBe(1);
  });
});
