import { expectTypeOf, it } from 'vitest';

import type { Database } from './database.types';
import type {
  CreateServicioPaymentPayload,
  CreateVentaPaymentPayload,
} from './payments-rpc-adapter';
import type { RpcArgs } from './rpc-args';
import { callRpc } from './rpc-client';
import type {
  CreateServicioWithInitialPaymentPayload,
  UpdateServicioPaymentAndPeriodPayload,
} from './servicios-rpc-adapter';
import type {
  CreateVentaRefundPayload,
  CreateVentaWithInitialPaymentPayload,
  UpdateVentaPaymentAndPeriodPayload,
} from './ventas-rpc-adapter';

type Functions = Database['public']['Functions'];

it('los payloads de escritura son asignables a RpcArgs del esquema generado', () => {
  expectTypeOf<CreateServicioPaymentPayload>().toExtend<RpcArgs<'create_servicio_payment'>>();
  expectTypeOf<CreateVentaPaymentPayload>().toExtend<RpcArgs<'create_venta_payment'>>();
  expectTypeOf<CreateServicioWithInitialPaymentPayload>()
    .toExtend<RpcArgs<'create_servicio_with_initial_payment'>>();
  expectTypeOf<UpdateServicioPaymentAndPeriodPayload>()
    .toExtend<RpcArgs<'update_servicio_payment_and_period'>>();
  expectTypeOf<CreateVentaWithInitialPaymentPayload>()
    .toExtend<RpcArgs<'create_venta_with_initial_payment'>>();
  expectTypeOf<CreateVentaRefundPayload>().toExtend<RpcArgs<'create_venta_refund'>>();
  expectTypeOf<UpdateVentaPaymentAndPeriodPayload>()
    .toExtend<RpcArgs<'update_venta_payment_and_period'>>();
});

it('RpcArgs acepta null y rechaza claves inexistentes', () => {
  expectTypeOf<RpcArgs<'delete_venta_with_payments'>>()
    .toEqualTypeOf<{ p_delete_payments?: boolean | null; p_venta_id: string | null }>();
  expectTypeOf<Functions['delete_venta_with_payments']['Args']['p_venta_id']>().toEqualTypeOf<string>();

  void (() => callRpc('delete_venta_with_payments', { p_venta_id: null }));
  // @ts-expect-error la clave no existe en el esquema generado
  void (() => callRpc('delete_venta_with_payments', { p_venta_id: 'v', p_inexistente: 1 }));
  // @ts-expect-error la funcion no existe en el esquema generado
  void (() => callRpc('funcion_inexistente', {}));
});
