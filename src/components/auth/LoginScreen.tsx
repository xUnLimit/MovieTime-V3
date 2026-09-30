'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Check, CircleAlert, Eye, EyeOff, Loader2, TriangleAlert } from 'lucide-react';

import { AUTH_REMEMBER_KEY } from '@/application/use-cases/auth-use-cases';
import { AuthRecoveryState } from '@/components/auth/AuthRecoveryState';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { useAuthStore } from '@/store/authStore';

/** Duracion de la salida al entrar; debe coincidir con las transiciones `login-*` de globals.css. */
export const LOGIN_ENTER_MS = 480;

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function shake(element: HTMLElement | null) {
  if (!element || typeof element.animate !== 'function' || prefersReducedMotion()) return;
  element.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-6px)' },
      { transform: 'translateX(5px)' },
      { transform: 'translateX(-3px)' },
      { transform: 'translateX(0)' },
    ],
    { duration: 320, easing: 'ease-out' },
  );
}

export function LoginScreen() {
  const router = useRouter();
  const { authRecoveryError, isAuthenticated, isHydrated, isLoading, login, logout, retryAuth } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(AUTH_REMEMBER_KEY) === 'true',
  );
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  // El store marca la sesion como autenticada antes de que termine la animacion de entrada;
  // mientras se envia el formulario la redireccion la hace este componente, no el efecto.
  const submitting = useRef(false);

  useEffect(() => {
    if (isHydrated && isAuthenticated && !submitting.current) router.push('/dashboard');
  }, [isAuthenticated, isHydrated, router]);

  const fail = (message: string, field: HTMLInputElement | null) => {
    setError(message);
    shake(cardRef.current);
    field?.focus();
    field?.select();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting.current || entering) return;

    if (!email.trim() || !password) {
      fail('Ingresa tu correo y tu contraseña para continuar.', email.trim() ? passwordRef.current : emailRef.current);
      return;
    }

    setError(null);
    submitting.current = true;
    try {
      await login(email, password, rememberMe);
    } catch (loginError) {
      submitting.current = false;
      fail(getPublicErrorMessage(loginError, 'Verifica tus credenciales e inténtalo de nuevo.'), passwordRef.current);
      return;
    }

    setEntering(true);
    if (!prefersReducedMotion()) await new Promise((resolve) => setTimeout(resolve, LOGIN_ENTER_MS));
    router.push('/dashboard');
  };

  const handlePasswordKey = (event: KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState('CapsLock'));
  };

  if (authRecoveryError) {
    return <AuthRecoveryState message={authRecoveryError} onRetry={retryAuth} onLogout={logout} />;
  }

  const busy = isLoading || entering;

  return (
    <main className="login-shell flex min-h-dvh flex-col items-center justify-center bg-background p-4" data-phase={entering ? 'entering' : 'idle'}>
      <div className="w-full max-w-sm">
        <div className="login-rise mb-6 flex flex-col items-center gap-4 text-center" data-step="0">
          <div className="login-tile flex size-12 items-center justify-center rounded-xl border bg-card text-foreground" aria-hidden>
            <Logo className="size-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Bienvenido</h1>
            <p className="text-sm text-muted-foreground">Inicia sesión para administrar MovieTime PTY</p>
          </div>
        </div>

        <div className="login-rise" data-step="1">
          <div ref={cardRef} className="login-card rounded-xl border bg-card p-5">
            <form onSubmit={handleSubmit} className="space-y-4" aria-busy={busy} noValidate>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-normal">Correo electrónico</Label>
                <Input
                  ref={emailRef}
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                  autoComplete="email"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'login-error' : undefined}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-normal">Contraseña</Label>
                <div className="relative">
                  <Input
                    ref={passwordRef}
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handlePasswordKey}
                    onKeyUp={handlePasswordKey}
                    onBlur={() => setCapsLock(false)}
                    disabled={busy}
                    autoComplete="current-password"
                    className="pr-10"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? 'login-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-10"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                  </button>
                </div>
                {capsLock ? (
                  <p className="flex items-center gap-1.5 text-xs text-warning">
                    <TriangleAlert className="size-3.5" aria-hidden /> Bloq Mayús está activado
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox id="remember" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(checked === true)} disabled={busy} />
                <label htmlFor="remember" className="cursor-pointer select-none text-sm">Recordarme</label>
              </div>

              {error ? (
                <p id="login-error" role="alert" className="flex items-start gap-2 rounded-md border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {entering ? (
                  <><Check className="login-check size-4" aria-hidden /> Bienvenido</>
                ) : isLoading ? (
                  <><Loader2 className="size-4 animate-spin" aria-hidden /> Iniciando sesión...</>
                ) : (
                  'Iniciar sesión'
                )}
              </Button>
            </form>
          </div>
        </div>

        <p className="login-rise login-meta mt-6 text-center text-xs text-muted-foreground" data-step="2">© MovieTime PTY</p>
      </div>
    </main>
  );
}
