'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { AuthRecoveryState } from '@/components/auth/AuthRecoveryState';
import { shouldRedirectToLogin } from '@/components/auth/auth-routing';

export default function Home() {
  const router = useRouter();
  const { authRecoveryError, isAuthenticated, isHydrated, retryAuth } = useAuthStore();
  const redirectToLogin = shouldRedirectToLogin({
    isHydrated,
    isAuthenticated,
    authRecoveryError,
  });

  useEffect(() => {
    if (!isHydrated || authRecoveryError) return;

    // Redirigir según estado de autenticación
    if (isAuthenticated) {
      router.push('/dashboard');
    } else if (redirectToLogin) {
      router.push('/login');
    }
  }, [authRecoveryError, isAuthenticated, isHydrated, redirectToLogin, router]);


  if (authRecoveryError) {
    return (
      <AuthRecoveryState message={authRecoveryError} onRetry={retryAuth} />
    );
  }
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto" />
        <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando...</p>
      </div>
    </div>
  );
}
