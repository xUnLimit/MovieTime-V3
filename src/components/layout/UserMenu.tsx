'use client';

import { LogOut, User, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/platform/utils';
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

type UserMenuProps = {
  variant?: 'header' | 'sidebar';
  collapsed?: boolean;
  isMobile?: boolean;
};

export function UserMenu({ variant = 'header', collapsed = false, isMobile = false }: UserMenuProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();

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

  const showSidebarText = variant === 'sidebar' && (isMobile || !collapsed);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'sidebar' ? (
          <button
            type="button"
            className={cn(
              "relative flex h-10 w-full items-center gap-3 overflow-hidden rounded-md pl-1",
              "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              "transition-colors duration-150"
            )}
            title={collapsed && !isMobile ? user.email : undefined}
            aria-label="Abrir menú de usuario"
          >
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span
              className="flex min-w-0 flex-1 flex-col items-start pr-2 text-left transition-opacity duration-200"
              style={{
                opacity: showSidebarText ? 1 : 0,
                pointerEvents: showSidebarText ? 'auto' : 'none',
              }}
            >
              <span className="w-full truncate text-xs font-medium leading-4">{user.email}</span>
              <span className="text-xs leading-4 text-muted-foreground">
                {user.role === 'admin' ? 'Administrador' : 'Operador'}
              </span>
            </span>
          </button>
        ) : (
          <Button variant="ghost" className="relative h-9 w-9 rounded-full">
            <Avatar className="h-9 w-9">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56"
        side={variant === 'sidebar' ? 'right' : 'bottom'}
        align={variant === 'sidebar' ? 'end' : 'end'}
        forceMount
      >
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
          <DropdownMenuItem onSelect={() => router.push('/configuracion')}>
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
  );
}
