import React, { useState } from 'react';
import { MapPin, Plus, Trash2, Users, X, AlertTriangle } from 'lucide-react';
import { MaintenanceList, MaintenanceRole, ROLE_LABELS, ROLES } from '../lib/maintenanceLogic';
import {
  MaintAuth,
  MaintResult,
  ListChange,
  maintAddUserAsync,
  maintRemoveUserAsync,
  maintUpdateSettingsAsync,
  maintUpdateUserAsync,
} from '../lib/maintenanceStorage';

interface MaintenanceManageProps {
  auth: MaintAuth;
  list: MaintenanceList;
  /** Wird mit dem neuen Stand aufgerufen, nachdem der Server eine Änderung bestätigt hat. */
  onListChange: (list: MaintenanceList) => void;
  /** Eigenes Kürzel (nur in der Listenansicht), um versehentliches Aussperren deutlicher zu warnen. */
  ownKuerzel?: string;
}

/** Verwaltung der Kürzel (Benutzer), Standorte und des Listennamens. Nur für Instandhaltung bzw. Admin. */
export const MaintenanceManage: React.FC<MaintenanceManageProps> = ({ auth, list, onListChange, ownKuerzel }) => {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newKuerzel, setNewKuerzel] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<MaintenanceRole>('melder');

  const [newLocation, setNewLocation] = useState('');
  const [listNameDraft, setListNameDraft] = useState(list.listName);

  const run = async (action: () => Promise<MaintResult<ListChange>>): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    const res = await action();
    setBusy(false);
    if (res.ok) {
      onListChange(res.data.list);
      return true;
    }
    if (res.list) onListChange(res.list);
    setError(res.error);
    return false;
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(() => maintAddUserAsync(auth, { kuerzel: newKuerzel, name: newName, role: newRole }));
    if (ok) {
      setNewKuerzel('');
      setNewName('');
    }
  };

  const handleRemoveUser = (kuerzel: string) => {
    const own = kuerzel === ownKuerzel ? '\n\nAchtung: Das ist Ihr eigenes Kürzel - Sie werden danach abgemeldet.' : '';
    if (!confirm(`Kürzel „${kuerzel}“ wirklich löschen? Bereits angelegte Einträge behalten das Kürzel als Text.${own}`)) return;
    run(() => maintRemoveUserAsync(auth, kuerzel));
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newLocation.trim();
    if (!name) return;
    const ok = await run(() => maintUpdateSettingsAsync(auth, { locations: [...list.locations, name] }));
    if (ok) setNewLocation('');
  };

  const handleRemoveLocation = (loc: string) => {
    run(() => maintUpdateSettingsAsync(auth, { locations: list.locations.filter((l) => l !== loc) }));
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => maintUpdateSettingsAsync(auth, { listName: listNameDraft }));
  };

  const input = 'border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none';
  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 cursor-pointer';

  return (
    <div className="space-y-6 text-slate-900">
      {error && (
        <div role="alert" className="flex items-start gap-2 p-3 rounded-lg border border-red-300 bg-red-50 text-red-800 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Meldung schließen" className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Kürzel */}
      <section className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" />
          Kürzel (Anmeldung an dieser Liste)
        </h3>
        <p className="text-xs text-slate-500">
          <strong>Melder</strong> können Meldungen eintragen und ihre eigenen offenen Einträge ändern. <strong>Instandhaltung</strong> kann zusätzlich Einträge erledigen, alle Einträge ändern/löschen und diese Verwaltung nutzen.
        </p>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="text-left px-3 py-2">Kürzel</th>
                <th className="text-left px-3 py-2">Name (optional)</th>
                <th className="text-left px-3 py-2">Rolle</th>
                <th className="text-left px-3 py-2" title="Für welche Standorte diese Person Hinweise zu neuen und dringenden Meldungen bekommt. Nichts angehakt = keine Hinweise.">Hinweise für Standorte</th>
                <th className="text-left px-3 py-2">Aktiv</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {list.users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-slate-500">
                    Noch kein Kürzel angelegt. Legen Sie zuerst ein Kürzel mit der Rolle „Instandhaltung“ an.
                  </td>
                </tr>
              )}
              {list.users.map((u) => (
                <tr key={u.kuerzel} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono font-bold">{u.kuerzel}</td>
                  <td className="px-3 py-2">
                    <input
                      defaultValue={u.name}
                      key={`${u.kuerzel}-${u.name}`}
                      maxLength={80}
                      aria-label={`Name für ${u.kuerzel}`}
                      className={`${input} w-full`}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== u.name) run(() => maintUpdateUserAsync(auth, u.kuerzel, { name: v }));
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={u.role}
                      aria-label={`Rolle für ${u.kuerzel}`}
                      className={input}
                      onChange={(e) => run(() => maintUpdateUserAsync(auth, u.kuerzel, { role: e.target.value as MaintenanceRole }))}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {list.locations.map((loc) => {
                        const checked = (u.notifyLocations ?? []).includes(loc);
                        return (
                          <label key={loc} className="inline-flex items-center gap-1 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              aria-label={`${u.kuerzel}: Hinweise für ${loc}`}
                              onChange={(e) => {
                                const current = u.notifyLocations ?? [];
                                const next = e.target.checked ? [...current, loc] : current.filter((l) => l !== loc);
                                run(() => maintUpdateUserAsync(auth, u.kuerzel, { notifyLocations: next }));
                              }}
                              className="w-3.5 h-3.5"
                            />
                            {loc}
                          </label>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={u.active}
                      aria-label={`${u.kuerzel} aktiv`}
                      onChange={(e) => run(() => maintUpdateUserAsync(auth, u.kuerzel, { active: e.target.checked }))}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveUser(u.kuerzel)}
                      title="Kürzel löschen"
                      aria-label={`Kürzel ${u.kuerzel} löschen`}
                      className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form onSubmit={handleAddUser} className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-600">
            Kürzel
            <input required minLength={2} maxLength={8} value={newKuerzel} onChange={(e) => setNewKuerzel(e.target.value.toUpperCase())} placeholder="MT" className={`${input} block w-24 font-mono uppercase`} />
          </label>
          <label className="text-xs text-slate-600">
            Name (optional)
            <input maxLength={80} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Max Mustermann" className={`${input} block w-48`} />
          </label>
          <label className="text-xs text-slate-600">
            Rolle
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as MaintenanceRole)} className={`${input} block`}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={busy} className={btn}>
            <Plus className="w-4 h-4" />
            Kürzel hinzufügen
          </button>
        </form>
      </section>

      {/* Standorte */}
      <section className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600" />
          Standorte
        </h3>
        <div className="flex flex-wrap gap-2">
          {list.locations.map((loc) => (
            <span key={loc} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-sm">
              {loc}
              <button
                type="button"
                onClick={() => handleRemoveLocation(loc)}
                title="Standort entfernen (nur möglich, wenn kein Eintrag ihn verwendet)"
                aria-label={`Standort ${loc} entfernen`}
                className="p-0.5 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
        <form onSubmit={handleAddLocation} className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-600">
            Neuer Standort
            <input value={newLocation} maxLength={60} onChange={(e) => setNewLocation(e.target.value)} placeholder="z. B. Werk Ost" className={`${input} block w-56`} />
          </label>
          <button type="submit" disabled={busy || !newLocation.trim()} className={btn}>
            <Plus className="w-4 h-4" />
            Hinzufügen
          </button>
        </form>
      </section>

      {/* Listenname */}
      <section className="space-y-3">
        <h3 className="font-semibold">Name der Liste</h3>
        <form onSubmit={handleSaveName} className="flex flex-wrap items-end gap-2">
          <input required maxLength={100} value={listNameDraft} onChange={(e) => setListNameDraft(e.target.value)} aria-label="Name der Liste" className={`${input} w-72`} />
          <button type="submit" disabled={busy || listNameDraft.trim() === list.listName} className={btn}>
            Speichern
          </button>
        </form>
      </section>
    </div>
  );
};
