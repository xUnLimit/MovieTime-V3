"use client";

import { useQuery } from '@tanstack/react-query';
import { loadBotAdminSnapshot, loadBotHealthUseCase } from '@/application/use-cases/bot-admin-use-cases';
import { hasPurchaseBlocks } from '@/modules/bot-config';

/**
 * True cuando los textos de compras se editan en el lienzo: la bandera del servidor esta encendida y la version publicada
 * ya trae los bloques. Si no se puede leer alguno de los dos, devuelve false y se conserva el editor de la pestana Compras.
 */
export function usePurchaseFlowInCanvas(enabled: boolean): boolean {
  const health = useQuery({ queryKey: ['bot-admin', 'health'], queryFn: loadBotHealthUseCase, retry: false, enabled });
  const snapshot = useQuery({ queryKey: ['bot-admin', 'snapshot'], queryFn: loadBotAdminSnapshot, retry: false, enabled });
  const published = snapshot.data?.published;
  return health.data?.purchaseBlocksEnabled === true && published != null && hasPurchaseBlocks(published);
}
