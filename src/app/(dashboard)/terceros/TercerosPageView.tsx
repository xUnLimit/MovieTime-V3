import type { ReactNode } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClientesTable } from '@/components/terceros/ClientesTable';
import { RevendedoresTable } from '@/components/terceros/RevendedoresTable';
import { TercerosMetrics } from '@/components/terceros/TercerosMetrics';
import { TodosTercerosTable } from '@/components/terceros/TodosTercerosTable';
import type { TercerosPageController } from './useTercerosPageController';

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
        <TabsList className="inline-flex h-auto rounded-none border-b border-border bg-transparent p-0">
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
  return (
    <div className="dashboard-page-heading">
      <div className="dashboard-page-heading-row">
        <div className="dashboard-page-heading-copy space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Terceros</h1>
          <p className="text-sm text-muted-foreground">
            <Link prefetch={false} href="/" className="transition-colors hover:text-foreground">
              Dashboard
            </Link>{' '}
            / <span className="text-foreground">Terceros</span>
          </p>
        </div>
        <Link prefetch={false} href="/terceros/crear" className="shrink-0">
          <Button className="whitespace-nowrap">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Tercero
          </Button>
        </Link>
      </div>
    </div>
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
      className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent"
    >
      {children}
    </TabsTrigger>
  );
}
