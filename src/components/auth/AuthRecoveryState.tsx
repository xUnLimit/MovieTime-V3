'use client';

import { LogOut, RefreshCw, WifiOff } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface AuthRecoveryStateProps {
  message: string;
  onRetry: () => void;
  onLogout: () => void | Promise<void>;
}

export function AuthRecoveryState({ message, onRetry, onLogout }: AuthRecoveryStateProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning-subtle">
          <WifiOff className="h-8 w-8 text-warning" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">No pudimos validar la sesión</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
          <p className="text-sm text-muted-foreground">
            Tu sesión guardada sigue intacta; no necesitas ingresar nuevamente tus credenciales.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar
          </Button>
          <Button type="button" variant="outline" onClick={() => void onLogout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesi&oacute;n
          </Button>
        </div>
      </div>
    </div>
  );
}
