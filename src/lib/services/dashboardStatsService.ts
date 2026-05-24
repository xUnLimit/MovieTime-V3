// Legacy compatibility barrel.
// New code should import dashboard reads from `@/lib/dashboard-read-models`.
// Client-side dashboard mutation APIs were removed; derived dashboard data is
// refreshed from SQL/RPC read models instead of being mutated optimistically.
export * from '@/lib/dashboard-read-models';
