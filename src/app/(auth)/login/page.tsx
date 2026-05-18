'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Eye, EyeOff, WifiOff } from 'lucide-react';
import { hasOfflineAuthUser } from '@/lib/pwa/offline-auth';

export default function LoginPage() {
  const router = useRouter();
  const { login, restoreOfflineSession, isAuthenticated, isLoading, isHydrated } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const offlineRestoreAttemptedRef = useRef(false);
  const [isOnline, setIsOnline] = useState(true);
  const [canUseOfflineAccess, setCanUseOfflineAccess] = useState(false);

  useEffect(() => {
    // Si ya está autenticado, redirigir al dashboard
    if (isHydrated && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isHydrated, router]);

  useEffect(() => {
    const updateOfflineState = () => {
      setRememberMe(localStorage.getItem('auth-remember') === 'true');
      setIsOnline(navigator.onLine);
      setCanUseOfflineAccess(hasOfflineAuthUser());
    };

    updateOfflineState();
    window.addEventListener('online', updateOfflineState);
    window.addEventListener('offline', updateOfflineState);

    return () => {
      window.removeEventListener('online', updateOfflineState);
      window.removeEventListener('offline', updateOfflineState);
    };
  }, []);

  useEffect(() => {
    if (
      !isHydrated ||
      isAuthenticated ||
      isOnline ||
      !canUseOfflineAccess ||
      offlineRestoreAttemptedRef.current
    ) {
      return;
    }

    offlineRestoreAttemptedRef.current = true;
    try {
      restoreOfflineSession();
      toast.success('Modo lectura offline activo');
      router.replace('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo entrar en modo offline.');
    }
  }, [canUseOfflineAccess, isAuthenticated, isHydrated, isOnline, restoreOfflineSession, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Campos incompletos', { description: 'Por favor ingresa tu email y contraseña para continuar.' });
      return;
    }

    try {
      await login(email, password, rememberMe);
      toast.success('Inicio de sesión exitoso', { description: 'Bienvenido de vuelta al sistema.' });
      router.push('/dashboard');
    } catch (error) {
      toast.error('Credenciales inválidas', { description: error instanceof Error ? error.message : undefined });
    }
  };

  const handleOfflineAccess = () => {
    try {
      restoreOfflineSession();
      toast.success('Modo lectura offline activo');
      router.push('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo entrar en modo offline.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm shadow-sm">
        <CardHeader className="space-y-1 text-center pb-4">
          <CardTitle className="text-xl font-semibold">Bienvenido</CardTitle>
          <CardDescription className="text-sm">
            Inicia sesión con tu correo y contraseña
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {!isOnline ? (
            <div className="mb-4 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Sin conexion. El inicio con contrasena necesita internet.</span>
              </div>
            </div>
          ) : null}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-normal">
                Correo Electrónico
              </Label>
              <Input
                id="email"
                type="email"
                placeholder=""
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-normal">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder=""
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <label
                htmlFor="remember"
                className="text-sm cursor-pointer select-none"
              >
                Recordarme
              </label>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !isOnline}
            >
              {isLoading ? 'Iniciando Sesión...' : 'Iniciar Sesión'}
            </Button>
            {!isOnline && canUseOfflineAccess ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleOfflineAccess}
              >
                Entrar en modo lectura offline
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
