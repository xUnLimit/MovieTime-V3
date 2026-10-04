import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutomationWorkspace } from './AutomationWorkspace';

const state=vi.hoisted(()=>({params:new URLSearchParams(),admin:true,loading:false,error:false,enabled:true,health:true,retry:vi.fn()}));
vi.mock('next/navigation',()=>({useSearchParams:()=>state.params,usePathname:()=>'/automatizaciones'}));
vi.mock('@/store/authStore',()=>({useAuthStore:(selector:(value:{user:{role:string}})=>unknown)=>selector({user:{role:state.admin?'admin':'vendedor'}})}));
vi.mock('@/hooks/use-bot-admin',()=>({useBotAdmin:()=>({status:{enabled:state.enabled},health:state.health?{eventsLast24h:2}:null})}));
vi.mock('@/hooks/use-templates',()=>({useTemplates:()=>({data:[],isLoading:state.loading,isError:state.error,refetch:state.retry})}));
vi.mock('@/components/editor-mensajes/TemplateEditor',()=>({TemplateEditor:({focused,onTemplateSaved}:{focused:boolean;onTemplateSaved:()=>Promise<void>})=><div><p>{focused?'Mensaje del recorrido':'Biblioteca completa'}</p><button onClick={()=>void onTemplateSaved()}>Guardar mensaje de prueba</button></div>}));
vi.mock('@/components/editor-mensajes/SyncMetaButton',()=>({SyncMetaButton:()=>null}));
vi.mock('./BotView',()=>({BotView:()=> <p>Editor del recorrido</p>}));
vi.mock('./AutomationsTab',()=>({AutomationsTab:()=> <p>Lista de recorridos comerciales</p>}));
vi.mock('./AutomationOperationsSummary',()=>({AutomationOperationsSummary:()=> <p>Resumen operativo</p>}));
beforeEach(()=>{vi.clearAllMocks();state.params=new URLSearchParams();state.admin=true;state.loading=false;state.error=false;state.enabled=true;state.health=true;state.retry.mockResolvedValue({});});

describe('AutomationWorkspace',()=>{
  it('abre en recorridos breves; biblioteca y conexiones viven en el menú lateral',()=>{
    const {rerender}=render(<AutomationWorkspace />);
    expect(screen.getByRole('heading',{name:'Automatizaciones'})).toBeTruthy();
    expect(screen.queryByRole('link',{name:'Biblioteca de mensajes'})).toBeNull();
    expect(screen.queryByRole('link',{name:'Conexiones y capacidades'})).toBeNull();
    expect(screen.getByRole('link',{name:'Editar recorrido'}).getAttribute('href')).toBe('/automatizaciones?editar=whatsapp');
    expect(screen.getByText('Activo')).toBeTruthy();
    state.enabled=false;state.health=false;rerender(<AutomationWorkspace />);
    expect(screen.getByText('Pausado')).toBeTruthy();
  });
  it('edita mensaje sin salir del recorrido y comunica uso compartido',()=>{
    state.params=new URLSearchParams('mensaje=dia_pago');render(<AutomationWorkspace />);
    expect(screen.getByText('Mensaje del recorrido')).toBeTruthy();
    expect(screen.getByText(/actualiza todos sus envíos/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Guardar mensaje de prueba'}));
    expect(state.retry).toHaveBeenCalled();
    expect(screen.getByRole('link',{name:'Volver a automatizaciones'})).toBeTruthy();
  });
  it('permite biblioteca, editor y recuperación de error; limita por rol',()=>{
    state.params=new URLSearchParams('vista=mensajes');const {rerender}=render(<AutomationWorkspace />);
    expect(screen.getByText('Biblioteca completa')).toBeTruthy();
    rerender(<AutomationWorkspace view="mensajes" />);expect(screen.getByText('Biblioteca completa')).toBeTruthy();
    state.params=new URLSearchParams('editar=whatsapp');rerender(<AutomationWorkspace />);
    expect(screen.getByText('Editor del recorrido')).toBeTruthy();
    state.params=new URLSearchParams('mensaje=unknown');state.loading=true;rerender(<AutomationWorkspace />);
    state.loading=false;state.error=true;rerender(<AutomationWorkspace />);
    fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));expect(state.retry).toHaveBeenCalled();
    state.admin=false;rerender(<AutomationWorkspace />);
    expect(screen.getByText(/solo para administradores/)).toBeTruthy();
  });
});
