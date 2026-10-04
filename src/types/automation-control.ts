export type AutomationSettings = {
  reservationMinutes: number;
  maxReservations: number;
  integrationsEnabled: boolean;
  purchasesEnabled?: boolean;
};
export type AutomationControl = {
  operations?: { pendingMessages: number; reviewMessages: number; oldestPendingAt: string | null;
    retryAttempts: number; averageResolutionSeconds: number; pendingDeliveries: number; reviewDeliveries: number;
    ordersToday: number; completedToday: number;
    pendingInterests?: number; reviewInterests?: number };
  settings: AutomationSettings;
  health: { integrationConfigured: boolean };
  providers: { id: string; name: string; loginCode: boolean; travelCode: boolean; verified: boolean }[];
  interests: { id: string; contactSuffix: string; category: string; plan: string; consent: boolean;
    paused: boolean; state: string; createdAt: string }[];
  access: { serviceId: string; mode: 'password' | 'code'; provider: 'netflix'; rotationConfirmedAt: string | null }[];
};
