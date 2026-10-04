import { StatusBadge } from '@/components/shared/StatusBadge';
import type { BotIssue } from '@/types/bot';

/** Problemas de un nodo: el estado se dice con texto y punto, no solo con color. */
export function IssueList({ issues, label }: { issues: readonly BotIssue[]; label: string }) {
  if (issues.length === 0) return null;
  return <ul aria-label={label} className="space-y-1 px-3 py-2">
    {issues.map((issue, index) => <li key={`${issue.path}-${index}`} className="flex items-start gap-1.5 text-xs">
      <StatusBadge tone={issue.severity === 'error' ? 'danger' : 'warning'} className="shrink-0">{issue.severity === 'error' ? 'Error' : 'Aviso'}</StatusBadge>
      <span className="min-w-0 flex-1 text-foreground">{issue.message}</span>
    </li>)}
  </ul>;
}
