import Link from 'next/link';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatearFechaHora } from '@/platform/utils/calculations';
import type { MetodoPago } from '@/types/metodos-pago';
import {
  CopyableField,
  FieldValue,
  maskCardNumber,
  SecretField,
  type CopyToClipboard,
} from './MetodoPagoDetailFields';

const TIPO_CUENTA_LABELS: Record<string, string> = {
  ahorro: 'Ahorro',
  corriente: 'Corriente',
  wallet: 'Wallet',
  telefono: 'Teléfono',
  email: 'Email',
};

const TIPO_METODO_PAGO_LABELS: Record<string, string> = {
  banco: 'Banco',
  yappy: 'Yappy',
  paypal: 'PayPal',
  binance: 'Binance',
  efectivo: 'Efectivo',
};

function BackButton({ variant = 'ghost' }: { variant?: 'ghost' | 'outline' }) {
  return (
    <Link prefetch={false} href="/metodos-pago">
      <Button variant={variant} size="icon" className="h-8 w-8">
        <ArrowLeft className="h-4 w-4" />
      </Button>
    </Link>
  );
}

export function MetodoPagoLoadingState() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BackButton />
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Cargando método de pago...</h1>
      </div>
      <div className="rounded-lg border bg-card p-6">
        <p className="text-muted-foreground">Cargando datos...</p>
      </div>
    </div>
  );
}

export function MetodoPagoNotFoundState() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BackButton />
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Método de pago no encontrado</h1>
      </div>
      <div className="rounded-lg border bg-card p-6">
        <p className="text-muted-foreground">El método de pago que buscas no existe.</p>
      </div>
    </div>
  );
}

export function MetodoPagoDetailHeader({
  metodo,
  onDelete,
}: {
  metodo: MetodoPago;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <BackButton variant="outline" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{metodo.nombre}</h1>
            <Badge
              variant="outline"
              className={
                metodo.activo
                  ? 'border-green-500/50 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
                  : 'border-red-500/50 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
              }
            >
              {metodo.activo ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            <Link prefetch={false} href="/" className="transition-colors hover:text-foreground">Dashboard</Link>
            {' / '}
            <Link prefetch={false} href="/metodos-pago" className="transition-colors hover:text-foreground">Métodos de Pago</Link>
            {' / '}
            <span className="text-foreground">{metodo.nombre}</span>
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link prefetch={false} href={`/metodos-pago/${metodo.id}/editar?from=/metodos-pago/${metodo.id}`}>
            <Edit className="mr-1.5 h-3.5 w-3.5" />
            Editar
          </Link>
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Eliminar
        </Button>
      </div>
    </div>
  );
}

export function MetodoPagoBasicInfo({
  metodo,
  isTercero,
}: {
  metodo: MetodoPago;
  isTercero: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="mb-6 text-lg font-semibold">Información Básica</h2>

      <div className="space-y-5">
        <FieldValue label="Alias">{metodo.alias || 'N/A'}</FieldValue>
        <FieldValue label="Asociado a">{isTercero ? 'Tercero' : 'Servicio'}</FieldValue>
        <FieldValue label="País">{metodo.pais}</FieldValue>
        <FieldValue label="Moneda">{metodo.moneda || 'USD'}</FieldValue>
        <FieldValue label="Creado">{formatearFechaHora(new Date(metodo.createdAt))}</FieldValue>
        <FieldValue label="Última Actualización">{formatearFechaHora(new Date(metodo.updatedAt))}</FieldValue>
      </div>
    </div>
  );
}

export function MetodoPagoAdditionalInfo({
  metodo,
  isTercero,
  showPassword,
  showCardNumber,
  onTogglePassword,
  onToggleCardNumber,
  onCopy,
}: {
  metodo: MetodoPago;
  isTercero: boolean;
  showPassword: boolean;
  showCardNumber: boolean;
  onTogglePassword: () => void;
  onToggleCardNumber: () => void;
  onCopy: CopyToClipboard;
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="mb-6 text-lg font-semibold">
        {isTercero ? 'Datos de la Cuenta' : 'Información Adicional'}
      </h2>

      <div className="space-y-5">
        {isTercero ? (
          <TerceroPaymentFields metodo={metodo} />
        ) : (
          <ServicioPaymentFields
            metodo={metodo}
            showPassword={showPassword}
            showCardNumber={showCardNumber}
            onTogglePassword={onTogglePassword}
            onToggleCardNumber={onToggleCardNumber}
            onCopy={onCopy}
          />
        )}
      </div>
    </div>
  );
}

function TerceroPaymentFields({ metodo }: { metodo: MetodoPago }) {
  return (
    <>
      <FieldValue label="Nombre del Titular">{metodo.titular}</FieldValue>
      <FieldValue label={metodo.banco ? 'Nombre del Banco' : 'Método'}>
        {metodo.banco || TIPO_METODO_PAGO_LABELS[metodo.tipo]}
      </FieldValue>
      <FieldValue label="Identificador de cuenta">{metodo.identificador}</FieldValue>
      {metodo.tipoCuenta && (
        <FieldValue label="Tipo de Cuenta">{TIPO_CUENTA_LABELS[metodo.tipoCuenta]}</FieldValue>
      )}
      <FieldValue label="Notas" muted>{metodo.notas || 'No hay notas.'}</FieldValue>
    </>
  );
}

function ServicioPaymentFields({
  metodo,
  showPassword,
  showCardNumber,
  onTogglePassword,
  onToggleCardNumber,
  onCopy,
}: {
  metodo: MetodoPago;
  showPassword: boolean;
  showCardNumber: boolean;
  onTogglePassword: () => void;
  onToggleCardNumber: () => void;
  onCopy: CopyToClipboard;
}) {
  return (
    <>
      <FieldValue label="Nombre del Titular">{metodo.titular}</FieldValue>
      {metodo.email && (
        <CopyableField label="Email" value={metodo.email} copyLabel="Email" onCopy={onCopy} />
      )}
      {metodo.contrasena && (
        <SecretField
          label="Contraseña"
          value={metodo.contrasena}
          copyLabel="Contraseña"
          visibleValue={showPassword ? metodo.contrasena : '••••••••'}
          isVisible={showPassword}
          onToggle={onTogglePassword}
          onCopy={onCopy}
        />
      )}
      {metodo.numeroTarjeta && (
        <SecretField
          label="Número de Tarjeta"
          value={metodo.numeroTarjeta}
          copyLabel="Número de tarjeta"
          visibleValue={showCardNumber ? metodo.numeroTarjeta : maskCardNumber(metodo.numeroTarjeta)}
          isVisible={showCardNumber}
          onToggle={onToggleCardNumber}
          onCopy={onCopy}
        />
      )}
      {metodo.fechaExpiracion && (
        <CopyableField
          label="Fecha Expiración"
          value={metodo.fechaExpiracion}
          copyLabel="Fecha de expiración"
          onCopy={onCopy}
        />
      )}
      <FieldValue label="Notas" muted>{metodo.notas || 'No hay notas.'}</FieldValue>
    </>
  );
}
