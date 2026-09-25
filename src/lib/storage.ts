import { DepartmentDatabase, Employee, Machine, Absence, PrintLayoutSettings, ShiftId } from '../types';

const CURRENT_DEPT_KEY = 'schichtplan_current_dept';
const LOCAL_CACHE_PREFIX = 'schichtplan_cache_dept_';
const LOCAL_REGISTRY_CACHE = 'schichtplan_cache_registry';
const LOCAL_ADMIN_PASSWORD_KEY = 'schichtplan_admin_password';
// Merkt sich dauerhaft (über Sessions hinweg), ob dieser Browser jemals
// einen echten Intranet-Server gesprochen hat. Der lokale Passwort-Fallback
// (siehe unten) darf NUR greifen, wenn dieses Flag nie gesetzt wurde - sonst
// könnte jemand im Firmennetz den echten Server kurz stören und danach den
// Fallback mit dem Standardpasswort missbrauchen. Ein einzelner
// fehlgeschlagener Request (Timeout, Neustart) reicht dafür nicht aus,
// weil ein Browser, der den echten Server einmal gesehen hat, ihn nie wieder
// als "gab es nie" behandeln darf.
const EVER_SAW_REAL_SERVER_KEY = 'schichtplan_ever_saw_real_server';

export const DEFAULT_ADMIN_PASSWORD = 'Industrie2025!';

let cachedServerStatus: { online: boolean; timestamp: number } | null = null;

function markRealServerSeen(): void {
  try {
    localStorage.setItem(EVER_SAW_REAL_SERVER_KEY, '1');
  } catch {}
}

function hasEverSeenRealServer(): boolean {
  try {
    return localStorage.getItem(EVER_SAW_REAL_SERVER_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Hilfsfunktion für sichere API-Aufrufe. Verhindert Fehler, wenn statische Hosts
 * (wie Vercel SPA-Routing) bei 404-Routen die index.html zurückgeben.
 */
async function fetchApiJson<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options?.headers || {}),
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // Kein echter JSON-Server (z.B. Vercel SPA-Rewrite lieferte HTML)
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function checkServerConnection(force = false): Promise<boolean> {
  const now = Date.now();
  if (!force && cachedServerStatus && (now - cachedServerStatus.timestamp < 10000)) {
    return cachedServerStatus.online;
  }

  try {
    const data = await fetchApiJson<{ status: string; mode: string }>('/api/status');
    const isOnline = !!data && data.status === 'online' && data.mode === 'intranet-local-database';
    if (isOnline) markRealServerSeen();
    cachedServerStatus = { online: isOnline, timestamp: now };
    return isOnline;
  } catch {
    cachedServerStatus = { online: false, timestamp: now };
    return false;
  }
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
// LOCAL REGISTRY HELPERS
// -------------------------------------------------------------
function getLocalRegistry(): DepartmentInfo[] {
  try {
    const cached = localStorage.getItem(LOCAL_REGISTRY_CACHE);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  // Scan localStorage for any saved departments
  const found: DepartmentInfo[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LOCAL_CACHE_PREFIX)) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            found.push({
              code: parsed.departmentCode,
              name: parsed.departmentName || `Abteilung ${parsed.departmentCode}`,
              createdAt: parsed.createdAt || new Date().toISOString(),
              lastModified: parsed.lastModified || new Date().toISOString(),
              machineCount: parsed.machines?.length || 0,
              employeeCount: parsed.employees?.length || 0,
            });
          }
        } catch {}
      }
    }
  } catch {}

  if (found.length > 0) {
    return found;
  }

  // Initial default seed departments
  const defaultList: DepartmentInfo[] = [
    {
      code: 'FERT-A',
      name: 'Zerspanung & CNC Fertigung (Halle 2)',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      machineCount: 5,
      employeeCount: 7,
    },
    {
      code: 'MONT-1',
      name: 'Montagelinie & Endprüfung (Halle 5)',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      machineCount: 2,
      employeeCount: 3,
    },
  ];

  try {
    localStorage.setItem(LOCAL_REGISTRY_CACHE, JSON.stringify(defaultList));
  } catch {}

  return defaultList;
}

