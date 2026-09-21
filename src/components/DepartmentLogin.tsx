import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  ArrowRight,
  ShieldCheck,
  Database,
  Trash2,
  Sparkles,
  Clock,
  Key,
  Lock,
  Unlock,
  Copy,
  Check,
  AlertCircle,
  AlertTriangle,
  LogOut,
  ChevronRight,
  RefreshCw,
  Info,
} from 'lucide-react';
import {
  listRegisteredDepartments,
  DepartmentInfo,
  setCurrentDepartmentCode,
  deleteDepartment,
  verifyDepartmentCode,
  verifyAdminPassword,
  setAdminPassword,
  isDefaultAdminPassword,
  DEFAULT_ADMIN_PASSWORD,
  createNewDepartment,
} from '../lib/storage';
import { ArcanePixelsBrand } from './ArcanePixelsBrand';

interface DepartmentLoginProps {
  onLogin: (deptCode: string) => void;
  initialAdminMode?: boolean;
}

export const DepartmentLogin: React.FC<DepartmentLoginProps> = ({
  onLogin,
  initialAdminMode = false,
}) => {
  // Navigation mode: 'enter' (Mitarbeiter: Kürzel eingeben), 'admin-login' (Passwort), 'admin-panel' (Verwaltung)
  const [viewMode, setViewMode] = useState<'enter' | 'admin-login' | 'admin-panel'>(
    initialAdminMode ? 'admin-login' : 'enter'
  );

  const [departments, setDepartments] = useState<DepartmentInfo[]>([]);

  // Employee entrance state
  const [deptCodeInput, setDeptCodeInput] = useState('');
  const [entranceError, setEntranceError] = useState<string | null>(null);

  // Admin auth state
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  // Admin new department creation state
  const [newDeptCode, setNewDeptCode] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptTemplate, setNewDeptTemplate] = useState<'seed' | 'empty'>('seed');
  const [creationSuccess, setCreationSuccess] = useState<string | null>(null);
  const [creationError, setCreationError] = useState<string | null>(null);

  // Admin password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<string | null>(null);
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);

  // Copy feedback state
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const loadDepartments = () => {
    const list = listRegisteredDepartments();
    setDepartments(list);
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  // Employee: Enter department with code
  const handleEnterWithCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = deptCodeInput.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode) {
      setEntranceError('Bitte geben Sie ein gültiges Abteilungskürzel ein.');
      return;
    }

    if (!verifyDepartmentCode(cleanCode)) {
      setEntranceError(
        `Keine Abteilung mit dem Kürzel „${cleanCode}“ gefunden. Bitte prüfen Sie das Kürzel, das Ihnen mitgeteilt wurde, oder fragen Sie Ihre Schichtleitung.`
      );
      return;
    }

    setEntranceError(null);
    setCurrentDepartmentCode(cleanCode);
    onLogin(cleanCode);
  };

  // Admin: Authenticate
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyAdminPassword(adminPasswordInput)) {
      setIsAdminAuthenticated(true);
      setViewMode('admin-panel');
      setAdminAuthError(null);
      setAdminPasswordInput('');
      loadDepartments();
    } else {
      setAdminAuthError('Ungültiges Administrator-Passwort. Bitte erneut versuchen.');
    }
  };

  // Admin: Create new department
  const handleCreateDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = newDeptCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode) {
      setCreationError('Bitte geben Sie ein gültiges Abteilungskürzel ein (z.B. CNC-1, SCHWEISS, MONT-B).');
      return;
    }

    if (verifyDepartmentCode(cleanCode)) {
      setCreationError(`Eine Abteilung mit dem Kürzel „${cleanCode}“ existiert bereits.`);
      return;
    }

    setCreationError(null);
    createNewDepartment(cleanCode, newDeptName.trim() || undefined, newDeptTemplate);
    loadDepartments();
    setCreationSuccess(cleanCode);
    setNewDeptCode('');
    setNewDeptName('');
  };

  // Admin: Change password
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError(null);
    setPasswordChangeSuccess(null);

    if (!verifyAdminPassword(oldPassword)) {
      setPasswordChangeError('Das aktuelle Passwort ist nicht korrekt.');
      return;
    }

    if (newPassword.length < 4) {
      setPasswordChangeError('Das neue Passwort muss mindestens 4 Zeichen lang sein.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordChangeError('Die Passwörter stimmen nicht überein.');
      return;
    }

    const success = setAdminPassword(newPassword);
    if (success) {
      setPasswordChangeSuccess('Admin-Passwort wurde erfolgreich geändert! Bitte gut notieren.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setShowPasswordChange(false), 3500);
    } else {
      setPasswordChangeError('Fehler beim Speichern des neuen Passworts.');
    }
  };

  // Delete department (admin only)
  const handleDeleteDepartment = (code: string) => {
    if (
      confirm(
        `Sind Sie sicher, dass Sie die Abteilung „${code}“ unwiderruflich löschen möchten? Alle Schichten, Maschinen und Mitarbeiter dieser Abteilung werden entfernt.`
      )
    ) {
      deleteDepartment(code);
      loadDepartments();
    }
  };

  // Copy code helper
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-2xl space-y-6">
        
        {/* Brand Logo & Link Header */}
        <div className="flex justify-center pt-2">
          <ArcanePixelsBrand
            theme="dark"
            size="xl"
            variant="plain"
          />
        </div>

        {/* App Title Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-400 text-xs font-medium tracking-wide uppercase">
            <ShieldCheck className="w-4 h-4" />
            Kürzel-basierte Mandantentrennung
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white font-display">
            SchichtPlan <span className="text-blue-400">Pro</span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-lg mx-auto">
            Industrieller Schicht- & Wochenplaner mit isolierten Abteilungsdatenbanken,
            automatischer Rotation und DIN-A4-Druckvorlagen.
          </p>
        </div>

        {/* ---------------------------------------------------- */}
        {/* VIEW 1: Standard Employee Entrance (Kürzel eingeben) */}
        {/* ---------------------------------------------------- */}
        {viewMode === 'enter' && (
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <Key className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Abteilung betreten</h2>
                  <p className="text-xs text-slate-400">
                    Zugang nur mit passendem Abteilungskürzel möglich
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                <Database className="w-3.5 h-3.5" />
                Geschützte Datenbank
              </span>
            </div>

            <form onSubmit={handleEnterWithCode} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  Abteilungskürzel eingeben:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={15}
                    value={deptCodeInput}
                    onChange={(e) => {
                      setDeptCodeInput(e.target.value.toUpperCase());
                      setEntranceError(null);
                    }}
                    placeholder="Z.B. FERT-A, MONT-1, CNC-02"
                    className="w-full font-mono bg-slate-900 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-base tracking-wider uppercase shadow-inner"
                    autoFocus
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
                    KÜRZEL
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                  <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  Geben Sie das Kürzel ein, das Ihnen von Ihrer Schicht- oder Betriebsleitung mitgeteilt wurde.
                </p>
              </div>

              {entranceError && (
                <div className="p-3.5 bg-red-950/70 border border-red-500/50 text-red-200 rounded-xl text-xs space-y-1">
                  <div className="font-semibold flex items-center gap-1.5 text-red-300">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    Zugang nicht möglich
                  </div>
                  <div>{entranceError}</div>
                  <div className="text-[11px] text-slate-300 pt-1">
                    Standard-Demo-Kürzel zum Ausprobieren:{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setDeptCodeInput('FERT-A');
                        setEntranceError(null);
                      }}
                      className="text-blue-400 underline font-mono font-bold hover:text-blue-300"
                    >
                      FERT-A
                    </button>{' '}
                    oder{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setDeptCodeInput('MONT-1');
                        setEntranceError(null);
                      }}
                      className="text-blue-400 underline font-mono font-bold hover:text-blue-300"
                    >
                      MONT-1
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
              >
                <span>Abteilung öffnen</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Quick-hint for demo / switch to admin */}
            <div className="pt-4 border-t border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-400 text-center sm:text-left">
                Sie möchten eine neue Abteilung für Ihren Betrieb anlegen?
              </span>
              <button
                type="button"
                onClick={() => {
                  setAdminAuthError(null);
                  setViewMode('admin-login');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium transition-colors cursor-pointer shrink-0"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Admin-Login / Neue Abteilung</span>
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* VIEW 2: Admin Login (Passwort-Abfrage)                */}
        {/* ---------------------------------------------------- */}
        {viewMode === 'admin-login' && (
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Administrator-Anmeldung</h2>
                  <p className="text-xs text-slate-400">
                    Nur für berechtigte Personen zum Anlegen und Verwalten von Abteilungen
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewMode('enter')}
                className="text-xs text-slate-400 hover:text-white transition-colors underline cursor-pointer"
              >
                Zurück zur Eingabe
              </button>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                  Admin-Passwort eingeben:
                </label>
                <input
                  type="password"
                  required
                  value={adminPasswordInput}
                  onChange={(e) => {
                    setAdminPasswordInput(e.target.value);
                    setAdminAuthError(null);
                  }}
                  placeholder="Passwort eingeben..."
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm shadow-inner"
                  autoFocus
                />
              </div>

              {/* Helpful hint about default password */}
              {isDefaultAdminPassword() && (
                <div className="p-3 bg-amber-950/60 border border-amber-500/40 rounded-xl text-amber-200 text-xs flex items-start gap-2">
                  <Key className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-amber-300">Standard-Passwort hinterlegt:</span>
                    Das Standard-Passwort lautet <code className="bg-amber-900/80 px-1.5 py-0.5 rounded font-bold font-mono text-white">admin123</code>. Sie können es nach dem Einloggen sofort nach Wunsch ändern.
                  </div>
                </div>
              )}

              {adminAuthError && (
                <div className="p-3.5 bg-red-950/70 border border-red-500/50 text-red-200 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{adminAuthError}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setViewMode('enter')}
                  className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-600/20 transition-all cursor-pointer"
                >
                  <Unlock className="w-4 h-4" />
                  <span>Anmelden & Abteilungen verwalten</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* VIEW 3: Admin Panel (Abteilungen anlegen & verwalten) */}
        {/* ---------------------------------------------------- */}
        {viewMode === 'admin-panel' && isAdminAuthenticated && (
          <div className="bg-slate-800/95 border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm space-y-6">
            {/* Admin Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">Abteilungs-Verwaltung</h2>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                      Admin-Bereich
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Hier können Sie neue Abteilungen anlegen und das Admin-Passwort ändern.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordChange(!showPasswordChange)}
                  className="px-3 py-1.5 rounded-lg border border-slate-600 hover:border-slate-500 bg-slate-700/60 text-slate-200 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Passwort ändern</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminAuthenticated(false);
                    setViewMode('enter');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Admin-Bereich verlassen"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Abmelden</span>
                </button>
              </div>
            </div>

            {/* Password change accordion / form */}
            {showPasswordChange && (
              <div className="p-4 sm:p-5 rounded-xl bg-slate-900/90 border border-amber-500/40 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    Admin-Passwort ändern (Zutrittsberechtigung für Neuanlagen)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowPasswordChange(false)}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    Schließen
                  </button>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Aktuelles Passwort</label>
                      <input
                        type="password"
                        required
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        placeholder="Aktuelles Passwort"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Neues Passwort</label>
                      <input
                        type="password"
                        required
                        minLength={4}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Neues Passwort (min. 4)"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Wiederholen</label>
                      <input
                        type="password"
                        required
                        minLength={4}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Neues Passwort bestätigen"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  {passwordChangeError && (
                    <div className="p-2.5 bg-red-950/80 border border-red-500/40 text-red-200 text-xs rounded-lg">
                      {passwordChangeError}
                    </div>
                  )}

                  {passwordChangeSuccess && (
                    <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs rounded-lg flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>{passwordChangeSuccess}</span>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Neues Passwort speichern
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Creation Success Banner */}
            {creationSuccess && (
              <div className="p-4 bg-emerald-950/70 border border-emerald-500/50 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-400" />
                    Abteilung erfolgreich angelegt!
                  </span>
                  <button
                    type="button"
                    onClick={() => setCreationSuccess(null)}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    Ausblenden
                  </button>
                </div>
                <p className="text-emerald-100">
                  Teilen Sie Ihren Mitarbeitern folgendes Kürzel mit, damit sie die Abteilung betreten können:
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="px-3 py-1.5 rounded-lg bg-emerald-900 border border-emerald-400 text-white font-mono font-bold text-sm tracking-widest">
                    {creationSuccess}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(creationSuccess)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedCode === creationSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Kopiert!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Kürzel kopieren</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentDepartmentCode(creationSuccess);
                      onLogin(creationSuccess);
                    }}
                    className="ml-auto px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Direkt zur Abteilung</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Section 1: Create New Department Form */}
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-700/80 space-y-4">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Neue Abteilung anlegen
                </h3>
              </div>

              <form onSubmit={handleCreateDepartment} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 block">
                      Abteilungskürzel (Pflichtfeld) *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={15}
                      value={newDeptCode}
                      onChange={(e) => {
                        setNewDeptCode(e.target.value.toUpperCase());
                        setCreationError(null);
                      }}
                      placeholder="Z.B. CNC-2, MONT-B, LACKIER"
                      className="w-full font-mono bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm uppercase"
                    />
                    <p className="text-[10px] text-slate-400">
                      Wird als Zugangsschlüssel an Mitarbeiter mitgeteilt.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 block">
                      Vollständiger Abteilungsname
                    </label>
                    <input
                      type="text"
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      placeholder="Z.B. Lackiererei & Oberflächentechnik Halle 4"
                      className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm"
                    />
                    <p className="text-[10px] text-slate-400">
                      Erscheint auf DIN-A4-Druckvorlagen & im Schichtplaner.
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Startvorlage:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-2.5 ${
                        newDeptTemplate === 'seed'
                          ? 'bg-blue-950/50 border-blue-500 text-white'
                          : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="template"
                        checked={newDeptTemplate === 'seed'}
                        onChange={() => setNewDeptTemplate('seed')}
                        className="mt-0.5 text-blue-500"
                      />
                      <div>
                        <div className="font-semibold text-slate-200">Mit Standard-Mustereinteilung</div>
                        <div className="text-[11px] text-slate-400">
                          Enthält typische Maschinen, 3-Schicht-System & Muster-Mitarbeiter zum direkten Testen.
                        </div>
                      </div>
                    </label>

                    <label
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-2.5 ${
                        newDeptTemplate === 'empty'
                          ? 'bg-blue-950/50 border-blue-500 text-white'
                          : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="template"
                        checked={newDeptTemplate === 'empty'}
                        onChange={() => setNewDeptTemplate('empty')}
                        className="mt-0.5 text-blue-500"
                      />
                      <div>
                        <div className="font-semibold text-slate-200">Leere Abteilung</div>
                        <div className="text-[11px] text-slate-400">
                          Komplett leer. Sie legen Ihre eigenen Maschinen und Mitarbeiter manuell oder via JSON an.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {creationError && (
                  <div className="p-3 bg-red-950/60 border border-red-500/40 text-red-300 rounded-lg text-xs">
                    {creationError}
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-md transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Abteilung anlegen & Kürzel generieren</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Section 2: List of Existing Departments & Codes */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  Bestehende Abteilungen & Zugangs-Kürzel ({departments.length})
                </label>
                <span className="text-[11px] text-slate-400">
                  Klicken Sie auf „Kopieren“, um das Kürzel an Mitarbeiter zu senden
                </span>
              </div>

              <div className="space-y-2">
                {departments.map((dept) => (
                  <div
                    key={dept.code}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/80 hover:border-slate-600 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2.5 py-0.5 rounded">
                          {dept.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(dept.code)}
                          title="Kürzel kopieren"
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                        >
                          {copiedCode === dept.code ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-300 font-medium">Kopiert</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-400" />
                              <span>Kürzel teilen</span>
                            </>
                          )}
                        </button>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Stand: {new Date(dept.lastModified).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                      <h4 className="text-sm font-medium text-slate-200">{dept.name}</h4>
                    </div>

                    <div className="flex items-center gap-2 sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentDepartmentCode(dept.code);
                          onLogin(dept.code);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600 border border-blue-500/50 hover:border-blue-500 text-blue-200 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <span>Öffnen</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteDepartment(dept.code)}
                        title="Abteilung löschen"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Back to normal entrance */}
            <div className="pt-3 border-t border-slate-700 flex justify-between items-center text-xs">
              <span className="text-slate-400">
                Mitarbeiter betreten die Abteilung über die normale Kürzel-Eingabemaske.
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsAdminAuthenticated(false);
                  setViewMode('enter');
                }}
                className="text-blue-400 hover:text-blue-300 font-medium cursor-pointer underline"
              >
                Zurück zur Mitarbeiter-Eingabemaske
              </button>
            </div>
          </div>
        )}

        {/* Feature Highlights Footer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400 pt-2">
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-start gap-2.5">
            <span className="text-blue-400 mt-0.5">●</span>
            <div>
              <span className="text-slate-200 font-medium block">Kürzel-Zugang</span>
              Jede Abteilung ist geschützt und nur mit passendem Kürzel betretbar.
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-start gap-2.5">
            <span className="text-amber-400 mt-0.5">●</span>
            <div>
              <span className="text-slate-200 font-medium block">Admin-Geschützt</span>
              Nur autorisierte Planer mit Passwort können neue Abteilungen anlegen.
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-start gap-2.5">
            <span className="text-blue-400 mt-0.5">●</span>
            <div>
              <span className="text-slate-200 font-medium block">4 Wochen Vorgabe</span>
              Schichtplan-Vorausplanung manuell anpassbar (1 bis 52 Wochen).
            </div>
          </div>
        </div>

        {/* ArcanePixels Footer & Link */}
        <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>SchichtPlan Pro</span>
            <span>•</span>
            <span>Mandantensichere Schichtplanung</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Entwickelt von</span>
            <ArcanePixelsBrand
              theme="dark"
              size="sm"
              variant="badge"
            />
          </div>
        </div>

      </div>
    </div>
  );
};
