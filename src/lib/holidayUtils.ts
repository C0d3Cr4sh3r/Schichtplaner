/**
 * Feiertage-Berechnung für DACH (Deutschland / Österreich / Schweiz)
 * Enthält Osterformel (Gauß / Meeus) für bewegliche Feiertage und feste Feiertage.
 */

export interface PublicHoliday {
  dateKey: string; // YYYY-MM-DD
  name: string;
  shortName: string;
  isNational: boolean; // Gesetzlicher bundesweiter Feiertag (DE/AT)
  region?: string; // z.B. "BW, BY, NW, SN, TH"
}

/**
 * Berechnet das Datum des Ostersonntags für ein gegebenes Jahr (Meeus/Jones/Butcher Algorithmus)
 */
export function getEasterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = März, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function formatDate(year: number, month1Based: number, day: number): string {
  const m = String(month1Based).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function addDays(baseYear: number, baseMonth: number, baseDay: number, daysToAdd: number): { year: number; month: number; day: number } {
  const d = new Date(baseYear, baseMonth - 1, baseDay + daysToAdd);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  };
}

/**
 * Liefert alle gesetzlichen und regionalen Feiertage für ein bestimmtes Jahr
 */
export function getHolidaysForYear(year: number): Map<string, PublicHoliday> {
  const map = new Map<string, PublicHoliday>();

  const add = (m: number, d: number, name: string, shortName: string, isNational = true, region?: string) => {
    const key = formatDate(year, m, d);
    map.set(key, { dateKey: key, name, shortName, isNational, region });
  };

  // 1. Feste Feiertage
  add(1, 1, 'Neujahr', 'Neujahr', true);
  add(1, 6, 'Heilige Drei Könige', '3 Könige', false, 'BW, BY, ST, AT');
  add(5, 1, 'Tag der Arbeit', '1. Mai', true);
  add(8, 15, 'Mariä Himmelfahrt', 'Himmelfahrt M.', false, 'BY, SL, AT');
  add(10, 3, 'Tag der Deutschen Einheit', 'Dt. Einheit', true, 'DE');
  add(10, 26, 'Nationalfeiertag Österreich', 'Nationalfeiertag', false, 'AT');
  add(10, 31, 'Reformationstag', 'Reformation', false, 'BB, HB, HH, MV, NI, SN, ST, SH, TH');
  add(11, 1, 'Allerheiligen', 'Allerheiligen', false, 'BW, BY, NW, RP, SL, AT');
  add(12, 24, 'Heiligabend (Bankfeiertag)', 'Heiligabend', false);
  add(12, 25, '1. Weihnachtstag', '1. Weih.', true);
  add(12, 26, '2. Weihnachtstag / Stephanitag', '2. Weih.', true);
  add(12, 31, 'Silvester (Bankfeiertag)', 'Silvester', false);

  // 2. Bewegliche Feiertage rund um Ostern
  const easter = getEasterSunday(year);

  // Karfreitag: Ostersonntag - 2 Tage
  const karfreitag = addDays(year, easter.month, easter.day, -2);
  add(karfreitag.month, karfreitag.day, 'Karfreitag', 'Karfreitag', true);

  // Ostersonntag
  add(easter.month, easter.day, 'Ostersonntag', 'Ostersonntag', true);

  // Ostermontag: Ostersonntag + 1 Tag
  const ostermontag = addDays(year, easter.month, easter.day, 1);
  add(ostermontag.month, ostermontag.day, 'Ostermontag', 'Ostermontag', true);

  // Christi Himmelfahrt: Ostersonntag + 39 Tage (Donnerstag)
  const himmelfahrt = addDays(year, easter.month, easter.day, 39);
  add(himmelfahrt.month, himmelfahrt.day, 'Christi Himmelfahrt / Vatertag', 'Himmelfahrt', true);

  // Pfingstsonntag: Ostersonntag + 49 Tage
  const pfingstsonntag = addDays(year, easter.month, easter.day, 49);
  add(pfingstsonntag.month, pfingstsonntag.day, 'Pfingstsonntag', 'Pfingsten', true);

  // Pfingstmontag: Ostersonntag + 50 Tage
  const pfingstmontag = addDays(year, easter.month, easter.day, 50);
  add(pfingstmontag.month, pfingstmontag.day, 'Pfingstmontag', 'Pfingstmo.', true);

  // Fronleichnam: Ostersonntag + 60 Tage (Donnerstag)
  const fronleichnam = addDays(year, easter.month, easter.day, 60);
  add(fronleichnam.month, fronleichnam.day, 'Fronleichnam', 'Fronleichnam', false, 'BW, BY, HE, NW, RP, SL, AT');

  // Buß- und Bettag (Mittwoch vor dem 23. November in Sachsen)
  // 23. Nov minus (Wochentag(23. Nov) + 4) % 7 Tage etc.
  const nov23 = new Date(year, 10, 23);
  const dow = nov23.getDay(); // 0=So, 1=Mo, 2=Di, 3=Mi...
  const daysBack = (dow - 3 + 7) % 7 || 7;
  const bussundbettag = new Date(year, 10, 23 - daysBack);
  add(
    bussundbettag.getMonth() + 1,
    bussundbettag.getDate(),
    'Buß- und Bettag',
    'Buß- & Bettag',
    false,
    'SN'
  );

  return map;
}

/**
 * Prüft, ob ein bestimmtes Datum ein Feiertag ist
 */
export function getHolidayForDate(dateStr: string): PublicHoliday | undefined {
  if (!dateStr || dateStr.length < 10) return undefined;
  const year = parseInt(dateStr.substring(0, 4), 10);
  if (isNaN(year)) return undefined;
  const holidays = getHolidaysForYear(year);
  return holidays.get(dateStr);
}

/**
 * Berechnet, ob ein Tag ein Werktag ist (weder Samstag, Sonntag noch gesetzlicher Feiertag)
 */
export function isWorkingDay(dateStr: string): boolean {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return false;
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  const dow = dt.getDay(); // 0=So, 6=Sa
  if (dow === 0 || dow === 6) return false;

  const holiday = getHolidayForDate(dateStr);
  if (holiday && holiday.isNational) {
    return false;
  }
  return true;
}

/**
 * Zählt die reinen Urlaubstage unter Berücksichtigung von Wochenenden und Feiertagen
 * (Ein Feiertag an einem Werktag verbraucht keinen Urlaubstag!)
 */
export function countVacationWorkingDays(startDateStr: string, endDateStr: string): {
  workingDays: number;
  weekendDays: number;
  holidaysCount: number;
  holidaysList: PublicHoliday[];
} {
  let workingDays = 0;
  let weekendDays = 0;
  let holidaysCount = 0;
  const holidaysList: PublicHoliday[] = [];

  let curr = startDateStr;
  while (curr <= endDateStr) {
    const parts = curr.split('-').map(Number);
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    const dow = dt.getDay();

    if (dow === 0 || dow === 6) {
      weekendDays++;
    } else {
      const holiday = getHolidayForDate(curr);
      if (holiday && holiday.isNational) {
        holidaysCount++;
        holidaysList.push(holiday);
      } else {
        workingDays++;
      }
    }

    // Next day
    dt.setDate(dt.getDate() + 1);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    curr = `${y}-${m}-${d}`;
  }

  return { workingDays, weekendDays, holidaysCount, holidaysList };
}