function updateDepartmentInRegistryCache(db: DepartmentDatabase): void {
  try {
    const current = getLocalRegistry();
    const existingIndex = current.findIndex((d) => d.code === db.departmentCode);
    const info: DepartmentInfo = {
      code: db.departmentCode,
      name: db.departmentName || `Abteilung ${db.departmentCode}`,
      createdAt: db.createdAt || new Date().toISOString(),
      lastModified: db.lastModified || new Date().toISOString(),
      machineCount: db.machines?.length || 0,
      employeeCount: db.employees?.length || 0,
    };

    if (existingIndex >= 0) {
      current[existingIndex] = info;
    } else {
      current.push(info);
    }
    localStorage.setItem(LOCAL_REGISTRY_CACHE, JSON.stringify(current));
  } catch {}
}

function removeDepartmentFromRegistryCache(code: string): void {
  try {
    const current = getLocalRegistry().filter((d) => d.code !== code);
    localStorage.setItem(LOCAL_REGISTRY_CACHE, JSON.stringify(current));
  } catch {}
}

// -------------------------------------------------------------
// SERVER INTRANET API & SEAMLESS LOCAL FALLBACK
// -------------------------------------------------------------

/**
 * Lists all departments from the server, falling back to local registry.
 */
export async function listRegisteredDepartmentsAsync(): Promise<DepartmentInfo[]> {
  const data = await fetchApiJson<DepartmentInfo[]>('/api/departments');
  if (Array.isArray(data) && data.length > 0) {
    try {
      localStorage.setItem(LOCAL_REGISTRY_CACHE, JSON.stringify(data));
    } catch {}
    return data;
  }

  return getLocalRegistry();
}

/**
 * Synchronous version for instant UI rendering
 */
export function listRegisteredDepartments(): DepartmentInfo[] {
  return getLocalRegistry();
}

/**
 * Füllt fehlende/kaputte Arrays einer geladenen Abteilung defensiv auf
 */
function normalizeDepartmentDatabase(data: DepartmentDatabase): DepartmentDatabase {
  return {
    ...data,
    machines: Array.isArray(data.machines) ? data.machines : [],
    employees: Array.isArray(data.employees) ? data.employees : [],
    absences: Array.isArray(data.absences) ? data.absences : [],
    manualOverrides: Array.isArray(data.manualOverrides) ? data.manualOverrides : [],
    version: typeof data.version === 'number' ? data.version : 1,
  };
}

/**
 * Loads a department from the server or local storage.
 */
export async function getDepartmentDBAsync(code: string): Promise<DepartmentDatabase | null> {
  const norm = normalizeCode(code);
  if (!norm) return null;

  // 1. Try server fetch
  const serverData = await fetchApiJson<DepartmentDatabase>(`/api/departments/${norm}`);
  if (serverData) {
    const data = normalizeDepartmentDatabase(serverData);
    try {
      localStorage.setItem(`${LOCAL_CACHE_PREFIX}${norm}`, JSON.stringify(data));
      updateDepartmentInRegistryCache(data);
    } catch {}
    return data;
  }

  // 2. Local storage cache
  try {
    const cached = localStorage.getItem(`${LOCAL_CACHE_PREFIX}${norm}`);
    if (cached) {
      const parsed = normalizeDepartmentDatabase(JSON.parse(cached));
      return parsed;
    }
  } catch {}

  // 3. If seed department FERT-A or MONT-1, generate seed data and save locally
  if (norm === 'FERT-A' || norm === 'MONT-1') {
    const seed = createSeedDepartmentDatabase(
      norm,
      norm === 'FERT-A' ? 'Zerspanung & CNC Fertigung (Halle 2)' : 'Montagelinie & Endprüfung (Halle 5)'
    );
    try {
      localStorage.setItem(`${LOCAL_CACHE_PREFIX}${norm}`, JSON.stringify(seed));
      updateDepartmentInRegistryCache(seed);
    } catch {}
    return seed;
  }

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
    if (cached) return normalizeDepartmentDatabase(JSON.parse(cached));
  } catch {}

  if (norm === 'FERT-A' || norm === 'MONT-1') {
    const seed = createSeedDepartmentDatabase(
      norm,
      norm === 'FERT-A' ? 'Zerspanung & CNC Fertigung (Halle 2)' : 'Montagelinie & Endprüfung (Halle 5)'
    );
    try {
      localStorage.setItem(`${LOCAL_CACHE_PREFIX}${norm}`, JSON.stringify(seed));
      updateDepartmentInRegistryCache(seed);
    } catch {}
    return seed;
  }

  return null;
}

