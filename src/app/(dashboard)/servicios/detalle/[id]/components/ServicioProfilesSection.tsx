import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import {
  Calendar,
  ChevronDown,
  DollarSign,
  ExternalLink,
  Lock,
  MoveRight,
  RefreshCw,
  Scissors,
  Tag,
  User,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getCurrencySymbol } from '@/platform/constants';
import { calcularDiasRelativosCalendario } from '@/platform/utils/calculations';

import { ServicioProfilesFooter } from './ServicioProfilesFooter';
import type { PerfilDetalle, ServicioDetalle } from './types';

interface ServicioProfilesSectionProps {
  expandedProfileNumber: number | null;
  metodoPagoMoneda?: string;
  perfilesDisponibles: number;
  profilePage: number;
  profilePageCount: number;
  profileSearch: string;
  servicio: ServicioDetalle;
  showProfileControls: boolean;
  visiblePerfiles: PerfilDetalle[];
  getCicloPagoLabel: (ciclo: string) => string;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onCutSale: (ventaId: string) => void | Promise<void>;
  onProfileSearchChange: (value: string) => void;
  onTransferSale: (ventaId: string) => void | Promise<void>;
  onToggleProfile: (profileNumber: number) => void;
}

export function ServicioProfilesSection({
  expandedProfileNumber,
  getCicloPagoLabel,
  metodoPagoMoneda,
  onCutSale,
  onNextPage,
  onPreviousPage,
  onProfileSearchChange,
  onTransferSale,
  onToggleProfile,
  perfilesDisponibles,
  profilePage,
  profilePageCount,
  profileSearch,
  servicio,
  showProfileControls,
  visiblePerfiles,
}: ServicioProfilesSectionProps) {
  return (
    <Card className="h-full min-w-0 p-6">
      <div className="mb-2 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Perfiles</h2>
          <p className="text-sm text-muted-foreground">
            {servicio.activo ? `${perfilesDisponibles} de ${servicio.perfilesDisponibles} perfiles disponibles` : 'Servicio inactivo'}
          </p>
        </div>
        {showProfileControls && (
          <div className="w-full sm:w-64">
            <Input
              value={profileSearch}
              onChange={(event) => onProfileSearchChange(event.target.value)}
              placeholder="Buscar persona..."
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        {visiblePerfiles.map((perfil) => {
          const venta = perfil.venta;
          const ventaCurrency = getCurrencySymbol(venta?.moneda || metodoPagoMoneda);
          const diasRestantes = venta?.fechaFin
            ? calcularDiasRelativosCalendario(venta.fechaFin)
            : null;
          return (
            <div
              key={perfil.numero}
              className={`rounded-lg border px-4 py-3 ${
                perfil.estado === 'ocupado' ? 'bg-success-subtle border-success-border' :
                perfil.estado === 'inactivo' ? 'bg-muted/30 border-muted opacity-50' :
                'bg-muted/50 border-border'
              }`}
            >
              <button
                type="button"
                onClick={() => perfil.estado === 'ocupado' && onToggleProfile(perfil.numero)}
                className="flex w-full min-w-0 items-center justify-between gap-3 text-left"
                disabled={perfil.estado === 'inactivo'}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <User className={`h-5 w-5 ${
                    perfil.estado === 'ocupado' ? 'text-success' :
                    perfil.estado === 'inactivo' ? 'text-muted-foreground' :
                    'text-info'
                  } shrink-0`} />
                  <span className={`truncate font-medium ${perfil.estado === 'inactivo' ? 'text-muted-foreground' : ''}`}>
                    {perfil.estado === 'ocupado' && perfil.clienteNombre
                      ? perfil.clienteNombre
                      : perfil.nombre}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {perfil.estado === 'inactivo' ? (
                    <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-accent">
                      Inactivo
                    </Badge>
                  ) : perfil.estado === 'disponible' ? (
                    <Badge variant="secondary" className="bg-success-subtle text-success hover:bg-success/15 dark:text-white">
                      Disponible
                    </Badge>
                  ) : (
                    <ChevronDown className={`h-4 w-4 transition-transform ${expandedProfileNumber === perfil.numero ? 'rotate-180' : ''}`} />
                  )}
                </div>
              </button>

              {perfil.estado === 'ocupado' && expandedProfileNumber === perfil.numero && venta && (
                <div className="mt-4 space-y-3">
                  <div className="pt-3 border-t border-border">
                    <div className="mb-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">Detalles de la venta:</p>
                      {venta.ventaId && (
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 text-warning hover:text-warning"
                            onClick={() => onCutSale(venta.ventaId!)}
                          >
                            <Scissors className="h-3.5 w-3.5" />
                            Cortar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 text-info hover:text-info"
                            onClick={() => onTransferSale(venta.ventaId!)}
                          >
                            <MoveRight className="h-3.5 w-3.5" />
                            Transferir
                          </Button>
                          <Link prefetch={false} href={`/ventas/${venta.ventaId}`}>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 bg-primary text-primary-foreground hover:bg-primary/90">
                              <ExternalLink className="h-3.5 w-3.5" />
                              Ver venta
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                    <div className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div className="min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">{venta.clienteNombre || 'Sin cliente'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">{ventaCurrency} {(venta.precioFinal ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">Desc: {(venta.descuento ?? 0).toFixed(2)}%</span>
                        </div>
                      </div>
                      <div className="min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Ciclo:</span>
                          <span className="font-medium">{venta.cicloPago ? getCicloPagoLabel(venta.cicloPago) : '-'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">
                            Inicio: {venta.fechaInicio ? format(new Date(venta.fechaInicio), 'd MMM yyyy', { locale: es }) : '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-medium">
                            Vence: {venta.fechaFin ? format(new Date(venta.fechaFin), 'd MMM yyyy', { locale: es }) : '-'}
                          </span>
                        </div>
                      </div>
                      <div className="min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Perfil:</span>
                          <span className="font-medium truncate">{venta.perfilNombre || '-'}</span>
                        </div>
                        {venta.codigo && (
                          <div className="flex items-center gap-2">
                            <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-muted-foreground">Código:</span>
                            <span className="min-w-0 break-all font-medium select-all">{venta.codigo}</span>
                          </div>
                        )}
                        {diasRestantes !== null && (() => {
                          let badgeClass: string;
                          let badgeText: string;
                          if (diasRestantes < 0) {
                            const d = Math.abs(diasRestantes);
                            badgeClass = 'border-danger-border bg-danger-subtle text-danger';
                            badgeText = `${d} día${d > 1 ? 's' : ''} de retraso`;
                          } else if (diasRestantes === 0) {
                            badgeClass = 'border-danger-border bg-danger-subtle text-danger';
                            badgeText = 'Vence hoy';
                          } else if (diasRestantes <= 7) {
                            badgeClass = 'border-warning-border bg-warning-subtle text-warning';
                            badgeText = `${diasRestantes} día${diasRestantes > 1 ? 's' : ''} restante${diasRestantes > 1 ? 's' : ''}`;
                          } else {
                            badgeClass = 'border-success-border bg-success-subtle text-success';
                            badgeText = `${diasRestantes} días restantes`;
                          }
                          return (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={badgeClass}>
                                {badgeText}
                              </Badge>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="min-w-0 space-y-2">
                        <div className="flex items-center gap-2" title="Sin contar el pago inicial">
                          <RefreshCw className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                          <span className="text-muted-foreground">Renovaciones:</span>
                          <span className="font-medium tabular-nums">{venta.renovaciones ?? '—'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border border-border bg-black p-3">
                    <p className="text-sm text-muted-foreground mb-2">Notas de la venta:</p>
                    <div className="text-sm whitespace-pre-line">
                      {venta.notas ? venta.notas : 'Sin notas'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ServicioProfilesFooter
        isServicioActivo={servicio.activo}
        onNextPage={onNextPage}
        onPreviousPage={onPreviousPage}
        profilePage={profilePage}
        profilePageCount={profilePageCount}
        showProfileControls={showProfileControls}
      />
    </Card>
  );
}
