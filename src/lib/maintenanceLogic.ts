/**
 * Instandhaltungsliste - reine Fachlogik (Regeln, Validierung, Rechte).
 *
 * Dieses Modul hat bewusst keine Abhängigkeiten (kein fs, kein fetch, kein
 * React): Es wird vom Server (server.ts) UND vom lokalen Demo-Modus im
 * Browser (maintenanceStorage.ts) benutzt, damit beide exakt dieselben Regeln
 * anwenden. Jede Funktion bekommt den aktuellen Listenstand und liefert
 * entweder einen NEUEN Stand oder einen Fehler mit HTTP-Status zurück - nie
 * wird der übergebene Stand verändert.
 *
 * Nebenläufigkeit: Der Server führt jede Änderung als eine einzige synchrone
 * Folge "Datei lesen -> Funktion hier -> Datei schreiben" aus (kein await
 * dazwischen). Node arbeitet Requests nacheinander ab, dadurch können sich
 * zwei gleichzeitige Einträge nie gegenseitig überschreiben. Konflikte beim
 * Bearbeiten DESSELBEN Eintrags erkennt die Revisionsnummer (rev) pro Eintrag.
 *
 * Wichtig: Ein Kürzel ist eine Kennzeichnung, keine Authentifizierung. Die
 * Rollenprüfung hier vertraut dem vom Client gemeldeten Kürzel.
 */

export type Discipline = 'mechanisch' | 'elektrisch';
export type Urgency = 'niedrig' | 'normal' | 'hoch' | 'sofort';
export type MaintenanceRole = 'melder' | 'instandhaltung';

export const DISCIPLINES: Discipline[] = ['mechanisch', 'elektrisch'];
export const URGENCIES: Urgency[] = ['niedrig', 'normal', 'hoch', 'sofort'];
export const ROLES: MaintenanceRole[] = ['melder', 'instandhaltung'];

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  mechanisch: 'Mechanisch',
  elektrisch: 'Elektrisch',
};
export const URGENCY_LABELS: Record<Urgency, string> = {
  niedrig: 'Niedrig',
  normal: 'Normal',
  hoch: 'Hoch',
  sofort: 'Sofort (Maschine steht)',
};
export const ROLE_LABELS: Record<MaintenanceRole, string> = {
  melder: 'Melder (Produktion)',
  instandhaltung: 'Instandhaltung (ausführend)',
};

export const MAX_MACHINE_LEN = 100;
export const MAX_AREA_LEN = 100;
export const MAX_DESCRIPTION_LEN = 2000;
export const MAX_NOTE_LEN = 1000;
export const MAX_LOCATION_LEN = 60;
export const MAX_NAME_LEN = 80;
export const MAX_LIST_NAME_LEN = 100;
export const MAX_LOCATIONS = 20;
export const MAX_USERS = 500;

export interface MaintenanceUser {
  kuerzel: string;
  name: string;
  role: MaintenanceRole;
  active: boolean;
}

export interface MaintenanceEntry {
  id: string;
  number: number; // fortlaufende Nummer für Rückfragen ("Auftrag 42")
  rev: number; // wird bei jeder Änderung hochgezählt (Konflikterkennung)
  location: string; // Standort
  area: string; // Bereich
  machine: string;
  description: string;
  discipline: Discipline;
  urgency: Urgency;
  createdBy: string; // Kürzel
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  done: boolean;
  doneBy?: string;
  doneAt?: string;
  doneNote?: string;
}

export interface MaintenanceList {
  listCode: string;
  listName: string;
  createdAt: string;
  lastModified: string;
  version: number; // zählt jede Änderung der Liste hoch (für effizientes Polling)
  nextNumber: number;
  locations: string[];
  users: MaintenanceUser[];
  entries: MaintenanceEntry[];
}

/** Wer führt die Aktion aus? 'admin' = Admin-Passwort wurde serverseitig geprüft. */
export type Actor = { type: 'admin' } | { type: 'user'; kuerzel: string };

export type LogicFailure = {
  ok: false;
  status: 400 | 401 | 403 | 404 | 409;
  error: string;
  /** Bei einem Revisionskonflikt: der aktuelle Stand des Eintrags (null = inzwischen gelöscht). */
  currentEntry?: MaintenanceEntry | null;
};
export type LogicSuccess<T = undefined> = { ok: true; list: MaintenanceList; value: T };
export type LogicResult<T = undefined> = LogicSuccess<T> | LogicFailure;