export type SaveResult =
  | { status: 'ok'; data: DepartmentDatabase }
  | { status: 'conflict'; current: DepartmentDatabase }
  | { status: 'error' };

/**
 * Saves department changes to the central intranet server when available,
 * and ALWAYS saves to local storage so user never loses data even on static hosts (Vercel) or offline.
 */
export async function saveDepartmentDBAsync(code: string, data: DepartmentDatabase): Promise<SaveResult> {
  const norm = normalizeCode(code);
  const currentVersion = data.version || 1;
  const newVersion = currentVersion + 1;
  const newTimestamp = new Date().toISOString();

  const locallySaved: DepartmentDatabase = {
    ...data,
    departmentCode: norm,
    version: newVersion,
    lastModified: newTimestamp,
  };

  // 1. Always save into LocalStorage first (instant zero-loss persistence)
  try {
    localStorage.setItem(`${LOCAL_CACHE_PREFIX}${norm}`, JSON.stringify(locallySaved));
    updateDepartmentInRegistryCache(locallySaved);
  } catch (err) {
    console.error('[Storage] Local storage write error:', err);
  }

  // 2. Sync to Server Intranet API if available
  try {
    const payload = {
      ...data,
      departmentCode: norm,
      baseVersion: data.version || 0,
    };

    const res = await fetch(`/api/departments/${norm}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const contentType = res.headers.get('content-type') || '';
    if (res.status === 409 && contentType.includes('application/json')) {
      const body = await res.json();
      return { status: 'conflict', current: normalizeDepartmentDatabase(body.current) };
    }

    if (res.ok && contentType.includes('application/json')) {
      const result = await res.json();
      const serverConfirmed: DepartmentDatabase = {
        ...data,
        departmentCode: norm,
        version: result.version || newVersion,
        lastModified: result.lastModified || newTimestamp,
      };
      try {
        localStorage.setItem(`${LOCAL_CACHE_PREFIX}${norm}`, JSON.stringify(serverConfirmed));
        updateDepartmentInRegistryCache(serverConfirmed);
      } catch {}
      return { status: 'ok', data: serverConfirmed };
    }
  } catch (err) {
    console.debug(`[Intranet DB] Server save unreachable for ${norm} (saved in local storage):`, err);
  }

  // If server is not running (e.g. Vercel static deployment or offline),
  // return success because data is safely saved in local storage!
  return { status: 'ok', data: locallySaved };
}

/**
 * Synchronous wrapper that saves locally and triggers background save to intranet server
 */
export function saveDepartmentDB(code: string, data: DepartmentDatabase): void {
  const norm = normalizeCode(code);
  const updated: DepartmentDatabase = {
    ...data,
    departmentCode: norm,
    version: (data.version || 1) + 1,
    lastModified: new Date().toISOString(),
  };

  try {
    localStorage.setItem(`${LOCAL_CACHE_PREFIX}${norm}`, JSON.stringify(updated));
    updateDepartmentInRegistryCache(updated);
  } catch {}

  // Fire and forget server update
  fetch(`/api/departments/${norm}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updated),
  }).catch(() => {});
}

