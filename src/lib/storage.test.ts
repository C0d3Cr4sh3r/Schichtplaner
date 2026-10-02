import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveDepartmentDBAsync,
  createNewDepartmentAsync,
  deleteDepartmentAsync,
  importDepartmentJSON,
  markRealServerSeen,
} from './storage';
import type { DepartmentDatabase } from '../types';

// Regressionstests für das Fehlerverhalten beim Speichern: Früher meldete saveDepartmentDBAsync auch bei
// abgelehnten oder nicht zustande gekommenen Requests "ok", wodurch der Fehlerhinweis nie erschien.

function makeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
  };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const html = () => new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } });

function db(version = 3): DepartmentDatabase {
  return {
    departmentCode: 'T-1',
    departmentName: 'Test',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastModified: '2026-01-01T00:00:00.000Z',
    version,
    machines: [],
    employees: [],
    absences: [],
    manualOverrides: [],
    layoutSettings: {} as any,
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeStorage());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('saveDepartmentDBAsync', () => {
  it('Server bestätigt -> ok mit Server-Version', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, { success: true, version: 4, lastModified: 'x' })));
    const r = await saveDepartmentDBAsync('T-1', db());
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.data.version).toBe(4);
  });

  it('Server lehnt ab (400/403/429/500) -> error, NICHT ok', async () => {
    for (const status of [400, 403, 429, 500]) {
      vi.stubGlobal('fetch', vi.fn(async () => json(status, { error: 'nope' })));
      const r = await saveDepartmentDBAsync('T-1', db());
      expect(r.status, `HTTP ${status}`).toBe('error');
    }
  });

  it('409 -> conflict mit aktuellem Stand', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(409, { error: 'x', current: db(9) })));
    const r = await saveDepartmentDBAsync('T-1', db());
    expect(r.status).toBe('conflict');
    if (r.status === 'conflict') expect(r.current.version).toBe(9);
  });

  it('Verbindung weg, Browser kannte echten Server -> error', async () => {
    markRealServerSeen();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network'); }));
    expect((await saveDepartmentDBAsync('T-1', db())).status).toBe('error');
  });

  it('Proxy-/HTML-Antwort, Browser kannte echten Server -> error', async () => {
    markRealServerSeen();
    vi.stubGlobal('fetch', vi.fn(async () => html()));
    expect((await saveDepartmentDBAsync('T-1', db())).status).toBe('error');
  });

  it('statische Demo (nie echten Server gesehen): lokales Speichern bleibt ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => html()));
    expect((await saveDepartmentDBAsync('T-1', db())).status).toBe('ok');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network'); }));
    expect((await saveDepartmentDBAsync('T-1', db())).status).toBe('ok');
  });
});

describe('createNewDepartmentAsync', () => {
  it('Server verweigert (403) -> ok:false und kein lokaler Geister-Eintrag', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(403, { error: 'Nur Admin' })));
    const r = await createNewDepartmentAsync('NEU-1', 'x', 'empty');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('Nur Admin');
    expect(localStorage.getItem('schichtplan_cache_dept_NEU-1')).toBeNull();
  });

  it('schickt das Admin-Passwort URL-kodiert mit', async () => {
    const f = vi.fn(async () => json(200, { success: true, version: 1 }));
    vi.stubGlobal('fetch', f);
    const r = await createNewDepartmentAsync('NEU-1', 'x', 'empty', 'Pä ss!');
    expect(r.ok).toBe(true);
    const init = (f.mock.calls[0] as any)[1];
    expect(init.headers['X-Admin-Password']).toBe(encodeURIComponent('Pä ss!'));
  });

  it('Server nicht erreichbar (echter Server bekannt) -> ok:false', async () => {
    markRealServerSeen();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network'); }));
    expect((await createNewDepartmentAsync('NEU-1', 'x', 'empty')).ok).toBe(false);
  });

  it('statische Demo: lokal anlegen ist ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => html()));
    expect((await createNewDepartmentAsync('NEU-1', 'x', 'empty')).ok).toBe(true);
  });
});

describe('deleteDepartmentAsync', () => {
  it('Server verweigert -> false, lokaler Stand bleibt', async () => {
    localStorage.setItem('schichtplan_cache_dept_T-1', JSON.stringify(db()));
    vi.stubGlobal('fetch', vi.fn(async () => json(403, { error: 'Nur Admin' })));
    expect(await deleteDepartmentAsync('T-1')).toBe(false);
    expect(localStorage.getItem('schichtplan_cache_dept_T-1')).not.toBeNull();
  });

  it('Server löscht -> true, lokaler Cache weg', async () => {
    localStorage.setItem('schichtplan_cache_dept_T-1', JSON.stringify(db()));
    vi.stubGlobal('fetch', vi.fn(async () => json(200, { success: true })));
    expect(await deleteDepartmentAsync('T-1', 'pw')).toBe(true);
    expect(localStorage.getItem('schichtplan_cache_dept_T-1')).toBeNull();
  });

  it('Server weg (echter Server bekannt) -> false', async () => {
    markRealServerSeen();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network'); }));
    expect(await deleteDepartmentAsync('T-1', 'pw')).toBe(false);
  });
});

describe('importDepartmentJSON', () => {
  it('nutzt die aktuelle Server-Version als Basis, nicht die der Datei', async () => {
    const calls: any[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: any) => {
        calls.push({ url, init });
        if (!init || init.method === undefined || init.method === 'GET') return json(200, db(7));
        return json(200, { success: true, version: 8, lastModified: 'x' });
      })
    );
    const r = await importDepartmentJSON(JSON.stringify(db(1)));
    expect(r.success).toBe(true);
    const put = calls.find((c) => c.init?.method === 'PUT');
    expect(JSON.parse(put.init.body).baseVersion).toBe(7);
  });

  it('Server lehnt ab -> success:false mit Hinweis', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: any) => (init?.method === 'PUT' ? json(403, { error: 'x' }) : json(404, { error: 'nf' })))
    );
    const r = await importDepartmentJSON(JSON.stringify(db(1)));
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Server/);
  });

  it('ungültiges JSON / Format wird abgefangen', async () => {
    expect((await importDepartmentJSON('{kaputt')).success).toBe(false);
    expect((await importDepartmentJSON('{"a":1}')).success).toBe(false);
  });
});
