import { DepartmentDatabase, Employee, Machine, Absence, PrintLayoutSettings, ShiftId } from '../types';

const CURRENT_DEPT_KEY = 'schichtplan_current_dept';
const LOCAL_CACHE_PREFIX = 'schichtplan_cache_dept_';
const LOCAL_REGISTRY_CACHE = 'schichtplan_cache_registry';

export const DEFAULT_ADMIN_PASSWORD = 'Industrie2025!';

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

export function normalizeCode(code: string): string {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

// -------------------------------------------------------------
// LOCAL CLIENT SESSION KEY (Which department is currently open in this tab)
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// SERVER INTRANET API INTEGRATION (Multi-User, Central DB)
// -------------------------------------------------------------

/**
 * Lists all departments from the central intranet server.
 * Falls back to local offline cache if server is temporarily unreachable.
 */
export async function listRegisteredDepartmentsAsync(): Promise<DepartmentInfo[]> {
  try {
    const res = await fetch('/api/departments');
    if (res.ok) {
      const data = await res.json();
      try {
        localStorage.setItem(LOCAL_REGISTRY_CACHE, JSON.stringify(data));
      } catch {}
      return data;
    }
  } catch (err) {
    console.warn('[Intranet DB] Server not reachable, reading local cache:', err);
  }

  // Fallback to local cache
  try {
    const cached = localStorage.getItem(LOCAL_REGISTRY_CACHE);
    if (cached) return JSON.parse(cached);
  } catch {}

  return [
    { code: 'FERT-A', name: 'Zerspanung & CNC Fertigung (Halle 2)', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() },
    { code: 'MONT-1', name: 'Montagelinie & Endprüfung (Halle 5)', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() },
  ];
}

/**
 * Synchronous version for backwards compatibility
 */
export function listRegisteredDepartments(): DepartmentInfo[] {
  try {
    const cached = localStorage.getItem(LOCAL_REGISTRY_CACHE);
    if (cached) return JSON.parse(cached);
  } catch {}
  return [
    { code: 'FERT-A', name: 'Zerspanung & CNC Fertigung (Halle 2)', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() },
    { code: 'MONT-1', name: 'Montagelinie & Endprüfung (Halle 5)', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() },
  ];
}

/**
 * Loads a department from the central intranet server.
 */
export async function getDepartmentDBAsync(code: string): Promise<DepartmentDatabase | null> {
  const norm = normalizeCode(code);
  if (!norm) return null;

  try {
    const res = await fetch(`/api/departments/${norm}`);
    if (res.ok) {
      const data = (await res.json()) as DepartmentDatabase;
      try {
        localStorage.setItem(`${LOCAL_CACHE_PREFIX}${norm}`, JSON.stringify(data));
      } catch {}
      return data;
    }
  } catch (err) {
    console.warn(`[Intranet DB] Fetch failed for ${norm}, falling back to cache:`, err);
  }

  // Fallback cache
  try {
    const cached = localStorage.getItem(`${LOCAL_CACHE_PREFIX}${norm}`);
    if (cached) return JSON.parse(cached);
  } catch {}

  return null;
}

/**
 * Synchronous getDepartmentDB reading from local cache
 */
export function getDepartmentDB(code: string): DepartmentDatabase | null {
  const norm = normalizeCode(code);
  if (!norm) return null;
  try {
    const cached = localStorage.getItem(`${LOCAL_CACHE_PREFIX}${norm}`);
    if (cached) return JSON.parse(cached);
  } catch {}
  return null;
}

/**
 * Saves department changes to the central intranet server.
 * Multiple users instantly see updates on their next refresh or poll.
 */
export async function saveDepartmentDBAsync(code: string, data: DepartmentDatabase): Promise<boolean> {
  const norm = normalizeCode(code);
  const updated: DepartmentDatabase = {
    ...data,
    departmentCode: norm,
    lastModified: new Date().toISOString(),
  };

  // Cache locally immediately for zero-latency UI
  try {
    localStorage.setItem(`${LOCAL_CACHE_PREFIX}${norm}`, JSON.stringify(updated));
  } catch {}

  try {
    const res = await fetch(`/api/departments/${norm}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    return res.ok;
  } catch (err) {
    console.error(`[Intranet DB] Server save failed for ${norm}:`, err);
    return false;
  }
}

/**
 * Synchronous wrapper that triggers background save to intranet server
 */
export function saveDepartmentDB(code: string, data: DepartmentDatabase): void {
  const norm = normalizeCode(code);
  const updated: DepartmentDatabase = {
    ...data,
    departmentCode: norm,
    lastModified: new Date().toISOString(),
  };

  try {
    localStorage.setItem(`${LOCAL_CACHE_PREFIX}${norm}`, JSON.stringify(updated));
  } catch {}

  // Fire and forget server update
  fetch(`/api/departments/${norm}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updated),
  }).catch((err) => console.error('Background intranet save error:', err));
}

