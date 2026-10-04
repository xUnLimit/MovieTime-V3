import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutomationControl, useAutomationControlActions } from './use-automation-control';
import { useConversationControl } from './use-conversation-control';
import { usePedidoActions, usePedidos } from './use-pedidos';

const state=vi.hoisted(()=>({admin:true,fetchControl:vi.fn(),settings:vi.fn(),access:vi.fn(),interest:vi.fn(),getConversation:vi.fn(),setConversation:vi.fn(),resolveReview:vi.fn(),list:vi.fn(),retry:vi.fn(),cancel:vi.fn(),reconcile:vi.fn(),delivery:vi.fn(),excess:vi.fn()}));
vi.mock('@/store/authStore',()=>({useAuthStore:(selector:(value:{user:{role:string}})=>unknown)=>selector({user:{role:state.admin?'admin':'vendedor'}})}));
vi.mock('@/application/use-cases/automation-control-use-cases',()=>({fetchAutomationControlUseCase:state.fetchControl,updateAutomationSettingsUseCase:state.settings,updateServiceAccessUseCase:state.access,updateInterestUseCase:state.interest}));
vi.mock('@/application/use-cases/whatsapp-conversation-use-cases',()=>({getConversationControlUseCase:state.getConversation,setConversationControlUseCase:state.setConversation,resolveConversationReviewUseCase:state.resolveReview}));
vi.mock('@/application/use-cases/pedidos-use-cases',()=>({listPedidosUseCase:state.list,retryPedidoUseCase:state.retry,cancelPedidoUseCase:state.cancel,reconcilePedidoUseCase:state.reconcile,resolvePedidoExcessUseCase:state.excess}));
vi.mock('@/application/use-cases/pedido-delivery-use-cases',()=>({requestPedidoDeliveryRetryUseCase:state.delivery}));
function wrapper(){const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});return {client,Wrapper:({children}:{children:ReactNode})=><QueryClientProvider client={client}>{children}</QueryClientProvider>};}
beforeEach(()=>{vi.clearAllMocks();state.admin=true;state.fetchControl.mockResolvedValue({settings:{}});state.settings.mockResolvedValue('ok');state.access.mockResolvedValue('ok');state.interest.mockResolvedValue('ok');state.getConversation.mockResolvedValue({waId:'50760000001',mode:'bot',version:1});state.setConversation.mockResolvedValue({waId:'50760000001',mode:'human',version:2});state.list.mockResolvedValue([]);state.retry.mockResolvedValue('order');state.cancel.mockResolvedValue('order');state.reconcile.mockResolvedValue('order');state.delivery.mockResolvedValue({processed:1,failed:0});});

