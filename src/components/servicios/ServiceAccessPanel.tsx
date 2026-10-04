'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Panel } from '@/components/shared/Panel';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useAutomationControl, useAutomationControlActions } from '@/hooks/use-automation-control';
import { getPublicErrorMessage } from '@/platform/errors/public-errors';
import { useAuthStore } from '@/store/authStore';
import type { AutomationControl } from '@/types/automation-control';

function AccessForm({ current, clients }: { current: AutomationControl['access'][number]; clients: number }) {
  const [code, setCode] = useState(current.mode === 'code');
  const [rotation, setRotation] = useState(false);
  const { access } = useAutomationControlActions();
  const changed = code !== (current.mode === 'code');
  return <div className="space-y-3"><div className="flex items-center justify-between gap-3"><Label htmlFor={`access-code-${current.serviceId}`}>Entregar acceso por código</Label><Switch id={`access-code-${current.serviceId}`} checked={code} disabled={access.isPending} onCheckedChange={setCode} /></div><p className="text-sm text-muted-foreground">{code ? `Los ${clients} clientes vigentes y las ventas futuras reciben correo/perfil y Solicitar código. Los envíos automáticos no incluyen la contraseña.` : 'Los envíos de acceso pueden incluir la contraseña mediante la política autorizada del servidor.'}</p>{changed && code ? <><p className="text-sm text-warning">Cambiar el modo no revoca una contraseña conocida. Rótala y comunica el cambio antes de activar el acceso por código.</p><div className="flex items-start gap-2"><Checkbox id={`rotation-${current.serviceId}`} checked={rotation} onCheckedChange={checked => setRotation(checked === true)} /><Label htmlFor={`rotation-${current.serviceId}`} className="leading-5">Confirmo que roté la contraseña y comuniqué el cambio a los clientes.</Label></div></> : null}<Button variant="outline" disabled={!changed || access.isPending || (code && !rotation)} onClick={() => access.mutate({ serviceId: current.serviceId, mode: code ? 'code' : 'password', rotationConfirmed: rotation })}>{access.isPending ? 'Guardando…' : 'Guardar modo de acceso'}</Button>{access.isError ? <p role="alert" className="text-sm text-danger">{getPublicErrorMessage(access.error, 'No se pudo cambiar el modo. Revisa la cuenta y reintenta.')}</p> : null}{access.isSuccess ? <p role="status" className="text-sm text-success">Modo de acceso actualizado.</p> : null}</div>;
}

export function ServiceAccessPanel({ serviceId, clients }: { serviceId: string; clients: number }) {
  const query = useAutomationControl();
  const admin = useAuthStore(state => state.user?.role === 'admin');
  const current = query.data?.access.find(item => item.serviceId === serviceId);
  if (!admin) return null;
  if (query.isLoading) return <Skeleton className="h-32 w-full" />;
  if (query.isError) return <Panel title="Acceso de clientes"><p role="alert" className="text-sm text-danger">No se pudo comprobar el modo de acceso.</p><Button variant="outline" onClick={() => void query.refetch()}>Reintentar</Button></Panel>;
  if (!current) return null;
  return <Panel title="Acceso de clientes" description="Netflix · el modo pertenece a esta cuenta y se adopta al transferir una venta." actions={<StatusBadge tone={current.mode === 'code' ? 'info' : 'neutral'}>{current.mode === 'code' ? 'Por código' : 'Por contraseña'}</StatusBadge>} footer={<Button variant="ghost" size="sm" asChild><Link href="/configuracion/automatizacion">Ver capacidades de acceso</Link></Button>}><AccessForm key={`${current.serviceId}:${current.mode}`} current={current} clients={clients} /></Panel>;
}
