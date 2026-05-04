'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UsuarioForm } from '@/components/usuarios/UsuarioForm';
import { useMetodosPagoStore } from '@/store/metodosPagoStore';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MetodoPago } from '@/types';

function CrearUsuarioPageContent() {
  const router = useRouter();
  const { fetchMetodosPagoUsuarios } = useMetodosPagoStore();
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMetodos = async () => {
      setLoading(true);
      const metodos = await fetchMetodosPagoUsuarios();
      setMetodosPago(metodos);
      setLoading(false);
    };
    loadMetodos();
  }, [fetchMetodosPagoUsuarios]);

  const handleSuccess = () => {
    router.push('/usuarios');
  };

  const handleCancel = () => {
    router.push('/usuarios');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/usuarios">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Nuevo Usuario</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10 sm:ml-10">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link> / <Link href="/usuarios" className="hover:text-foreground transition-colors">Clientes</Link> / <span className="text-foreground">Crear</span>
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Cargando...</div>
          </div>
        ) : (
          <UsuarioForm
            tipoInicial="cliente"
            metodosPago={metodosPago}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
            isPage={true}
          />
        )}
      </div>
    </div>
  );
}

export default function CrearUsuarioPage() {
  return (
    <ModuleErrorBoundary moduleName="Crear Usuario">
      <CrearUsuarioPageContent />
    </ModuleErrorBoundary>
  );
}
