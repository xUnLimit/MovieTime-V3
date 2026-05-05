export { supabase, getSupabaseClient } from './client';
export type { Database } from './client';

export {
  toCamelCase,
  toSnakeCase,
  parseDateFields,
  COMMON_DATE_FIELDS,
} from './mappers';
export type { CamelCaseKeys, SnakeCaseKeys } from './mappers';

export {
  signIn,
  signOut,
  sendPasswordReset,
  getCurrentSession,
  getCurrentSupabaseUser,
  getCurrentProfile,
  onAuthStateChange,
} from './auth';

export { getPaginated, getCount } from './pagination';
export type {
  SupabaseFilter,
  SupabasePaginationOptions,
  SupabasePaginatedResult,
} from './pagination';

export {
  getById,
  getAll,
  insert,
  update,
  remove,
  rpc,
} from './queries';
