'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface DashboardErrorFallbackProps {
  error?: Error;
  reset?: () => void;
}

export function DashboardErrorFallback({ error, reset }: DashboardErrorFallbackProps) {
  const handleReload = () => {
    if (reset) {
      reset();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <Card className="max-w-md w-full p-6 space-y-4">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="h-8 w-8" />
          <h2 className="text-2xl font-bold">Error en la aplicación</h2>
        </div>
        
        <p className="text-muted-foreground">
          Ha ocurrido un error inesperado. Por favor, intenta recargar la página.
        </p>

        {error && (
          <details className="text-sm">
            <summary className="cursor-pointer font-medium mb-2">Detalles del error</summary>
            <pre className="bg-muted p-3 rounded-md overflow-auto text-xs">
              {error.message}
            </pre>
          </details>
        )}

        <Button onClick={handleReload} className="w-full">
          <RefreshCw className="mr-2 h-4 w-4" />
          Recargar página
        </Button>
      </Card>
    </div>
  );
}
