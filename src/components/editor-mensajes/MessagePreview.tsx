'use client';

import { useState } from 'react';
import { TemplateMensaje } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageCircle } from 'lucide-react';

interface MessagePreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplateMensaje | null;
}

export function MessagePreview({ open, onOpenChange, template }: MessagePreviewProps) {
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});

  if (!template) return null;

  const renderPreview = () => {
    let content = template.contenido;
    Object.entries(placeholderValues).forEach(([key, value]) => {
      content = content.replace(new RegExp(`{${key}}`, 'g'), value || `{${key}}`);
    });
    return content;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vista Previa del Mensaje</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">{template.nombre}</h3>
            <p className="text-sm text-muted-foreground">
              Completa los placeholders para ver cómo se verá el mensaje final
            </p>
          </div>

          {template.placeholders.length > 0 && (
            <div className="space-y-2">
              <Label>Placeholders</Label>
              <div className="grid grid-cols-2 gap-2">
                {template.placeholders.map((placeholder) => (
                  <div key={placeholder} className="space-y-1">
                    <Label htmlFor={placeholder} className="text-xs">
                      {placeholder}
                    </Label>
                    <Input
                      id={placeholder}
                      placeholder={`Ingrese ${placeholder}`}
                      value={placeholderValues[placeholder] || ''}
                      onChange={(e) =>
                        setPlaceholderValues({
                          ...placeholderValues,
                          [placeholder]: e.target.value,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Vista Previa</Label>
            <Card className="p-4 bg-green-50 dark:bg-green-950">
              <div className="flex items-start gap-3">
                <MessageCircle className="h-5 w-5 text-green-600 mt-1" />
                <div className="flex-1">
                  <p className="text-sm whitespace-pre-wrap">{renderPreview()}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
