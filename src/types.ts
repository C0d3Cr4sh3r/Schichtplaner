export type ShiftId = 'frueh' | 'spaet' | 'nacht' | 'frei';

export type RoleId = 'teamleiter' | 'schichtfuehrer' | 'mitarbeiter' | 'springer';

export type ShiftModelType = '1-schicht' | '2-schicht' | '3-schicht';

export type AbsenceType =
  | 'urlaub'
  | 'krank'
  | 'karenz'
  | 'zeitausgleich'
  | 'weiterbildung'
  | 'sonderurlaub';

export interface Employee {
  id: string;
  departmentCode: string;
  personnelNumber: string;
  firstName: string;
  lastName: string;
  role: RoleId; // Teamleiter, Schichtführer, Mitarbeiter, Springer
  shiftModel: ShiftModelType; // 1, 2 oder 3 Schichten
  excludedShifts: ShiftId[]; // z.B. kein Nachtdienst ('nacht')
  customSequence: ShiftId[]; // Manuelle Rotationsreihenfolge, z.B. ['frueh', 'spaet', 'nacht'] oder ['frueh', 'spaet']
  rotationOffsetWeeks: number; // Start-Woche im Zyklus (0, 1, 2...)
  qualifiedMachineIds: string[]; // Maschinen für die dieser Mitarbeiter eingewiesen ist
  preferredMachineId?: string; // Stammmaschine
  phone?: string;
  notes?: string;
  active: boolean;
}

export interface Machine {
  id: string;
  departmentCode: string;
  code: string; // z.B. "CNC-01", "SPRITZ-04"
  name: string; // z.B. "DMG Mori 5-Achs Fräszentrum"
  area: string; // z.B. "Halle 1 / Bereich B"
  shiftModel: ShiftModelType; // Läuft in 1, 2 oder 3 Schichten
  minStaffPerShift: {
    frueh: number;
    spaet: number;
    nacht: number;
  };
  requiredRole?: RoleId;
  status: 'aktiv' | 'wartung' | 'stillstand';
  notes?: string;
}

export interface Absence {
  id: string;
  departmentCode: string;
  employeeId: string;
  type: AbsenceType; // urlaub, krank, etc.
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  note?: string;
  substituteEmployeeId?: string; // Vertretung falls zugewiesen
}

export interface ManualShiftOverride {
  // Key format: `${year}-KW${kw}-${machineId}-${shiftId}` or `${year}-KW${kw}-SF-${shiftId}`
  id: string;
  year: number;
  kw: number;
  machineId?: string;
  shiftId: ShiftId;
  dayIndex?: number; // 0 = Mo, 1 = Di ... 6 = So; undefined = ganze Woche
  assignedEmployeeIds: string[];
  note?: string;
}

export interface PrintLayoutSettings {
  orientation: 'landscape' | 'portrait';
  colorTheme: 'monochrome' | 'industrial-blue' | 'shift-colored' | 'high-contrast';
  scalePercent: number; // 50 - 100%
  fontSize: 'compact' | 'normal' | 'large';
  companyName: string;
  departmentDisplayName: string;
  documentTitle: string;
  documentSubtitle: string;
  showTeamLeadBox: boolean;
  showShiftLeaderRow: boolean;
  showMachineDetails: boolean;
  showStaffPhone: boolean;
  showLegend: boolean;
  showNotesField: boolean;
  customNotesText: string;
  showSignatures: boolean;
  signature1Label: string;
  signature2Label: string;
}

export interface DepartmentDatabase {
  departmentCode: string; // e.g. "FERT-A"
  departmentName: string; // e.g. "Fertigung & Zerspanung Halle 1"
  createdAt: string;
  lastModified: string;
  version?: number; // wird vom Server hochgezählt, für Konflikterkennung bei gleichzeitigem Speichern
  machines: Machine[];
  employees: Employee[];
  absences: Absence[];
  manualOverrides: ManualShiftOverride[];
  layoutSettings: PrintLayoutSettings;
}

export interface WeekPlanSchedule {
  year: number;
  kw: number;
  startDateStr: string;
  endDateStr: string;
  teamLeader?: Employee;
  shiftLeaders: {
    frueh?: Employee | Employee[];
    spaet?: Employee | Employee[];
    nacht?: Employee | Employee[];
  };
  machineAssignments: {
    machine: Machine;
    shifts: {
      frueh: Employee[];
      spaet: Employee[];
      nacht: Employee[];
    };
    understaffed: {
      frueh: boolean;
      spaet: boolean;
      nacht: boolean;
    };
  }[];
  unassignedStaff: {
    frueh: Employee[];
    spaet: Employee[];
    nacht: Employee[];
    frei: Employee[];
  };
  absentEmployees: {
    employee: Employee;
    type: AbsenceType;
    affectedDaysText: string;
  }[];
}
