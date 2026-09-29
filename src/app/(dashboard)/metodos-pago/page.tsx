'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { TercerosMetodosPagoTable } from '@/components/metodos-pago/TercerosMetodosPagoTable';
import { ServiciosMetodosPagoTable } from '@/components/metodos-pago/ServiciosMetodosPagoTable';
import { MetodosPagoMetrics } from '@/components/metodos-pago/MetodosPagoMetrics';
import { useMetodosPago } from '@/hooks/use-metodos-pago';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { queryKeys } from '@/platform/query-keys';
import { useQueryClient } from '@tanstack/react-query';

function MetodosPagoPageContent() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('terceros');
  const { data: metodosPago = [], refetch: refetchMetodosPago } = useMetodosPago();

  const handleMetodoDeleted = async () => {
    await refetchMetodosPago();
    await queryClient.invalidateQueries({ queryKey: queryKeys.metodosPago.counts() });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Métodos de Pago"
        actions={
          <Button asChild className="whitespace-nowrap">
            <Link prefetch={false} href="/metodos-pago/crear">
              <Plus />
              Nuevo Método
            </Link>
          </Button>
        }
      />

      <MetodosPagoMetrics />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger
            value="terceros"
          >
            Terceros
          </TabsTrigger>
          <TabsTrigger
            value="servicios"
          >
            Servicios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="terceros" className="space-y-4">
          <TercerosMetodosPagoTable
            metodosPago={metodosPago}
            title="Métodos de pago de Terceros"
            onMetodoDeleted={handleMetodoDeleted}
          />
        </TabsContent>

        <TabsContent value="servicios" className="space-y-4">
          <ServiciosMetodosPagoTable
            metodosPago={metodosPago}
            title="Métodos de pago de Servicios"
            onMetodoDeleted={handleMetodoDeleted}
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
