import { configureActivityLogSource } from '@/platform/activity/activity-log-adapter';
import { useActivityLogStore } from '@/store/activityLogStore';
import { useAuthStore } from '@/store/authStore';

// Composition root: conecta la identidad (authStore) y el registro (activityLogStore)
// con el adaptador de platform, que no conoce los stores.
configureActivityLogSource({
  getContext: () => {
    const user = useAuthStore.getState().user;
    return {
      usuarioId: user?.id ?? 'sistema',
      usuarioEmail: user?.email ?? 'sistema',
    };
  },
  record: (log) => useActivityLogStore.getState().addLog(log),
});
