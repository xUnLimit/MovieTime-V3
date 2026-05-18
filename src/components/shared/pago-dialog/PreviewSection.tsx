import { MessageCircle } from 'lucide-react';
import type { UseFormSetValue } from 'react-hook-form';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { PagoDialogFormData } from './schema';

interface PreviewSectionProps {
  notificarWhatsAppValue?: boolean;
  previewMessage: string;
  setPreviewMessage: (value: string) => void;
  setValue: UseFormSetValue<PagoDialogFormData>;
}

export function PreviewSection({
  notificarWhatsAppValue,
  previewMessage,
  setPreviewMessage,
  setValue,
}: PreviewSectionProps) {
  return (
    <div className="rounded-lg border bg-background/40 p-3">
      <div className="flex items-center gap-3">
        <Switch
          id="notificar-whatsapp"
          aria-label="Notificar al cliente por WhatsApp"
          checked={Boolean(notificarWhatsAppValue)}
          onCheckedChange={(checked) => setValue('notificarWhatsApp', checked as boolean)}
        />
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageCircle className="h-4 w-4 text-green-500" />
          <span>Notificar al cliente por WhatsApp</span>
        </div>
      </div>

      {notificarWhatsAppValue && (
        <div className="mt-4 space-y-2">
          <label htmlFor="whatsapp-preview-message" className="text-sm font-semibold">
            Vista Previa del Mensaje
          </label>
          <p className="text-xs text-muted-foreground">Puedes ajustar el mensaje antes de enviarlo. Los cambios no se guardan en las plantillas.</p>
          <Textarea
            id="whatsapp-preview-message"
            name="whatsappPreviewMessage"
            value={previewMessage}
            onChange={(event) => setPreviewMessage(event.target.value)}
            rows={10}
            className="min-h-[220px] resize-y text-sm leading-relaxed"
          />
        </div>
      )}
    </div>
  );
}
