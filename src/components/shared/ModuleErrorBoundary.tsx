'use client';

import React from 'react';
import Link from 'next/link';
import { ErrorBoundary } from './ErrorBoundary';
import { AlertTriangle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reportError } from '@/platform/observability/logger';

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
    reportError('ModuleErrorBoundary', `Error in ${moduleName} module`, error, {
      errorInfo,
      moduleName,
    });
  };

  const fallback = (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <div className="flex justify-center">
          <div className="rounded-full bg-danger-subtle p-3">
            <AlertTriangle className="h-8 w-8 text-danger" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground dark:text-white">
            Error en {moduleName}
          </h2>
          <p className="text-muted-foreground">
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
          <Button variant="default" asChild>
            <Link href="/dashboard">
              <Home className="mr-2 h-4 w-4" />
              Ir al Dashboard
            </Link>
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
