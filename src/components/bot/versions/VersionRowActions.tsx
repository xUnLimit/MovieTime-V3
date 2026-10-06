import { FileDiff, GitCompare, MoreHorizontal, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { BotVersionSummary } from '@/types/bot';

type VersionRowActionsProps = {
  version: BotVersionSummary;
  onChanges: () => void;
  onCompareWithPublished: () => void;
  onLoad: () => void;
};

/** Menú de una fila del historial: ver qué cambió, compararla con lo publicado o llevarla al borrador. */
export function VersionRowActions({ version, onChanges, onCompareWithPublished, onLoad }: VersionRowActionsProps) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Acciones de la versión ${version.version}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={onChanges}><FileDiff />Ver qué cambió</DropdownMenuItem>
      {version.isPublished ? null : <DropdownMenuItem onSelect={onCompareWithPublished}><GitCompare />Comparar con la publicada</DropdownMenuItem>}
      <DropdownMenuItem onSelect={onLoad}><Undo2 />Cargar en el borrador</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
