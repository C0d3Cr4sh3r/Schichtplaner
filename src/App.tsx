import React, { useState, useEffect } from 'react';
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

export default function App() {
  const [currentDeptCode, setCurrentDeptCodeState] = useState<string | null>(null);
  const [currentDB, setCurrentDB] = useState<DepartmentDatabase | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('wochenplan');
  const [isDBModalOpen, setIsDBModalOpen] = useState(false);
  const [isAdminModeRequested, setIsAdminModeRequested] = useState(false);

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
      getDepartmentDBAsync(currentDeptCode).then((latest) => {
        if (latest && (!currentDB || latest.lastModified !== currentDB.lastModified)) {
          setCurrentDB(latest);
        }
      });
    }, 4000); // 4 seconds intranet sync
    return () => clearInterval(interval);
  }, [currentDeptCode, currentDB]);

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
    setCurrentDB(updated);
    await saveDepartmentDBAsync(currentDeptCode, updated);
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
