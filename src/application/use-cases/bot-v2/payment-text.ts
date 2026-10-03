import { renderPaymentMessage, type PaymentMessages } from '@/modules/bot-config/payment-messages';
import type { SubmitReceiptResult } from '../pedido-payment-use-cases';

const expiryClock = new Intl.DateTimeFormat('es-PA', {
  timeZone: 'America/Panama', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
});

export const formatAmount = (value: number): string => (Number.isFinite(value) ? value : 0).toFixed(2);
export function formatExpiry(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : expiryClock.format(date);
}

/** Traduce el resultado del comprobante a un texto editable. Nunca incluye codigo ni telefonos. */
export function receiptResultText(result: SubmitReceiptResult, messages: PaymentMessages, moneda: string): string {
  switch (result.estado) {
    case 'confirmado':
      return renderPaymentMessage(messages, result.sobrepago ? 'pago_confirmado_sobrepago' : 'pago_confirmado');
    case 'esperando_correo':
      return renderPaymentMessage(messages, 'esperando_correo');
    case 'en_revision':
      if (result.motivo === 'monto_menor') {
        return renderPaymentMessage(messages, 'revision_monto_menor', { faltante: formatAmount(result.faltante), moneda });
      }
      return renderPaymentMessage(messages, result.motivo === 'fuera_de_ventana'
        ? 'revision_fuera_de_ventana' : 'revision_entrega_pendiente');
    case 'rechazado':
      return renderPaymentMessage(messages, ({
        sin_codigo: 'rechazo_sin_codigo', codigo_usado: 'rechazo_codigo_usado',
        pedido_invalido: 'rechazo_pedido_invalido', intentos_excedidos: 'rechazo_intentos_excedidos',
      } as const)[result.motivo]);
  }
}