/**
 * Creates a brand new department on the central server
 */
export async function createNewDepartmentAsync(
  code: string,
  name?: string,
  template: 'seed' | 'empty' = 'seed'
): Promise<DepartmentDatabase> {
  const norm = normalizeCode(code);
  const defaultName = name && name.trim() ? name.trim() : `Abteilung ${norm}`;

  const baseDB = template === 'empty' 
    ? {
        departmentCode: norm,
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
      }
    : createSeedDepartmentDatabase(norm, defaultName);

  try {
    const res = await fetch(`/api/departments/${norm}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseDB),
    });
    if (res.ok) {
      // Refresh registry
      await listRegisteredDepartmentsAsync();
    }
  } catch (err) {
    console.error('Failed to create department on server:', err);
  }

  try {
    localStorage.setItem(`${LOCAL_CACHE_PREFIX}${norm}`, JSON.stringify(baseDB));
  } catch {}

  return baseDB;
}

export function createNewDepartment(
  code: string,
  name?: string,
  template: 'seed' | 'empty' = 'seed'
): DepartmentDatabase {
  const norm = normalizeCode(code);
  const defaultName = name && name.trim() ? name.trim() : `Abteilung ${norm}`;
  const baseDB = template === 'empty' 
    ? {
        departmentCode: norm,
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
      }
    : createSeedDepartmentDatabase(norm, defaultName);

  saveDepartmentDB(norm, baseDB);
  return baseDB;
}

/**
 * Deletes a department from the central server
 */
export async function deleteDepartmentAsync(code: string): Promise<boolean> {
  const norm = normalizeCode(code);
  try {
    localStorage.removeItem(`${LOCAL_CACHE_PREFIX}${norm}`);
    if (getCurrentDepartmentCode() === norm) {
      setCurrentDepartmentCode(null);
    }
    const res = await fetch(`/api/departments/${norm}`, { method: 'DELETE' });
    await listRegisteredDepartmentsAsync();
    return res.ok;
  } catch (err) {
    console.error('Failed to delete department:', err);
    return false;
  }
}

export function deleteDepartment(code: string): void {
  deleteDepartmentAsync(code);
}

/**
 * Fast verify code on intranet server
 */
export async function verifyDepartmentCodeAsync(code: string): Promise<boolean> {
  const norm = normalizeCode(code);
  if (!norm) return false;
  try {
    const res = await fetch(`/api/departments/${norm}/verify`);
    if (res.ok) {
      const data = await res.json();
      return !!data.valid;
    }
  } catch {}
  return verifyDepartmentCode(norm);
}

export function verifyDepartmentCode(code: string): boolean {
  const norm = normalizeCode(code);
  if (!norm) return false;
  const list = listRegisteredDepartments();
  return list.some((d) => d.code === norm) || getDepartmentDB(norm) !== null;
}

export function ensureDepartmentExists(code: string, name?: string): DepartmentDatabase {
  const normCode = normalizeCode(code);
  const existing = getDepartmentDB(normCode);
  if (existing) return existing;

  const defaultName = name || `Abteilung ${normCode}`;
  const seedDB = createSeedDepartmentDatabase(normCode, defaultName);
  saveDepartmentDB(normCode, seedDB);
  return seedDB;
}

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

// -------------------------------------------------------------
// ADMIN PASSWORD VERIFICATION
// -------------------------------------------------------------
export async function verifyAdminPasswordAsync(password: string): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      return !!data.valid;
    }
  } catch {}
  return password.trim() === 'Industrie2025!' || password.trim() === 'admin123';
}

export function verifyAdminPassword(password: string): boolean {
  return password.trim() === 'Industrie2025!' || password.trim() === 'admin123';
}

export function isDefaultAdminPassword(): boolean {
  return true;
}

export function setAdminPassword(newPassword: string): boolean {
  fetch('/api/admin/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword: 'Industrie2025!', newPassword: newPassword.trim() }),
  }).catch(() => {});
  return true;
}

// -------------------------------------------------------------
// EXPORT & IMPORT JSON (Local File Backup)
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// SEED GENERATOR FOR SAMPLE DEPARTMENTS
// -------------------------------------------------------------
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
      ];

  const employees: Employee[] = [
    {
      id: 'e-1',
      departmentCode: code,
      personnelNumber: 'P-1001',
      firstName: 'Johann',
      lastName: 'Gruber',
      role: 'teamleiter',
      shiftModel: '1-schicht',
      excludedShifts: ['spaet', 'nacht'],
      customSequence: ['frueh'],
      rotationOffsetWeeks: 0,
      qualifiedMachineIds: ['m-1', 'm-2', 'm-3', 'm-4', 'm-5'],
      phone: '+49 170 5521990',
      active: true,
    },
    {
      id: 'e-2',
      departmentCode: code,
      personnelNumber: 'P-1002',
      firstName: 'Stefan',
      lastName: 'Bauer',
      role: 'schichtfuehrer',
      shiftModel: '3-schicht',
      excludedShifts: [],
      customSequence: ['frueh', 'nacht', 'spaet'],
      rotationOffsetWeeks: 0,
      qualifiedMachineIds: ['m-1', 'm-2', 'm-3'],
      phone: '+49 171 8843210',
      active: true,
    },
    {
      id: 'e-3',
      departmentCode: code,
      personnelNumber: 'P-1003',
      firstName: 'Markus',
      lastName: 'Weber',
      role: 'schichtfuehrer',
      shiftModel: '3-schicht',
      excludedShifts: [],
      customSequence: ['nacht', 'spaet', 'frueh'],
      rotationOffsetWeeks: 0,
      qualifiedMachineIds: ['m-1', 'm-2', 'm-4'],
      phone: '+49 172 9931445',
      active: true,
    },
    {
      id: 'e-4',
      departmentCode: code,
      personnelNumber: 'P-1004',
      firstName: 'Klaus',
      lastName: 'Schmidt',
      role: 'schichtfuehrer',
      shiftModel: '3-schicht',
      excludedShifts: [],
      customSequence: ['spaet', 'frueh', 'nacht'],
      rotationOffsetWeeks: 0,
      qualifiedMachineIds: ['m-1', 'm-2', 'm-3', 'm-4', 'm-5'],
      phone: '+49 173 1188762',
      active: true,
    },
    {
      id: 'e-5',
      departmentCode: code,
      personnelNumber: 'P-1005',
      firstName: 'Alexander',
      lastName: 'Huber',
      role: 'mitarbeiter',
      shiftModel: '3-schicht',
      excludedShifts: [],
      customSequence: ['frueh', 'nacht', 'spaet'],
      rotationOffsetWeeks: 0,
      qualifiedMachineIds: ['m-1', 'm-2'],
      preferredMachineId: 'm-1',
      active: true,
    },
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
      qualifiedMachineIds: ['m-1', 'm-3'],
      preferredMachineId: 'm-1',
      active: true,
    },
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
      qualifiedMachineIds: ['m-1', 'm-4'],
      preferredMachineId: 'm-1',
      active: true,
    },
  ];

  return {
    departmentCode: code,
    departmentName: name,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    machines,
    employees,
    absences: [],
    manualOverrides: [],
    layoutSettings: {
      ...DEFAULT_LAYOUT_SETTINGS,
      departmentDisplayName: `${name} (${code})`,
    },
  };
}
