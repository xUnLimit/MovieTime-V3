import {
  getAll,
  getById,
  queryDocuments,
  getCount,
  create,
  update,
  logCacheHit,
  adjustCategoriaGastos,
  adjustCategoriaSuscripciones,
} from './record-core';
import { supabase } from './client';
import { ENTITIES, type QueryFilter } from './entities';
import type { Categoria, Plan, TipoPlanConfig } from '@/types';

export { logCacheHit, adjustCategoriaGastos, adjustCategoriaSuscripciones };

export const getCategorias = <T>() => getAll<T>(ENTITIES.CATEGORIAS);
export const getCategoriaById = <T>(id: string) => getById<T>(ENTITIES.CATEGORIAS, id);
export const queryCategorias = <T>(filters: QueryFilter[] = []) => queryDocuments<T>(ENTITIES.CATEGORIAS, filters);
export const countCategorias = (filters: QueryFilter[] = []) => getCount(ENTITIES.CATEGORIAS, filters);
export const createCategoria = <T extends Record<string, unknown>>(payload: Omit<T, 'id'>) =>
  create(ENTITIES.CATEGORIAS, payload);
export const updateCategoria = <T extends Record<string, unknown>>(id: string, payload: Partial<T>) =>
  update(ENTITIES.CATEGORIAS, id, payload);

export { ENTITIES } from './entities';

