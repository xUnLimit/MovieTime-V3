'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DashboardViewSection,
  DevicePushSection,
} from './ConfiguracionDialogBasicSections';
import { ExecutivePushSection } from './ConfiguracionDialogExecutiveSection';
import { WhatsAppAutoSection } from './ConfiguracionDialogWhatsAppAutoSection';
import { useConfiguracionDialogController } from './useConfiguracionDialogController';

interface ConfiguracionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConfiguracionDialog({ open, onOpenChange }: ConfiguracionDialogProps) {
  const controller = useConfiguracionDialogController({ open });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-0 flex h-[100dvh] max-h-[100dvh] translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-x-0 p-0 sm:top-[50%] sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:translate-y-[-50%] sm:rounded-lg sm:border">
        <DialogHeader className="shrink-0 border-b bg-background px-6 pb-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:pt-6">
          <DialogTitle>Configuracion</DialogTitle>
          <DialogDescription>
            Ajustes del dashboard y push ejecutivas.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4 sm:pb-6">
          <DashboardViewSection
            availableYears={controller.availableYears}
            selectedYear={controller.selectedYear}
            setSelectedYear={controller.setSelectedYear}
          />
          <DevicePushSection
            handlePushSubscriptionToggle={controller.handlePushSubscriptionToggle}
            handleTestPush={controller.handleTestPush}
            isPushSupported={controller.isPushSupported}
            isSendingTestPush={controller.isSendingTestPush}
            notificationPermission={controller.notificationPermission}
            pushSubscribed={controller.pushSubscribed}
          />
          <ExecutivePushSection
            draftIntervalHours={controller.draftIntervalHours}
            draftWindowEnd={controller.draftWindowEnd}
            draftWindowStart={controller.draftWindowStart}
            executivePush={controller.executivePush}
            executivePushConfigReady={controller.executivePushConfigReady}
            executivePushStatus={controller.executivePushStatus}
            handleBlockToggle={controller.handleBlockToggle}
            handleExecutivePushToggle={controller.handleExecutivePushToggle}
            handleScheduleCommit={controller.handleScheduleCommit}
            isSavingExecutiveSchedule={controller.isSavingExecutiveSchedule}
            setDraftIntervalHours={controller.setDraftIntervalHours}
            setDraftWindowEnd={controller.setDraftWindowEnd}
            setDraftWindowStart={controller.setDraftWindowStart}
          />
          <WhatsAppAutoSection settings={controller.whatsappAuto} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
