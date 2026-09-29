import Link from 'next/link';
import { Edit, Trash2 } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
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

export function MetodoPagoLoadingState() {
  return (
    <div className="space-y-6">
      <PageHeader title="Cargando método de pago..." trail={[{ label: 'Detalle' }]} />
      <div className="rounded-lg border bg-card p-6">
        <p className="text-muted-foreground">Cargando datos...</p>
      </div>
    </div>
  );
}

export function MetodoPagoNotFoundState() {
  return (
    <div className="space-y-6">
      <PageHeader title="Método de pago no encontrado" trail={[{ label: 'Detalle' }]} />
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
    <PageHeader
      title={metodo.nombre}
      trail={[{ label: metodo.nombre }]}
      description={
        <StatusBadge tone={metodo.activo ? 'success' : 'neutral'}>{metodo.activo ? 'Activo' : 'Inactivo'}</StatusBadge>
      }
      actions={
        <>
          <Button asChild variant="outline">
            <Link prefetch={false} href={`/metodos-pago/${metodo.id}/editar?from=/metodos-pago/${metodo.id}`}>
              <Edit />
              Editar
            </Link>
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 />
            Eliminar
          </Button>
        </>
      }
    />
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
      <h2 className="mb-6 text-base font-semibold">Información Básica</h2>

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
      <h2 className="mb-6 text-base font-semibold">
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
