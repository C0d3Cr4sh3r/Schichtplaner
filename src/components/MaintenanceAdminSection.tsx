import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Plus, Trash2, Wrench } from 'lucide-react';
import { MaintenanceList } from '../lib/maintenanceLogic';
import {
  MaintListSummary,
  maintAdminCreateListAsync,
  maintAdminDeleteListAsync,
  maintAdminListAsync,
  maintFetchListAsync,
} from '../lib/maintenanceStorage';
import { MaintenanceManage } from './MaintenanceManage';

interface MaintenanceAdminSectionProps {
  /** Das beim Admin-Login bestätigte Passwort (nur im Speicher gehalten). */
  adminPassword: string;
}

/** Admin-Bereich: Instandhaltungslisten anlegen/löschen und deren Kürzel & Standorte verwalten. */
export const MaintenanceAdminSection: React.FC<MaintenanceAdminSectionProps> = ({ adminPassword }) => {
  const [lists, setLists] = useState<MaintListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newLocations, setNewLocations] = useState('');
  const [firstKuerzel, setFirstKuerzel] = useState('');
  const [firstName, setFirstName] = useState('');
  const [busy, setBusy] = useState(false);

  const [openCode, setOpenCode] = useState<string | null>(null);
  const [openList, setOpenList] = useState<MaintenanceList | null>(null);

  const reload = useCallback(async () => {
    const res = await maintAdminListAsync(adminPassword);
    setLoading(false);
    if (res.ok) {
      setLists(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
  }, [adminPassword]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const locations = newLocations
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await maintAdminCreateListAsync(adminPassword, {
      code: newCode,
      name: newName,
      locations: locations.length ? locations : undefined,
      firstUser: firstKuerzel.trim() ? { kuerzel: firstKuerzel, name: firstName } : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNewCode('');
    setNewName('');
    setNewLocations('');
    setFirstKuerzel('');
    setFirstName('');
    await reload();
  };

  const handleDelete = async (code: string) => {
    if (!confirm(`Instandhaltungsliste „${code}“ mit allen Einträgen und Kürzeln löschen? (Der Server legt vorher eine Sicherung an.)`)) return;
    const res = await maintAdminDeleteListAsync(adminPassword, code);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (openCode === code) {
      setOpenCode(null);
      setOpenList(null);
    }
    await reload();
  };

  const toggleOpen = async (code: string) => {
    if (openCode === code) {
      setOpenCode(null);
      setOpenList(null);
      return;
    }
    const res = await maintFetchListAsync({ listCode: code, adminPassword });
    if (res.ok && res.data.list) {
      setOpenCode(code);
      setOpenList(res.data.list);
    } else if (!res.ok) {
      setError(res.error);
    }
  };

  const inputClass = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500';

  return (
    <div className="space-y-4 pt-2" data-testid="maintenance-admin">
      <div className="flex items-center gap-2">
        <Wrench className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-bold text-white">Instandhaltungslisten</h3>
      </div>
      <p className="text-xs text-slate-400">
        Eine Liste hat ein eigenes Listenkürzel. Mitarbeiter melden sich mit dem Listenkürzel und ihrem persönlichen Kürzel an; das persönliche Kürzel erscheint bei ihren Einträgen.
      </p>

      {error && (
        <div role="alert" className="p-3 bg-red-950/70 border border-red-500/50 text-red-200 rounded-xl text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="underline cursor-pointer">
            OK
          </button>
        </div>
      )}

      <form onSubmit={handleCreate} className="p-4 rounded-xl bg-slate-900/80 border border-slate-700 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-[11px] text-slate-400">
            Listenkürzel
            <input required maxLength={20} value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} placeholder="INSTANDHALTUNG" className={`${inputClass} mt-1 font-mono uppercase`} />
          </label>
          <label className="text-[11px] text-slate-400">
            Name der Liste (optional)
            <input maxLength={100} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Instandhaltung Werk Nord + Süd" className={`${inputClass} mt-1`} />
          </label>
          <label className="text-[11px] text-slate-400 sm:col-span-2">
            Standorte (durch Komma getrennt, optional – Standard: „Standort 1, Standort 2“)
            <input value={newLocations} onChange={(e) => setNewLocations(e.target.value)} placeholder="Werk Nord, Werk Süd" className={`${inputClass} mt-1`} />
          </label>
          <label className="text-[11px] text-slate-400">
            Erstes Kürzel (Rolle Instandhaltung)
            <input maxLength={8} value={firstKuerzel} onChange={(e) => setFirstKuerzel(e.target.value.toUpperCase())} placeholder="MT" className={`${inputClass} mt-1 font-mono uppercase`} />
          </label>
          <label className="text-[11px] text-slate-400">
            Name dazu (optional)
            <input maxLength={80} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Max Mustermann" className={`${inputClass} mt-1`} />
          </label>
        </div>
        <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer">
          <Plus className="w-3.5 h-3.5" />
          Liste anlegen
        </button>
      </form>

      {loading ? (
        <p className="text-xs text-slate-500">Lade…</p>
      ) : lists.length === 0 ? (
        <p className="text-xs text-slate-500">Noch keine Instandhaltungsliste angelegt.</p>
      ) : (
        <ul className="space-y-2">
          {lists.map((l) => (
            <li key={l.code} className="rounded-xl bg-slate-900/60 border border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                <button type="button" onClick={() => toggleOpen(l.code)} className="flex items-center gap-2 text-left cursor-pointer" aria-expanded={openCode === l.code}>
                  {openCode === l.code ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <span className="font-mono font-bold text-blue-300">{l.code}</span>
                  <span className="text-sm text-slate-200">{l.name}</span>
                </button>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>{l.userCount} Kürzel</span>
                  <span>
                    {l.openCount} offen / {l.entryCount} gesamt
                  </span>
                  <button type="button" onClick={() => handleDelete(l.code)} title="Liste löschen" aria-label={`Liste ${l.code} löschen`} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {openCode === l.code && openList && (
                <div className="bg-white rounded-b-xl p-4">
                  <MaintenanceManage
                    auth={{ listCode: l.code, adminPassword }}
                    list={openList}
                    onListChange={(next) => {
                      setOpenList(next);
                      reload();
                    }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