/**
 * Creates a brand new department on server or locally
 */
export async function createNewDepartmentAsync(
  code: string,
  name?: string,
  template: 'seed' | 'empty' = 'seed'
): Promise<DepartmentDatabase> {
  const norm = normalizeCode(code);
  const defaultName = name && name.trim() ? name.trim() : `Abteilung ${norm}`;

  const baseDB: DepartmentDatabase =
    template === 'empty'
      ? {
          departmentCode: norm,
          departmentName: defaultName,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          version: 1,
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

  // Save locally
  try {
    localStorage.setItem(`${LOCAL_CACHE_PREFIX}${norm}`, JSON.stringify(baseDB));
    updateDepartmentInRegistryCache(baseDB);
  } catch {}

  // Try server
  try {
    const res = await fetch(`/api/departments/${norm}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseDB),
    });
    if (res.ok) {
      await listRegisteredDepartmentsAsync();
    }
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
  const baseDB =
    template === 'empty'
      ? {
          departmentCode: norm,
          departmentName: defaultName,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          version: 1,
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
 * Deletes a department
 */
export async function deleteDepartmentAsync(code: string): Promise<boolean> {
  const norm = normalizeCode(code);
  try {
    localStorage.removeItem(`${LOCAL_CACHE_PREFIX}${norm}`);
    removeDepartmentFromRegistryCache(norm);
    if (getCurrentDepartmentCode() === norm) {
      setCurrentDepartmentCode(null);
    }
  } catch {}

  try {
    const res = await fetch(`/api/departments/${norm}`, { method: 'DELETE' });
    return res.ok;
  } catch {}

  return true;
}

export function deleteDepartment(code: string): void {
  deleteDepartmentAsync(code);
}

export interface DepartmentBackup {
  date: string; // YYYY-MM-DD
  file: string;
}

/**
 * Listet die verfügbaren täglichen Server-Backups einer Abteilung auf
 * (neueste zuerst). Nur verfügbar gegen den echten Intranet-Server.
 */
export async function listDepartmentBackupsAsync(code: string): Promise<DepartmentBackup[]> {
  const norm = normalizeCode(code);
  const data = await fetchApiJson<DepartmentBackup[]>(`/api/departments/${norm}/backups`);
  return Array.isArray(data) ? data : [];
}

/**
 * Stellt ein bestimmtes tägliches Backup als aktuellen Stand der Abteilung wieder her.
 * Der bisherige (evtl. fehlerhafte) Stand wird dabei serverseitig selbst noch
 * einmal gesichert, bevor er überschrieben wird.
 */
export async function restoreDepartmentBackupAsync(
  code: string,
  date: string
): Promise<{ success: boolean; error?: string }> {
  const norm = normalizeCode(code);
  try {
    const res = await fetch(`/api/departments/${norm}/backups/${date}/restore`, { method: 'POST' });
    if (res.ok) return { success: true };
    const data = await res.json().catch(() => null);
    return { success: false, error: data?.error || 'Wiederherstellung fehlgeschlagen.' };
  } catch {
    return { success: false, error: 'Server nicht erreichbar.' };
  }
}

/**
 * Fast verify code on intranet server or local storage
 */
export async function verifyDepartmentCodeAsync(code: string): Promise<boolean> {
  const norm = normalizeCode(code);
  if (!norm) return false;

  const data = await fetchApiJson<{ valid: boolean }>(`/api/departments/${norm}/verify`);
  if (data && typeof data.valid === 'boolean') {
    return data.valid;
  }

  return verifyDepartmentCode(norm);
}

export function verifyDepartmentCode(code: string): boolean {
  const norm = normalizeCode(code);
  if (!norm) return false;
  if (norm === 'FERT-A' || norm === 'MONT-1') return true;
  const list = listRegisteredDepartments();
  return list.some((d) => d.code === norm) || getDepartmentDB(norm) !== null;
}

export function ensureDepartmentExists(code: string, name?: string): DepartmentDatabase {
  const normCode = normalizeCode(code);
  const existing = getDepartmentDB(normCode);
  if (existing) return existing;

  const defaultName = name || `Abteilung ${normCode}`;
  return createSeedDepartmentDatabase(normCode, defaultName);
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
// ADMIN PASSWORD VERIFICATION & MANAGEMENT
// -------------------------------------------------------------
export async function verifyAdminPasswordAsync(password: string): Promise<boolean> {
  const trimmed = password.trim();
  if (!trimmed) return false;

  // 1. Try server API
  try {
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ password: trimmed }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      markRealServerSeen();
      const data = await res.json();
      return !!data.valid;
    }
  } catch (err) {
    console.debug('[Storage] Server admin check unavailable, verifying locally:', err);
  }

  // 2. Client-side / Static host fallback - NUR erlaubt, wenn dieser Browser
  // noch nie einen echten Intranet-Server gesehen hat (siehe
  // hasEverSeenRealServer). Auf dem echten Firmenserver bleibt diese Lücke
  // damit dauerhaft geschlossen, auch wenn der Server mal kurz down ist.
  if (hasEverSeenRealServer()) return false;
  try {
    const localAdminPass = localStorage.getItem(LOCAL_ADMIN_PASSWORD_KEY) || DEFAULT_ADMIN_PASSWORD;
    return trimmed === localAdminPass || trimmed === DEFAULT_ADMIN_PASSWORD;
  } catch {
    return trimmed === DEFAULT_ADMIN_PASSWORD;
  }
}

export async function isDefaultAdminPasswordAsync(): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ password: '' }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      markRealServerSeen();
      const data = await res.json();
      return !!data.isDefault;
    }
  } catch {}

  if (hasEverSeenRealServer()) return false;
  try {
    const localAdminPass = localStorage.getItem(LOCAL_ADMIN_PASSWORD_KEY);
    return !localAdminPass || localAdminPass === DEFAULT_ADMIN_PASSWORD;
  } catch {
    return true;
  }
}

export async function changeAdminPasswordAsync(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'Das neue Passwort muss mindestens 6 Zeichen lang sein.' };
  }

  const localAdminPass = localStorage.getItem(LOCAL_ADMIN_PASSWORD_KEY) || DEFAULT_ADMIN_PASSWORD;
  let serverSuccess = false;
  let serverReachable = false;

  try {
    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      serverReachable = true;
      markRealServerSeen();
      serverSuccess = true;
    } else if (res.status === 401 && contentType.includes('application/json')) {
      serverReachable = true;
      markRealServerSeen();
      const data = await res.json();
      return { success: false, error: data.error || 'Aktuelles Passwort ist nicht korrekt.' };
    }
  } catch (err) {
    console.debug('[Storage] Server unreachable for password change, saving locally.');
  }

  // Ist der echte Server erreichbar (egal ob dieser Versuch erfolgreich war),
  // gilt ausschließlich dessen Ergebnis - kein lokaler Fallback mehr, sobald
  // ein echter Server einmal gesehen wurde.
  if (serverReachable || hasEverSeenRealServer()) {
    return serverSuccess
      ? { success: true }
      : { success: false, error: 'Server nicht erreichbar. Bitte später erneut versuchen.' };
  }

  if (!serverSuccess) {
    if (currentPassword !== localAdminPass && currentPassword !== DEFAULT_ADMIN_PASSWORD) {
      return { success: false, error: 'Aktuelles Passwort ist nicht korrekt.' };
    }
  }

  try {
    localStorage.setItem(LOCAL_ADMIN_PASSWORD_KEY, newPassword);
  } catch {}

  return { success: true };
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
    version: 1,
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
