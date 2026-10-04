import type { ReactNode } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClientesTable } from '@/components/terceros/ClientesTable';
import { RevendedoresTable } from '@/components/terceros/RevendedoresTable';
import { TercerosMetrics } from '@/components/terceros/TercerosMetrics';
import { TodosTercerosTable } from '@/components/terceros/TodosTercerosTable';
import type { TercerosPageController } from './useTercerosPageController';
import { useAuthStore } from '@/store/authStore';

type TercerosPageViewProps = TercerosPageController;

export function TercerosPageView({
  activeTab,
  displayData,
  handleEdit,
  handleMetodoPagoFilterChange,
  handleRefresh,
  handleSearchChange,
  handleTabChange,
  handleView,
  isLoading,
  metodoPagoOptions,
  paginationProps,
  searchQuery,
  selectedMetodoPagoFilter,
}: TercerosPageViewProps) {
  return (
    <div className="space-y-4">
      <TercerosPageHeading />
      <TercerosMetrics />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TercerosTabTrigger value="todos">Todos</TercerosTabTrigger>
          <TercerosTabTrigger value="clientes">Clientes</TercerosTabTrigger>
          <TercerosTabTrigger value="revendedores">Revendedores</TercerosTabTrigger>
        </TabsList>

        <TabsContent value="todos" className="space-y-4">
          <TodosTercerosTable
            terceros={displayData}
            onEdit={handleEdit}
            onView={handleView}
            title="Todos los terceros"
            isLoading={isLoading}
            pagination={paginationProps}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onRefresh={handleRefresh}
            metodoPagoFilter={selectedMetodoPagoFilter}
            onMetodoPagoFilterChange={handleMetodoPagoFilterChange}
            metodoPagoOptions={metodoPagoOptions}
          />
        </TabsContent>

        <TabsContent value="clientes" className="space-y-4">
          <ClientesTable
            clientes={displayData}
            onEdit={handleEdit}
            onView={handleView}
            title="Clientes"
            isLoading={isLoading}
            pagination={paginationProps}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onRefresh={handleRefresh}
            metodoPagoFilter={selectedMetodoPagoFilter}
            onMetodoPagoFilterChange={handleMetodoPagoFilterChange}
            metodoPagoOptions={metodoPagoOptions}
          />
        </TabsContent>

        <TabsContent value="revendedores" className="space-y-4">
          <RevendedoresTable
            revendedores={displayData}
            onEdit={handleEdit}
            onView={handleView}
            isLoading={isLoading}
            pagination={paginationProps}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            onRefresh={handleRefresh}
            metodoPagoFilter={selectedMetodoPagoFilter}
            onMetodoPagoFilterChange={handleMetodoPagoFilterChange}
            metodoPagoOptions={metodoPagoOptions}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TercerosPageHeading() {
  const admin = useAuthStore(state => state.user?.role === 'admin');
  return (
    <PageHeader
      title="Terceros"
      actions={
        <>
        {admin ? <Button variant="outline" asChild><Link href="/terceros/interesados">Interesados</Link></Button> : null}
        <Button asChild className="whitespace-nowrap">
          <Link prefetch={false} href="/terceros/crear">
            <Plus />
            Nuevo Tercero
          </Link>
        </Button>
        </>
      }
    />
  );
}

function TercerosTabTrigger({
  children,
  value,
}: {
  children: ReactNode;
  value: string;
}) {
  return (
    <TabsTrigger
      value={value}
    >
      {children}
    </TabsTrigger>
  );
}
