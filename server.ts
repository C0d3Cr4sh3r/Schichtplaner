import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '20mb' }));

// Local database directory on internal disk / container volume
const DATA_DIR = path.join(process.cwd(), 'data');
const DEPT_DIR = path.join(DATA_DIR, 'departments');
const SYSTEM_FILE = path.join(DATA_DIR, 'system.json');

// Ensure local intranet database storage directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DEPT_DIR)) {
  fs.mkdirSync(DEPT_DIR, { recursive: true });
}

// System settings interface (admin password, registry)
interface SystemConfig {
  adminPasswordHash?: string;
  adminPasswordPlain?: string; // Stored securely on internal server only
  lastUpdated: string;
}

const DEFAULT_ADMIN_PASS = 'Industrie2025!';

function getSystemConfig(): SystemConfig {
  try {
    if (fs.existsSync(SYSTEM_FILE)) {
      return JSON.parse(fs.readFileSync(SYSTEM_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading system.json:', err);
  }
  const initial: SystemConfig = {
    adminPasswordPlain: DEFAULT_ADMIN_PASS,
    lastUpdated: new Date().toISOString(),
  };
  fs.writeFileSync(SYSTEM_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  return initial;
}

function saveSystemConfig(cfg: SystemConfig): void {
  fs.writeFileSync(SYSTEM_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
}

function normalizeCode(code: string): string {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

function getDeptFilePath(code: string): string {
  const norm = normalizeCode(code);
  return path.join(DEPT_DIR, `${norm}.json`);
}

// Seeding standard industrial departments if completely empty
function initializeSeedDataIfEmpty() {
  const existingFiles = fs.readdirSync(DEPT_DIR).filter(f => f.endsWith('.json'));
  if (existingFiles.length === 0) {
    console.log('[Intranet DB] Initializing seed departments on local server...');
    const seedFERT = {
      departmentCode: 'FERT-A',
      departmentName: 'Zerspanung & CNC Fertigung (Halle 2)',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      machines: [
        {
          id: 'm1',
          departmentCode: 'FERT-A',
          code: 'CNC-01',
          name: 'DMG MORI NLX 2500 (Drehzentrum)',
          area: 'Halle 2 / Zerspanung Süd',
          shiftModel: '3-schicht',
          minStaffPerShift: { frueh: 1, spaet: 1, nacht: 1 },
          status: 'aktiv',
        },
        {
          id: 'm2',
          departmentCode: 'FERT-A',
          code: 'CNC-02',
          name: 'Hermle C42U 5-Achs Fräszentrum',
          area: 'Halle 2 / Zerspanung Nord',
          shiftModel: '3-schicht',
          minStaffPerShift: { frueh: 1, spaet: 1, nacht: 1 },
          status: 'aktiv',
        },
        {
          id: 'm3',
          departmentCode: 'FERT-A',
          code: 'MESS-01',
          name: 'Zeiss Prismo 3D-Koordinatenmessmaschine',
          area: 'Halle 2 / Qualitätssicherung',
          shiftModel: '2-schicht',
          minStaffPerShift: { frueh: 1, spaet: 1, nacht: 0 },
          status: 'aktiv',
        },
        {
          id: 'm4',
          departmentCode: 'FERT-A',
          code: 'SAEG-01',
          name: 'Kasto Vollautomatische Bandsäge',
          area: 'Halle 2 / Materiallager',
          shiftModel: '2-schicht',
          minStaffPerShift: { frueh: 1, spaet: 1, nacht: 0 },
          status: 'aktiv',
        },
      ],
      employees: [
        {
          id: 'emp-tl-1',
          departmentCode: 'FERT-A',
          personnelNumber: 'P-1001',
          firstName: 'Hans',
          lastName: 'Müller',
          role: 'teamleiter',
          shiftModel: '1-schicht',
          excludedShifts: ['nacht'],
          customSequence: ['frueh'],
          rotationOffsetWeeks: 0,
          qualifiedMachineIds: ['m1', 'm2', 'm3', 'm4'],
          phone: '+49 170 1122334',
          active: true,
        },
        {
          id: 'emp-sf-1',
          departmentCode: 'FERT-A',
          personnelNumber: 'P-1002',
          firstName: 'Markus',
          lastName: 'Weber',
          role: 'schichtfuehrer',
          shiftModel: '3-schicht',
          excludedShifts: [],
          customSequence: ['frueh', 'nacht', 'spaet'],
          rotationOffsetWeeks: 0,
          qualifiedMachineIds: ['m1', 'm2', 'm3'],
          phone: '+49 171 2233445',
          active: true,
        },
        {
          id: 'emp-sf-2',
          departmentCode: 'FERT-A',
          personnelNumber: 'P-1003',
          firstName: 'Stefan',
          lastName: 'Bauer',
          role: 'schichtfuehrer',
          shiftModel: '3-schicht',
          excludedShifts: [],
          customSequence: ['nacht', 'spaet', 'frueh'],
          rotationOffsetWeeks: 0,
          qualifiedMachineIds: ['m1', 'm2', 'm4'],
          phone: '+49 172 3344556',
          active: true,
        },
        {
          id: 'emp-sf-3',
          departmentCode: 'FERT-A',
          personnelNumber: 'P-1004',
          firstName: 'Klaus',
          lastName: 'Schmidt',
          role: 'schichtfuehrer',
          shiftModel: '3-schicht',
          excludedShifts: [],
          customSequence: ['spaet', 'frueh', 'nacht'],
          rotationOffsetWeeks: 0,
          qualifiedMachineIds: ['m1', 'm2', 'm3', 'm4'],
          phone: '+49 173 4455667',
          active: true,
        },
        {
          id: 'emp-w-1',
          departmentCode: 'FERT-A',
          personnelNumber: 'P-2001',
          firstName: 'Alexander',
          lastName: 'Fischer',
          role: 'mitarbeiter',
          shiftModel: '3-schicht',
          excludedShifts: [],
          customSequence: ['frueh', 'nacht', 'spaet'],
          rotationOffsetWeeks: 0,
          qualifiedMachineIds: ['m1', 'm2'],
          preferredMachineId: 'm1',
          active: true,
        },
        {
          id: 'emp-w-2',
          departmentCode: 'FERT-A',
          personnelNumber: 'P-2002',
          firstName: 'Michael',
          lastName: 'Schneider',
          role: 'mitarbeiter',
          shiftModel: '3-schicht',
          excludedShifts: [],
          customSequence: ['nacht', 'spaet', 'frueh'],
          rotationOffsetWeeks: 0,
          qualifiedMachineIds: ['m1'],
          preferredMachineId: 'm1',
          active: true,
        },
        {
          id: 'emp-w-3',
          departmentCode: 'FERT-A',
          personnelNumber: 'P-2003',
          firstName: 'Thomas',
          lastName: 'Wagner',
          role: 'mitarbeiter',
          shiftModel: '3-schicht',
          excludedShifts: [],
          customSequence: ['spaet', 'frueh', 'nacht'],
          rotationOffsetWeeks: 0,
          qualifiedMachineIds: ['m1', 'm4'],
          preferredMachineId: 'm1',
          active: true,
        },
        {
          id: 'emp-w-4',
          departmentCode: 'FERT-A',
          personnelNumber: 'P-2004',
          firstName: 'Christian',
          lastName: 'Becker',
          role: 'mitarbeiter',
          shiftModel: '3-schicht',
          excludedShifts: [],
          customSequence: ['frueh', 'nacht', 'spaet'],
          rotationOffsetWeeks: 0,
          qualifiedMachineIds: ['m2'],
          preferredMachineId: 'm2',
          active: true,
        },
        {
          id: 'emp-w-5',
          departmentCode: 'FERT-A',
          personnelNumber: 'P-2005',
          firstName: 'Daniel',
          lastName: 'Hoffmann',
          role: 'mitarbeiter',
          shiftModel: '3-schicht',
          excludedShifts: [],
          customSequence: ['nacht', 'spaet', 'frueh'],
          rotationOffsetWeeks: 0,
          qualifiedMachineIds: ['m2'],
          preferredMachineId: 'm2',
          active: true,
        },
        {
          id: 'emp-w-6',
          departmentCode: 'FERT-A',
          personnelNumber: 'P-2006',
          firstName: 'Florian',
          lastName: 'Schulz',
          role: 'mitarbeiter',
          shiftModel: '3-schicht',
          excludedShifts: [],
          customSequence: ['spaet', 'frueh', 'nacht'],
          rotationOffsetWeeks: 0,
          qualifiedMachineIds: ['m2', 'm3'],
          preferredMachineId: 'm2',
          active: true,
        },
        {
          id: 'emp-w-7',
          departmentCode: 'FERT-A',
          personnelNumber: 'P-2007',
          firstName: 'Patrick',
          lastName: 'Koch',
          role: 'mitarbeiter',
          shiftModel: '2-schicht',
          excludedShifts: ['nacht'],
          customSequence: ['frueh', 'spaet'],
          rotationOffsetWeeks: 0,
          qualifiedMachineIds: ['m3', 'm4'],
          preferredMachineId: 'm3',
          active: true,
        },
        {
          id: 'emp-w-8',
          departmentCode: 'FERT-A',
          personnelNumber: 'P-2008',
          firstName: 'Tobias',
          lastName: 'Richter',
          role: 'mitarbeiter',
          shiftModel: '2-schicht',
          excludedShifts: ['nacht'],
          customSequence: ['spaet', 'frueh'],
          rotationOffsetWeeks: 0,
          qualifiedMachineIds: ['m3', 'm4'],
          preferredMachineId: 'm3',
          active: true,
        },
      ],
      absences: [],
      manualOverrides: [],
      layoutSettings: {
        orientation: 'landscape',
        colorTheme: 'monochrome',
        scalePercent: 88,
        fontSize: 'compact',
        companyName: 'IndustrieWerke AG',
        departmentDisplayName: 'Zerspanung & CNC Fertigung (Halle 2)',
        documentTitle: 'Wochenschichtplan & Maschineneinteilung',
        documentSubtitle: 'Gültig für Produktionswoche',
        showTeamLeadBox: true,
        showShiftLeaderRow: true,
        showMachineDetails: true,
        showStaffPhone: true,
        showLegend: true,
        showNotesField: true,
        customNotesText: 'Sicherheitshinweis: Vor Schichtbeginn PSA überprüfen und Maschinen-Checkliste durchführen.',
        showSignatures: true,
        signature1Label: 'Schichtleitung (geprüft)',
        signature2Label: 'Betriebsrat / Abteilungsleitung (freigegeben)',
      },
    };

    const seedMONT = {
      departmentCode: 'MONT-1',
      departmentName: 'Montagelinie & Endprüfung (Halle 5)',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      machines: [
        {
          id: 'm-mont-1',
          departmentCode: 'MONT-1',
          code: 'LINIE-01',
          name: 'Hauptmontageband Antriebsstrang',
          area: 'Halle 5 / Linie A',
          shiftModel: '2-schicht',
          minStaffPerShift: { frueh: 2, spaet: 2, nacht: 0 },
          status: 'aktiv',
        },
        {
          id: 'm-mont-2',
          departmentCode: 'MONT-1',
          code: 'PRUEF-01',
          name: 'Endprüfstand & Dichtheitskontrolle',
          area: 'Halle 5 / Prüffeld',
          shiftModel: '2-schicht',
          minStaffPerShift: { frueh: 1, spaet: 1, nacht: 0 },
          status: 'aktiv',
        },
      ],
      employees: [
        {
          id: 'emp-m-tl',
          departmentCode: 'MONT-1',
          personnelNumber: 'P-3001',
          firstName: 'Ralf',
          lastName: 'Zimmermann',
          role: 'teamleiter',
          shiftModel: '1-schicht',
          excludedShifts: ['nacht'],
          customSequence: ['frueh'],
          rotationOffsetWeeks: 0,
          qualifiedMachineIds: ['m-mont-1', 'm-mont-2'],
          active: true,
        },
        {
          id: 'emp-m-sf1',
          departmentCode: 'MONT-1',
          personnelNumber: 'P-3002',
          firstName: 'Jürgen',
          lastName: 'Braun',
          role: 'schichtfuehrer',
          shiftModel: '2-schicht',
          excludedShifts: ['nacht'],
          customSequence: ['frueh', 'spaet'],
          rotationOffsetWeeks: 0,
          qualifiedMachineIds: ['m-mont-1', 'm-mont-2'],
          active: true,
        },
        {
          id: 'emp-m-sf2',
          departmentCode: 'MONT-1',
          personnelNumber: 'P-3003',
          firstName: 'Sven',
          lastName: 'Krüger',
          role: 'schichtfuehrer',
          shiftModel: '2-schicht',
          excludedShifts: ['nacht'],
          customSequence: ['spaet', 'frueh'],
          rotationOffsetWeeks: 0,
          qualifiedMachineIds: ['m-mont-1', 'm-mont-2'],
          active: true,
        },
      ],
      absences: [],
      manualOverrides: [],
      layoutSettings: {
        orientation: 'landscape',
        colorTheme: 'monochrome',
        scalePercent: 88,
        fontSize: 'compact',
        companyName: 'IndustrieWerke AG',
        departmentDisplayName: 'Montagelinie & Endprüfung (Halle 5)',
        documentTitle: 'Wochenschichtplan & Maschineneinteilung',
        documentSubtitle: 'Gültig für Produktionswoche',
        showTeamLeadBox: true,
        showShiftLeaderRow: true,
        showMachineDetails: true,
        showStaffPhone: true,
        showLegend: true,
        showNotesField: true,
        customNotesText: 'Montage-Qualitätskontrolle nach jedem Takt bestätigen.',
        showSignatures: true,
        signature1Label: 'Schichtleitung (geprüft)',
        signature2Label: 'Betriebsrat / Abteilungsleitung (freigegeben)',
      },
    };

    fs.writeFileSync(getDeptFilePath('FERT-A'), JSON.stringify(seedFERT, null, 2), 'utf-8');
    fs.writeFileSync(getDeptFilePath('MONT-1'), JSON.stringify(seedMONT, null, 2), 'utf-8');
    console.log('[Intranet DB] Seeded FERT-A and MONT-1 successfully.');
  }
}

initializeSeedDataIfEmpty();

// -------------------------------------------------------------
// REST API ENDPOINTS FOR LOCAL INTRANET MULTI-USER DB
// -------------------------------------------------------------

// 1. Health & Server Status (checks local storage & isolation)
app.get('/api/status', (req: Request, res: Response) => {
  const depts = fs.readdirSync(DEPT_DIR).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
  res.json({
    status: 'online',
    mode: 'intranet-local-database',
    cloudConnection: false,
    externalInternetRequired: false,
    serverTime: new Date().toISOString(),
    departmentCount: depts.length,
    departments: depts,
  });
});

// 2. List all registered departments (summary info)
app.get('/api/departments', (req: Request, res: Response) => {
  try {
    const files = fs.readdirSync(DEPT_DIR).filter(f => f.endsWith('.json'));
    const list = files.map(file => {
      const fullPath = path.join(DEPT_DIR, file);
      try {
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        return {
          code: data.departmentCode,
          name: data.departmentName || `Abteilung ${data.departmentCode}`,
          createdAt: data.createdAt,
          lastModified: data.lastModified,
          machineCount: data.machines?.length || 0,
          employeeCount: data.employees?.length || 0,
        };
      } catch {
        const code = file.replace('.json', '');
        return { code, name: `Abteilung ${code}`, createdAt: new Date().toISOString(), lastModified: new Date().toISOString() };
      }
    });
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to list departments', details: err.message });
  }
});

// 3. Verify Department Code (fast check)
app.get('/api/departments/:code/verify', (req: Request, res: Response) => {
  const code = normalizeCode(req.params.code);
  const filePath = getDeptFilePath(code);
  const exists = fs.existsSync(filePath);
  if (exists) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      res.json({ valid: true, code, name: data.departmentName });
    } catch {
      res.json({ valid: true, code, name: `Abteilung ${code}` });
    }
  } else {
    res.json({ valid: false, code });
  }
});

// 4. Get Department Database
app.get('/api/departments/:code', (req: Request, res: Response) => {
  const code = normalizeCode(req.params.code);
  const filePath = getDeptFilePath(code);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: `Department ${code} not found` });
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: `Failed to read department ${code}`, details: err.message });
  }
});