describe('automation hooks',()=>{
  it('reads admin controls and invalidates configuration after each command',async()=>{
    const {client,Wrapper}=wrapper();
    const invalidate=vi.spyOn(client,'invalidateQueries');
    const query=renderHook(()=>useAutomationControl(),{wrapper:Wrapper});
    await waitFor(()=>expect(query.result.current.isSuccess).toBe(true));
    const actions=renderHook(()=>useAutomationControlActions(),{wrapper:Wrapper});
    await act(async()=>{await actions.result.current.save.mutateAsync({reservationMinutes:15,maxReservations:1,integrationsEnabled:false});await actions.result.current.access.mutateAsync({serviceId:'s1',mode:'code',rotationConfirmed:true});await actions.result.current.interest.mutateAsync({id:'i1',action:'pause'});});
    expect(state.settings).toHaveBeenCalled();expect(state.access).toHaveBeenCalled();expect(state.interest).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledTimes(3);
    query.unmount();client.clear();
  });
  it('does not fetch controls or orders for non administrators',()=>{
    state.admin=false;const {Wrapper}=wrapper();renderHook(()=>useAutomationControl(),{wrapper:Wrapper});renderHook(()=>usePedidos(),{wrapper:Wrapper});expect(state.fetchControl).not.toHaveBeenCalled();expect(state.list).not.toHaveBeenCalled();
  });
  it('keeps the server version on takeover and refreshes conflicts',async()=>{
    const {client,Wrapper}=wrapper();const hook=renderHook(()=>useConversationControl('50760000001'),{wrapper:Wrapper});
    await waitFor(()=>expect(hook.result.current.query.isSuccess).toBe(true));
    await act(async()=>{await hook.result.current.change.mutateAsync({mode:'human',version:1});});
    expect(state.setConversation).toHaveBeenCalledWith({waId:'50760000001',mode:'human',version:1});
    await waitFor(()=>expect(hook.result.current.query.data).toMatchObject({mode:'human',version:2}));
    state.setConversation.mockRejectedValueOnce(new Error('version conflict'));
    const invalidate=vi.spyOn(client,'invalidateQueries');
    await act(async()=>{await expect(hook.result.current.change.mutateAsync({mode:'bot',version:1})).rejects.toThrow('version conflict');});
    expect(invalidate).toHaveBeenCalledWith({queryKey:['conversation-control','50760000001']});
    hook.unmount();client.clear();
  });
  it('reuses a failed financial attempt key and renews only after success',async()=>{
    const {client,Wrapper}=wrapper();const actions=renderHook(()=>usePedidoActions(),{wrapper:Wrapper});
    state.reconcile.mockRejectedValueOnce(new Error('network lost'));
    await act(async()=>{await expect(actions.result.current.reconcile.mutateAsync({id:'order-1',code:'REF-1'})).rejects.toThrow('network lost');});
    await act(async()=>{await actions.result.current.reconcile.mutateAsync({id:'order-1',code:'REF-1'});});
    expect(state.reconcile.mock.calls[0][2]).toBe(state.reconcile.mock.calls[1][2]);
    await act(async()=>{await actions.result.current.reconcile.mutateAsync({id:'order-1',code:'REF-1'});await actions.result.current.retry.mutateAsync('order-1');await actions.result.current.cancel.mutateAsync('order-2');await actions.result.current.delivery.mutateAsync('order-1');});
    expect(state.reconcile.mock.calls[2][2]).not.toBe(state.reconcile.mock.calls[0][2]);
    expect(state.retry).toHaveBeenCalledWith('order-1',expect.any(String));expect(state.cancel).toHaveBeenCalledWith('order-2',expect.any(String));
    client.clear();
  });
  it('only loads contextual orders on demand',async()=>{
    const {client,Wrapper}=wrapper();const hook=renderHook(({enabled})=>usePedidos(enabled),{initialProps:{enabled:false},wrapper:Wrapper});
    expect(state.list).not.toHaveBeenCalled();hook.rerender({enabled:true});await waitFor(()=>expect(hook.result.current.isSuccess).toBe(true));hook.unmount();client.clear();
  });
  it('uses one idempotency key for a retried excess resolution and refreshes its balance',async()=>{
    const {client,Wrapper}=wrapper();const hook=renderHook(()=>usePedidoActions(),{wrapper:Wrapper});
    const input={id:'order-1',action:'credito' as const,reference:'LEDGER-01',amount:2};
    state.excess.mockRejectedValueOnce(new Error('network lost')).mockResolvedValue('order-1');
    const invalidate=vi.spyOn(client,'invalidateQueries');
    await act(async()=>{await expect(hook.result.current.excess.mutateAsync(input)).rejects.toThrow('network lost');});
    await act(async()=>{await hook.result.current.excess.mutateAsync(input);});
    expect(state.excess.mock.calls[0][4]).toBe(state.excess.mock.calls[1][4]);
    expect(state.excess).toHaveBeenCalledWith('order-1','credito','LEDGER-01',2,expect.any(String));
    expect(invalidate).toHaveBeenCalledWith({queryKey:['pedidos']});hook.unmount();client.clear();
  });
  it('resolves a manual review using the server version and refreshes a rejected review',async()=>{
    const {client,Wrapper}=wrapper();
    const hook=renderHook(()=>useConversationControl('50760000001'),{wrapper:Wrapper});
    await waitFor(()=>expect(hook.result.current.query.isSuccess).toBe(true));
    state.resolveReview.mockResolvedValueOnce({waId:'50760000001',mode:'human',version:3});
    await act(async()=>{await hook.result.current.resolve.mutateAsync(2);});
    expect(state.resolveReview).toHaveBeenCalledWith('50760000001',2);
    await waitFor(()=>expect(hook.result.current.query.data).toMatchObject({mode:'human',version:3}));
    state.resolveReview.mockRejectedValueOnce(new Error('review changed'));
    const invalidate=vi.spyOn(client,'invalidateQueries');
    await act(async()=>{await expect(hook.result.current.resolve.mutateAsync(2)).rejects.toThrow('review changed');});
    expect(invalidate).toHaveBeenCalledWith({queryKey:['conversation-control','50760000001']});
    hook.unmount();client.clear();
  });
});



