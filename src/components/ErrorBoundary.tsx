import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryState {
  error: Error | null;
}

// Fängt Rendering-Fehler ab (z.B. eine Abteilung mit unerwartet fehlenden
// Feldern) und zeigt eine verständliche Meldung statt einer leeren weißen
// Seite ohne jeden Hinweis, was passiert ist.
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Unerwarteter Fehler:', error, info.componentStack);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('schichtplan_current_dept');
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-red-200 rounded-2xl shadow-lg p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-700">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-bold">Unerwarteter Fehler</h1>
            </div>
            <p className="text-sm text-slate-600">
              Die Seite konnte nicht korrekt geladen werden — möglicherweise sind die Daten dieser Abteilung
              unvollständig. Ihre Eingaben sind davon nicht betroffen, es liegt an der Anzeige.
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl cursor-pointer transition-colors"
            >
              Zurück zur Abteilungsauswahl
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
