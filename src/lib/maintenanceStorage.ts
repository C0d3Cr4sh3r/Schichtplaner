/**
 * Instandhaltungsliste - Client-Zugriff auf die Server-API.
 *
 * Wichtiger Unterschied zu storage.ts (Abteilungen): Hier gibt es KEINEN
 * stillen Fallback. Jede fehlgeschlagene Anfrage an einen echten Server wird
 * als Fehler gemeldet, damit niemand glaubt, ein Eintrag sei gespeichert,
 * obwohl er es nicht ist. Nur wenn dieser Browser noch NIE einen echten
 * Intranet-Server gesehen hat (statisch gehostete Demo, z. B. Vercel), läuft die
 * Liste lokal im Browser (localStorage) - mit denselben Regeln aus
 * maintenanceLogic.ts - und die Oberfläche weist deutlich darauf hin.
 */
import {
  Actor,
  LogicResult,
  MaintenanceEntry,
  MaintenanceList,
  MaintenanceRole,
  addUser,
  createEntry,
  createList,
  deleteEntry,
  findActiveUser,
  normalizeKuerzel,
  normalizeListCode,
  markSeen,
  removeUser,
  setEntryAssignee,
  setEntryDone,
  setEntryProvisional,
  updateEntry,
  updateSettings,
  updateUser,
} from './maintenanceLogic';
import { hasEverSeenRealServer, markRealServerSeen } from './storage';

const SESSION_KEY = 'schichtplan_maint_session';
const LAST_LIST_KEY = 'schichtplan_maint_last_list';
const DEMO_LIST_PREFIX = 'schichtplan_demo_maint_';
const REQUEST_TIMEOUT_MS = 10000;

export const DEMO_LIST_CODE = 'INSTANDHALTUNG';

export interface MaintSession {
  listCode: string;
  listName: string;
  kuerzel: string;
  name: string;
  role: MaintenanceRole;
}

/** Wer ruft auf? Persönliches Kürzel (normal) oder Admin-Passwort (Verwaltung im Admin-Bereich). */
export interface MaintAuth {
  listCode: string;
  kuerzel?: string;
  adminPassword?: string;
}

export type MaintResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      status: number; // 0 = Server nicht erreichbar
      error: string;
      network?: boolean;
      currentEntry?: MaintenanceEntry | null;
      list?: MaintenanceList;
    };

export interface ListChange {
  list: MaintenanceList;
  entry?: MaintenanceEntry;
}

// ---------------------------------------------------------------------------
// Sitzung (nur für diesen Browser-Tab; wird beim Schließen des Tabs vergessen,
// damit an gemeinsam genutzten PCs nicht versehentlich unter fremdem Kürzel
// weitergearbeitet wird)
// ---------------------------------------------------------------------------

export function loadMaintSession(): MaintSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s && typeof s.listCode === 'string' && typeof s.kuerzel === 'string' && (s.role === 'melder' || s.role === 'instandhaltung')) {
      return s as MaintSession;
    }
  } catch {}
  return null;
}

export function saveMaintSession(session: MaintSession | null): void {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}

export function getLastListCode(): string {
  try {
    return localStorage.getItem(LAST_LIST_KEY) || '';
  } catch {
    return '';
  }
}

function rememberListCode(code: string): void {
  try {
    localStorage.setItem(LAST_LIST_KEY, code);
  } catch {}
}

// ---------------------------------------------------------------------------
// Modus
// ---------------------------------------------------------------------------

let localDemoActive = false;

/** true, sobald in dieser Sitzung auf den lokalen Browser-Speicher (Demo) zurückgegriffen wurde. */
export function isMaintenanceLocalDemo(): boolean {
  return localDemoActive;
}

type RawResponse = { kind: 'server'; status: number; json: any } | { kind: 'noserver' };

