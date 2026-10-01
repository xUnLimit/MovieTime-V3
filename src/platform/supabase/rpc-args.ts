import type { Database } from './database.types';

/**
 * PostgreSQL acepta NULL en los argumentos de una funcion aunque los tipos generados
 * solo indiquen los parametros con DEFAULT como opcionales. Distribuir sobre las
 * sobrecargas conserva cada firma y el modificador opcional de sus propiedades.
 * El nombre y el tipo de cada parametro siguen ligados al esquema generado: al
 * regenerarlo tras un cambio SQL, el adapter deja de compilar si hay un desfase.
 */
export type NullableRpcArgs<T> = T extends unknown ? { [K in keyof T]: T[K] | null } : never;

export type RpcArgs<Name extends keyof Database['public']['Functions']> =
  NullableRpcArgs<Database['public']['Functions'][Name]['Args']>;
