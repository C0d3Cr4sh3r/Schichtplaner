import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  Cog,
  Database,
  ListChecks,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Trash2,
  UserRound,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  DISCIPLINES,
  DISCIPLINE_LABELS,
  Discipline,
  MaintenanceEntry,
  MaintenanceList,
  MaintenanceRole,
  ROLE_LABELS,
  URGENCIES,
  URGENCY_LABELS,
  Urgency,
  canModifyEntry,
  computeNotices,
  isProvisionalOverdue,
  MaintenanceNotice,
} from '../lib/maintenanceLogic';
import {
  EntryInput,
  ListChange,
  MaintAuth,
  MaintResult,
  MaintSession,
  isMaintenanceLocalDemo,
  maintAssignAsync,
  maintCreateEntryAsync,
  maintDeleteEntryAsync,
  maintFetchListAsync,
  maintMarkSeenAsync,
  maintSetDoneAsync,
  maintSetProvisionalAsync,
  maintUpdateEntryAsync,
  saveMaintSession,
} from '../lib/maintenanceStorage';
import { MaintenanceManage } from './MaintenanceManage';
import { ArcanePixelsBrand } from './ArcanePixelsBrand';

const POLL_INTERVAL_MS = 4000;
const LAST_LOCATION_KEY = 'schichtplan_maint_last_location';

const URGENCY_STYLE: Record<Urgency, { badge: string; bar: string }> = {
  niedrig: { badge: 'bg-slate-100 text-slate-700 border-slate-300', bar: 'bg-slate-300' },
  normal: { badge: 'bg-blue-50 text-blue-800 border-blue-300', bar: 'bg-blue-400' },
  hoch: { badge: 'bg-amber-50 text-amber-900 border-amber-400', bar: 'bg-amber-500' },
  sofort: { badge: 'bg-red-50 text-red-800 border-red-400', bar: 'bg-red-600' },
};
const URGENCY_RANK: Record<Urgency, number> = { sofort: 3, hoch: 2, normal: 1, niedrig: 0 };

function formatDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function noticeLabel(n: MaintenanceNotice): string {
  switch (n.kind) {
    case 'assigned':
      return 'Ihnen zugewiesen';
    case 'sofort':
      return 'Sofort-Meldung';
    case 'neu':
      return 'Neue Meldung';
    default:
      return n.entry.done ? 'Ihre Meldung wurde erledigt' : 'Ihre Meldung: provisorisch behoben';
  }
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return y && m && d ? `${d}.${m}.${y}` : ymd;
}

function sortEntries(entries: MaintenanceEntry[]): MaintenanceEntry[] {
  return [...entries].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1; // offene zuerst
    if (!a.done && !!a.provisional !== !!b.provisional) return a.provisional ? 1 : -1; // provisorisch nach den echt offenen
    if (!a.done && a.provisional && b.provisional) {
      const byDue = (a.provisionalDue || '9999-12-31').localeCompare(b.provisionalDue || '9999-12-31'); // früheste Frist zuerst
      if (byDue !== 0) return byDue;
    }
    if (!a.done) {
      const byUrgency = URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency];
      if (byUrgency !== 0) return byUrgency;
      return a.createdAt.localeCompare(b.createdAt); // älteste zuerst
    }
    return (b.doneAt || '').localeCompare(a.doneAt || ''); // zuletzt erledigte zuerst
  });
}

type Notice = { kind: 'error' | 'info'; text: string };

interface MaintenanceAppProps {
  session: MaintSession;
  onLogout: () => void;
}