async function rawRequest(method: string, path: string, auth: Partial<MaintAuth>, body?: unknown): Promise<RawResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    // Header-Werte URL-kodieren: HTTP-Header vertragen keine beliebigen Zeichen.
    if (auth.kuerzel) headers['X-Kuerzel'] = encodeURIComponent(auth.kuerzel);
    if (auth.adminPassword) headers['X-Admin-Password'] = encodeURIComponent(auth.adminPassword);
    const res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // Kein JSON: kein echter Server (statischer Host liefert index.html) oder ein Proxy-Fehler.
      return { kind: 'noserver' };
    }
    let json: any = null;
    try {
      json = await res.json();
    } catch {}
    return { kind: 'server', status: res.status, json };
  } catch {
    return { kind: 'noserver' };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Lesen: einfach nicht erreichbar.
const NETWORK_ERROR: MaintResult<never> = {
  ok: false,
  status: 0,
  network: true,
  error: 'Server nicht erreichbar. Bitte Verbindung prüfen.',
};

// Schreiben: Bei Zeitüberschreitung oder Verbindungsabbruch kann der Server die Aktion trotzdem noch
// ausgeführt haben - daher NICHT behaupten, es sei nichts gespeichert worden.
const WRITE_NETWORK_ERROR: MaintResult<never> = {
  ok: false,
  status: 0,
  network: true,
  error: 'Keine Antwort vom Server. Ob die Aktion gespeichert wurde, ist unklar - bitte erst die Liste prüfen, bevor Sie es erneut versuchen (sonst droht ein doppelter Eintrag).',
};

function fromServer<T>(raw: Extract<RawResponse, { kind: 'server' }>): MaintResult<T> {
  markRealServerSeen();
  const { status, json } = raw;
  if (status >= 200 && status < 300) return { ok: true, data: json as T };
  return {
    ok: false,
    status,
    error: (json && typeof json.error === 'string' && json.error) || `Fehler (${status})`,
    currentEntry: json?.currentEntry,
    list: json?.list,
  };
}

// ---------------------------------------------------------------------------
// Lokaler Demo-Speicher (nur ohne echten Server, siehe Dateikopf)
// ---------------------------------------------------------------------------

function demoKey(code: string): string {
  return `${DEMO_LIST_PREFIX}${code}`;
}

function readDemoList(code: string): MaintenanceList | null {
  try {
    const raw = localStorage.getItem(demoKey(code));
    return raw ? (JSON.parse(raw) as MaintenanceList) : null;
  } catch {
    return null;
  }
}

function writeDemoList(list: MaintenanceList): boolean {
  try {
    localStorage.setItem(demoKey(list.listCode), JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

function listDemoCodes(): string[] {
  const codes: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DEMO_LIST_PREFIX)) codes.push(key.slice(DEMO_LIST_PREFIX.length));
    }
  } catch {}
  return codes;
}

function demoId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Legt beim ersten Aufruf in der Demo eine Beispielliste mit Beispiel-Kürzeln an. */
function ensureDemoSeed(): void {
  if (listDemoCodes().length > 0) return;
  const now = new Date().toISOString();
  const created = createList(
    {
      code: DEMO_LIST_CODE,
      name: 'Instandhaltung (Demo)',
      locations: ['Werk Nord', 'Werk Süd'],
      firstUser: { kuerzel: 'IH1', name: 'Demo Instandhaltung' },
    },
    now
  );
  if (!created.ok) return;
  let list = created.list;
  const admin: Actor = { type: 'admin' };
  const addMelder = addUser(list, admin, { kuerzel: 'PROD1', name: 'Demo Produktion', role: 'melder' }, now);
  if (addMelder.ok) list = addMelder.list;
  const samples = [
    { location: 'Werk Nord', area: 'Halle 2', machine: 'CNC-01', description: 'Kühlmittelpumpe tropft, Pfütze unter der Maschine.', discipline: 'mechanisch', urgency: 'hoch' },
    { location: 'Werk Süd', area: 'Verpackung', machine: 'Bandsäge 3', description: 'Lichtschranke am Einlauf meldet sporadisch Fehler.', discipline: 'elektrisch', urgency: 'normal' },
  ];
  for (const s of samples) {
    const r = createEntry(list, { type: 'user', kuerzel: 'PROD1' }, s, now, demoId);
    if (r.ok) list = r.list;
  }
  writeDemoList(list);
}

