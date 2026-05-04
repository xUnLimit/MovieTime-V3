'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('Global error boundary caught:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 bg-background text-foreground">
          <div className="flex flex-col items-center gap-4 max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-xl font-semibold">Error crítico</h1>
            <p className="text-sm text-gray-500">
              {error.message || 'Un error inesperado ocurrió al cargar la aplicación.'}
            </p>
            {error.digest && (
              <p className="text-xs text-gray-400">Código: {error.digest}</p>
            )}
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
