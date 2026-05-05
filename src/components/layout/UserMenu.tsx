'use client';

import { useState } from 'react';
import { LogOut, User, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ConfiguracionDialog } from './ConfiguracionDialog';

export function UserMenu() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [configuracionOpen, setConfiguracionOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!user) return null;

  const initials = user.displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full">
            <Avatar className="h-9 w-9">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.email}</p>
              <Badge variant="secondary" className="w-fit mt-1">
                {user.role === 'admin' ? 'Administrador' : 'Operador'}
              </Badge>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <User className="mr-2 h-4 w-4" />
            <span>Perfil</span>
          </DropdownMenuItem>
          
          {user.role === 'admin' && (
            <DropdownMenuItem onSelect={() => setConfiguracionOpen(true)}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Configuración</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Cerrar sesión</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {user.role === 'admin' && (
        <ConfiguracionDialog
          open={configuracionOpen}
          onOpenChange={setConfiguracionOpen}
        />
      )}
    </>
  );
}
