import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface PagerControlsProps {
  /** Indice actual (base 0). */
  index: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  previousDisabled: boolean;
  nextDisabled: boolean;
  previousLabel?: string;
  nextLabel?: string;
}

/** Paginador compacto "1/3 ‹ ›" para widgets que alternan vistas o bloques. */
export function PagerControls({
  index,
  total,
  onPrevious,
  onNext,
  previousDisabled,
  nextDisabled,
  previousLabel = 'Vista anterior',
  nextLabel = 'Vista siguiente',
}: PagerControlsProps) {
  return (
    <div className="flex items-center gap-0.5">
      {total > 1 ? (
        <span className="px-1 text-xs text-muted-foreground tabular-nums" aria-live="polite">
          {index + 1}/{total}
        </span>
      ) : null}
      <Button type="button" size="icon" variant="ghost" onClick={onPrevious} disabled={previousDisabled} aria-label={previousLabel}>
        <ChevronLeft />
      </Button>
      <Button type="button" size="icon" variant="ghost" onClick={onNext} disabled={nextDisabled} aria-label={nextLabel}>
        <ChevronRight />
      </Button>
    </div>
  );
}
