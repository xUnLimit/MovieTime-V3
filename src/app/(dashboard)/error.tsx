'use client';

import { useEffect } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const details = error.message || 'Un error inesperado ocurrió.';

  useEffect(() => {
    console.error('Dashboard error boundary caught:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-4 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-xl font-semibold">Algo salió mal</h1>
        <p className="text-sm text-muted-foreground">{details}</p>
        {error.digest && (
          <p className="text-xs text-muted-foreground">Código: {error.digest}</p>
        )}
        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={() => window.location.href = '/'}>
            <Home className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <Button onClick={reset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
        </div>
      </div>
    </div>
  );
}
