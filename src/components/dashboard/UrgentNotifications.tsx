'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Notificacion } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, AlertCircle } from 'lucide-react';

interface UrgentNotificationsProps {
  notificaciones: Notificacion[];
}

const priorityColors: Record<string, string> = {
  '100_dias': 'bg-red-600 text-white',
  '11_dias': 'bg-red-500 text-white',
  '8_dias': 'bg-orange-500 text-white',
  '7_dias': 'bg-orange-400 text-orange-900',
  '3_dias': 'bg-yellow-500 text-yellow-900',
  '2_dias': 'bg-yellow-400 text-yellow-900',
  '1_dia': 'bg-yellow-300 text-yellow-900',
  vencido: 'bg-red-700 text-white',
};

const priorityLabels: Record<string, string> = {
  '100_dias': '100 días',
  '11_dias': '11 días',
  '8_dias': '8 días',
  '7_dias': '7 días',
  '3_dias': '3 días',
  '2_dias': '2 días',
  '1_dia': '1 día',
  vencido: 'Vencido',
};

export function UrgentNotifications({ notificaciones }: UrgentNotificationsProps) {
  // Filtrar notificaciones urgentes no leídas
  const urgentNotifications = notificaciones
    .filter((n) => !n.leida && ['100_dias', '11_dias', '8_dias', 'vencido'].includes(n.prioridad))
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          Notificaciones Urgentes
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/notificaciones">
            Ver todas
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {urgentNotifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay notificaciones urgentes
            </p>
          ) : (
            urgentNotifications.map((notif) => (
              <div
                key={notif.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div
                  className={`h-2 w-2 rounded-full mt-2 ${priorityColors[notif.prioridad]}`}
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{notif.titulo}</p>
                    <Badge
                      variant="outline"
                      className={`${priorityColors[notif.prioridad]} border-none`}
                    >
                      {priorityLabels[notif.prioridad]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {notif.titulo}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
