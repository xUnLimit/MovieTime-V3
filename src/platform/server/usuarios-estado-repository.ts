import { createServiceRoleClient } from './supabase-server';

export function createUsuarioEstadoRepository() {
  const client = createServiceRoleClient();
  return {
    async find(id: string) {
      const { data, error } = await client.from('usuarios').select('id,role,active').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
    async countActiveAdmins() {
      const { count, error } = await client.from('usuarios')
        .select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('active', true);
      if (error || count === null) throw error ?? new Error('No se pudo contar administradores.');
      return count;
    },
    async setActive(id: string, active: boolean) {
      const { error } = await client.from('usuarios').update({ active }).eq('id', id);
      if (error) throw error;
    },
    async setBanned(id: string, banned: boolean) {
      const { error } = await client.auth.admin.updateUserById(id, {
        ban_duration: banned ? '876000h' : 'none',
      });
      if (error) throw error;
    },
  };
}
