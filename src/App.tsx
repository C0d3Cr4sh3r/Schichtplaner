import React, { useState, useEffect } from 'react';
import { DepartmentDatabase } from './types';
import {
  getCurrentDepartmentCode,
  setCurrentDepartmentCode,
  getDepartmentDB,
  saveDepartmentDB,
  ensureDepartmentExists,
  listRegisteredDepartments,
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

  // Initialize department from storage
  useEffect(() => {
    const savedDept = getCurrentDepartmentCode();
    if (savedDept) {
      const db = getDepartmentDB(savedDept) || ensureDepartmentExists(savedDept);
      setCurrentDeptCodeState(savedDept);
      setCurrentDB(db);
    } else {
      // Check if there are default departments
      const depts = listRegisteredDepartments();
      if (depts.length > 0) {
        // We show login screen to require Kürzel entry
      }
    }
  }, []);

  const handleLogin = (deptCode: string) => {
    const db = getDepartmentDB(deptCode) || ensureDepartmentExists(deptCode);
    setCurrentDeptCodeState(deptCode);
    setCurrentDB(db);
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

  const handleUpdateDB = (updated: DepartmentDatabase) => {
    if (!currentDeptCode) return;
    saveDepartmentDB(currentDeptCode, updated);
    setCurrentDB(updated);
  };

  const handleImportSuccess = (code: string) => {
    setCurrentDepartmentCode(code);
    setCurrentDeptCodeState(code);
    const db = getDepartmentDB(code);
    setCurrentDB(db);
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
            <ArcanePixelsBrand theme="light" size="xs" variant="badge" />
          </div>
        </div>
      </footer>
    </div>
  );
}
