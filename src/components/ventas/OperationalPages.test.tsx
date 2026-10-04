import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PedidosPage from '@/app/(dashboard)/ventas/pedidos/page';
import CobrosPage from '@/app/(dashboard)/ventas/cobros/page';
import InteresadosPage from '@/app/(dashboard)/terceros/interesados/page';
import ConfigurationPage from '@/app/(dashboard)/configuracion/automatizacion/page';
import AutomatizacionesPage from '@/app/(dashboard)/automatizaciones/page';
import { VentasNavigation } from './VentasNavigation';

const state=vi.hoisted(()=>({admin:true,route:'/ventas/pedidos',loading:false,error:false,hasData:true,retry:vi.fn()}));
vi.mock('next/navigation',()=>({usePathname:()=>state.route}));
vi.mock('@/store/authStore',()=>({useAuthStore:(selector:(value:{user:{role:string}})=>unknown)=>selector({user:{role:state.admin?'admin':'vendedor'}})}));
vi.mock('@/hooks/use-automation-control',()=>({useAutomationControl:()=>({data:state.hasData?{}:null,isLoading:state.loading,isError:state.error,refetch:state.retry})}));
vi.mock('@/components/configuracion/AutomationSettingsForm',()=>({AutomationSettingsForm:()=> <p>Formulario de configuración</p>}));
vi.mock('@/components/terceros/InterestsView',()=>({InterestsView:()=> <p>Demanda de clientes</p>}));
vi.mock('@/components/yappy/YappyPaymentsView',()=>({YappyPaymentsView:()=> <p>Revisión de cobros</p>}));
vi.mock('@/components/bot/AutomationWorkspace',()=>({AutomationWorkspace:()=> <p>Recorridos de atención</p>}));
vi.mock('./PedidosView',()=>({PedidosView:()=> <p>Pedidos operativos</p>}));
beforeEach(()=>{vi.clearAllMocks();state.admin=true;state.route='/ventas/pedidos';state.loading=false;state.error=false;state.hasData=true;});

describe('páginas operativas',()=>{
  it('navega entre vistas hermanas y conserva acceso a suscripciones por rol',()=>{
    const {rerender}=render(<VentasNavigation />);
    expect(screen.getByRole('link',{name:'Pedidos'}).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link',{name:'Cobros'}).getAttribute('href')).toBe('/ventas/cobros');
    state.admin=false;rerender(<VentasNavigation />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
  it.each([PedidosPage,InteresadosPage,ConfigurationPage])('respeta permiso de administrador',Page=>{
    const {rerender}=render(<Page />);
    expect(screen.queryByText(/solo para administradores/)).toBeNull();
    state.admin=false;rerender(<Page />);
    expect(screen.getByText(/solo para administradores/)).toBeTruthy();
  });
  it('configuración maneja carga, error y ausencia de datos',()=>{
    state.loading=true;const {rerender,container}=render(<ConfigurationPage />);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
    state.loading=false;state.error=true;rerender(<ConfigurationPage />);
    fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));expect(state.retry).toHaveBeenCalled();
    state.error=false;state.hasData=false;rerender(<ConfigurationPage />);
    expect(screen.queryByText('Formulario de configuración')).toBeNull();
  });
  it('conserva contenido de cobros y monta automatizaciones protegidas',()=>{
    const {unmount}=render(<CobrosPage />);expect(screen.getByText('Revisión de cobros')).toBeTruthy();unmount();
    render(<AutomatizacionesPage />);expect(screen.getByText('Recorridos de atención')).toBeTruthy();
  });
});
