import { Copy, Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';

export type CopyToClipboard = (text: string, label: string) => void;

export function FieldValue({
  label,
  children,
  muted = false,
}: {
  label: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{label}</span>
      </div>
      <p className={muted ? 'text-sm text-muted-foreground' : 'text-sm font-medium'}>{children}</p>
    </div>
  );
}

export function CopyableField({
  label,
  value,
  copyLabel,
  onCopy,
}: {
  label: string;
  value: string;
  copyLabel: string;
  onCopy: CopyToClipboard;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">{value}</p>
        <CopyButton value={value} label={copyLabel} onCopy={onCopy} />
      </div>
    </div>
  );
}

export function SecretField({
  label,
  value,
  copyLabel,
  visibleValue,
  isVisible,
  onToggle,
  onCopy,
}: {
  label: string;
  value: string;
  copyLabel: string;
  visibleValue: string;
  isVisible: boolean;
  onToggle: () => void;
  onCopy: CopyToClipboard;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium">{visibleValue}</p>
        <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0" onClick={onToggle}>
          {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </Button>
        <CopyButton value={value} label={copyLabel} onCopy={onCopy} />
      </div>
    </div>
  );
}

function CopyButton({
  value,
  label,
  onCopy,
}: {
  value: string;
  label: string;
  onCopy: CopyToClipboard;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-5 w-5 flex-shrink-0"
      onClick={() => onCopy(value, label)}
    >
      <Copy className="h-3 w-3" />
    </Button>
  );
}

export function maskCardNumber(numeroTarjeta: string) {
  return `•••• •••• •••• ${numeroTarjeta.replace(/\D/g, '').slice(-4)}`;
}
