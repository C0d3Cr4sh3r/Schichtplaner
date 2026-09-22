import React from 'react';
import {
  CalendarDays,
  Cpu,
  Users,
  CalendarOff,
  Printer,
  Building2,
  Database,
  Download,
  Upload,
  RefreshCw,
  Lock,
  BookOpen,
} from 'lucide-react';
import { DepartmentDatabase } from '../types';
import { detectMachineVacationConflicts } from '../lib/absenceUtils';
import { ArcanePixelsBrand } from './ArcanePixelsBrand';

export type ActiveTab = 'wochenplan' | 'maschinen' | 'mitarbeiter' | 'abwesenheiten' | 'layout' | 'anleitung';

interface HeaderNavProps {
  db: DepartmentDatabase;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onSwitchDepartment: () => void;
  onOpenAdmin?: () => void;
  onExportDB: () => void;
  onImportClick: () => void;
  onPrintPreviewClick: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  db,
  activeTab,
  onTabChange,
  onSwitchDepartment,
  onOpenAdmin,
  onExportDB,
  onImportClick,
  onPrintPreviewClick,
}) => {
  const vacationConflicts = React.useMemo(() => {
    return detectMachineVacationConflicts(db.employees, db.machines, db.absences);
  }, [db.employees, db.machines, db.absences]);

  const tabs = [
    { id: 'wochenplan' as ActiveTab, label: 'Wochen- & Schichtplan', icon: CalendarDays, count: undefined, conflictCount: 0 },
    { id: 'maschinen' as ActiveTab, label: 'Maschinen', icon: Cpu, count: db.machines.length, conflictCount: 0 },
    { id: 'mitarbeiter' as ActiveTab, label: 'Mitarbeiter & Rotation', icon: Users, count: db.employees.length, conflictCount: 0 },
    {
      id: 'abwesenheiten' as ActiveTab,
      label: 'Urlaub & Krankheit',
      icon: CalendarOff,
      count: db.absences.length,
      conflictCount: vacationConflicts.length,
    },
    { id: 'layout' as ActiveTab, label: 'DIN-A4 Layout & Druck', icon: Printer, count: undefined, conflictCount: 0 },
    { id: 'anleitung' as ActiveTab, label: 'Handbuch & Anleitung', icon: BookOpen, count: undefined, conflictCount: 0 },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs no-print">
      {/* Top utility row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between border-b border-slate-100 text-xs">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-slate-900 tracking-tight text-base sm:text-lg">
              SchichtPlan <span className="text-blue-600">Pro</span>
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Department indicator */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-800 font-mono font-bold text-xs">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              {db.departmentCode}
            </span>
            <span className="text-slate-600 font-medium hidden md:inline truncate max-w-xs">
              {db.departmentName}
            </span>
            <button
              onClick={onSwitchDepartment}
              className="text-blue-600 hover:text-blue-800 underline text-xs ml-1 flex items-center gap-1 cursor-pointer"
              title="Abteilungskürzel wechseln"
            >
              <RefreshCw className="w-3 h-3" />
              Wechseln
            </button>
            {onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="text-slate-500 hover:text-amber-700 text-xs ml-2 hidden sm:flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-amber-50 px-2 py-0.5 rounded border border-slate-200 transition-colors"
                title="Admin-Bereich: Neue Abteilung anlegen / verwalten"
              >
                <Lock className="w-3 h-3 text-amber-600" />
                <span>Admin</span>
              </button>
            )}
            <span
              className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-medium"
              title="Alle Daten liegen sicher auf dem internen Firmen-Server im Intranet. Kein Byte verlässt das Netzwerk."
            >
              <Database className="w-3 h-3 text-emerald-600" />
              <span>Intranet-DB</span>
            </span>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onExportDB}
            title="Datenbank dieser Abteilung als JSON sichern"
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md border border-slate-200 text-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>DB Export</span>
          </button>
          <button
            onClick={onImportClick}
            title="JSON-Sicherung wiederherstellen"
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md border border-slate-200 text-xs transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>DB Import</span>
          </button>
          <button
            onClick={onPrintPreviewClick}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-medium shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>DIN-A4 Drucken</span>
          </button>
          <div className="h-4 w-px bg-slate-200 mx-0.5" />
          <ArcanePixelsBrand theme="light" variant="text" />
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-1 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 py-2.5 px-3 sm:px-4 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-blue-600 text-blue-700 bg-blue-50/40'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.conflictCount > 0 && (
                  <span
                    className="ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-amber-500 text-white animate-pulse"
                    title={`${tab.conflictCount} Urlaubsüberschneidung(en) an Maschinen!`}
                  >
                    {tab.conflictCount} ⚠️
                  </span>
                )}
                {tab.count !== undefined && tab.conflictCount === 0 && (
                  <span
                    className={`ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-blue-200 text-blue-800 font-semibold' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
