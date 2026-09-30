'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Info, XCircle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  loadingText?: string;
  variant?: 'warning' | 'danger' | 'info';
  loading?: boolean;
  /** Bloquea el boton de confirmar (por ejemplo mientras se calcula el alcance de la accion). */
  confirmDisabled?: boolean;
  /** El dialogo no se cierra al confirmar: lo cierra quien lo usa cuando termina la accion. */
  keepOpenOnConfirm?: boolean;
  children?: React.ReactNode;
}

const VARIANTS = {
  warning: { icon: AlertTriangle, iconClass: 'text-warning', buttonClass: 'bg-warning hover:bg-warning/90' },
  danger: { icon: XCircle, iconClass: 'text-danger', buttonClass: 'bg-danger hover:bg-danger/90' },
  info: { icon: Info, iconClass: 'text-info', buttonClass: 'bg-info hover:bg-info/90' },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  loadingText = 'Procesando...',
  variant = 'warning',
  loading = false,
  confirmDisabled = false,
  keepOpenOnConfirm = false,
  children,
}: ConfirmDialogProps) {
  const handleConfirm = async (event: React.MouseEvent) => {
    // AlertDialogAction cierra por defecto; se impide cuando quien llama controla el cierre.
    if (keepOpenOnConfirm) event.preventDefault();
    await onConfirm();
    if (!keepOpenOnConfirm) onOpenChange(false);
  };

  const config = VARIANTS[variant];
  const Icon = config.icon;

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (next || !loading) onOpenChange(next); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className={`rounded-full bg-muted p-2 ${config.iconClass}`}>
              <Icon className="h-5 w-5" />
            </div>
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {children && <div className="py-4">{children}</div>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading || confirmDisabled}
            className={config.buttonClass}
          >
            {loading ? loadingText : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
