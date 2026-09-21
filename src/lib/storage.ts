import { DepartmentDatabase, Employee, Machine, Absence, PrintLayoutSettings, ShiftId } from '../types';

const DB_PREFIX = 'schichtplan_dept_db_';
const DEPT_REGISTRY_KEY = 'schichtplan_registered_depts';
const CURRENT_DEPT_KEY = 'schichtplan_current_dept';
const ADMIN_PASSWORD_KEY = 'schichtplan_admin_password';

export const DEFAULT_ADMIN_PASSWORD = 'admin123';

/**
 * Gets the current admin password for department creation and management.
 * Defaults to 'admin123' if not changed.
 */
export function getAdminPassword(): string {
  try {
    const saved = localStorage.getItem(ADMIN_PASSWORD_KEY);
    return saved && saved.trim() ? saved : DEFAULT_ADMIN_PASSWORD;
  } catch {
    return DEFAULT_ADMIN_PASSWORD;
  }
}

/**
 * Checks whether the admin password is still the default one ('admin123').
 */
export function isDefaultAdminPassword(): boolean {
  return getAdminPassword() === DEFAULT_ADMIN_PASSWORD;
}

/**
 * Sets a new admin password.
 */
export function setAdminPassword(newPassword: string): boolean {
  if (!newPassword || newPassword.trim().length < 4) {
    return false;
  }
  try {
    localStorage.setItem(ADMIN_PASSWORD_KEY, newPassword.trim());
    return true;
  } catch (err) {
    console.error('Failed to set admin password', err);
    return false;
  }
}

/**
 * Verifies if the provided password matches the admin password.
 */
export function verifyAdminPassword(password: string): boolean {
  return password.trim() === getAdminPassword();
}

/**
 * Verifies if a department with the given code exists in the registry or database.
 */
export function verifyDepartmentCode(code: string): boolean {
  const norm = normalizeCode(code);
  if (!norm) return false;
  const list = listRegisteredDepartments();
  if (list.some((d) => d.code === norm)) return true;
  return getDepartmentDB(norm) !== null;
}

/**
 * Finds department info by code if it exists.
 */
export function getDepartmentInfo(code: string): DepartmentInfo | null {
  const norm = normalizeCode(code);
  if (!norm) return null;
  const list = listRegisteredDepartments();
  const found = list.find((d) => d.code === norm);
  if (found) return found;
  const db = getDepartmentDB(norm);
  if (db) {
    return {
      code: db.departmentCode,
      name: db.departmentName,
      createdAt: db.createdAt,
      lastModified: db.lastModified,
      machineCount: db.machines.length,
      employeeCount: db.employees.length,
    };
  }
  return null;
}

export interface DepartmentInfo {
  code: string;
  name: string;
  createdAt: string;
  lastModified: string;
  machineCount?: number;
  employeeCount?: number;
}

export const DEFAULT_LAYOUT_SETTINGS: PrintLayoutSettings = {
  orientation: 'landscape',
  colorTheme: 'monochrome',
  scalePercent: 88,
  fontSize: 'compact',
  companyName: 'IndustrieWerke AG',
  documentTitle: 'Wochenschichtplan & Maschineneinteilung',
  documentSubtitle: 'Gültig für Produktionswoche',
  departmentDisplayName: '',
  showTeamLeadBox: true,
  showShiftLeaderRow: true,
  showMachineDetails: true,
  showStaffPhone: true,
  showLegend: true,
  showNotesField: true,
  customNotesText: 'Sicherheitshinweis: Vor Schichtbeginn PSA überprüfen und Maschinen-Checkliste durchführen.',
  showSignatures: true,
  signature1Label: 'Schichtleitung (geprüft)',
  signature2Label: 'Betriebsrat / Abteilungsleitung (freigegeben)',
};

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

export function getCurrentDepartmentCode(): string | null {
  try {
    return localStorage.getItem(CURRENT_DEPT_KEY);
  } catch {
    return null;
  }
}

