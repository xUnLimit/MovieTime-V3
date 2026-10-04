import { notFound } from 'next/navigation';
import { AutomationJourneysPreview } from './AutomationJourneysPreview';

export const metadata = { title: 'Recorridos · MovieTime PTY', robots: { index: false, follow: false } };

export default function AutomationJourneysPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <AutomationJourneysPreview />;
}
