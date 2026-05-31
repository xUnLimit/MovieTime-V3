import type { LogContext as ServicioLogContext, RecordActivityLog as ServicioRecordActivityLog } from '@/application/use-cases/servicios/servicios-shared';
import type { LogContext as VentaLogContext, RecordActivityLog as VentaRecordActivityLog } from '@/application/use-cases/ventas/ventas-shared';

export type ActivityLogOptions = {
  logContext: ServicioLogContext & VentaLogContext;
  recordActivityLog: ServicioRecordActivityLog & VentaRecordActivityLog;
};
