import { expectTypeOf, it } from 'vitest';

import type { Database } from './database.types';
import type { NullableRpcArgs, RpcArgs } from './rpc-args';

type Functions = Database['public']['Functions'];

it('admite NULL sin perder las claves opcionales', () => {
  expectTypeOf<NullableRpcArgs<{ requerido: string; opcional?: number }>>()
    .toEqualTypeOf<{ requerido: string | null; opcional?: number | null }>();
});

it('distribuye sobre las firmas sobrecargadas', () => {
  expectTypeOf<NullableRpcArgs<{ primero: string } | { segundo: number }>>()
    .toEqualTypeOf<{ primero: string | null } | { segundo: number | null }>();
});

it('conserva el contrato generado de los RPC de escritura', () => {
  expectTypeOf<RpcArgs<'create_servicio_payment'>>()
    .toEqualTypeOf<NullableRpcArgs<Functions['create_servicio_payment']['Args']>>();
  expectTypeOf<RpcArgs<'create_venta_payment'>>()
    .toEqualTypeOf<NullableRpcArgs<Functions['create_venta_payment']['Args']>>();
  expectTypeOf<RpcArgs<'create_venta_refund'>>()
    .toEqualTypeOf<NullableRpcArgs<Functions['create_venta_refund']['Args']>>();
});