function fail(status: LogicFailure['status'], error: string, currentEntry?: MaintenanceEntry | null): LogicFailure {
  const f: LogicFailure = { ok: false, status, error };
  if (currentEntry !== undefined) f.currentEntry = currentEntry;
  return f;
}

// ---------------------------------------------------------------------------
// Kürzel / Codes
// ---------------------------------------------------------------------------

/** Vereinheitlicht ein Kürzel: Großbuchstaben, nur A-Z 0-9 Ä Ö Ü _ -, max. 8 Zeichen. */
export function normalizeKuerzel(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9ÄÖÜ_-]/g, '')
    .slice(0, 8);
}

export function isValidKuerzel(k: string): boolean {
  return k.length >= 2 && k.length <= 8 && /^[A-Z0-9ÄÖÜ_-]+$/.test(k);
}

export function normalizeListCode(raw: unknown): string {
  return String(raw ?? '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

function cleanText(raw: unknown, max: number): string {
  return String(raw ?? '').trim().slice(0, max);
}

// ---------------------------------------------------------------------------
// Liste anlegen / Login
// ---------------------------------------------------------------------------

export interface NewListInput {
  code: string;
  name?: string;
  locations?: string[];
  firstUser?: { kuerzel: string; name?: string };
}

export function createList(input: NewListInput, now: string): LogicResult<undefined> | LogicFailure {
  const code = normalizeListCode(input.code);
  if (!code) return fail(400, 'Bitte ein gültiges Listenkürzel angeben (A-Z, 0-9, - und _).');

  const locResult = sanitizeLocations(input.locations && input.locations.length ? input.locations : ['Standort 1', 'Standort 2']);
  if (!locResult.ok) return locResult;

  const users: MaintenanceUser[] = [];
  if (input.firstUser && input.firstUser.kuerzel) {
    const k = normalizeKuerzel(input.firstUser.kuerzel);
    if (!isValidKuerzel(k)) return fail(400, 'Das Kürzel muss 2-8 Zeichen lang sein (A-Z, 0-9, Ä Ö Ü, - und _).');
    users.push({ kuerzel: k, name: cleanText(input.firstUser.name, MAX_NAME_LEN), role: 'instandhaltung', active: true });
  }

  const list: MaintenanceList = {
    listCode: code,
    listName: cleanText(input.name, MAX_LIST_NAME_LEN) || `Instandhaltung ${code}`,
    createdAt: now,
    lastModified: now,
    version: 1,
    nextNumber: 1,
    locations: locResult.value,
    users,
    entries: [],
  };
  return { ok: true, list, value: undefined };
}

/** Prüft ein Kürzel gegen die Benutzerliste. Gibt den Benutzer zurück oder null. */
export function findActiveUser(list: MaintenanceList, kuerzel: unknown): MaintenanceUser | null {
  const k = normalizeKuerzel(kuerzel);
  if (!k) return null;
  const user = list.users.find((u) => u.kuerzel === k);
  return user && user.active ? user : null;
}

// ---------------------------------------------------------------------------
// Rechte
// ---------------------------------------------------------------------------

function resolveUser(list: MaintenanceList, actor: Actor): MaintenanceUser | LogicFailure {
  if (actor.type !== 'user') return fail(403, 'Dafür ist eine Anmeldung mit persönlichem Kürzel nötig.');
  const user = findActiveUser(list, actor.kuerzel);
  if (!user) return fail(401, 'Kürzel unbekannt oder deaktiviert. Bitte neu anmelden.');
  return user;
}

function isFailure(x: MaintenanceUser | LogicFailure): x is LogicFailure {
  return (x as LogicFailure).ok === false;
}

/** Admin-Passwort ODER aktive Instandhaltung darf Benutzer und Einstellungen verwalten. */
function requireManager(list: MaintenanceList, actor: Actor): LogicFailure | null {
  if (actor.type === 'admin') return null;
  const user = findActiveUser(list, actor.kuerzel);
  if (!user) return fail(401, 'Kürzel unbekannt oder deaktiviert. Bitte neu anmelden.');
  if (user.role !== 'instandhaltung') return fail(403, 'Dafür hat Ihr Kürzel keine Berechtigung (nur Instandhaltung).');
  return null;
}

/** Instandhaltung darf alles; ein Melder nur eigene, noch offene Einträge (wird auch von der Oberfläche genutzt). */
export function canModifyEntry(user: Pick<MaintenanceUser, 'kuerzel' | 'role'>, entry: MaintenanceEntry): boolean {
  if (user.role === 'instandhaltung') return true;
  return entry.createdBy === user.kuerzel && !entry.done;
}

function touch(list: MaintenanceList, now: string, patch: Partial<MaintenanceList>): MaintenanceList {
  return { ...list, ...patch, version: list.version + 1, lastModified: now };
}

// ---------------------------------------------------------------------------
// Einträge
// ---------------------------------------------------------------------------

export interface EntryFields {
  location: string;
  area: string;
  machine: string;
  description: string;
  discipline: Discipline;
  urgency: Urgency;
}

/**
 * Liest die Eintragsfelder aus einem unbekannten Objekt. Nur bekannte Felder
 * werden übernommen (Whitelist) - alles andere im Request wird ignoriert.
 * partial=true: nur vorhandene Felder prüfen (für Änderungen).
 */
export function parseEntryFields(
  raw: unknown,
  list: MaintenanceList,
  partial: boolean
): { ok: true; fields: Partial<EntryFields> } | LogicFailure {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Partial<EntryFields> = {};
  const has = (k: string) => src[k] !== undefined;

  if (!partial || has('location')) {
    const v = cleanText(src.location, MAX_LOCATION_LEN);
    if (!v) return fail(400, 'Bitte einen Standort wählen.');
    if (!list.locations.includes(v)) return fail(400, `Unbekannter Standort „${v}“.`);
    out.location = v;
  }
  if (!partial || has('area')) {
    const v = cleanText(src.area, MAX_AREA_LEN);
    if (!v) return fail(400, 'Bitte einen Bereich angeben.');
    out.area = v;
  }
  if (!partial || has('machine')) {
    const v = cleanText(src.machine, MAX_MACHINE_LEN);
    if (!v) return fail(400, 'Bitte eine Maschine angeben.');
    out.machine = v;
  }
  if (!partial || has('description')) {
    const v = cleanText(src.description, MAX_DESCRIPTION_LEN);
    if (!v) return fail(400, 'Bitte eine Beschreibung angeben.');
    out.description = v;
  }
  if (!partial || has('discipline')) {
    if (!DISCIPLINES.includes(src.discipline as Discipline)) return fail(400, 'Bitte „Mechanisch“ oder „Elektrisch“ wählen.');
    out.discipline = src.discipline as Discipline;
  }
  if (!partial || has('urgency')) {
    if (!URGENCIES.includes(src.urgency as Urgency)) return fail(400, 'Bitte eine Dringlichkeit wählen.');
    out.urgency = src.urgency as Urgency;
  }
  return { ok: true, fields: out };
}

export function createEntry(
  list: MaintenanceList,
  actor: Actor,
  raw: unknown,
  now: string,
  newId: () => string
): LogicResult<MaintenanceEntry> {
  const user = resolveUser(list, actor);
  if (isFailure(user)) return user;
  const parsed = parseEntryFields(raw, list, false);
  if (!parsed.ok) return parsed;
  const f = parsed.fields as EntryFields;

  const entry: MaintenanceEntry = {
    id: newId(),
    number: list.nextNumber,
    rev: 1,
    location: f.location,
    area: f.area,
    machine: f.machine,
    description: f.description,
    discipline: f.discipline,
    urgency: f.urgency,
    createdBy: user.kuerzel,
    createdAt: now,
    updatedBy: user.kuerzel,
    updatedAt: now,
    done: false,
  };
  return {
    ok: true,
    list: touch(list, now, { nextNumber: list.nextNumber + 1, entries: [...list.entries, entry] }),
    value: entry,
  };
}

function locateEntry(list: MaintenanceList, id: string): MaintenanceEntry | null {
  return list.entries.find((e) => e.id === id) || null;
}

/** Gemeinsame Vorprüfung für Änderungen an einem bestehenden Eintrag. */
function prepareEntryChange(
  list: MaintenanceList,
  actor: Actor,
  id: string,
  baseRev: unknown
): { user: MaintenanceUser; entry: MaintenanceEntry } | LogicFailure {
  const user = resolveUser(list, actor);
  if (isFailure(user)) return user;
  const entry = locateEntry(list, id);
  if (!entry) return fail(404, 'Dieser Eintrag existiert nicht mehr (wurde evtl. gelöscht).', null);
  if (typeof baseRev !== 'number' || baseRev !== entry.rev) {
    return fail(409, 'Dieser Eintrag wurde inzwischen von jemand anderem geändert.', entry);
  }
  return { user, entry };
}

export function updateEntry(
  list: MaintenanceList,
  actor: Actor,
  id: string,
  raw: unknown,
  baseRev: unknown,
  now: string
): LogicResult<MaintenanceEntry> {
  const prep = prepareEntryChange(list, actor, id, baseRev);
  if ('ok' in prep) return prep;
  const { user, entry } = prep;
  if (!canModifyEntry(user, entry)) {
    return fail(403, entry.done ? 'Erledigte Einträge kann nur die Instandhaltung ändern.' : 'Diesen Eintrag kann nur sein Ersteller oder die Instandhaltung ändern.');
  }
  const parsed = parseEntryFields(raw, list, true);
  if (!parsed.ok) return parsed;

  const updated: MaintenanceEntry = {
    ...entry,
    ...parsed.fields,
    rev: entry.rev + 1,
    updatedBy: user.kuerzel,
    updatedAt: now,
  };
  return {
    ok: true,
    list: touch(list, now, { entries: list.entries.map((e) => (e.id === id ? updated : e)) }),
    value: updated,
  };
}

/** Als erledigt melden bzw. wieder öffnen - nur Instandhaltung. */
export function setEntryDone(
  list: MaintenanceList,
  actor: Actor,
  id: string,
  done: unknown,
  note: unknown,
  baseRev: unknown,
  now: string
): LogicResult<MaintenanceEntry> {
  const prep = prepareEntryChange(list, actor, id, baseRev);
  if ('ok' in prep) return prep;
  const { user, entry } = prep;
  if (user.role !== 'instandhaltung') return fail(403, 'Nur die Instandhaltung kann Einträge als erledigt melden.');
  if (typeof done !== 'boolean') return fail(400, 'Ungültiger Status.');

  let updated: MaintenanceEntry;
  if (done) {
    updated = {
      ...entry,
      done: true,
      doneBy: user.kuerzel,
      doneAt: now,
      doneNote: cleanText(note, MAX_NOTE_LEN) || undefined,
      rev: entry.rev + 1,
      updatedBy: user.kuerzel,
      updatedAt: now,
    };
  } else {
    const { doneBy: _a, doneAt: _b, doneNote: _c, ...rest } = entry;
    updated = { ...rest, done: false, rev: entry.rev + 1, updatedBy: user.kuerzel, updatedAt: now };
  }
  return {
    ok: true,
    list: touch(list, now, { entries: list.entries.map((e) => (e.id === id ? updated : e)) }),
    value: updated,
  };
}

export function deleteEntry(
  list: MaintenanceList,
  actor: Actor,
  id: string,
  baseRev: unknown,
  now: string
): LogicResult<undefined> {
  const prep = prepareEntryChange(list, actor, id, baseRev);
  if ('ok' in prep) return prep;
  const { user, entry } = prep;
  if (!canModifyEntry(user, entry)) {
    return fail(403, entry.done ? 'Erledigte Einträge kann nur die Instandhaltung löschen.' : 'Diesen Eintrag kann nur sein Ersteller oder die Instandhaltung löschen.');
  }
  return {
    ok: true,
    list: touch(list, now, { entries: list.entries.filter((e) => e.id !== id) }),
    value: undefined,
  };
}

// ---------------------------------------------------------------------------
// Benutzer (Kürzel)
// ---------------------------------------------------------------------------

function activeManagerCount(users: MaintenanceUser[]): number {
  return users.filter((u) => u.active && u.role === 'instandhaltung').length;
}

/** Verhindert, dass durch eine Änderung die letzte aktive Instandhaltung verschwindet (Aussperr-Schutz). */
function guardLastManager(before: MaintenanceUser[], after: MaintenanceUser[]): LogicFailure | null {
  if (activeManagerCount(before) > 0 && activeManagerCount(after) === 0) {
    return fail(409, 'Es muss mindestens ein aktives Kürzel mit der Rolle „Instandhaltung“ bleiben.');
  }
  return null;
}

export function addUser(
  list: MaintenanceList,
  actor: Actor,
  raw: unknown,
  now: string
): LogicResult<MaintenanceUser> {
  const denied = requireManager(list, actor);
  if (denied) return denied;
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const kuerzel = normalizeKuerzel(src.kuerzel);
  if (!isValidKuerzel(kuerzel)) return fail(400, 'Das Kürzel muss 2-8 Zeichen lang sein (A-Z, 0-9, Ä Ö Ü, - und _).');
  if (!ROLES.includes(src.role as MaintenanceRole)) return fail(400, 'Bitte eine Rolle wählen.');
  if (list.users.some((u) => u.kuerzel === kuerzel)) return fail(409, `Das Kürzel „${kuerzel}“ gibt es bereits.`);
  if (list.users.length >= MAX_USERS) return fail(400, 'Maximale Anzahl Kürzel erreicht.');

  const user: MaintenanceUser = {
    kuerzel,
    name: cleanText(src.name, MAX_NAME_LEN),
    role: src.role as MaintenanceRole,
    active: true,
  };
  return { ok: true, list: touch(list, now, { users: [...list.users, user] }), value: user };
}

export function updateUser(
  list: MaintenanceList,
  actor: Actor,
  kuerzelRaw: string,
  raw: unknown,
  now: string
): LogicResult<MaintenanceUser> {
  const denied = requireManager(list, actor);
  if (denied) return denied;
  const kuerzel = normalizeKuerzel(kuerzelRaw);
  const existing = list.users.find((u) => u.kuerzel === kuerzel);
  if (!existing) return fail(404, `Kürzel „${kuerzel}“ nicht gefunden.`);
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const updated: MaintenanceUser = { ...existing };
  if (src.name !== undefined) updated.name = cleanText(src.name, MAX_NAME_LEN);
  if (src.role !== undefined) {
    if (!ROLES.includes(src.role as MaintenanceRole)) return fail(400, 'Ungültige Rolle.');
    updated.role = src.role as MaintenanceRole;
  }
  if (src.active !== undefined) {
    if (typeof src.active !== 'boolean') return fail(400, 'Ungültiger Status.');
    updated.active = src.active;
  }
  const users = list.users.map((u) => (u.kuerzel === kuerzel ? updated : u));
  const guard = guardLastManager(list.users, users);
  if (guard) return guard;
  return { ok: true, list: touch(list, now, { users }), value: updated };
}

export function removeUser(
  list: MaintenanceList,
  actor: Actor,
  kuerzelRaw: string,
  now: string
): LogicResult<undefined> {
  const denied = requireManager(list, actor);
  if (denied) return denied;
  const kuerzel = normalizeKuerzel(kuerzelRaw);
  if (!list.users.some((u) => u.kuerzel === kuerzel)) return fail(404, `Kürzel „${kuerzel}“ nicht gefunden.`);
  const users = list.users.filter((u) => u.kuerzel !== kuerzel);
  const guard = guardLastManager(list.users, users);
  if (guard) return guard;
  return { ok: true, list: touch(list, now, { users }), value: undefined };
}

// ---------------------------------------------------------------------------
// Einstellungen (Standorte, Listenname)
// ---------------------------------------------------------------------------

function sanitizeLocations(raw: unknown): { ok: true; value: string[] } | LogicFailure {
  if (!Array.isArray(raw)) return fail(400, 'Standorte müssen als Liste angegeben werden.');
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const v = cleanText(item, MAX_LOCATION_LEN);
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) return fail(400, `Der Standort „${v}“ ist doppelt vorhanden.`);
    seen.add(key);
    out.push(v);
  }
  if (out.length === 0) return fail(400, 'Es muss mindestens ein Standort vorhanden sein.');
  if (out.length > MAX_LOCATIONS) return fail(400, `Maximal ${MAX_LOCATIONS} Standorte möglich.`);
  return { ok: true, value: out };
}

export function updateSettings(
  list: MaintenanceList,
  actor: Actor,
  raw: unknown,
  now: string
): LogicResult<undefined> {
  const denied = requireManager(list, actor);
  if (denied) return denied;
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const patch: Partial<MaintenanceList> = {};

  if (src.listName !== undefined) {
    const name = cleanText(src.listName, MAX_LIST_NAME_LEN);
    if (!name) return fail(400, 'Der Listenname darf nicht leer sein.');
    patch.listName = name;
  }
  if (src.locations !== undefined) {
    const locs = sanitizeLocations(src.locations);
    if (!locs.ok) return locs;
    const removedInUse = list.locations.filter(
      (old) => !locs.value.includes(old) && list.entries.some((e) => e.location === old)
    );
    if (removedInUse.length > 0) {
      return fail(409, `Standort „${removedInUse[0]}“ wird noch von Einträgen verwendet und kann nicht entfernt werden.`);
    }
    patch.locations = locs.value;
  }
  return { ok: true, list: touch(list, now, patch), value: undefined };
}
