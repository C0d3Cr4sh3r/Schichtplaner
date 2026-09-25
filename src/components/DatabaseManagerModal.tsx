import React, { useState, useEffect } from 'react';
import { DepartmentDatabase } from '../types';
import {
  exportDepartmentJSON,
  importDepartmentJSON,
  createSeedDepartmentDatabase,
  checkServerConnection,
  listDepartmentBackupsAsync,
  restoreDepartmentBackupAsync,
  DepartmentBackup,
} from '../lib/storage';
import { Download, Upload, RefreshCcw, Database, CheckCircle, AlertTriangle, FileCode, Info, History } from 'lucide-react';

interface DatabaseManagerModalProps {
  db: DepartmentDatabase;
  isOpen: boolean;
  onClose: () => void;
  onUpdateDB: (updated: DepartmentDatabase) => void;
  onImportSuccess: (deptCode: string) => void;
}

export const DatabaseManagerModal: React.FC<DatabaseManagerModalProps> = ({
  db,
  isOpen,
  onClose,
  onUpdateDB,
  onImportSuccess,
}) => {
  const [importText, setImportText] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isServerOnline, setIsServerOnline] = useState<boolean | null>(null);
  const [backups, setBackups] = useState<DepartmentBackup[]>([]);
  const [restoringDate, setRestoringDate] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      checkServerConnection().then(setIsServerOnline);
      listDepartmentBackupsAsync(db.departmentCode).then(setBackups);
    }
  }, [isOpen, db.departmentCode]);

  if (!isOpen) return null;

  const handleRestoreBackup = async (date: string) => {
    if (
      !confirm(
        `Möchten Sie wirklich den Stand vom ${date} wiederherstellen? Der aktuelle Stand wird vorher automatisch gesichert, danach aber durch diesen Backup-Stand ersetzt.`
      )
    ) {
      return;
    }
    setRestoringDate(date);
    const result = await restoreDepartmentBackupAsync(db.departmentCode, date);
    setRestoringDate(null);
    if (result.success) {
      setStatusMsg({ type: 'success', text: `Stand vom ${date} wurde wiederhergestellt. Bitte Seite neu laden, um ihn zu sehen.` });
      listDepartmentBackupsAsync(db.departmentCode).then(setBackups);
    } else {
      setStatusMsg({ type: 'error', text: result.error || 'Wiederherstellung fehlgeschlagen.' });
    }
  };

  const handleDownload = () => {
    const jsonStr = exportDepartmentJSON(db.departmentCode);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schichtplan_db_${db.departmentCode}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg({ type: 'success', text: `Datenbank für Abteilung "${db.departmentCode}" erfolgreich als JSON exportiert.` });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportText(content);
        const res = importDepartmentJSON(content);
        if (res.success && res.code) {
          setStatusMsg({ type: 'success', text: `Datenbank für "${res.code}" erfolgreich importiert!` });
          onImportSuccess(res.code);
        } else {
          setStatusMsg({ type: 'error', text: res.error || 'Fehler beim Importieren.' });
        }
      }
    };
    reader.readAsText(file);
  };

  const handleManualImport = () => {
    if (!importText.trim()) return;
    const res = importDepartmentJSON(importText);
    if (res.success && res.code) {
      setStatusMsg({ type: 'success', text: `Datenbank für "${res.code}" erfolgreich importiert!` });
      onImportSuccess(res.code);
    } else {
      setStatusMsg({ type: 'error', text: res.error || 'Ungültiges JSON-Format.' });
    }
  };

  const handleResetToDefault = () => {
    if (
      confirm(
        `Möchten Sie die Datenbank der Abteilung "${db.departmentCode}" wirklich auf die Standard-Industrie-Musterdaten zurücksetzen? Alle manuellen Änderungen gehen verloren.`
      )
    ) {
      const fresh = createSeedDepartmentDatabase(db.departmentCode, db.departmentName);
      onUpdateDB(fresh);
      setStatusMsg({ type: 'success', text: 'Auf Standard-Musterdaten zurückgesetzt.' });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-base">
              Datenbank-Verwaltung & Datensicherung
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            ✕
          </button>
        </div>

        {/* Info stats */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-slate-500 block">Aktive Abteilung:</span>
              <span className="font-mono font-bold text-blue-700 text-sm">{db.departmentCode}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Abteilungsname:</span>
              <span className="font-medium text-slate-800">{db.departmentName}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Maschinen im Bestand:</span>
              <span className="font-mono font-semibold">{db.machines.length} Maschinen</span>
            </div>
            <div>
              <span className="text-slate-500 block">Mitarbeiter registriert:</span>
              <span className="font-mono font-semibold">{db.employees.length} Personen</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
            <span className="text-slate-500">Speicher-Betriebsmodus:</span>
            {isServerOnline === true && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Intranet-Server (Aktiv & Synchronisiert)
              </span>
            )}
            {isServerOnline === false && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-medium text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                Browser-Modus (Demo / Lokaler Speicher)
              </span>
            )}
          </div>
        </div>

        {/* Status message */}
        {statusMsg && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
                : 'bg-red-50 border border-red-300 text-red-800'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Export action */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
            1. Backup / JSON-Export
          </label>
          <p className="text-[11px] text-slate-500">
            Speichern Sie die vollständige Konfiguration dieser Abteilung als `.json`-Datei auf Ihrem Computer.
          </p>
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Vollständige Abteilungs-DB als JSON exportieren</span>
          </button>
        </div>

        {/* Automatic server backups */}
        {isServerOnline && (
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-slate-500" />
              Automatische Server-Backups
            </label>
            <p className="text-[11px] text-slate-500">
              Der Server sichert vor jeder Änderung automatisch den Stand des Vortages (max. 30 Tage aufbewahrt). Damit lässt sich ein versehentlicher Datenverlust rückgängig machen.
            </p>
            {backups.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">Noch keine automatischen Backups vorhanden (entstehen ab der ersten Änderung an einem neuen Tag).</p>
            ) : (
              <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                {backups.map((b) => (
                  <div key={b.date} className="flex items-center justify-between px-3 py-1.5 text-xs">
                    <span className="font-mono text-slate-700">{b.date}</span>
                    <button
                      type="button"
                      onClick={() => handleRestoreBackup(b.date)}
                      disabled={restoringDate === b.date}
                      className="text-[11px] text-blue-700 hover:text-blue-900 font-medium cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                    >
                      {restoringDate === b.date ? 'Wird wiederhergestellt…' : 'Wiederherstellen'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Import action */}
        <div className="space-y-2 pt-2 border-t border-slate-200">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
            2. Backup wiederherstellen / JSON-Import
          </label>
          <div className="flex items-center gap-2">
            <label className="flex-1 flex items-center justify-center gap-2 py-2 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>JSON-Datei auswählen</span>
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* Reset to template */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="text-xs text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            Musterdaten zurücksetzen
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
