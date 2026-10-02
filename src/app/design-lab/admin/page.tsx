import { notFound } from 'next/navigation';
import { AdminPreview } from './AdminPreview';
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <AdminPreview />;
}