type CategoriaRow = {
  id: string;
  nombre: string;
  tipo: 'cliente' | 'revendedor';
  tipo_categoria: 'plataforma_streaming' | 'otros' | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export async function getCategoriasFull(): Promise<Categoria[]> {
  const { data, error } = await supabase.from('categorias').select('*').order('nombre');
  if (error) throw new Error(error.message);
  return buildCategorias(data ?? []);
}

export async function getCategoriasCounts() {
  const [{ count: totalCategorias }, { count: categoriasClientes }, { count: categoriasRevendedores }] =
    await Promise.all([
      supabase.from('categorias').select('*', { count: 'exact', head: true }),
      supabase.from('categorias').select('*', { count: 'exact', head: true }).eq('tipo', 'cliente'),
      supabase.from('categorias').select('*', { count: 'exact', head: true }).eq('tipo', 'revendedor'),
    ]);

  return {
    totalCategorias: totalCategorias ?? 0,
    categoriasClientes: categoriasClientes ?? 0,
    categoriasRevendedores: categoriasRevendedores ?? 0,
  };
}

export async function createCategoriaRecord(
  categoria: Pick<Categoria, 'nombre' | 'tipo' | 'tipoCategoria' | 'notas' | 'activo'>
) {
  const { data, error } = await supabase
    .from('categorias')
    .insert({
      nombre: categoria.nombre,
      tipo: categoria.tipo,
      tipo_categoria: categoria.tipoCategoria,
      notas: categoria.notas,
      activo: categoria.activo,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateCategoriaRecord(id: string, updates: Partial<Categoria>) {
  const { data, error } = await supabase
    .from('categorias')
    .update({
      ...(updates.nombre !== undefined ? { nombre: updates.nombre } : {}),
      ...(updates.tipo !== undefined ? { tipo: updates.tipo } : {}),
      ...(updates.tipoCategoria !== undefined ? { tipo_categoria: updates.tipoCategoria } : {}),
      ...(updates.notas !== undefined ? { notas: updates.notas } : {}),
      ...(updates.activo !== undefined ? { activo: updates.activo } : {}),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteCategoriaRecord(id: string) {
  const { error } = await supabase.rpc('delete_categoria', { p_categoria_id: id });
  if (error) throw new Error(error.message);
}

export async function buildCategorias(categoriasRows: CategoriaRow[]): Promise<Categoria[]> {
  const ids = categoriasRows.map((categoria) => categoria.id);
  if (ids.length === 0) return [];

  const [tiposResult, planesResult, countersResult, ventasResult, financialResult] = await Promise.all([
    supabase.from('planes_tipos').select('*').in('categoria_id', ids).eq('activo', true),
    supabase.from('planes').select('*').in('categoria_id', ids).eq('activo', true),
    supabase.from('v_categoria_counters').select('*').in('categoria_id', ids),
    supabase.from('v_ventas_full').select('categoria_id,estado').in('categoria_id', ids),
    supabase.from('v_categoria_financial_metrics').select('*').in('categoria_id', ids),
  ]);

  if (tiposResult.error) throw new Error(tiposResult.error.message);
  if (planesResult.error) throw new Error(planesResult.error.message);
  if (countersResult.error) throw new Error(countersResult.error.message);
  if (ventasResult.error) throw new Error(ventasResult.error.message);
  if (financialResult.error) throw new Error(financialResult.error.message);

  const tiposByCategoria = new Map<string, TipoPlanConfig[]>();
  for (const tipo of tiposResult.data ?? []) {
    tiposByCategoria.set(tipo.categoria_id, [
      ...(tiposByCategoria.get(tipo.categoria_id) ?? []),
      { id: tipo.id, nombre: tipo.nombre },
    ]);
  }

  const planesByCategoria = new Map<string, Plan[]>();
  for (const plan of planesResult.data ?? []) {
    planesByCategoria.set(plan.categoria_id, [
      ...(planesByCategoria.get(plan.categoria_id) ?? []),
      {
        id: plan.id,
        nombre: plan.nombre,
        precio: Number(plan.precio),
        cicloPago: plan.ciclo_pago,
        tipoPlan: plan.plan_tipo_id,
      },
    ]);
  }

  const countersByCategoria = new Map((countersResult.data ?? []).map((counter) => [counter.categoria_id, counter]));
  const ventasActivasByCategoria = new Map<string, number>();
  for (const venta of ventasResult.data ?? []) {
    if (!venta.categoria_id || venta.estado === 'inactivo') continue;
    ventasActivasByCategoria.set(
      venta.categoria_id,
      (ventasActivasByCategoria.get(venta.categoria_id) ?? 0) + 1
    );
  }

  const financialByCategoria = new Map((financialResult.data ?? []).map((row) => [row.categoria_id, row]));

  return categoriasRows.map((categoria) => {
    const counters = countersByCategoria.get(categoria.id);
    const financial = financialByCategoria.get(categoria.id);
    return {
      id: categoria.id,
      nombre: categoria.nombre,
      tipo: categoria.tipo,
      tipoCategoria: categoria.tipo_categoria ?? undefined,
      tiposPlanes: tiposByCategoria.get(categoria.id) ?? [],
      planes: planesByCategoria.get(categoria.id) ?? [],
      notas: categoria.notas ?? undefined,
      activo: categoria.activo,
      totalServicios: Number(counters?.total_servicios ?? 0),
      serviciosActivos: Number(counters?.servicios_activos ?? 0),
      perfilesDisponiblesTotal: Number(counters?.perfiles_disponibles_total ?? 0),
      ventasTotales: ventasActivasByCategoria.get(categoria.id) ?? 0,
      ingresosTotales: Number(financial?.ingresos_usd ?? 0),
      gastosTotal: Number(financial?.gastos_usd ?? 0),
      createdAt: new Date(categoria.created_at),
      updatedAt: new Date(categoria.updated_at),
      createdBy: categoria.created_by ?? undefined,
    };
  });
}

export async function upsertCategoriaPlanes(categoriaId: string, tiposPlanes: TipoPlanConfig[], planes: Plan[]) {
  await deactivateMissingCategoriaPlanes(categoriaId, tiposPlanes, planes);

  if (tiposPlanes.length > 0) {
    const { error } = await supabase.from('planes_tipos').upsert(
      tiposPlanes.map((tipo, index) => ({
        id: tipo.id,
        categoria_id: categoriaId,
        nombre: tipo.nombre,
        orden: index + 1,
        activo: true,
      })),
      { onConflict: 'id' }
    );
    if (error) throw new Error(error.message);
  }

  if (planes.length > 0) {
    const { error } = await supabase.from('planes').upsert(
      planes.map((plan, index) => ({
        id: plan.id,
        categoria_id: categoriaId,
        plan_tipo_id: plan.tipoPlan,
        nombre: plan.nombre,
        precio: plan.precio,
        ciclo_pago: plan.cicloPago,
        orden: index + 1,
        activo: true,
      })),
      { onConflict: 'id' }
    );
    if (error) throw new Error(error.message);
  }
}

async function deactivateMissingCategoriaPlanes(
  categoriaId: string,
  tiposPlanes: TipoPlanConfig[],
  planes: Plan[]
) {
  const [existingTiposResult, existingPlanesResult] = await Promise.all([
    supabase.from('planes_tipos').select('id').eq('categoria_id', categoriaId).eq('activo', true),
    supabase.from('planes').select('id').eq('categoria_id', categoriaId).eq('activo', true),
  ]);

  if (existingTiposResult.error) throw new Error(existingTiposResult.error.message);
  if (existingPlanesResult.error) throw new Error(existingPlanesResult.error.message);

  const nextTipoIds = new Set(tiposPlanes.map((tipo) => tipo.id));
  const nextPlanIds = new Set(planes.map((plan) => plan.id));
  const removedTipoIds = (existingTiposResult.data ?? [])
    .map((tipo) => tipo.id)
    .filter((id) => !nextTipoIds.has(id));
  const removedPlanIds = (existingPlanesResult.data ?? [])
    .map((plan) => plan.id)
    .filter((id) => !nextPlanIds.has(id));

  await Promise.all([
    removedPlanIds.length > 0
      ? supabase.from('planes').update({ activo: false }).in('id', removedPlanIds)
      : Promise.resolve({ error: null }),
    removedTipoIds.length > 0
      ? supabase.from('planes_tipos').update({ activo: false }).in('id', removedTipoIds)
      : Promise.resolve({ error: null }),
  ]).then(([planesResult, tiposResult]) => {
    if (planesResult.error) throw new Error(planesResult.error.message);
    if (tiposResult.error) throw new Error(tiposResult.error.message);
  });
}
