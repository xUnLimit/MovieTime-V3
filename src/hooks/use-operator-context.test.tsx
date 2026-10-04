import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTableContext } from './use-table-context';
import { useUnsavedNavigation } from './use-unsaved-navigation';

const error=vi.hoisted(()=>vi.fn());
vi.mock('@/platform/observability/logger',()=>({reportError:error}));
beforeEach(()=>{window.sessionStorage.clear();vi.clearAllMocks();});

describe('table context',()=>{
  it('restaura únicamente filtros/selección válidos y conserva cambios',()=>{
    const hook=renderHook(()=>useTableContext('test'));
    act(()=>{hook.result.current.setFilter('payment');hook.result.current.setSearch('Netflix');hook.result.current.setSelection('order-1');});
    hook.unmount();
    const restored=renderHook(()=>useTableContext('test'));
    expect(restored.result.current).toMatchObject({filter:'payment',search:'Netflix',selection:'order-1'});
    restored.unmount();
    window.sessionStorage.setItem('movietime:table:test','{"filter":true}');
    expect(renderHook(()=>useTableContext('test')).result.current.filter).toBe('all');
  });
  it('recupera JSON inválido y fallos de almacenamiento sin bloquear la lista',()=>{
    window.sessionStorage.setItem('movietime:table:test','invalid');
    const first=renderHook(()=>useTableContext('test'));
    expect(first.result.current.search).toBe('');
    expect(error).toHaveBeenCalled();
    first.unmount();
    const write=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('storage blocked');});
    renderHook(()=>useTableContext('new'));
    expect(error).toHaveBeenCalledTimes(2);
    write.mockRestore();
  });
});

describe('unsaved navigation',()=>{
  it('protege query changes y cierre; permite misma ruta exacta, cancelación y aprobación',()=>{
    const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);
    const hook=renderHook(()=>useUnsavedNavigation(true));
    const close=new Event('beforeunload',{cancelable:true});
    window.dispatchEvent(close);
    expect(close.defaultPrevented).toBe(true);
    const anchor=document.createElement('a');anchor.href='/automatizaciones?mensaje=renovacion';document.body.append(anchor);
    const click=new MouseEvent('click',{bubbles:true,cancelable:true});anchor.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    confirm.mockReturnValue(true);
    const allowed=new MouseEvent('click',{bubbles:true,cancelable:true});anchor.dispatchEvent(allowed);
    expect(allowed.defaultPrevented).toBe(false);
    anchor.href=window.location.href;anchor.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
    anchor.href='mailto:test@example.com';anchor.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
    expect(confirm).toHaveBeenCalledTimes(2);
    anchor.remove();hook.unmount();confirm.mockRestore();
  });
  it('sin borrador no intercepta el cierre',()=>{
    renderHook(()=>useUnsavedNavigation(false));
    const close=new Event('beforeunload',{cancelable:true});window.dispatchEvent(close);
    expect(close.defaultPrevented).toBe(false);
  });
});