export function setCurrentDepartmentCode(code: string | null): void {
  try {
    if (code) {
      localStorage.setItem(CURRENT_DEPT_KEY, normalizeCode(code));
    } else {
      localStorage.removeItem(CURRENT_DEPT_KEY);
    }
  } catch (err) {
    console.error('Failed to set current department', err);
  }
}

export function listRegisteredDepartments(): DepartmentInfo[] {
  try {
    const raw = localStorage.getItem(DEPT_REGISTRY_KEY);
    if (!raw) {
      // Seed default departments if none exist
      const defaultDepts: DepartmentInfo[] = [
        {
          code: 'FERT-A',
          name: 'Zerspanung & CNC Fertigung (Halle 2)',
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        },
        {
          code: 'MONT-1',
          name: 'Montagelinie & Endprüfung (Halle 5)',
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        },
      ];
      localStorage.setItem(DEPT_REGISTRY_KEY, JSON.stringify(defaultDepts));
      // Ensure seed databases exist
      ensureDepartmentExists('FERT-A', defaultDepts[0].name);
      return defaultDepts;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error listing departments', err);
    return [];
  }
}

function updateRegistry(info: DepartmentInfo): void {
  try {
    const depts = listRegisteredDepartments();
    const existingIndex = depts.findIndex((d) => d.code === info.code);
    if (existingIndex >= 0) {
      depts[existingIndex] = { ...depts[existingIndex], ...info };
    } else {
      depts.push(info);
    }
    localStorage.setItem(DEPT_REGISTRY_KEY, JSON.stringify(depts));
  } catch (err) {
    console.error('Failed to update registry', err);
  }
}

export function ensureDepartmentExists(code: string, name?: string): DepartmentDatabase {
  const normCode = normalizeCode(code);
  const existing = getDepartmentDB(normCode);
  if (existing) return existing;

  const defaultName = name || `Abteilung ${normCode}`;
  const seedDB = createSeedDepartmentDatabase(normCode, defaultName);
  saveDepartmentDB(normCode, seedDB);

  updateRegistry({
    code: normCode,
    name: defaultName,
    createdAt: seedDB.createdAt,
    lastModified: seedDB.lastModified,
  });

  return seedDB;
}

export function createNewDepartment(
  code: string,
  name?: string,
  template: 'seed' | 'empty' = 'seed'
): DepartmentDatabase {
  const normCode = normalizeCode(code);
  const defaultName = name && name.trim() ? name.trim() : `Abteilung ${normCode}`;

  let newDB: DepartmentDatabase;
  if (template === 'empty') {
    newDB = {
      departmentCode: normCode,
      departmentName: defaultName,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      machines: [],
      employees: [],
      absences: [],
      manualOverrides: [],
      layoutSettings: {
        ...DEFAULT_LAYOUT_SETTINGS,
        departmentDisplayName: defaultName,
      },
    };
  } else {
    newDB = createSeedDepartmentDatabase(normCode, defaultName);
  }

  saveDepartmentDB(normCode, newDB);
  return newDB;
}

function migrateDatabase(db: DepartmentDatabase): DepartmentDatabase {
  let changed = false;

  const migratedEmployees = db.employees.map((emp) => {
    if (!emp.customSequence || emp.customSequence.length === 0) {
      if (emp.shiftModel === '3-schicht') {
        changed = true;
        return { ...emp, customSequence: ['frueh', 'nacht', 'spaet'] as ShiftId[] };
      }
      return emp;
    }

    const seqStr = emp.customSequence.join(',');

    // Migrate standard 3-shift old rhythm (F -> S -> N) to new rhythm (F -> N -> S/Mittag)
    if (seqStr === 'frueh,spaet,nacht') {
      changed = true;
      return { ...emp, customSequence: ['frueh', 'nacht', 'spaet'] as ShiftId[] };
    }
    // Who was on old offset (S -> N -> F) -> in new rhythm, who has Nacht now has next Spät then Früh (N -> S -> F)
    if (seqStr === 'spaet,nacht,frueh') {
      changed = true;
      return { ...emp, customSequence: ['nacht', 'spaet', 'frueh'] as ShiftId[] };
    }
    // Who was on old offset (N -> F -> S) -> in new rhythm, who has Spät now has next Früh then Nacht (S -> F -> N)
    if (seqStr === 'nacht,frueh,spaet') {
      changed = true;
      return { ...emp, customSequence: ['spaet', 'frueh', 'nacht'] as ShiftId[] };
    }
    // 4-shift leader cycles with 'frei'
    if (seqStr === 'frueh,spaet,nacht,frei') {
      changed = true;
      return { ...emp, customSequence: ['frueh', 'nacht', 'spaet', 'frei'] as ShiftId[] };
    }
    if (seqStr === 'spaet,nacht,frei,frueh') {
      changed = true;
      return { ...emp, customSequence: ['nacht', 'spaet', 'frei', 'frueh'] as ShiftId[] };
    }
    if (seqStr === 'nacht,frei,frueh,spaet') {
      changed = true;
      return { ...emp, customSequence: ['spaet', 'frei', 'frueh', 'nacht'] as ShiftId[] };
    }

    return emp;
  });

  if (changed) {
    const updated = { ...db, employees: migratedEmployees };
    try {
      localStorage.setItem(`${DB_PREFIX}${normalizeCode(db.departmentCode)}`, JSON.stringify(updated));
    } catch {
      // ignore
    }
    return updated;
  }

  return db;
}

export function getDepartmentDB(code: string): DepartmentDatabase | null {
  try {
    const normCode = normalizeCode(code);
    const raw = localStorage.getItem(`${DB_PREFIX}${normCode}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DepartmentDatabase;
    return migrateDatabase(parsed);
  } catch (err) {
    console.error(`Failed to read database for ${code}`, err);
    return null;
  }
}

export function saveDepartmentDB(code: string, data: DepartmentDatabase): void {
  try {
    const normCode = normalizeCode(code);
    const updated: DepartmentDatabase = {
      ...data,
      departmentCode: normCode,
      lastModified: new Date().toISOString(),
    };
    localStorage.setItem(`${DB_PREFIX}${normCode}`, JSON.stringify(updated));

    updateRegistry({
      code: normCode,
      name: data.departmentName || `Abteilung ${normCode}`,
      createdAt: data.createdAt || new Date().toISOString(),
      lastModified: updated.lastModified,
      machineCount: data.machines?.length || 0,
      employeeCount: data.employees?.length || 0,
    });
  } catch (err) {
    console.error(`Failed to save database for ${code}`, err);
  }
}

export function deleteDepartment(code: string): void {
  try {
    const normCode = normalizeCode(code);
    localStorage.removeItem(`${DB_PREFIX}${normCode}`);
    const depts = listRegisteredDepartments().filter((d) => d.code !== normCode);
    localStorage.setItem(DEPT_REGISTRY_KEY, JSON.stringify(depts));
    if (getCurrentDepartmentCode() === normCode) {
      setCurrentDepartmentCode(null);
    }
  } catch (err) {
    console.error('Failed to delete department', err);
  }
}

export function exportDepartmentJSON(code: string): string {
  const db = getDepartmentDB(code);
  if (!db) return '';
  return JSON.stringify(db, null, 2);
}

export function importDepartmentJSON(jsonStr: string): { success: boolean; code?: string; error?: string } {
  try {
    const parsed = JSON.parse(jsonStr) as DepartmentDatabase;
    if (!parsed.departmentCode || !Array.isArray(parsed.employees) || !Array.isArray(parsed.machines)) {
      return { success: false, error: 'Ungültiges Schichtplan-Datenbankformat.' };
    }
    const normCode = normalizeCode(parsed.departmentCode);
    saveDepartmentDB(normCode, parsed);
    return { success: true, code: normCode };
  } catch (err) {
    return { success: false, error: 'JSON-Parsing-Fehler: ' + (err instanceof Error ? err.message : String(err)) };
  }
}

export function createSeedDepartmentDatabase(code: string, name: string): DepartmentDatabase {
  const isCnc = code.includes('CNC') || code.includes('FERT');

  const machines: Machine[] = isCnc
    ? [
        {
          id: 'm-1',
          departmentCode: code,
          code: 'CNC-01',
          name: 'DMG Mori 5-Achs DMU 50',
          area: 'Halle 2 - Zerspanung Süd',
          shiftModel: '3-schicht',
          minStaffPerShift: { frueh: 1, spaet: 1, nacht: 1 },
          status: 'aktiv',
          notes: 'Präzisionsfräsen für Titan- & Edelstahlkomponenten',
        },
        {
          id: 'm-2',
          departmentCode: code,
          code: 'CNC-02',
          name: 'Hermle C42U 5-Achs',
          area: 'Halle 2 - Zerspanung Süd',
          shiftModel: '3-schicht',
          minStaffPerShift: { frueh: 1, spaet: 1, nacht: 1 },
          status: 'aktiv',
          notes: 'Großteilbearbeitung',
        },
        {
          id: 'm-3',
          departmentCode: code,
          code: 'DREH-01',
          name: 'Gildemeister CTX beta 1250 TC',
          area: 'Halle 2 - Drehzentrum',
          shiftModel: '2-schicht',
          minStaffPerShift: { frueh: 1, spaet: 1, nacht: 0 },
          status: 'aktiv',
          notes: 'Dreh-Fräszentrum',
        },
        {
          id: 'm-4',
          departmentCode: code,
          code: 'ROBO-01',
          name: 'KUKA Palettier- und Beladezelle',
          area: 'Halle 2 - Automationsinsel',
          shiftModel: '3-schicht',
          minStaffPerShift: { frueh: 1, spaet: 1, nacht: 1 },
          status: 'aktiv',
          notes: 'Automatisierte Werkstückbeschickung',
        },
        {
          id: 'm-5',
          departmentCode: code,
          code: 'MESS-01',
          name: 'Zeiss 3D-Koordinatenmessmaschine',
          area: 'Halle 2 - Messraum',
          shiftModel: '2-schicht',
          minStaffPerShift: { frueh: 1, spaet: 1, nacht: 0 },
          status: 'aktiv',
          notes: 'Qualitätssicherung und Erstmusterprüfberichte',
        },
      ]
    : [
        {
          id: 'm-1',
          departmentCode: code,
          code: 'LINIE-1',
          name: 'Hauptmontage Taktstraße 1',
          area: 'Halle 5 - Endmontage',
          shiftModel: '2-schicht',
          minStaffPerShift: { frueh: 2, spaet: 2, nacht: 0 },
          status: 'aktiv',
        },
        {
          id: 'm-2',
          departmentCode: code,
          code: 'TEST-01',
          name: 'Elektrische Endprüfung & HV-Test',
          area: 'Halle 5 - Prüffeld',
          shiftModel: '2-schicht',
          minStaffPerShift: { frueh: 1, spaet: 1, nacht: 0 },
          status: 'aktiv',
        },
        {
          id: 'm-3',
          departmentCode: code,
          code: 'VERP-01',
          name: 'Roboter-Verpackungslinie',
          area: 'Halle 5 - Logistikübergabe',
          shiftModel: '3-schicht',
          minStaffPerShift: { frueh: 1, spaet: 1, nacht: 1 },
          status: 'aktiv',
        },
      ];

  const employees: Employee[] = [
    // 1. Teamleiter
    {
      id: 'e-1',
      departmentCode: code,
      personnelNumber: 'P-1001',
      firstName: 'Klaus',
      lastName: 'Bauer',
      role: 'teamleiter',
      shiftModel: '1-schicht',
      excludedShifts: ['spaet', 'nacht'],
      customSequence: ['frueh'],
      rotationOffsetWeeks: 0,
      qualifiedMachineIds: ['m-1', 'm-2', 'm-3', 'm-4', 'm-5'],
      phone: '+49 171 4529101',
      notes: 'Gesamtverantwortung Abteilung Fertigung',
      active: true,
    },
    // 2. Schichtführer 1
    {
      id: 'e-2',
      departmentCode: code,
      personnelNumber: 'P-1002',
      firstName: 'Markus',
      lastName: 'Weber',
      role: 'schichtfuehrer',
      shiftModel: '3-schicht',
      excludedShifts: [],
      customSequence: ['frueh', 'nacht', 'spaet', 'frei'],
      rotationOffsetWeeks: 0,
      qualifiedMachineIds: ['m-1', 'm-2', 'm-3', 'm-4'],
      phone: '+49 171 9081234',
      notes: 'Schichtführer Gruppe A (Ersthelfer & Sicherheitsbeauftragter)',
      active: true,
    },
    // 3. Schichtführer 2
    {
      id: 'e-3',
      departmentCode: code,
      personnelNumber: 'P-1003',
      firstName: 'Stefan',
      lastName: 'Richter',
      role: 'schichtfuehrer',
      shiftModel: '3-schicht',
      excludedShifts: [],
      customSequence: ['nacht', 'spaet', 'frei', 'frueh'],
      rotationOffsetWeeks: 0,
      qualifiedMachineIds: ['m-1', 'm-2', 'm-3'],
      phone: '+49 171 8723451',
      notes: 'Schichtführer Gruppe B',
      active: true,
    },
    // 4. Schichtführer 3
    {
      id: 'e-4',
      departmentCode: code,
      personnelNumber: 'P-1004',
      firstName: 'Thomas',
      lastName: 'Müller',
      role: 'schichtfuehrer',
      shiftModel: '3-schicht',
      excludedShifts: [],
      customSequence: ['spaet', 'frei', 'frueh', 'nacht'],
      rotationOffsetWeeks: 0,
      qualifiedMachineIds: ['m-1', 'm-2', 'm-4'],
      phone: '+49 171 6612984',
      notes: 'Schichtführer Gruppe C',
      active: true,
    },
    // 5. Mitarbeiter 1 (3-Schicht: Früh -> Nacht -> Spät/Mittag)
    {
      id: 'e-5',
      departmentCode: code,
      personnelNumber: 'P-1005',
      firstName: 'Alexander',
      lastName: 'Schmidt',
      role: 'mitarbeiter',
      shiftModel: '3-schicht',
      excludedShifts: [],
      customSequence: ['frueh', 'nacht', 'spaet'],
      rotationOffsetWeeks: 0,
      qualifiedMachineIds: ['m-1', 'm-2'],
      preferredMachineId: 'm-1',
      phone: '+49 160 5512399',
      notes: 'CNC-Spezialist 5-Achs',
      active: true,
    },
    // 6. Mitarbeiter 2 (3-Schicht versetzt: Jetzt Nacht -> nächste Woche Spät/Mittag -> danach Früh)
    {
      id: 'e-6',
      departmentCode: code,
      personnelNumber: 'P-1006',
      firstName: 'Christian',
      lastName: 'Wagner',
      role: 'mitarbeiter',
      shiftModel: '3-schicht',
      excludedShifts: [],
      customSequence: ['nacht', 'spaet', 'frueh'],
      rotationOffsetWeeks: 0,
      qualifiedMachineIds: ['m-1', 'm-2'],
      preferredMachineId: 'm-1',
      phone: '+49 160 8823101',
      active: true,
    },
    // 7. Mitarbeiter 3 (3-Schicht versetzt: Jetzt Spät/Mittag -> nächste Woche Früh -> danach Nacht)
    {
      id: 'e-7',
      departmentCode: code,
      personnelNumber: 'P-1007',
      firstName: 'Michael',
      lastName: 'Koch',
      role: 'mitarbeiter',
      shiftModel: '3-schicht',
      excludedShifts: [],
      customSequence: ['spaet', 'frueh', 'nacht'],
      rotationOffsetWeeks: 0,
      qualifiedMachineIds: ['m-2', 'm-4'],
      preferredMachineId: 'm-2',
      phone: '+49 160 9944122',
      active: true,
    },
    // 8. Mitarbeiter 4 (2-Schicht, schließt Nachtschicht aus!)
    {
      id: 'e-8',
      departmentCode: code,
      personnelNumber: 'P-1008',
      firstName: 'Hanna',
      lastName: 'Schneider',
      role: 'mitarbeiter',
      shiftModel: '2-schicht',
      excludedShifts: ['nacht'],
      customSequence: ['frueh', 'spaet'],
      rotationOffsetWeeks: 0,
      qualifiedMachineIds: ['m-3', 'm-5'],
      preferredMachineId: 'm-3',
      phone: '+49 152 4433211',
      notes: 'Aus gesundheitlichen Gründen kein Nachtdienst',
      active: true,
    },
    // 9. Mitarbeiter 5 (2-Schicht versetzt)
    {
      id: 'e-9',
      departmentCode: code,
      personnelNumber: 'P-1009',
      firstName: 'Jürgen',
      lastName: 'Fischer',
      role: 'mitarbeiter',
      shiftModel: '2-schicht',
      excludedShifts: ['nacht'],
      customSequence: ['spaet', 'frueh'],
      rotationOffsetWeeks: 0,
      qualifiedMachineIds: ['m-3', 'm-5'],
      preferredMachineId: 'm-3',
      phone: '+49 152 7712390',
      active: true,
    },
    // 10. Mitarbeiter 6 (3-Schicht Robotik)
    {
      id: 'e-10',
      departmentCode: code,
      personnelNumber: 'P-1010',
      firstName: 'David',
      lastName: 'Becker',
      role: 'mitarbeiter',
      shiftModel: '3-schicht',
      excludedShifts: [],
      customSequence: ['frueh', 'nacht', 'spaet'],
      rotationOffsetWeeks: 1,
      qualifiedMachineIds: ['m-4', 'm-1'],
      preferredMachineId: 'm-4',
      phone: '+49 176 3311988',
      active: true,
    },
    // 11. Mitarbeiter 7 (1-Schicht Messraum / Tagschicht)
    {
      id: 'e-11',
      departmentCode: code,
      personnelNumber: 'P-1011',
      firstName: 'Sabine',
      lastName: 'Hoffmann',
      role: 'mitarbeiter',
      shiftModel: '1-schicht',
      excludedShifts: ['spaet', 'nacht'],
      customSequence: ['frueh'],
      rotationOffsetWeeks: 0,
      qualifiedMachineIds: ['m-5'],
      preferredMachineId: 'm-5',
      phone: '+49 176 8877112',
      notes: 'QS-Messraum Leitung Tagesbetrieb',
      active: true,
    },
    // 12. Springer / Aushilfe
    {
      id: 'e-12',
      departmentCode: code,
      personnelNumber: 'P-1012',
      firstName: 'Tobias',
      lastName: 'Klein',
      role: 'springer',
      shiftModel: '3-schicht',
      excludedShifts: [],
      customSequence: ['frueh', 'nacht', 'spaet'],
      rotationOffsetWeeks: 2,
      qualifiedMachineIds: ['m-1', 'm-2', 'm-3', 'm-4', 'm-5'],
      phone: '+49 151 2299881',
      notes: 'Flexibler Springer für Krankheits- und Urlaubsausfälle',
      active: true,
    },
  ];

  // Some sample absences in the current or upcoming weeks
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const absences: Absence[] = [
    {
      id: 'abs-1',
      departmentCode: code,
      employeeId: 'e-7', // Michael Koch
      type: 'urlaub',
      startDate: `${year}-${month}-15`,
      endDate: `${year}-${month}-21`,
      note: 'Erholungsurlaub Sommer',
      substituteEmployeeId: 'e-12',
    },
    {
      id: 'abs-2',
      departmentCode: code,
      employeeId: 'e-6', // Christian Wagner
      type: 'krank',
      startDate: `${year}-${month}-08`,
      endDate: `${year}-${month}-12`,
      note: 'AU ärztlich attestiert',
      substituteEmployeeId: 'e-12',
    },
  ];

  return {
    departmentCode: code,
    departmentName: name,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    machines,
    employees,
    absences,
    manualOverrides: [],
    layoutSettings: {
      ...DEFAULT_LAYOUT_SETTINGS,
      departmentDisplayName: `${name} (${code})`,
    },
  };
}
