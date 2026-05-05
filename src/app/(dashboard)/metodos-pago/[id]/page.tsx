'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Copy, Edit, Eye, EyeOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ModuleErrorBoundary } from '@/components/shared/ModuleErrorBoundary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getMetodoPagoById } from '@/lib/supabase/catalogos-repository';
import { formatearFechaHora } from '@/lib/utils/calculations';
import { useMetodosPagoStore } from '@/store/metodosPagoStore';
import { MetodoPago } from '@/types';

function VerMetodoPagoPageContent() {
  const params = useParams();
  const router = useRouter();
  const { deleteMetodoPago } = useMetodosPagoStore();
  const [metodo, setMetodo] = useState<MetodoPago | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCardNumber, setShowCardNumber] = useState(false);

  useEffect(() => {
    const loadMetodoPago = async () => {
      const id = Array.isArray(params.id) ? params.id[0] : params.id;
      if (!id) return;

      setIsLoading(true);
      try {
        const data = await getMetodoPagoById<MetodoPago>(id);
        setMetodo(data);
      } catch (error) {
        console.error('Error cargando método de pago:', error);
        setMetodo(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadMetodoPago();
  }, [params.id]);

  const handleDelete = async () => {
    if (metodo) {
      try {
        await deleteMetodoPago(metodo.id);
        toast.success('Método de pago eliminado', { description: 'El método de pago ha sido eliminado correctamente.' });
        router.push('/metodos-pago');
      } catch (error) {
        toast.error('Error al eliminar método de pago', { description: error instanceof Error ? error.message : undefined });
      }
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`, { description: `${label} copiado al portapapeles exitosamente.` });
  };

  const tipoCuentaLabels: Record<string, string> = {
    ahorro: 'Ahorro',
    corriente: 'Corriente',
    wallet: 'Wallet',
    telefono: 'Teléfono',
    email: 'Email',
  };

  const tipoMetodoPagoLabels: Record<string, string> = {
    banco: 'Banco',
    yappy: 'Yappy',
    paypal: 'PayPal',
    binance: 'Binance',
    efectivo: 'Efectivo',
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/metodos-pago">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cargando método de pago...</h1>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-muted-foreground">Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (!metodo) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/metodos-pago">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Método de pago no encontrado</h1>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-muted-foreground">El método de pago que buscas no existe.</p>
        </div>
      </div>
    );
  }

  const isUsuario = metodo.asociadoA === 'usuario' || !!metodo.tipoCuenta;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/metodos-pago">
            <Button variant="outline" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{metodo.nombre}</h1>
              <Badge variant="outline" className={metodo.activo ? 'border-green-500/50 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' : 'border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'}>
                {metodo.activo ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
              {' / '}
              <Link href="/metodos-pago" className="hover:text-foreground transition-colors">Métodos de Pago</Link>
              {' / '}
              <span className="text-foreground">{metodo.nombre}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/metodos-pago/${metodo.id}/editar?from=/metodos-pago/${metodo.id}`}>
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

      {/* Dos columnas: Información Básica e Información Adicional */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Información Básica */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-6">Información Básica</h2>

          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span>Alias</span>
              </div>
              <p className="text-sm font-medium">{metodo.alias || 'N/A'}</p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span>Asociado a</span>
              </div>
              <p className="text-sm font-medium">{isUsuario ? 'Usuario' : 'Servicio'}</p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span>País</span>
              </div>
              <p className="text-sm font-medium">{metodo.pais}</p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span>Moneda</span>
              </div>
              <p className="text-sm font-medium">{metodo.moneda || 'USD'}</p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span>Creado</span>
              </div>
              <p className="text-sm font-medium">
                {formatearFechaHora(new Date(metodo.createdAt))}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span>Última Actualización</span>
              </div>
              <p className="text-sm font-medium">
                {formatearFechaHora(new Date(metodo.updatedAt))}
              </p>
            </div>
          </div>
        </div>

        {/* Información Adicional / Datos de la Cuenta / Datos del Servicio */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-6">
            {isUsuario ? 'Datos de la Cuenta' : 'Información Adicional'}
          </h2>

          <div className="space-y-5">
            {isUsuario ? (
              <>
                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span>Nombre del Titular</span>
                  </div>
                  <p className="text-sm font-medium">{metodo.titular}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span>{metodo.banco ? 'Nombre del Banco' : 'Método'}</span>
                  </div>
                  <p className="text-sm font-medium">{metodo.banco || tipoMetodoPagoLabels[metodo.tipo]}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span>Identificador de cuenta</span>
                  </div>
                  <p className="text-sm font-medium">{metodo.identificador}</p>
                </div>

                {metodo.tipoCuenta && (
                  <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span>Tipo de Cuenta</span>
                    </div>
                    <p className="text-sm font-medium">{tipoCuentaLabels[metodo.tipoCuenta]}</p>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span>Notas</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{metodo.notas || 'No hay notas.'}</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span>Nombre del Titular</span>
                  </div>
                  <p className="text-sm font-medium">{metodo.titular}</p>
                </div>

                {metodo.email && (
                  <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span>Email</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{metodo.email}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 flex-shrink-0"
                        onClick={() => copyToClipboard(metodo.email!, 'Email')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {metodo.contrasena && (
                  <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span>Contraseña</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {showPassword ? metodo.contrasena : '••••••••'}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 flex-shrink-0"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 flex-shrink-0"
                        onClick={() => copyToClipboard(metodo.contrasena!, 'Contraseña')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {metodo.numeroTarjeta && (
                  <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span>Número de Tarjeta</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {showCardNumber
                          ? metodo.numeroTarjeta
                          : `•••• •••• •••• ${metodo.numeroTarjeta.replace(/\D/g, '').slice(-4)}`
                        }
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 flex-shrink-0"
                        onClick={() => setShowCardNumber(!showCardNumber)}
                      >
                        {showCardNumber ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 flex-shrink-0"
                        onClick={() => copyToClipboard(metodo.numeroTarjeta!, 'Número de tarjeta')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {metodo.fechaExpiracion && (
                  <div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span>Fecha Expiración</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{metodo.fechaExpiracion}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 flex-shrink-0"
                        onClick={() => copyToClipboard(metodo.fechaExpiracion!, 'Fecha de expiración')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span>Notas</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{metodo.notas || 'No hay notas.'}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Eliminar Método de Pago"
        description={`¿Estás seguro de que quieres eliminar el método "${metodo.nombre}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
      />
    </div>
  );
}

export default function VerMetodoPagoPage() {
  return (
    <ModuleErrorBoundary moduleName="Ver Método de Pago">
      <VerMetodoPagoPageContent />
    </ModuleErrorBoundary>
  );
}