function demoActor(auth: Partial<MaintAuth>): Actor {
  return auth.adminPassword ? { type: 'admin' } : { type: 'user', kuerzel: normalizeKuerzel(auth.kuerzel) };
}

// ---------------------------------------------------------------------------
// Öffentliche Funktionen
// ---------------------------------------------------------------------------

export async function maintLoginAsync(listCodeRaw: string, kuerzelRaw: string): Promise<MaintResult<MaintSession>> {
  const listCode = normalizeListCode(listCodeRaw);
  const kuerzel = normalizeKuerzel(kuerzelRaw);
  if (!listCode || !kuerzel) {
    return { ok: false, status: 400, error: 'Bitte Listenkürzel und persönliches Kürzel eingeben.' };
  }

  const raw = await rawRequest('POST', `/api/maintenance/${encodeURIComponent(listCode)}/login`, {}, { kuerzel });
  if (raw.kind === 'server') {
    markRealServerSeen();
    if (raw.status === 429) {
      return { ok: false, status: 429, error: raw.json?.error || 'Zu viele Fehlversuche. Bitte kurz warten.' };
    }
    if (raw.status === 200 && raw.json?.valid) {
      const session: MaintSession = {
        listCode: raw.json.listCode,
        listName: raw.json.listName,
        kuerzel: raw.json.user.kuerzel,
        name: raw.json.user.name || '',
        role: raw.json.user.role,
      };
      rememberListCode(session.listCode);
      return { ok: true, data: session };
    }
    return { ok: false, status: 401, error: 'Listenkürzel oder persönliches Kürzel unbekannt. Bitte prüfen oder bei der Instandhaltung nachfragen.' };
  }

  if (hasEverSeenRealServer()) return NETWORK_ERROR;

  localDemoActive = true;
  ensureDemoSeed();
  const list = readDemoList(listCode);
  const user = list ? findActiveUser(list, kuerzel) : null;
  if (!list || !user) {
    return { ok: false, status: 401, error: `Demo: Listenkürzel „${DEMO_LIST_CODE}“ mit Kürzel „IH1“ (Instandhaltung) oder „PROD1“ (Melder) ausprobieren.` };
  }
  rememberListCode(list.listCode);
  return { ok: true, data: { listCode: list.listCode, listName: list.listName, kuerzel: user.kuerzel, name: user.name, role: user.role } };
}

/** Liest die Liste. Mit knownVersion antwortet der Server bei Gleichstand nur mit {unchanged:true}. */
export async function maintFetchListAsync(
  auth: MaintAuth,
  known?: { version: number; lastModified: string }
): Promise<MaintResult<{ list?: MaintenanceList; unchanged?: boolean }>> {
  const query = known ? `?version=${known.version}&modified=${encodeURIComponent(known.lastModified)}` : '';
  const raw = await rawRequest('GET', `/api/maintenance/${encodeURIComponent(auth.listCode)}${query}`, auth);
  if (raw.kind === 'server') return fromServer(raw);
  if (hasEverSeenRealServer()) return NETWORK_ERROR;

  localDemoActive = true;
  ensureDemoSeed();
  const list = readDemoList(auth.listCode);
  if (!list) return { ok: false, status: 404, error: `Liste ${auth.listCode} nicht gefunden.` };
  if (!auth.adminPassword && !findActiveUser(list, auth.kuerzel)) {
    return { ok: false, status: 401, error: 'Kürzel unbekannt oder deaktiviert. Bitte neu anmelden.' };
  }
  if (known && known.version === list.version && known.lastModified === list.lastModified) return { ok: true, data: { unchanged: true } };
  return { ok: true, data: { list } };
}

