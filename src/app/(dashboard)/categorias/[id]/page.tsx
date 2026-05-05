'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, DollarSign, Edit, Tag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getCategoriaUseCase } from '@/lib/use-cases/categorias-use-cases';
import { formatearFechaHora } from '@/lib/utils/calculations';
import { useCategoriasStore } from '@/store/categoriasStore';
import { Categoria, Plan } from '@/types';

function VerCategoriaPageContent() {
  const params = useParams();
  const router = useRouter();
  const { deleteCategoria } = useCategoriasStore();
  const [categoria, setCategoria] = useState<Categoria | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  useEffect(() => {
    const loadCategoria = async () => {
      const id = Array.isArray(params.id) ? params.id[0] : params.id;
      if (!id) return;
      setIsLoading(true);
      try {
        const data = await getCategoriaUseCase<Categoria>(id);
        setCategoria(data);
      } catch (error) {
        console.error('Error cargando categoría:', error);
        setCategoria(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadCategoria();
  }, [params.id]);

  const handleDelete = async () => {
    if (categoria) {
      try {
        await deleteCategoria(categoria.id);
        toast.success('Categoría eliminada', { description: 'La categoría ha sido eliminada correctamente.' });
        router.push('/categorias');
      } catch (error) {
        toast.error('Error al eliminar categoría', { description: error instanceof Error ? error.message : undefined });
      }
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'cliente': return 'Cliente';
      case 'revendedor': return 'Revendedor';
      case 'ambos': return 'Cliente y Revendedor';
      default: return tipo;
    }
  };

  const getTipoCategoriaLabel = (tipo: string) => {
    switch (tipo) {
      case 'plataforma_streaming': return 'Plataforma De Streaming';
      case 'otros': return 'Otros';
      default: return tipo;
    }
  };

  const getCicloPagoLabel = (ciclo: string) => {
    switch (ciclo) {
      case 'mensual': return { label: 'Mensual', short: 'mes' };
      case 'trimestral': return { label: 'Trimestral', short: 'trimestre' };
      case 'semestral': return { label: 'Semestral', short: 'semestre' };
      case 'anual': return { label: 'Anual', short: 'año' };
      default: return { label: ciclo, short: ciclo };
    }
  };



  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/categorias">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cargando categoría...</h1>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-muted-foreground">Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (!categoria) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/categorias">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Categoría no encontrada</h1>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-muted-foreground">La categoría que buscas no existe.</p>
        </div>
      </div>
    );
  }

  const tiposPlanes = categoria.tiposPlanes || [];
  const planes = categoria.planes || [];

  const getPlanesPorTipo = (tipoPlanId: string): Plan[] =>
    planes.filter(p => p.tipoPlan === tipoPlanId);

  const gruposPlanes = tiposPlanes.filter(t => getPlanesPorTipo(t.id).length > 0);

  const PlanCard = ({ plan, tipoPlanNombre, accentColor }: { plan: Plan; tipoPlanNombre: string; accentColor: string }) => {
    const isOpen = expandedPlan === plan.id;
    return (
      <div
        className={`rounded-lg border overflow-hidden cursor-pointer ${accentColor}`}
        onClick={() => setExpandedPlan(isOpen ? null : plan.id)}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <DollarSign className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{plan.nombre || 'Plan sin nombre'}</p>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
        </div>

        {isOpen && (
          <div className="px-4 pb-3 pt-0 border-t mt-0">
            <div className="pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Tipo de plan</span>
                <span className="text-xs font-medium text-primary">{tipoPlanNombre}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Ciclo de pago</span>
                <span className="text-xs font-medium">{getCicloPagoLabel(plan.cicloPago).label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Precio</span>
                <span className="text-xs font-bold">
                  ${plan.precio.toFixed(2)}
                  <span className="font-normal text-muted-foreground">/{getCicloPagoLabel(plan.cicloPago).short}</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/categorias">
            <Button variant="outline" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{categoria.nombre}</h1>
            <p className="text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
              {' / '}
              <Link href="/categorias" className="hover:text-foreground transition-colors">Categorías</Link>
              {' / '}
              <span className="text-foreground">{categoria.nombre}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/categorias/${categoria.id}/editar?from=/categorias/${categoria.id}`}>
              <Edit className="h-3.5 w-3.5 mr-1.5" />
              Editar
            </Link>
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Eliminar
          </Button>
        </div>
      </div>

      {/* Info + Notas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-lg border bg-card p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Información de la Categoría</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Datos básicos de la categoría</p>
          </div>
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Nombre:</span>
              <span className="text-sm font-medium">{categoria.nombre}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Asociado a:</span>
              <span className="text-sm font-medium">{getTipoLabel(categoria.tipo)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tipo de Categoría:</span>
              <Badge variant="outline" className="text-xs">{getTipoCategoriaLabel(categoria.tipoCategoria || '')}</Badge>
            </div>
            {tiposPlanes.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tipos de Plan:</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {tiposPlanes.map(t => (
                    <Badge key={t.id} variant="secondary" className="text-xs gap-1">
                      <Tag className="h-3 w-3" />
                      {t.nombre}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Fecha de creación:</span>
              <span className="text-sm font-medium">{formatearFechaHora(new Date(categoria.createdAt))}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Última actualización:</span>
              <span className="text-sm font-medium">{formatearFechaHora(new Date(categoria.updatedAt))}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 flex flex-col">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Notas</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Información adicional</p>
          </div>
          <div className="flex-1 flex items-start">
            {categoria.notas ? (
              <p className="text-sm text-muted-foreground leading-relaxed">{categoria.notas}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No hay notas para esta categoría.</p>
            )}
          </div>
        </div>
      </div>

      {/* Planes agrupados por tipos configurados */}
      {gruposPlanes.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Planes</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Grupos por tipo de plan */}
            {gruposPlanes.map((tipo) => {
              const planesDelTipo = getPlanesPorTipo(tipo.id);
              return (
                <div key={tipo.id} className="rounded-lg border bg-card overflow-hidden">
                  <div className="px-5 py-4 flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <h3 className="text-sm font-semibold">{tipo.nombre}</h3>
                      <p className="text-xs text-muted-foreground">
                        {planesDelTipo.length} plan{planesDelTipo.length !== 1 ? 'es' : ''} registrado{planesDelTipo.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="px-4 pb-4 space-y-2">
                    {planesDelTipo.map(plan => (
                      <PlanCard key={plan.id} plan={plan} tipoPlanNombre={tipo.nombre} accentColor="border-border" />
                    ))}
                  </div>
                </div>
              );
            })}

          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Eliminar Categoría"
        description={`¿Estás seguro de que quieres eliminar la categoría "${categoria.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
      />
    </div>
  );
}

export default function VerCategoriaPage() {
  return (
    <ModuleErrorBoundary moduleName="Ver Categoría">
      <VerCategoriaPageContent />
    </ModuleErrorBoundary>
  );
}
