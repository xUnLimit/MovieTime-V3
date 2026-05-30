import type { Configuracion, ExecutivePushBlock } from '@/types';

type ExecutivePushSettings = Configuracion['executivePush'];

export function getExecutivePushToggleUpdate(
  executivePush: ExecutivePushSettings,
  enabled: boolean,
  updatedBy?: string,
): ExecutivePushSettings {
  return {
    ...executivePush,
    enabled,
    updatedBy,
  };
}

export function getExecutivePushScheduleUpdate({
  executivePush,
  intervalHours,
  updatedBy,
  windowEnd,
  windowStart,
}: {
  executivePush: ExecutivePushSettings;
  intervalHours: number;
  updatedBy?: string;
  windowEnd: string;
  windowStart: string;
}): ExecutivePushSettings {
  return {
    ...executivePush,
    sendTime: windowStart,
    windowStart,
    windowEnd,
    intervalHours,
    updatedBy,
  };
}

export function isExecutivePushScheduleUnchanged({
  executivePush,
  intervalHours,
  windowEnd,
  windowStart,
}: {
  executivePush: ExecutivePushSettings;
  intervalHours: number;
  windowEnd: string;
  windowStart: string;
}) {
  return (
    windowStart === executivePush.windowStart &&
    windowEnd === executivePush.windowEnd &&
    intervalHours === executivePush.intervalHours
  );
}

export function getExecutivePushBlocksUpdate({
  blockKey,
  checked,
  executivePush,
  updatedBy,
}: {
  blockKey: string;
  checked: boolean;
  executivePush: ExecutivePushSettings;
  updatedBy?: string;
}): ExecutivePushSettings {
  const typedBlock = blockKey as ExecutivePushBlock;
  const selectedBlocks = checked
    ? Array.from(new Set([...executivePush.selectedBlocks, typedBlock]))
    : executivePush.selectedBlocks.filter((block) => block !== typedBlock);

  const blockOrder = executivePush.blockOrder.filter((block) => selectedBlocks.includes(block));
  if (checked && !blockOrder.includes(typedBlock)) {
    blockOrder.push(typedBlock);
  }

  return {
    ...executivePush,
    selectedBlocks,
    blockOrder,
    updatedBy,
  };
}
