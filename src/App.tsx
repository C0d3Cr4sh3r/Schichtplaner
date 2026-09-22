import React, { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { DepartmentDatabase } from './types';
import {
  getCurrentDepartmentCode,
  setCurrentDepartmentCode,
  getDepartmentDBAsync,
  saveDepartmentDBAsync,
  ensureDepartmentExists,
  listRegisteredDepartmentsAsync,
} from './lib/storage';
import { DepartmentLogin } from './components/DepartmentLogin';
import { HeaderNav, ActiveTab } from './components/HeaderNav';
import { ShiftPlannerView } from './components/ShiftPlannerView';
import { MachineManager } from './components/MachineManager';
import { EmployeeManager } from './components/EmployeeManager';
import { AbsenceManager } from './components/AbsenceManager';
import { LayoutEditorAndPrint } from './components/LayoutEditorAndPrint';
import { DatabaseManagerModal } from './components/DatabaseManagerModal';
import { ArcanePixelsBrand } from './components/ArcanePixelsBrand';
import { UserManual } from './components/UserManual';

export type SaveStatus = { kind: 'idle' } | { kind: 'saving' } | { kind: 'error' } | { kind: 'conflict' };

export default function App() {
  const [currentDeptCode, setCurrentDeptCodeState] = useState<string | null>(null);
  const [currentDB, setCurrentDB] = useState<DepartmentDatabase | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('wochenplan');
  const [isDBModalOpen, setIsDBModalOpen] = useState(false);
  const [isAdminModeRequested, setIsAdminModeRequested] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: 'idle' });
  // Ref statt nur State: das Polling-Intervall (siehe unten) greift per
  // Closure darauf zu und darf currentDB nicht überschreiben, während ein
  // Save aussteht - sonst überschreibt der Poll-Zyklus eine gerade erst
  // lokal gesetzte, noch nicht vom Server bestätigte Änderung.
  const pendingSaveRef = React.useRef(false);

  // Initialize department from server and local cache
  useEffect(() => {
    const savedDept = getCurrentDepartmentCode();
    if (savedDept) {
      setCurrentDeptCodeState(savedDept);
      getDepartmentDBAsync(savedDept).then((db) => {
        if (db) {
          setCurrentDB(db);
        } else {
          const fallback = ensureDepartmentExists(savedDept);
          setCurrentDB(fallback);
        }
      });
    }
    listRegisteredDepartmentsAsync();
  }, []);

  // Periodic poll to synchronize changes made by other colleagues in the intranet
  useEffect(() => {
    if (!currentDeptCode) return;
    const interval = setInterval(() => {
      if (pendingSaveRef.current) return; // eigener Save läuft gerade, nicht überschreiben
      getDepartmentDBAsync(currentDeptCode).then((latest) => {
        if (pendingSaveRef.current) return; // zwischen Fetch-Start und -Ende kann ein Save begonnen haben
        setCurrentDB((prev) => {
          if (latest && (!prev || latest.version !== prev.version)) {
            return latest;
          }
          return prev;
        });
      });
    }, 4000); // 4 seconds intranet sync
    return () => clearInterval(interval);
  }, [currentDeptCode]);

  const handleLogin = async (deptCode: string) => {
    setCurrentDeptCodeState(deptCode);
    const db = await getDepartmentDBAsync(deptCode);
    if (db) {
      setCurrentDB(db);
    } else {
      const fallback = ensureDepartmentExists(deptCode);
      setCurrentDB(fallback);
    }
    setIsAdminModeRequested(false);
  };

  const handleSwitchDepartment = () => {
    setCurrentDepartmentCode(null);
    setCurrentDeptCodeState(null);
    setCurrentDB(null);
    setIsAdminModeRequested(false);
  };

  const handleOpenAdmin = () => {
    setCurrentDepartmentCode(null);
    setCurrentDeptCodeState(null);
    setCurrentDB(null);
    setIsAdminModeRequested(true);
  };

  const handleUpdateDB = async (updated: DepartmentDatabase) => {
    if (!currentDeptCode) return;
    setCurrentDB(updated); // optimistisch: UI reagiert sofort
    pendingSaveRef.current = true;
    setSaveStatus({ kind: 'saving' });

    const result = await saveDepartmentDBAsync(currentDeptCode, updated);
    pendingSaveRef.current = false;

    if (result.status === 'ok') {
      setCurrentDB(result.data);
      setSaveStatus({ kind: 'idle' });
    } else if (result.status === 'conflict') {
      // Jemand anderes hat zwischenzeitlich gespeichert. Statt die fremde
      // Änderung zu überschreiben oder die eigene blind zu wiederholen
      // (riskant bei komplexen Edits), übernehmen wir den aktuellen
      // Serverstand und zeigen einen Hinweis - der letzte eigene Klick muss
      // dann bewusst wiederholt werden.
      setCurrentDB(result.current);
      setSaveStatus({ kind: 'conflict' });
    } else {
      setSaveStatus({ kind: 'error' });
    }
  };

  const handleImportSuccess = async (code: string) => {
    setCurrentDepartmentCode(code);
    setCurrentDeptCodeState(code);
    const db = await getDepartmentDBAsync(code);
    if (db) setCurrentDB(db);
    setIsDBModalOpen(false);
    setIsAdminModeRequested(false);
  };

  // If not logged into a department, show isolated department selector / login
  if (!currentDeptCode || !currentDB) {
    return (
      <DepartmentLogin
        onLogin={handleLogin}
        initialAdminMode={isAdminModeRequested}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Save-Status: erscheint nur bei Fehler/Konflikt, damit eine
          gescheiterte oder verworfene Änderung nicht unbemerkt bleibt. */}
      {(saveStatus.kind === 'error' || saveStatus.kind === 'conflict') && (
        <div className="fixed top-4 right-4 z-50 max-w-sm no-print">
          <div
            className={`rounded-xl border shadow-lg px-4 py-3 flex items-start gap-2.5 text-sm ${
              saveStatus.kind === 'error'
                ? 'bg-red-50 border-red-300 text-red-800'
                : 'bg-amber-50 border-amber-300 text-amber-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              {saveStatus.kind === 'error' ? (
                <>
                  <span className="font-semibold block">Speichern fehlgeschlagen</span>
                  Die letzte Änderung konnte nicht gespeichert werden. Bitte Verbindung prüfen und erneut versuchen.
                </>
              ) : (
                <>
                  <span className="font-semibold block">Gleichzeitige Änderung erkannt</span>
                  Jemand anderes hat diese Abteilung gerade gespeichert. Ihre letzte Änderung wurde nicht übernommen — der aktuelle Stand wurde geladen, bitte bei Bedarf erneut eintragen.
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSaveStatus({ kind: 'idle' })}
              className="text-xs underline opacity-70 hover:opacity-100 cursor-pointer shrink-0"
            >
              OK
            </button>
          </div>
        </div>
      )}
      {saveStatus.kind === 'saving' && (
        <div className="fixed top-4 right-4 z-50 no-print">
          <div className="rounded-xl border border-slate-200 bg-white shadow-lg px-3 py-2 flex items-center gap-2 text-xs text-slate-500">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Speichert...
          </div>
        </div>
      )}

      {/* Navigation Header */}
      <HeaderNav
        db={currentDB}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSwitchDepartment={handleSwitchDepartment}
        onOpenAdmin={handleOpenAdmin}
        onExportDB={() => setIsDBModalOpen(true)}
        onImportClick={() => setIsDBModalOpen(true)}
        onPrintPreviewClick={() => setActiveTab('layout')}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'wochenplan' && (
          <ShiftPlannerView
            db={currentDB}
            onUpdateDB={handleUpdateDB}
            onSwitchToPrint={() => setActiveTab('layout')}
          />
        )}

        {activeTab === 'maschinen' && (
          <MachineManager db={currentDB} onUpdateDB={handleUpdateDB} />
        )}

        {activeTab === 'mitarbeiter' && (
          <EmployeeManager db={currentDB} onUpdateDB={handleUpdateDB} />
        )}

        {activeTab === 'abwesenheiten' && (
          <AbsenceManager db={currentDB} onUpdateDB={handleUpdateDB} />
        )}

        {activeTab === 'layout' && (
          <LayoutEditorAndPrint db={currentDB} onUpdateDB={handleUpdateDB} />
        )}

        {activeTab === 'anleitung' && (
          <UserManual />
        )}
      </main>

      {/* Database Backup / Restore Modal */}
      <DatabaseManagerModal
        db={currentDB}
        isOpen={isDBModalOpen}
        onClose={() => setIsDBModalOpen(false)}
        onUpdateDB={handleUpdateDB}
        onImportSuccess={handleImportSuccess}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-3 text-xs text-slate-500 no-print">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <span>
              SchichtPlan Pro • Abteilung{' '}
              <strong className="font-mono text-slate-800">{currentDB.departmentCode}</strong> (Isolierte
              Datenbank)
            </span>
            <span className="hidden md:inline">• Wöchentliche automatisierte Rotation</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Entwickelt von</span>
            <ArcanePixelsBrand theme="light" variant="text" />
          </div>
        </div>
      </footer>
    </div>
  );
}
