import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Hot Module Reload laesst sich ueber die Umgebungsvariable DISABLE_HMR
      // deaktivieren (z.B. waehrend automatisierter Bearbeitungen, um Flackern zu vermeiden).
      hmr: process.env.DISABLE_HMR !== 'true',
      // Dateibeobachtung ebenfalls deaktivieren, wenn DISABLE_HMR gesetzt ist.
      // Ignore data/ (die serverseitige JSON-Datenbank, die der Server bei jedem
      // Speichern schreibt): ohne das wuerde Vite jede gestempelte Abwesenheit als
      // Quellcode-Aenderung werten und die Seite neu laden, wodurch der aktuelle
      // Tab-/Scroll-Zustand verloren ginge.
      watch: process.env.DISABLE_HMR === 'true' ? null : { ignored: ['**/data/**'] },
    },
  };
});
