import { createAccessDataStore } from '@/modules/messaging/access-data-store';
import { buildMessageData, maskCredentials, renderFreeText, type NoticeGroup } from '@/modules/messaging/message-data';
import { createNoticeStore } from '@/modules/messaging/notice-store';
import type { AccessData } from './bot-reply';

const MAX_TEXT = 4096;

/**
 * Los datos de acceso que el bot reenvía: de las ventas activas del número que escribe, con la plantilla que se envía al crear la
 * venta («Notificación de Suscripción»). Las contraseñas y PIN de un servicio que entra con código nunca se incluyen. Las
 * dependencias se crean al primer uso: una base de datos sin configurar no debe romper la entrega del webhook.
 */
export function createAccessData(now: () => Date = () => new Date()): AccessData {
  let access: ReturnType<typeof createAccessDataStore> | undefined;
  let notices: ReturnType<typeof createNoticeStore> | undefined;
  const sales = () => (access ??= createAccessDataStore());
  const noticeStore = () => (notices ??= createNoticeStore());
  return {
    async eligible(waId) {
      const { sales: rows } = await sales().eligibleSales(waId);
      return rows.map(({ saleId, service, profile }) => ({ saleId, service, profile }));
    },
    async compose(waId, saleId) {
      const { clienteId, sales: rows } = await sales().eligibleSales(waId);
      const sale = rows.find((row) => row.saleId === saleId);
      if (!clienteId || !sale) return null;
      const [ventas, template] = await Promise.all([noticeStore().loadVentas([saleId]), noticeStore().loadTemplate('suscripcion')]);
      const venta = ventas[0];
      if (!venta || venta.clienteId !== clienteId || !venta.activa || venta.reembolsada || venta.enReposo || !template?.contenido) return null;
      const group: NoticeGroup = {
        clienteId, clienteNombre: venta.clienteNombre, telefono: venta.telefono,
        fechaVencimiento: venta.fechaVencimiento, moneda: venta.moneda, ventas: [venta],
      };
      const data = buildMessageData(group, { now: now() });
      const text = renderFreeText(template.contenido, data);
      if (!text || text.length > MAX_TEXT) return null;
      // El cliente recibe el texto real; el chat guarda el mismo texto con la contraseña y el PIN ocultos.
      return { text, stored: renderFreeText(template.contenido, maskCredentials(data)), withheld: sale.codeOnly };
    },
  };
}
