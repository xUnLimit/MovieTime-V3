// Contrato de la actividad de los avisos de WhatsApp que muestra Plantillas de mensajes
// (tabla whatsapp_notices), leida con la sesion del administrador. Nunca incluye el texto enviado.

import type { TipoTemplate } from '@/types';

export type NoticeStatus ='pending' | 'accepted' | 'failed' | 'skipped';
export type NoticeOrigin = 'auto' | 'manual';

/** Fila minima para contar la actividad de 30 dias por tipo. */
export type NoticeActivityRow = { tipo: string; status: string; createdAt: string };

export type RecentNotice = {
  id: string;
  tipo: string;
  status: NoticeStatus;
  origin: NoticeOrigin;
  createdAt: string;
  waId: string;
  clienteNombre: string | null;
  skipReason: string | null;
};

export type RecentNoticeFilters = { tipo?: TipoTemplate; status?: NoticeStatus };

export type RecentNoticePage = { notices: RecentNotice[]; total: number; page: number; pageSize: number };
