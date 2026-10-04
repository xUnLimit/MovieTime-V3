'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { InterestsView } from '@/components/terceros/InterestsView';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';

export default function InteresadosPage() {
  const admin = useAuthStore(state => state.user?.role === 'admin');
  if (!admin) return <p className="text-sm text-muted-foreground">Esta sección está disponible solo para administradores.</p>;
  return <div className="space-y-4"><Button variant="ghost" asChild><Link href="/terceros"><ArrowLeft />Volver a terceros</Link></Button><PageHeader title="Interesados" description="Consulta la demanda y gestiona avisos cuando vuelve la disponibilidad." /><InterestsView /></div>;
}