async function mutate(
  auth: MaintAuth,
  method: string,
  path: string,
  body: unknown,
  local: (list: MaintenanceList, actor: Actor, now: string) => LogicResult<unknown>,
  entryFrom?: (value: any) => MaintenanceEntry | undefined
): Promise<MaintResult<ListChange>> {
  const raw = await rawRequest(method, path, auth, body);
  if (raw.kind === 'server') return fromServer<ListChange>(raw);
  if (hasEverSeenRealServer()) return WRITE_NETWORK_ERROR;

  localDemoActive = true;
  const list = readDemoList(auth.listCode);
  if (!list) return { ok: false, status: 404, error: `Liste ${auth.listCode} nicht gefunden.` };
  const result = local(list, demoActor(auth), new Date().toISOString());
  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      error: result.error,
      currentEntry: result.currentEntry,
      list: result.status === 409 || result.status === 404 ? list : undefined,
    };
  }
  if (!writeDemoList(result.list)) {
    return { ok: false, status: 500, error: 'Browser-Speicher voll oder gesperrt - nicht gespeichert.' };
  }
  return { ok: true, data: { list: result.list, entry: entryFrom ? entryFrom(result.value) : undefined } };
}

const entryUrl = (auth: MaintAuth, id?: string) =>
  `/api/maintenance/${encodeURIComponent(auth.listCode)}/entries${id ? `/${encodeURIComponent(id)}` : ''}`;
const userUrl = (auth: MaintAuth, k?: string) =>
  `/api/maintenance/${encodeURIComponent(auth.listCode)}/users${k ? `/${encodeURIComponent(k)}` : ''}`;

export interface EntryInput {
  location: string;
  area: string;
  machine: string;
  description: string;
  discipline: string;
  urgency: string;
}

export function maintCreateEntryAsync(auth: MaintAuth, input: EntryInput) {
  return mutate(auth, 'POST', entryUrl(auth), input, (l, a, now) => createEntry(l, a, input, now, demoId), (v) => v as MaintenanceEntry);
}

export function maintUpdateEntryAsync(auth: MaintAuth, id: string, baseRev: number, input: Partial<EntryInput>) {
  return mutate(auth, 'PATCH', entryUrl(auth, id), { ...input, baseRev }, (l, a, now) => updateEntry(l, a, id, input, baseRev, now), (v) => v as MaintenanceEntry);
}

export function maintSetDoneAsync(auth: MaintAuth, id: string, baseRev: number, done: boolean, note: string) {
  return mutate(auth, 'POST', `${entryUrl(auth, id)}/done`, { baseRev, done, note }, (l, a, now) => setEntryDone(l, a, id, done, note, baseRev, now), (v) => v as MaintenanceEntry);
}

export function maintSetProvisionalAsync(auth: MaintAuth, id: string, baseRev: number, provisional: boolean, note: string, due?: string) {
  return mutate(auth, 'POST', `${entryUrl(auth, id)}/provisional`, { baseRev, provisional, note, due }, (l, a, now) => setEntryProvisional(l, a, id, provisional, note, baseRev, now, due), (v) => v as MaintenanceEntry);
}

export function maintAssignAsync(auth: MaintAuth, id: string, baseRev: number, assignee: string) {
  return mutate(auth, 'POST', `${entryUrl(auth, id)}/assign`, { baseRev, assignee }, (l, a, now) => setEntryAssignee(l, a, id, assignee, baseRev, now), (v) => v as MaintenanceEntry);
}

export function maintMarkSeenAsync(auth: MaintAuth, upTo: string) {
  return mutate(auth, 'POST', `/api/maintenance/${encodeURIComponent(auth.listCode)}/seen`, { upTo }, (l, a, now) => markSeen(l, a, upTo, now));
}

