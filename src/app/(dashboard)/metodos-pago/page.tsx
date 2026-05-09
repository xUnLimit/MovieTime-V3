'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { UsuariosMetodosPagoTable } from '@/components/metodos-pago/UsuariosMetodosPagoTable';
import { ServiciosMetodosPagoTable } from '@/components/metodos-pago/ServiciosMetodosPagoTable';
import { MetodosPagoMetrics } from '@/components/metodos-pago/MetodosPagoMetrics';
import { useMetodosPagoStore } from '@/store/metodosPagoStore';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';

function MetodosPagoPageContent() {
  const { metodosPago, fetchMetodosPago } = useMetodosPagoStore();
  const [activeTab, setActiveTab] = useState('usuarios');

  useEffect(() => {
    fetchMetodosPago();
  }, [fetchMetodosPago]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Métodos de Pago</h1>
          <p className="text-sm text-muted-foreground">
            <Link prefetch={false} href="/" className="hover:text-foreground transition-colors">Dashboard</Link> / <span className="text-foreground">Métodos de Pago</span>
          </p>
        </div>
        <Link prefetch={false} href="/metodos-pago/crear" className="shrink-0">
          <Button className="whitespace-nowrap">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Método
          </Button>
        </Link>
      </div>

      <MetodosPagoMetrics />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-transparent rounded-none p-0 h-auto inline-flex border-b border-border">
          <TabsTrigger
            value="usuarios"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm"
          >
            Usuarios
          </TabsTrigger>
          <TabsTrigger
            value="servicios"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2 text-sm"
          >
            Servicios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="space-y-4">
          <UsuariosMetodosPagoTable
            metodosPago={metodosPago}
            title="Métodos de pago de Usuarios"
          />
        </TabsContent>

        <TabsContent value="servicios" className="space-y-4">
          <ServiciosMetodosPagoTable
            metodosPago={metodosPago}
            title="Métodos de pago de Servicios"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function MetodosPagoPage() {
  return (
    <ModuleErrorBoundary moduleName="Métodos de Pago">
      <MetodosPagoPageContent />
    </ModuleErrorBoundary>
  );
}
