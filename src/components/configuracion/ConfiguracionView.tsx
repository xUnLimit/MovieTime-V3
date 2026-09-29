'use client';

import { DashboardViewSection, DevicePushSection } from './BasicSections';
import { ExecutivePushSection } from './ExecutivePushSection';
import { useConfiguracionController } from './useConfiguracionController';
import { WhatsAppAutoSection } from './WhatsAppAutoSection';

/** Ajustes en dos columnas: preferencias de este dispositivo a la izquierda, automatizaciones a la derecha. */
export function ConfiguracionView() {
  const controller = useConfiguracionController();

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2 xl:items-start">
      <div className="min-w-0 space-y-4">
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
        <WhatsAppAutoSection settings={controller.whatsappAuto} />
      </div>
      <div className="min-w-0">
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
      </div>
    </div>
  );
}
