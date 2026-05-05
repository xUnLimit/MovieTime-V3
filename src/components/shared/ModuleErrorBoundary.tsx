'use client';

import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { AlertTriangle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ModuleErrorBoundaryProps {
  children: React.ReactNode;
  moduleName: string;
  onReset?: () => void;
}

export function ModuleErrorBoundary({
  children,
  moduleName,
  onReset,
}: ModuleErrorBoundaryProps) {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log to console in development
    console.error(`Error in ${moduleName} module:`, error, errorInfo);

    // In production, you could send to error tracking service
    // Example: Sentry.captureException(error, { contexts: { module: moduleName } });
  };

  const fallback = (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 dark:bg-red-900 p-3">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Error en {moduleName}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Ha ocurrido un error al cargar este módulo. Por favor, intenta recargar
            la página o contacta al soporte si el problema persiste.
          </p>
        </div>

        <div className="flex gap-3 justify-center">
          <Button
            onClick={() => {
              if (onReset) {
                onReset();
              }
              window.location.reload();
            }}
            variant="outline"
          >
            Recargar página
          </Button>
          <Button
            onClick={() => (window.location.href = '/dashboard')}
            variant="default"
          >
            <Home className="mr-2 h-4 w-4" />
            Ir al Dashboard
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <ErrorBoundary fallback={fallback} onError={handleError}>
      {children}
    </ErrorBoundary>
  );
}
