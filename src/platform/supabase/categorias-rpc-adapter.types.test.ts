import { expectTypeOf, it } from 'vitest';

import type { Database } from './database.types';
import { deleteCategoriaRpc, getCategoriasCountsRpc, getCategoriasFullRpc } from './categorias-rpc-adapter';

type Functions = Database['public']['Functions'];

it('conserva los argumentos generados de categorias', () => {
  expectTypeOf<Parameters<typeof getCategoriasFullRpc>>().toEqualTypeOf<[]>();
  expectTypeOf<Parameters<typeof getCategoriasCountsRpc>>().toEqualTypeOf<[]>();
  expectTypeOf<Parameters<typeof deleteCategoriaRpc>[0]>()
    .toEqualTypeOf<Functions['delete_categoria']['Args']['p_categoria_id']>();
  expectTypeOf<Functions['get_categorias_full']['Args']>().toEqualTypeOf<never>();
  expectTypeOf<Functions['get_categorias_counts']['Args']>().toEqualTypeOf<never>();
});
