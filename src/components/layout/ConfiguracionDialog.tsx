'use client';

import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useDashboardStore } from '@/store/dashboardStore';
import { useDashboardFilterStore } from '@/store/dashboardFilterStore';

interface ConfiguracionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConfiguracionDialog({ open, onOpenChange }: ConfiguracionDialogProps) {
  const { stats } = useDashboardStore();
  const { selectedYear, setSelectedYear } = useDashboardFilterStore();

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearsFromData = new Set<number>();

    (stats?.ingresosPorMes ?? []).forEach(({ mes }) => {
      const year = parseInt(mes.split('-')[0], 10);
      if (!isNaN(year) && year <= currentYear) {
        yearsFromData.add(year);
      }
    });

    // Always include the current year even if there's no data yet
    yearsFromData.add(currentYear);

    return Array.from(yearsFromData).sort((a, b) => b - a);
  }, [stats?.ingresosPorMes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Configuración</DialogTitle>
          <DialogDescription>
            Ajusta cómo se visualizan los datos en el dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Vista del Dashboard</Label>
            <Select
              value={String(selectedYear)}
              onValueChange={(val) => setSelectedYear(parseInt(val, 10))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar año" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year === new Date().getFullYear() ? `${year} (actual)` : String(year)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Los widgets mostrarán ingresos y gastos acumulados desde enero de{' '}
              {selectedYear} hasta hoy.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