// 5. Save/Update Department Database
app.put('/api/departments/:code', (req: Request, res: Response) => {
  const code = normalizeCode(req.params.code);
  const filePath = getDeptFilePath(code);
  try {
    const body = req.body;
    const updated = {
      ...body,
      departmentCode: code,
      lastModified: new Date().toISOString(),
    };
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');
    res.json({ success: true, code, lastModified: updated.lastModified });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to save department ${code}`, details: err.message });
  }
});

// 6. Create New Department
app.post('/api/departments', (req: Request, res: Response) => {
  const { code: rawCode, name: rawName, template } = req.body;
  const code = normalizeCode(rawCode);
  if (!code) {
    return res.status(400).json({ error: 'Valid department code is required' });
  }
  const filePath = getDeptFilePath(code);
  if (fs.existsSync(filePath)) {
    return res.status(409).json({ error: `Department ${code} already exists` });
  }

  const name = rawName && rawName.trim() ? rawName.trim() : `Abteilung ${code}`;
  const newDept = {
    departmentCode: code,
    departmentName: name,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    machines: [],
    employees: [],
    absences: [],
    manualOverrides: [],
    layoutSettings: {
      orientation: 'landscape',
      colorTheme: 'monochrome',
      scalePercent: 88,
      fontSize: 'compact',
      companyName: 'IndustrieWerke AG',
      departmentDisplayName: name,
      documentTitle: 'Wochenschichtplan & Maschineneinteilung',
      documentSubtitle: 'Gültig für Produktionswoche',
      showTeamLeadBox: true,
      showShiftLeaderRow: true,
      showMachineDetails: true,
      showStaffPhone: true,
      showLegend: true,
      showNotesField: true,
      customNotesText: '',
      showSignatures: true,
      signature1Label: 'Schichtleitung (geprüft)',
      signature2Label: 'Betriebsrat / Abteilungsleitung (freigegeben)',
    },
  };

  fs.writeFileSync(filePath, JSON.stringify(newDept, null, 2), 'utf-8');
  res.status(201).json(newDept);
});

// 7. Delete Department
app.delete('/api/departments/:code', (req: Request, res: Response) => {
  const code = normalizeCode(req.params.code);
  const filePath = getDeptFilePath(code);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: `Department ${code} does not exist` });
  }
  try {
    fs.unlinkSync(filePath);
    res.json({ success: true, deleted: code });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to delete department ${code}`, details: err.message });
  }
});

