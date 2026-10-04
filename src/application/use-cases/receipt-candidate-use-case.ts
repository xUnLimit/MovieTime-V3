import { createAutomationControlStore } from '@/modules/automation-control/store';
import { downloadCloudApiMedia } from '@/modules/whatsapp/media-download';
import { env } from '@/platform/config';
import { createLogger } from '@/platform/observability/logger';
import { requestOpenAiReceipt } from '@/platform/server/openai-receipt';
import { z } from '@/platform/validation/zod';
import type { AutomationSettings } from '@/types/automation-control';

const candidateSchema = z.object({ reference: z.string().regex(/^[A-Za-z0-9-]{4,80}$/).nullable(),
  confidence: z.number().min(0).max(1) }).strict();
type Dependencies = {
  settings(): Promise<AutomationSettings>; claimBudget(tokens: number): Promise<boolean>;
  download(id: string): Promise<{ bytes: ArrayBuffer; mimeType: string }>;
  interpret(image: { bytes: ArrayBuffer; mimeType: string }, model: string): Promise<unknown>;
};
const logger = createLogger('ReceiptCandidate');

export async function readReceiptCandidateUseCase(mediaId: string, deps?: Dependencies): Promise<string | null> {
  if (!/^\d{1,32}$/.test(mediaId)) return null;
  try {
    const dependencies = deps ?? { ...createAutomationControlStore(), interpret: requestOpenAiReceipt,
      download: (id: string) => downloadCloudApiMedia({ accessToken: env.whatsappAccessToken ?? '',
        phoneNumberId: env.whatsappPhoneNumberId ?? '' }, id) };
    const settings = await dependencies.settings();
    if (settings.aiMode !== 'queries' || !await dependencies.claimBudget(4096)) return null;
    const image = await dependencies.download(mediaId);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.mimeType)
      || image.bytes.byteLength === 0 || image.bytes.byteLength > 1024 * 1024) return null;
    const candidate = candidateSchema.safeParse(await dependencies.interpret(image, settings.model));
    if (!candidate.success || candidate.data.confidence < 0.9) return null;
    return candidate.data.reference;
  } catch {
    logger.warn('Comprobante no legible; se solicita la referencia escrita.');
    return null;
  }
}
