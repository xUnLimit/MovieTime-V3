'use client';

import { useState } from 'react';
import { Activity, Plus } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { FilterMenu, TableSearch, TableToolbar } from '@/components/shared/TableToolbar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { LabRow, LabSection } from './LabSection';

const ESTADOS = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'vencidas', label: 'Vencidas' },
  { value: 'proximas', label: 'Próximas a vencer' },
];

export function NavigationSection() {
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('todos');

  return (
    <LabSection id="navegacion" title="Encabezado, tabs y toolbar" description="Estructura estándar de cada módulo: encabezado, acciones, filtros y contenido.">
      <div className="space-y-6 rounded-xl border bg-card p-5">
        <PageHeader
          title="Ventas"
          description="Gestiona suscripciones, pagos y renovaciones."
          breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Ventas' }]}
          actions={
            <Button>
              <Plus /> Nueva venta
            </Button>
          }
        />

        <TableToolbar>
          <TableSearch value={search} onChange={setSearch} placeholder="Buscar cliente o servicio" />
          <FilterMenu icon={Activity} ariaLabel="Estado" value={estado} options={ESTADOS} onChange={setEstado} />
        </TableToolbar>

        <LabRow label="Tabs · underline (default)">
          <Tabs defaultValue="todas" className="w-full">
            <div className="tabs-scroll-shell">
              <TabsList className="tabs-scroll-list">
                <TabsTrigger value="todas">Todas</TabsTrigger>
                <TabsTrigger value="activas">Activas</TabsTrigger>
                <TabsTrigger value="vencidas">Vencidas</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="todas" className="pt-3 text-sm text-muted-foreground">
              Contenido de la pestaña.
            </TabsContent>
          </Tabs>
        </LabRow>
        <LabRow label="Tabs · pills (vistas dentro de una tarjeta)">
          <Tabs defaultValue="mes">
            <TabsList variant="pills">
              <TabsTrigger value="mes">Mes</TabsTrigger>
              <TabsTrigger value="trimestre">Trimestre</TabsTrigger>
              <TabsTrigger value="anio">Año</TabsTrigger>
            </TabsList>
          </Tabs>
        </LabRow>
      </div>
    </LabSection>
  );
}
