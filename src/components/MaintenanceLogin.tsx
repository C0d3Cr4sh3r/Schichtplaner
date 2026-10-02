import React, { useState } from 'react';
import { ArrowRight, AlertCircle, CalendarDays, Info, Wrench } from 'lucide-react';
import {
  DEMO_LIST_CODE,
  MaintSession,
  getLastListCode,
  isMaintenanceLocalDemo,
  maintLoginAsync,
  saveMaintSession,
} from '../lib/maintenanceStorage';

export type LoginTarget = 'planner' | 'maintenance';

interface LoginTargetSwitchProps {
  value: LoginTarget;
  onChange: (target: LoginTarget) => void;
}

/** Umschalter auf der Startseite: Schichtplan (Abteilungskürzel) oder Instandhaltungsliste (Listen- + persönliches Kürzel). */
export const LoginTargetSwitch: React.FC<LoginTargetSwitchProps> = ({ value, onChange }) => {
  const base = 'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer';
  const on = 'bg-blue-600 text-white shadow';
  const off = 'text-slate-300 hover:text-white hover:bg-slate-700/60';
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-slate-900/70 border border-slate-700" role="tablist" aria-label="Bereich wählen">
      <button type="button" role="tab" aria-selected={value === 'planner'} onClick={() => onChange('planner')} className={`${base} ${value === 'planner' ? on : off}`}>
        <CalendarDays className="w-4 h-4" />
        Schichtplan
      </button>
      <button type="button" role="tab" aria-selected={value === 'maintenance'} onClick={() => onChange('maintenance')} className={`${base} ${value === 'maintenance' ? on : off}`}>
        <Wrench className="w-4 h-4" />
        Instandhaltungsliste
      </button>
    </div>
  );
};

interface MaintenanceLoginFormProps {
  onLogin: (session: MaintSession) => void;
}

export const MaintenanceLoginForm: React.FC<MaintenanceLoginFormProps> = ({ onLogin }) => {
  const [listCode, setListCode] = useState(getLastListCode());
  const [kuerzel, setKuerzel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await maintLoginAsync(listCode, kuerzel);
    setBusy(false);
    setDemo(isMaintenanceLocalDemo());
    if (!result.ok) {
      setError(result.error);
      return;
    }
    saveMaintSession(result.data);
    onLogin(result.data);
  };

  const inputClass =
    'w-full font-mono bg-slate-900 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-base tracking-wider uppercase shadow-inner';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="maint-list-code" className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
            Listenkürzel
          </label>
          <input
            id="maint-list-code"
            type="text"
            required
            maxLength={20}
            value={listCode}
            onChange={(e) => {
              setListCode(e.target.value.toUpperCase());
              setError(null);
            }}
            placeholder="z. B. INSTANDHALTUNG"
            className={inputClass}
            autoFocus={!listCode}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="maint-kuerzel" className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
            Ihr persönliches Kürzel
          </label>
          <input
            id="maint-kuerzel"
            type="text"
            required
            maxLength={8}
            value={kuerzel}
            onChange={(e) => {
              setKuerzel(e.target.value.toUpperCase());
              setError(null);
            }}
            placeholder="z. B. MT"
            className={inputClass}
            autoFocus={!!listCode}
            autoComplete="off"
          />
        </div>
      </div>
      <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
        <span>
          Das Listenkürzel kennt Ihr Team, das persönliche Kürzel (z. B. Ihre Initialen) bekommen Sie von der Instandhaltung. Unter diesem Kürzel erscheinen Ihre Einträge.
        </span>
      </p>

      {error && (
        <div className="p-3.5 bg-red-950/70 border border-red-500/50 text-red-200 rounded-xl text-xs space-y-1" role="alert">
          <div className="font-semibold flex items-center gap-1.5 text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            Anmeldung nicht möglich
          </div>
          <div>{error}</div>
        </div>
      )}

      {demo && (
        <div className="p-3 bg-amber-950/40 border border-amber-500/30 text-amber-200/90 rounded-xl text-xs">
          Demo-Modus: Die Liste läuft nur in diesem Browser. Zum Ausprobieren: Listenkürzel{' '}
          <button type="button" className="underline font-mono font-bold text-amber-300" onClick={() => setListCode(DEMO_LIST_CODE)}>
            {DEMO_LIST_CODE}
          </button>
          , Kürzel{' '}
          <button type="button" className="underline font-mono font-bold text-amber-300" onClick={() => setKuerzel('IH1')}>
            IH1
          </button>{' '}
          (Instandhaltung) oder{' '}
          <button type="button" className="underline font-mono font-bold text-amber-300" onClick={() => setKuerzel('PROD1')}>
            PROD1
          </button>{' '}
          (Melder).
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
      >
        <span>{busy ? 'Prüfe…' : 'Liste öffnen'}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
};
