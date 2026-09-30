import type { Database } from './database.types';

export const ENTITIES = {
  TERCEROS: 'terceros',
  SERVICIOS: 'servicios',
  CATEGORIAS: 'categorias',
  METODOS_PAGO: 'metodosPago',
  TIPOS_GASTO: 'tiposGasto',
  ACTIVITY_LOG: 'activityLog',
  CONFIG: 'config',
  GASTOS: 'gastos',
  TEMPLATES: 'templates',
  NOTIFICACIONES: 'notificaciones',
  PAGOS_SERVICIO: 'pagosServicio',
  VENTAS: 'ventas',
  PAGOS_VENTA: 'pagosVenta',
} as const;

export type CollectionName = typeof ENTITIES[keyof typeof ENTITIES];
export type PublicTableName = keyof Database['public']['Tables'];
export type PublicViewName = keyof Database['public']['Views'];
export type PublicEntity = PublicTableName | PublicViewName;

export type QueryFilter = {
  field: string;
  operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'is' | 'ilike' | 'orIlike';
  value: unknown;
};

export type QueryBuilder = {
  eq: (field: string, value: unknown) => QueryBuilder;
  neq: (field: string, value: unknown) => QueryBuilder;
  lt: (field: string, value: unknown) => QueryBuilder;
  lte: (field: string, value: unknown) => QueryBuilder;
  gt: (field: string, value: unknown) => QueryBuilder;
  gte: (field: string, value: unknown) => QueryBuilder;
  in: (field: string, value: unknown) => QueryBuilder;
  is: (field: string, value: null | boolean) => QueryBuilder;
  ilike: (field: string, value: string) => QueryBuilder;
  or: (filters: string) => QueryBuilder;
};

const TABLE_BY_COLLECTION: Record<CollectionName, PublicTableName> = {
  terceros: 'terceros',
  servicios: 'servicios',
  categorias: 'categorias',
  metodosPago: 'metodos_pago',
  tiposGasto: 'tipos_gasto',
  activityLog: 'activity_log',
  config: 'config',
  gastos: 'gastos',
  templates: 'templates',
  notificaciones: 'notificaciones',
  pagosServicio: 'pagos_servicio',
  ventas: 'ventas',
  pagosVenta: 'pagos_venta',
};

const READ_ENTITY_BY_COLLECTION: Partial<Record<CollectionName, PublicEntity>> = {
  gastos: 'v_gastos_full',
  pagosServicio: 'v_pagos_servicio_full',
  pagosVenta: 'v_pagos_venta_full',
  ventas: 'v_ventas_full',
  servicios: 'v_servicios_full',
};

export function readEntity(collectionName: CollectionName): PublicEntity {
  return READ_ENTITY_BY_COLLECTION[collectionName] ?? TABLE_BY_COLLECTION[collectionName];
}

export function writeTable(collectionName: CollectionName): PublicTableName {
  return TABLE_BY_COLLECTION[collectionName];
}