export function maintDeleteEntryAsync(auth: MaintAuth, id: string, baseRev: number) {
  return mutate(auth, 'DELETE', `${entryUrl(auth, id)}?baseRev=${baseRev}`, undefined, (l, a, now) => deleteEntry(l, a, id, baseRev, now));
}

export function maintAddUserAsync(auth: MaintAuth, input: { kuerzel: string; name: string; role: MaintenanceRole; notifyLocations?: string[] }) {
  return mutate(auth, 'POST', userUrl(auth), input, (l, a, now) => addUser(l, a, input, now));
}

export function maintUpdateUserAsync(auth: MaintAuth, kuerzel: string, patch: { name?: string; role?: MaintenanceRole; active?: boolean; notifyLocations?: string[] }) {
  return mutate(auth, 'PATCH', userUrl(auth, kuerzel), patch, (l, a, now) => updateUser(l, a, kuerzel, patch, now));
}

export function maintRemoveUserAsync(auth: MaintAuth, kuerzel: string) {
  return mutate(auth, 'DELETE', userUrl(auth, kuerzel), undefined, (l, a, now) => removeUser(l, a, kuerzel, now));
}

export function maintUpdateSettingsAsync(auth: MaintAuth, patch: { listName?: string; locations?: string[] }) {
  return mutate(auth, 'PATCH', `/api/maintenance/${encodeURIComponent(auth.listCode)}/settings`, patch, (l, a, now) => updateSettings(l, a, patch, now));
}

// ---------------------------------------------------------------------------
// Admin: Listen anlegen / löschen / übersehen
// ---------------------------------------------------------------------------

export interface MaintListSummary {
  code: string;
  name: string;
  userCount: number;
  entryCount: number;
  openCount: number;
}

export async function maintAdminListAsync(adminPassword: string): Promise<MaintResult<MaintListSummary[]>> {
  const raw = await rawRequest('GET', '/api/maintenance', { adminPassword });
  if (raw.kind === 'server') return fromServer(raw);
  if (hasEverSeenRealServer()) return NETWORK_ERROR;

  localDemoActive = true;
  ensureDemoSeed();
  const lists = listDemoCodes()
    .map((code) => readDemoList(code))
    .filter((l): l is MaintenanceList => !!l)
    .map((l) => ({
      code: l.listCode,
      name: l.listName,
      userCount: l.users.length,
      entryCount: l.entries.length,
      openCount: l.entries.filter((e) => !e.done).length,
    }));
  return { ok: true, data: lists };
}

export async function maintAdminCreateListAsync(
  adminPassword: string,
  input: { code: string; name?: string; locations?: string[]; firstUser?: { kuerzel: string; name?: string } }
): Promise<MaintResult<{ list: MaintenanceList }>> {
  const raw = await rawRequest('POST', '/api/maintenance', { adminPassword }, input);
  if (raw.kind === 'server') return fromServer(raw);
  if (hasEverSeenRealServer()) return WRITE_NETWORK_ERROR;

  localDemoActive = true;
  ensureDemoSeed();
  const created = createList(input, new Date().toISOString());
  if (!created.ok) return { ok: false, status: created.status, error: created.error };
  if (readDemoList(created.list.listCode)) {
    return { ok: false, status: 409, error: `Liste ${created.list.listCode} existiert bereits.` };
  }
  writeDemoList(created.list);
  return { ok: true, data: { list: created.list } };
}

export async function maintAdminDeleteListAsync(adminPassword: string, code: string): Promise<MaintResult<{ success: boolean }>> {
  const raw = await rawRequest('DELETE', `/api/maintenance/${encodeURIComponent(code)}`, { adminPassword });
  if (raw.kind === 'server') return fromServer(raw);
  if (hasEverSeenRealServer()) return WRITE_NETWORK_ERROR;

  localDemoActive = true;
  try {
    localStorage.removeItem(demoKey(code));
  } catch {}
  return { ok: true, data: { success: true } };
}