export const MaintenanceApp: React.FC<MaintenanceAppProps> = ({ session, onLogout }) => {
  const [list, setList] = useState<MaintenanceList | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionInvalid, setSessionInvalid] = useState<string | null>(null);
  const [tab, setTab] = useState<'liste' | 'verwaltung'>('liste');
  const [notice, setNotice] = useState<Notice | null>(null);

  const [statusFilter, setStatusFilter] = useState<'offen' | 'provisorisch' | 'ueberfaellig' | 'erledigt' | 'alle'>('offen');
  // Lokales Datum für die Überfälligkeit; wird minütlich aktualisiert, damit die Markierung auch über Mitternacht stimmt.
  const [today, setToday] = useState(todayLocal());
  useEffect(() => {
    const id = setInterval(() => setToday(todayLocal()), 60000);
    return () => clearInterval(id);
  }, []);
  const [locationFilter, setLocationFilter] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState<'' | Discipline>('');
  const [urgencyFilter, setUrgencyFilter] = useState<'' | Urgency>('');
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<'' | 'mine' | 'none'>('');
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [flashNumber, setFlashNumber] = useState<number | null>(null);

  const [formState, setFormState] = useState<{ mode: 'create' } | { mode: 'edit'; entry: MaintenanceEntry } | null>(null);
  const [doneTarget, setDoneTarget] = useState<{ entry: MaintenanceEntry; mode: 'done' | 'provisional' } | null>(null);

  const auth: MaintAuth = useMemo(() => ({ listCode: session.listCode, kuerzel: session.kuerzel }), [session.listCode, session.kuerzel]);

  // Stand-Verwaltung. Die Race, die es zu vermeiden gilt: Eine Poll-Anfrage startet, dann bestätigt der
  // Server eine eigene Aktion, danach trifft die ältere Poll-Antwort ein und würde den frischen Stand
  // überschreiben. Deshalb: Antworten auf EIGENE Aktionen werden immer übernommen und zählen
  // mutationSeq hoch; eine Poll-Antwort wird verworfen, wenn seit ihrem Start eine Aktion fertig wurde
  // (der nächste Poll holt den Stand ohnehin). Bewusst KEIN Vergleich "Version nur steigend": Wird
  // eine ältere Sicherung zurückgespielt, hat die Liste danach eine NIEDRIGERE Version und muss
  // trotzdem angezeigt werden.
  const versionRef = useRef<number | undefined>(undefined);
  const lastModifiedRef = useRef<string | undefined>(undefined);
  const mutationSeqRef = useRef(0);
  const pollInFlightRef = useRef(false);
  const applyList = useCallback((incoming: MaintenanceList) => {
    versionRef.current = incoming.version;
    lastModifiedRef.current = incoming.lastModified;
    setList(incoming);
  }, []);
  const applyMutationList = useCallback(
    (incoming: MaintenanceList) => {
      mutationSeqRef.current++;
      applyList(incoming);
    },
    [applyList]
  );

  // Regelmäßig den Stand vom Server holen, damit Änderungen der Kollegen
  // erscheinen. Bei unverändertem Stand antwortet der Server nur kurz.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (pollInFlightRef.current) return; // keine überlappenden Abfragen bei langsamer Verbindung
      pollInFlightRef.current = true;
      const seqAtStart = mutationSeqRef.current;
      const known =
        versionRef.current !== undefined && lastModifiedRef.current
          ? { version: versionRef.current, lastModified: lastModifiedRef.current }
          : undefined;
      const res = await maintFetchListAsync(auth, known);
      pollInFlightRef.current = false;
      if (cancelled) return;
      if (res.ok) {
        setLoadError(null);
        if (res.data.list && mutationSeqRef.current === seqAtStart) applyList(res.data.list);
      } else if (res.status === 401 || res.status === 404) {
        setSessionInvalid(res.status === 404 ? 'Diese Liste existiert nicht mehr.' : res.error);
      } else {
        setLoadError(res.error);
      }
    };
    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [auth, applyList]);

  // Meldungen ausblenden: Hinweise nach einigen Sekunden, Fehler bleiben bis zum Schließen.
  useEffect(() => {
    if (notice?.kind !== 'info') return;
    const id = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(id);
  }, [notice]);

  const me = list?.users.find((u) => u.kuerzel === session.kuerzel);
  const role: MaintenanceRole = me?.role ?? session.role;
  const isManager = role === 'instandhaltung';

  // Führt eine Server-Aktion aus und kümmert sich einheitlich um Ergebnis, Konflikte und Fehler.
  const act = useCallback(
    async (action: () => Promise<MaintResult<ListChange>>, successText?: string): Promise<MaintResult<ListChange>> => {
      const res = await action();
      if (res.ok) {
        applyMutationList(res.data.list);
        if (successText) setNotice({ kind: 'info', text: successText });
      } else {
        if (res.list) applyMutationList(res.list);
        if (res.status === 401) setSessionInvalid(res.error);
        else if (res.status === 409) setNotice({ kind: 'error', text: `${res.error} Der aktuelle Stand wurde geladen - bitte Ihre Aktion bei Bedarf wiederholen.` });
        else setNotice({ kind: 'error', text: res.error });
      }
      return res;
    },
    [applyMutationList]
  );

  const handleLogout = () => {
    saveMaintSession(null);
    onLogout();
  };

  const filtered = useMemo(() => {
    if (!list) return [];
    const q = search.trim().toLowerCase();
    return sortEntries(
      list.entries.filter((e) => {
        if (statusFilter === 'offen' && e.done) return false; // "Offen" enthält auch provisorisch behobene
        if (statusFilter === 'provisorisch' && (e.done || !e.provisional)) return false;
        if (statusFilter === 'ueberfaellig' && !isProvisionalOverdue(e, today)) return false;
        if (statusFilter === 'erledigt' && !e.done) return false;
        if (locationFilter && e.location !== locationFilter) return false;
        if (disciplineFilter && e.discipline !== disciplineFilter) return false;
        if (urgencyFilter && e.urgency !== urgencyFilter) return false;
        if (assigneeFilter === 'mine' && e.assignedTo !== session.kuerzel) return false;
        if (assigneeFilter === 'none' && e.assignedTo) return false;
        if (q) {
          const hay = `${e.number} ${e.machine} ${e.area} ${e.description} ${e.createdBy} ${e.doneNote || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
    );
  }, [list, statusFilter, locationFilter, disciplineFilter, urgencyFilter, assigneeFilter, search, today, session.kuerzel]);

  const stats = useMemo(() => {
    const entries = list?.entries ?? [];
    return {
      open: entries.filter((e) => !e.done && !e.provisional).length,
      provisional: entries.filter((e) => !e.done && e.provisional).length,
      overdue: entries.filter((e) => isProvisionalOverdue(e, today)).length,
      mine: entries.filter((e) => !e.done && e.assignedTo === session.kuerzel).length,
      urgent: entries.filter((e) => !e.done && e.urgency === 'sofort').length,
      done: entries.filter((e) => e.done).length,
    };
  }, [list, today, session.kuerzel]);

  // ---- Hinweise: persönlich pro Kürzel, aus den Daten abgeleitet (siehe computeNotices)
  const notices = useMemo(() => (list ? computeNotices(list, session.kuerzel) : []), [list, session.kuerzel]);
  const noticeByEntry = useMemo(() => new Map(notices.map((n) => [n.entry.id, n])), [notices]);
  const hasUrgentNotice = notices.some((n) => n.urgent);

  // Erstmalig (noch kein persönlicher Marker): Marker auf "jetzt" setzen, damit der Altbestand nicht als neu gilt.
  const initSeenRef = useRef(false);
  useEffect(() => {
    if (!list || initSeenRef.current) return;
    const mine = list.users.find((u) => u.kuerzel === session.kuerzel);
    if (mine && !mine.seenAt) {
      initSeenRef.current = true;
      maintMarkSeenAsync(auth, new Date().toISOString()).then((res) => {
        if (res.ok) applyMutationList(res.data.list);
      });
    }
  }, [list, session.kuerzel, auth, applyMutationList]);

  // Zähler im Tab-Titel, damit neue Hinweise auch bei verdecktem Fenster auffallen.
  useEffect(() => {
    const original = document.title;
    document.title = notices.length > 0 ? `(${notices.length}) Instandhaltungsliste` : 'Instandhaltungsliste';
    return () => {
      document.title = original;
    };
  }, [notices.length]);

  // Alles bis zum neuesten angezeigten Hinweis als gelesen markieren (später eintreffende bleiben ungelesen).
  const markNoticesSeen = useCallback(
    async (shown: MaintenanceNotice[]) => {
      if (shown.length === 0) return;
      const upTo = shown.reduce((max, n) => (n.at > max ? n.at : max), shown[0].at);
      await act(() => maintMarkSeenAsync(auth, upTo));
    },
    [auth, act]
  );

  const focusEntry = useCallback((entry: MaintenanceEntry) => {
    setTab('liste');
    setStatusFilter('alle');
    setLocationFilter('');
    setDisciplineFilter('');
    setUrgencyFilter('');
    setAssigneeFilter('');
    setSearch('');
    setNoticesOpen(false);
    setFlashNumber(entry.number);
    setTimeout(() => {
      document.querySelector(`li[data-entry-number="${entry.number}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 80);
    setTimeout(() => setFlashNumber(null), 3000);
  }, []);

  if (sessionInvalid) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 text-slate-100 space-y-4" role="alert">
          <div className="flex items-center gap-2 font-semibold text-amber-300">
            <AlertTriangle className="w-5 h-5" />
            Anmeldung nicht mehr gültig
          </div>
          <p className="text-sm text-slate-300">{sessionInvalid}</p>
          <button type="button" onClick={handleLogout} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm cursor-pointer">
            Zur Anmeldung
          </button>
        </div>
      </div>
    );
  }

  const demo = isMaintenanceLocalDemo();
  const selectClass = 'border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm bg-white text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {notice && (
        <div className="fixed top-4 right-4 z-50 max-w-sm" role={notice.kind === 'error' ? 'alert' : 'status'}>
          <div
            className={`rounded-xl border shadow-lg px-4 py-3 flex items-start gap-2.5 text-sm ${
              notice.kind === 'error' ? 'bg-red-50 border-red-300 text-red-800' : 'bg-emerald-50 border-emerald-300 text-emerald-800'
            }`}
          >
            {notice.kind === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> : <Check className="w-4 h-4 shrink-0 mt-0.5" />}
            <div className="flex-1">{notice.text}</div>
            <button type="button" onClick={() => setNotice(null)} className="text-xs underline opacity-70 hover:opacity-100 cursor-pointer shrink-0">
              OK
            </button>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-display font-bold text-slate-900 tracking-tight text-base sm:text-lg flex items-center gap-2">
              <Wrench className="w-5 h-5 text-blue-600" />
              Instandhaltungsliste
            </span>
            <span className="text-slate-600 font-medium">{list?.listName ?? session.listName}</span>
            {demo ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-800 text-[11px] font-medium" title="Kein Intranet-Server erreichbar: Die Liste läuft nur in diesem Browser.">
                <Database className="w-3 h-3" />
                Demo (nur dieser Browser)
              </span>
            ) : loadError ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-50 border border-red-300 text-red-700 text-[11px] font-medium" title={loadError}>
                <RefreshCw className="w-3 h-3" />
                Keine Verbindung - Anzeige evtl. veraltet
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-medium" title="Änderungen werden direkt auf dem Firmenserver gespeichert und für alle live aktualisiert.">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live synchronisiert
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setNoticesOpen((v) => !v)}
                aria-label={`Hinweise (${notices.length} ungelesen)`}
                aria-expanded={noticesOpen}
                className={`relative inline-flex items-center gap-1 px-2 py-1 rounded-md border cursor-pointer ${notices.length > 0 ? (hasUrgentNotice ? 'bg-red-600 border-red-700 text-white' : 'bg-blue-600 border-blue-700 text-white') : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Hinweise</span>
                {notices.length > 0 && <span className="font-bold">{notices.length}</span>}
              </button>
              {noticesOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-slate-200 rounded-xl shadow-xl z-50 text-sm" role="dialog" aria-label="Hinweise">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                    <span className="font-semibold">Hinweise für {session.kuerzel}</span>
                    <button
                      type="button"
                      disabled={notices.length === 0}
                      onClick={() => markNoticesSeen(notices)}
                      className="text-xs text-blue-700 underline disabled:opacity-40 cursor-pointer"
                    >
                      Alle als gelesen markieren
                    </button>
                  </div>
                  {notices.length === 0 ? (
                    <p className="px-3 py-4 text-slate-500 text-xs">Keine neuen Hinweise. Die Markierung gilt nur für Sie — was andere gelesen haben, ändert nichts.</p>
                  ) : (
                    <ul className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {notices.map((n) => (
                        <li key={n.entry.id}>
                          <button type="button" onClick={() => focusEntry(n.entry)} className="w-full text-left px-3 py-2 hover:bg-slate-50 cursor-pointer">
                            <div className={`text-xs font-semibold ${n.urgent ? 'text-red-700' : 'text-blue-700'}`}>{noticeLabel(n)}</div>
                            <div className="text-slate-800">
                              #{n.entry.number} · {n.entry.machine} <span className="text-slate-500">({n.entry.location})</span>
                            </div>
                            <div className="text-[11px] text-slate-500">{formatDateTime(n.at)}</div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-700" title={ROLE_LABELS[role]}>
              <UserRound className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-mono font-bold">{session.kuerzel}</span>
              {session.name && <span className="hidden sm:inline text-slate-500">{session.name}</span>}
              <span className="text-slate-400">·</span>
              <span>{isManager ? 'Instandhaltung' : 'Melder'}</span>
            </span>
            <button type="button" onClick={handleLogout} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer">
              <LogOut className="w-3.5 h-3.5" />
              Abmelden
            </button>
            <ArcanePixelsBrand theme="light" variant="text" />
          </div>
        </div>
        {isManager && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <nav className="flex gap-2" aria-label="Bereiche">
              {([
                ['liste', 'Meldungen', ListChecks],
                ['verwaltung', 'Verwaltung', Settings],
              ] as const).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex items-center gap-2 py-2.5 px-4 text-sm font-medium border-b-2 cursor-pointer ${
                    tab === id ? 'border-blue-600 text-blue-700 bg-blue-50/40' : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${tab === id ? 'text-blue-600' : 'text-slate-400'}`} />
                  {label}
                </button>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        {list && notices.length > 0 && (
          <div
            role="alert"
            data-testid="notice-banner"
            className={`mb-4 rounded-xl border px-4 py-3 text-sm ${hasUrgentNotice ? 'border-red-300 bg-red-50 text-red-900' : 'border-blue-300 bg-blue-50 text-blue-900'}`}
          >
            <div className="flex items-start gap-3">
              {hasUrgentNotice ? <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" /> : <Bell className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />}
              <ul className="flex-1 min-w-0 space-y-1">
                {notices.slice(0, 3).map((n) => (
                  <li key={n.entry.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <strong className={n.urgent ? 'text-red-700' : ''}>{noticeLabel(n)}:</strong>
                    <span>
                      #{n.entry.number} · {n.entry.machine} ({n.entry.location})
                    </span>
                    <button type="button" onClick={() => focusEntry(n.entry)} className="underline text-xs font-medium cursor-pointer">
                      Anzeigen
                    </button>
                  </li>
                ))}
                {notices.length > 3 && <li className="text-xs opacity-80">… und {notices.length - 3} weitere (siehe Glocke oben)</li>}
              </ul>
              <button
                type="button"
                onClick={() => markNoticesSeen(notices)}
                className={`shrink-0 px-3 py-1 rounded-lg border text-xs font-medium cursor-pointer ${hasUrgentNotice ? 'border-red-300 hover:bg-red-100' : 'border-blue-300 hover:bg-blue-100'}`}
              >
                Alle gelesen
              </button>
            </div>
          </div>
        )}
        {!list ? (
          <div className="py-16 text-center text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            {loadError ? loadError : 'Liste wird geladen…'}
          </div>
        ) : tab === 'verwaltung' && isManager ? (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <MaintenanceManage auth={auth} list={list} onListChange={applyMutationList} ownKuerzel={session.kuerzel} />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Kopfzeile: Aktion + Kennzahlen */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4 text-sm">
                <span>
                  <strong className="text-lg">{stats.open}</strong> offen
                </span>
                {stats.urgent > 0 && (
                  <span className="text-red-700 font-semibold inline-flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    {stats.urgent} sofort
                  </span>
                )}
                {stats.mine > 0 && (
                  <button type="button" onClick={() => setAssigneeFilter('mine')} className="text-blue-700 font-medium underline cursor-pointer" title="Mir zugewiesene offene Meldungen anzeigen">
                    {stats.mine} mir zugewiesen
                  </button>
                )}
                {stats.overdue > 0 && (
                  <span className="text-red-700 font-semibold inline-flex items-center gap-1" title="Frist für die Nachbearbeitung überschritten">
                    <AlertTriangle className="w-4 h-4" />
                    {stats.overdue} Nachbearbeitung überfällig
                  </span>
                )}
                {stats.provisional > 0 && (
                  <span className="text-violet-700 font-medium" title="Läuft wieder, endgültige Reparatur steht noch aus">
                    {stats.provisional} provisorisch
                  </span>
                )}
                <span className="text-slate-500">{stats.done} erledigt</span>
              </div>
              <button
                type="button"
                onClick={() => setFormState({ mode: 'create' })}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Neue Meldung
              </button>
            </div>

            {/* Filter */}
            <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl p-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Suchen: Maschine, Text, Nr., Kürzel"
                  aria-label="Suchen"
                  className={`${selectClass} pl-8 w-64`}
                />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Status" className={selectClass}>
                <option value="offen">Offen (inkl. provisorisch)</option>
                <option value="provisorisch">Nur provisorisch behoben</option>
                <option value="ueberfaellig">Nachbearbeitung überfällig</option>
                <option value="erledigt">Erledigt</option>
                <option value="alle">Alle</option>
              </select>
              <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} aria-label="Standort" className={selectClass}>
                <option value="">Alle Standorte</option>
                {list.locations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <select value={disciplineFilter} onChange={(e) => setDisciplineFilter(e.target.value as '' | Discipline)} aria-label="Art" className={selectClass}>
                <option value="">Mechanisch & Elektrisch</option>
                {DISCIPLINES.map((d) => (
                  <option key={d} value={d}>
                    {DISCIPLINE_LABELS[d]}
                  </option>
                ))}
              </select>
              <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value as '' | 'mine' | 'none')} aria-label="Zuständigkeit" className={selectClass}>
                <option value="">Alle Zuständigkeiten</option>
                <option value="mine">Mir zugewiesen</option>
                <option value="none">Nicht zugewiesen</option>
              </select>
              <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value as '' | Urgency)} aria-label="Dringlichkeit" className={selectClass}>
                <option value="">Alle Dringlichkeiten</option>
                {URGENCIES.map((u) => (
                  <option key={u} value={u}>
                    {URGENCY_LABELS[u]}
                  </option>
                ))}
              </select>
            </div>

            {/* Einträge */}
            {filtered.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-300 rounded-xl py-12 text-center text-slate-500 text-sm">
                {list.entries.length === 0 ? 'Noch keine Meldungen. Mit „Neue Meldung“ den ersten Eintrag anlegen.' : 'Keine Einträge für diese Filter.'}
              </div>
            ) : (
              <ul className="space-y-3">
                {filtered.map((entry) => {
                  const style = URGENCY_STYLE[entry.urgency];
                  const mayModify = canModifyEntry({ kuerzel: session.kuerzel, role }, entry);
                  return (
                    <li key={entry.id} className={`flex bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs ${entry.done ? 'opacity-80' : ''} ${flashNumber === entry.number ? 'ring-2 ring-blue-500' : ''}`} data-entry-number={entry.number}>
                      <div className={`w-1.5 shrink-0 ${entry.done ? 'bg-emerald-400' : isProvisionalOverdue(entry, today) ? 'bg-red-600' : entry.provisional ? 'bg-violet-500' : style.bar}`} aria-hidden />
                      <div className="flex-1 p-4 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <span className="font-mono text-xs text-slate-500">#{entry.number}</span>
                          <span className="font-semibold text-slate-900">{entry.machine}</span>
                          <span className="text-sm text-slate-600">
                            {entry.location} · {entry.area}
                          </span>
                          {noticeByEntry.has(entry.id) && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-blue-600 text-white font-bold" title="Für Sie neu seit Ihrem letzten „Gelesen“">
                              NEU
                            </span>
                          )}
                          {entry.assignedTo && (
                            <span
                              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${entry.assignedTo === session.kuerzel ? 'border-blue-500 bg-blue-50 text-blue-800 font-semibold' : 'border-slate-300 bg-white text-slate-600'}`}
                              title={`Zugewiesen von ${entry.assignedBy ?? '?'} am ${formatDateTime(entry.assignedAt)}`}
                            >
                              <UserRound className="w-3 h-3" />
                              Zuständig: {entry.assignedTo}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-slate-300 bg-slate-50 text-slate-700">
                            {entry.discipline === 'elektrisch' ? <Zap className="w-3 h-3 text-yellow-600" /> : <Cog className="w-3 h-3 text-slate-600" />}
                            {DISCIPLINE_LABELS[entry.discipline]}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${style.badge}`}>{URGENCY_LABELS[entry.urgency]}</span>
                          {entry.done ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-emerald-400 bg-emerald-50 text-emerald-800 font-medium">
                              <Check className="w-3 h-3" />
                              Erledigt
                            </span>
                          ) : entry.provisional ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-violet-400 bg-violet-50 text-violet-800 font-medium">
                              <Wrench className="w-3 h-3" />
                              Provisorisch behoben – Nachbearbeitung nötig
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full border border-slate-300 bg-white text-slate-600">Offen</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{entry.description}</p>
                        <div className="text-xs text-slate-500 space-y-0.5">
                          <div>
                            Gemeldet von <strong className="font-mono text-slate-700">{entry.createdBy}</strong> am {formatDateTime(entry.createdAt)}
                            {entry.rev > 1 && !entry.done && <span> · zuletzt geändert von {entry.updatedBy} am {formatDateTime(entry.updatedAt)}</span>}
                          </div>
                          {!entry.done && entry.provisional && (
                            <div className="text-violet-900 bg-violet-50 border border-violet-200 rounded-lg px-2 py-1">
                              Provisorisch behoben von <strong className="font-mono">{entry.provisionalBy}</strong> am {formatDateTime(entry.provisionalAt)}
                              {entry.provisionalNote && <span> – „{entry.provisionalNote}“</span>}
                              {entry.provisionalDue && (
                                <div className={isProvisionalOverdue(entry, today) ? 'text-red-700 font-semibold' : 'font-medium'}>
                                  {isProvisionalOverdue(entry, today) ? 'ÜBERFÄLLIG – Nachbearbeiten bis ' : 'Nachbearbeiten bis '}
                                  {formatDate(entry.provisionalDue)}
                                </div>
                              )}
                            </div>
                          )}
                          {entry.done && (
                            <div className="text-emerald-800">
                              Erledigt von <strong className="font-mono">{entry.doneBy}</strong> am {formatDateTime(entry.doneAt)}
                              {entry.doneNote && <span className="text-slate-700"> – „{entry.doneNote}“</span>}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-center gap-1.5 p-3 shrink-0">
                        {isManager && !entry.done && (
                          <select
                            value={entry.assignedTo ?? ''}
                            aria-label={`Meldung ${entry.number} zuweisen`}
                            onChange={(e) =>
                              act(
                                () => maintAssignAsync(auth, entry.id, entry.rev, e.target.value),
                                e.target.value ? `#${entry.number} an ${e.target.value} zugewiesen.` : `Zuweisung von #${entry.number} aufgehoben.`
                              )
                            }
                            className="border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white text-slate-800 max-w-[9.5rem]"
                          >
                            <option value="">Nicht zugewiesen</option>
                            {list.users
                              .filter((u) => u.active && u.role === 'instandhaltung')
                              .map((u) => (
                                <option key={u.kuerzel} value={u.kuerzel}>
                                  {u.kuerzel}
                                  {u.name ? ` – ${u.name}` : ''}
                                </option>
                              ))}
                          </select>
                        )}
                        {isManager &&
                          (entry.done ? (
                            <button
                              type="button"
                              onClick={() => act(() => maintSetDoneAsync(auth, entry.id, entry.rev, false, ''), `#${entry.number} wieder geöffnet.`)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Wieder öffnen
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setDoneTarget({ entry, mode: 'done' })}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                {entry.provisional ? 'Endgültig erledigt' : 'Erledigt'}
                              </button>
                              {entry.provisional ? (
                                <button
                                  type="button"
                                  onClick={() => setDoneTarget({ entry, mode: 'provisional' })}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-violet-300 text-violet-800 hover:bg-violet-50 text-xs font-medium cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  Frist / Notiz ändern
                                </button>
                              ) : null}
                              {entry.provisional ? (
                                <button
                                  type="button"
                                  onClick={() => act(() => maintSetProvisionalAsync(auth, entry.id, entry.rev, false, ''), `#${entry.number} wieder auf „offen“ gesetzt.`)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Zurück auf offen
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDoneTarget({ entry, mode: 'provisional' })}
                                  title="Läuft wieder, muss aber noch richtig repariert werden"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-violet-400 text-violet-800 bg-violet-50 hover:bg-violet-100 text-xs font-medium cursor-pointer"
                                >
                                  <Wrench className="w-3.5 h-3.5" />
                                  Provisorisch
                                </button>
                              )}
                            </>
                          ))}
                        {mayModify && (
                          <div className="flex gap-1">
                            <button type="button" onClick={() => setFormState({ mode: 'edit', entry })} title="Bearbeiten" aria-label={`Meldung ${entry.number} bearbeiten`} className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Meldung #${entry.number} (${entry.machine}) wirklich löschen?`)) {
                                  act(() => maintDeleteEntryAsync(auth, entry.id, entry.rev), `#${entry.number} gelöscht.`);
                                }
                              }}
                              title="Löschen"
                              aria-label={`Meldung ${entry.number} löschen`}
                              className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </main>

      {list && formState && (
        <EntryFormModal
          list={list}
          session={session}
          state={formState}
          onClose={() => setFormState(null)}
          onSubmit={(input, baseRev) =>
            formState.mode === 'create'
              ? act(() => maintCreateEntryAsync(auth, input), 'Meldung gespeichert.')
              : act(() => maintUpdateEntryAsync(auth, formState.entry.id, baseRev!, input), 'Änderung gespeichert.')
          }
        />
      )}

      {doneTarget && (
        <DoneDialog
          entry={doneTarget.entry}
          mode={doneTarget.mode}
          onClose={() => setDoneTarget(null)}
          onConfirm={async (note, due) => {
            const { entry, mode } = doneTarget;
            const res =
              mode === 'done'
                ? await act(() => maintSetDoneAsync(auth, entry.id, entry.rev, true, note), `#${entry.number} als erledigt gemeldet.`)
                : await act(() => maintSetProvisionalAsync(auth, entry.id, entry.rev, true, note, due), `#${entry.number} als provisorisch behoben vermerkt - bleibt in der Liste.`);
            setDoneTarget(null);
            return res.ok;
          }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------

interface EntryFormModalProps {
  list: MaintenanceList;
  session: MaintSession;
  state: { mode: 'create' } | { mode: 'edit'; entry: MaintenanceEntry };
  onClose: () => void;
  onSubmit: (input: EntryInput, baseRev?: number) => Promise<MaintResult<ListChange>>;
}

function rememberedLocation(list: MaintenanceList): string {
  try {
    const v = localStorage.getItem(LAST_LOCATION_KEY);
    if (v && list.locations.includes(v)) return v;
  } catch {}
  return list.locations[0] ?? '';
}

const EntryFormModal: React.FC<EntryFormModalProps> = ({ list, session, state, onClose, onSubmit }) => {
  const editing = state.mode === 'edit' ? state.entry : null;
  const [location, setLocation] = useState(editing?.location ?? rememberedLocation(list));
  const [area, setArea] = useState(editing?.area ?? '');
  const [machine, setMachine] = useState(editing?.machine ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [discipline, setDiscipline] = useState<Discipline>(editing?.discipline ?? 'mechanisch');
  const [urgency, setUrgency] = useState<Urgency>(editing?.urgency ?? 'normal');
  const [baseRev, setBaseRev] = useState<number | undefined>(editing?.rev);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<MaintenanceEntry | null | undefined>(undefined); // undefined = kein Konflikt, null = gelöscht

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  // Vorschläge aus bereits vorhandenen Einträgen: weniger Tippfehler, schnelleres Eintragen.
  const areaSuggestions = useMemo(
    () => Array.from(new Set(list.entries.filter((e) => e.location === location).map((e) => e.area))).sort(),
    [list.entries, location]
  );
  const machineSuggestions = useMemo(
    () =>
      Array.from(
        new Set(list.entries.filter((e) => e.location === location && (!area.trim() || e.area.toLowerCase() === area.trim().toLowerCase())).map((e) => e.machine))
      ).sort(),
    [list.entries, location, area]
  );

  const loadCurrent = () => {
    if (!conflict) return;
    setLocation(conflict.location);
    setArea(conflict.area);
    setMachine(conflict.machine);
    setDescription(conflict.description);
    setDiscipline(conflict.discipline);
    setUrgency(conflict.urgency);
    setBaseRev(conflict.rev);
    setConflict(undefined);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || conflict !== undefined) return;
    setSaving(true);
    setError(null);
    const res = await onSubmit({ location, area, machine, description, discipline, urgency }, baseRev);
    setSaving(false);
    if (res.ok) {
      try {
        localStorage.setItem(LAST_LOCATION_KEY, location);
      } catch {}
      onClose();
      return;
    }
    if (res.status === 409 || (res.status === 404 && res.currentEntry === null)) {
      setConflict(res.currentEntry ?? null);
      return;
    }
    setError(res.error);
  };

  const field = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none';
  const label = 'text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1';

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/60 flex items-start sm:items-center justify-center p-3 overflow-y-auto" role="dialog" aria-modal="true" aria-label={editing ? `Meldung ${editing.number} bearbeiten` : 'Neue Meldung'}>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-5 sm:p-6 space-y-4 my-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{editing ? `Meldung #${editing.number} bearbeiten` : 'Neue Meldung'}</h2>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Schließen" className="p-1 rounded hover:bg-slate-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {conflict !== undefined && (
          <div role="alert" className="p-3 rounded-lg border border-amber-400 bg-amber-50 text-amber-900 text-sm space-y-2">
            {conflict === null ? (
              <>
                <p>Dieser Eintrag wurde inzwischen gelöscht. Ihre Änderung wurde nicht gespeichert.</p>
                <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold cursor-pointer">
                  Schließen
                </button>
              </>
            ) : (
              <>
                <p>
                  Dieser Eintrag wurde inzwischen von <strong className="font-mono">{conflict.updatedBy}</strong> geändert. Ihre Änderung wurde nicht gespeichert, damit nichts überschrieben wird.
                </p>
                <button type="button" onClick={loadCurrent} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold cursor-pointer">
                  Aktuellen Stand laden und neu bearbeiten
                </button>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="mf-location" className={label}>
              Standort
            </label>
            <select id="mf-location" required value={location} onChange={(e) => setLocation(e.target.value)} className={field}>
              {list.locations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="mf-area" className={label}>
              Bereich
            </label>
            <input id="mf-area" required maxLength={100} list="mf-area-list" value={area} onChange={(e) => setArea(e.target.value)} placeholder="z. B. Halle 2, Verpackung" className={field} autoComplete="off" />
            <datalist id="mf-area-list">
              {areaSuggestions.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
        </div>

        <div>
          <label htmlFor="mf-machine" className={label}>
            Maschine
          </label>
          <input id="mf-machine" required maxLength={100} list="mf-machine-list" value={machine} onChange={(e) => setMachine(e.target.value)} placeholder="z. B. CNC-01" className={field} autoComplete="off" />
          <datalist id="mf-machine-list">
            {machineSuggestions.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>

        <div>
          <label htmlFor="mf-description" className={label}>
            Beschreibung
          </label>
          <textarea id="mf-description" required rows={4} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Was ist defekt? Was wurde beobachtet?" className={field} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <fieldset>
            <legend className={label}>Art</legend>
            <div className="flex gap-2">
              {DISCIPLINES.map((d) => (
                <label key={d} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm cursor-pointer ${discipline === d ? 'border-blue-600 bg-blue-50 text-blue-800 font-semibold' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>
                  <input type="radio" name="mf-discipline" value={d} checked={discipline === d} onChange={() => setDiscipline(d)} className="sr-only" />
                  {d === 'elektrisch' ? <Zap className="w-4 h-4" /> : <Cog className="w-4 h-4" />}
                  {DISCIPLINE_LABELS[d]}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="mf-urgency" className={label}>
              Dringlichkeit
            </label>
            <select id="mf-urgency" value={urgency} onChange={(e) => setUrgency(e.target.value as Urgency)} className={field}>
              {URGENCIES.map((u) => (
                <option key={u} value={u}>
                  {URGENCY_LABELS[u]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Eintrag unter dem Kürzel <strong className="font-mono text-slate-700">{editing ? editing.createdBy : session.kuerzel}</strong>
        </p>

        {error && (
          <div role="alert" className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-800 text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50 cursor-pointer">
            Abbrechen
          </button>
          <button type="submit" disabled={saving || conflict !== undefined} className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold cursor-pointer">
            {saving ? 'Speichert…' : editing ? 'Änderung speichern' : 'Meldung speichern'}
          </button>
        </div>
      </form>
    </div>
  );
};

// ---------------------------------------------------------------------------

interface DoneDialogProps {
  entry: MaintenanceEntry;
  mode: 'done' | 'provisional';
  onClose: () => void;
  onConfirm: (note: string, due?: string) => Promise<boolean>;
}

const DoneDialog: React.FC<DoneDialogProps> = ({ entry, mode, onClose, onConfirm }) => {
  const provisional = mode === 'provisional';
  // Beim Ändern eines bestehenden Provisoriums die bisherigen Werte vorbelegen.
  const [note, setNote] = useState(provisional ? entry.provisionalNote ?? '' : '');
  const [due, setDue] = useState(provisional ? entry.provisionalDue ?? '' : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/60 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label={provisional ? `Meldung ${entry.number} provisorisch behoben` : `Meldung ${entry.number} erledigt melden`}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (saving) return;
          setSaving(true);
          await onConfirm(note, provisional ? due || undefined : undefined);
        }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4"
      >
        <h2 className="text-lg font-bold">{provisional ? 'Provisorisch behoben' : 'Als erledigt melden'}</h2>
        {provisional && (
          <p className="text-xs text-violet-900 bg-violet-50 border border-violet-200 rounded-lg p-2">
            Die Maschine läuft wieder, muss aber noch richtig repariert werden. Der Eintrag bleibt in der Liste, bis er endgültig erledigt wird.
          </p>
        )}
        <p className="text-sm text-slate-600">
          <span className="font-mono">#{entry.number}</span> · <strong>{entry.machine}</strong> ({entry.location} · {entry.area})
        </p>
        <div>
          <label htmlFor="done-note" className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1">
            {provisional ? 'Was wurde provisorisch gemacht – und was ist noch zu tun?' : 'Was wurde gemacht? (optional)'}
          </label>
          <textarea
            id="done-note"
            required={provisional}
            rows={3}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
            placeholder={provisional ? 'z. B. Mit Schlauchschelle abgedichtet; Schlauch muss bei nächstem Stillstand getauscht werden' : 'z. B. Dichtung getauscht, Pumpe geprüft'}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
          />
        </div>
        {provisional && (
          <div>
            <label htmlFor="prov-due" className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1">
              Nachbearbeiten bis (optional, Wiedervorlage)
            </label>
            <input
              id="prov-due"
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">Nach diesem Datum erscheint die Meldung als überfällig.</p>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50 cursor-pointer">
            Abbrechen
          </button>
          <button type="submit" disabled={saving} className={`px-5 py-2 rounded-lg disabled:opacity-50 text-white text-sm font-semibold cursor-pointer ${provisional ? 'bg-violet-600 hover:bg-violet-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            {saving ? 'Speichert…' : provisional ? 'Provisorisch vermerken' : 'Erledigt melden'}
          </button>
        </div>
      </form>
    </div>
  );
};
