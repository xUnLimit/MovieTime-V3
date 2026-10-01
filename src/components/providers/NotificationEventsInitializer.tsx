'use client';

import { useEffect, useRef } from 'react';
import './activity-log-composition';
import { initializeNotificationEventListeners } from '@/modules/notifications/notification-event-listeners';

export function NotificationEventsInitializer() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    initializeNotificationEventListeners();
  }, []);

  return null;
}