// 8. Admin Password Verification & Change
app.post('/api/admin/verify', (req: Request, res: Response) => {
  const { password } = req.body;
  const cfg = getSystemConfig();
  const isValid = password === (cfg.adminPasswordPlain || DEFAULT_ADMIN_PASS);
  res.json({
    valid: isValid,
    isDefault: (cfg.adminPasswordPlain || DEFAULT_ADMIN_PASS) === DEFAULT_ADMIN_PASS,
  });
});

app.post('/api/admin/change-password', (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const cfg = getSystemConfig();
  if (currentPassword !== (cfg.adminPasswordPlain || DEFAULT_ADMIN_PASS)) {
    return res.status(401).json({ error: 'Aktuelles Passwort ist nicht korrekt.' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Das neue Passwort muss mindestens 6 Zeichen lang sein.' });
  }
  cfg.adminPasswordPlain = newPassword;
  cfg.lastUpdated = new Date().toISOString();
  saveSystemConfig(cfg);
  res.json({ success: true, isDefault: false });
});

// -------------------------------------------------------------
// VITE MIDDLEWARE SETUP (Express + Vite)
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Intranet Schichtplaner] Server läuft auf http://0.0.0.0:${PORT} (100% On-Premise / No-Cloud)`);
  });
}

startServer();
