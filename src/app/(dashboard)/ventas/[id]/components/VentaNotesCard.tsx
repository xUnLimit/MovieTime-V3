import { Card } from '@/components/ui/card';

interface VentaNotesCardProps {
  notas?: string;
}

export function VentaNotesCard({ notas }: VentaNotesCardProps) {
  return (
    <Card className="p-6 space-y-3">
      <h2 className="text-lg font-semibold">Notas</h2>
      <div className="rounded-lg border bg-muted/20 p-4 text-sm whitespace-pre-line">
        {notas?.trim() ? notas : 'Sin notas'}
      </div>
    </Card>
  );
}
