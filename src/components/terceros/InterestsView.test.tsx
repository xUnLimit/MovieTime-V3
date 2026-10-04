import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationControl } from '@/types/automation-control';
import { InterestsView } from './InterestsView';

const state = vi.hoisted(() => ({ interests:[] as AutomationControl['interests'],mutate:vi.fn(),retry:vi.fn(),loading:false,failed:false,error:false }));
vi.mock('@/hooks/use-automation-control',()=>({useAutomationControl:()=>({data:{interests:state.interests},isLoading:state.loading,isError:state.failed,refetch:state.retry}),useAutomationControlActions:()=>({interest:{mutate:state.mutate,isPending:false,isError:state.error,error:new Error('private sql')}})}));
beforeEach(()=>{window.sessionStorage.clear();vi.clearAllMocks();state.interests=[{id:'i1',contactSuffix:'2001',category:'Netflix',plan:'Perfil mensual',consent:true,paused:false,state:'waiting',createdAt:'2026-10-03'},{id:'i2',contactSuffix:'2002',category:'Disney+',plan:'Plan anual',consent:false,paused:true,state:'waiting',createdAt:'2026-10-03'}];state.loading=false;state.failed=false;state.error=false;Element.prototype.hasPointerCapture=()=>false;Element.prototype.setPointerCapture=()=>undefined;Element.prototype.releasePointerCapture=()=>undefined;Element.prototype.scrollIntoView=()=>undefined;});

describe('InterestsView',()=>{
  it('avisa al contacto autorizado sin incluir su teléfono en UI',async()=>{
    render(<InterestsView />);
    const user=userEvent.setup();
    await user.click(screen.getAllByRole('button',{name:'Acciones del interés'})[0]);
    await user.click(screen.getByRole('menuitem',{name:'Avisar disponibilidad'}));
    expect(state.mutate).toHaveBeenCalledWith({id:'i1',action:'notify'},expect.any(Object));
    act(()=>state.mutate.mock.calls[0][1].onSuccess());
    expect(screen.getByRole('status').textContent).toContain('Aviso preparado');
  });
  it('impide avisar sin consentimiento, permite pausa/reactivación y confirma cancelación',async()=>{
    render(<InterestsView />);
    const user=userEvent.setup();
    await user.click(screen.getAllByRole('button',{name:'Acciones del interés'})[1]);
    expect(screen.getByRole('menuitem',{name:'Avisar disponibilidad'}).getAttribute('aria-disabled')).toBe('true');
    await user.click(screen.getByRole('menuitem',{name:'Reactivar avisos'}));
    expect(state.mutate).toHaveBeenCalledWith({id:'i2',action:'resume'},expect.any(Object));
    act(()=>state.mutate.mock.calls[0][1].onSuccess());
    await user.click(screen.getAllByRole('button',{name:'Acciones del interés'})[0]);
    await user.click(screen.getByRole('menuitem',{name:'Pausar avisos'}));
    act(()=>state.mutate.mock.calls[1][1].onSuccess());
    await user.click(screen.getAllByRole('button',{name:'Acciones del interés'})[0]);
    await user.click(screen.getByRole('menuitem',{name:'Cancelar interés'}));
    expect(state.mutate).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('button',{name:'Cancelar interés'}));
    expect(state.mutate).toHaveBeenLastCalledWith({id:'i1',action:'cancel'},expect.any(Object));
    act(()=>state.mutate.mock.calls[2][1].onSuccess());
    expect(screen.getByRole('status').textContent).toContain('cancelado');
  });
  it('conserva búsqueda tras una revisión y maneja error/vacío',async()=>{
    const {rerender}=render(<InterestsView />);
    fireEvent.change(screen.getByRole('searchbox'),{target:{value:'Netflix'}});
    expect(screen.queryByText('Plan anual')).toBeNull();
    state.failed=true;state.error=true;
    rerender(<InterestsView />);
    fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));
    expect(state.retry).toHaveBeenCalled();
    screen.getAllByRole('alert').forEach(element=>expect(element.textContent).not.toContain('private sql'));
    fireEvent.change(screen.getByRole('searchbox'),{target:{value:'Sin coincidencia'}});
    expect(screen.getByText('No hay interesados en esta vista.')).toBeTruthy();
  });
  it('filtra los permisos de aviso, las pausas y el consentimiento independientemente',async()=>{
    state.interests.push({...state.interests[0],id:'i3',plan:'Completado',state:'fulfilled'});
    state.interests.push({...state.interests[0],id:'i4',plan:'Cancelado',state:'cancelled'});
    render(<InterestsView />);
    const user=userEvent.setup();
    for(const [label,visible] of [['Con aviso autorizado','Perfil mensual'],['Pausados','Plan anual'],['Sin consentimiento','Plan anual']] as const){
      await user.click(screen.getByRole('button',{name:'Estado del interés'}));
      await user.click(screen.getByRole('menuitem',{name:label}));
      expect(screen.getByText(visible)).toBeTruthy();
      expect(screen.queryByText('Completado')).toBeNull();
      expect(screen.queryByText('Cancelado')).toBeNull();
    }
  });
});


