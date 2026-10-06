import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pedido } from '@/modules/orders/contracts';
import { PedidosView } from './PedidosView';

const state=vi.hoisted(()=>({rows:[] as Pedido[],failed:false,loading:false,retry:vi.fn()}));
vi.mock('@/hooks/use-terceros',()=>({useTerceros:()=>({data:[{id:'t1',nombre:'Ana',apellido:'Pérez'}]})}));
vi.mock('@/hooks/use-pedidos',()=>({usePedidos:()=>({data:state.rows,isLoading:state.loading,isError:state.failed,refetch:state.retry}),usePedidoActions:()=>({retry:{mutate:vi.fn(),isPending:false,error:null},cancel:{mutate:vi.fn(),isPending:false,error:null},remove:{mutate:vi.fn(),isPending:false,error:null}})}));
vi.mock('./PedidoReview',async importOriginal=>({...(await importOriginal<typeof import('./PedidoReview')>()),PedidoReview:()=> <p>Detalle del pedido seleccionado</p>}));
beforeEach(()=>{window.sessionStorage.clear();vi.clearAllMocks();state.failed=false;state.loading=false;state.rows=Array.from({length:4},(_,index)=>({id:`order-${index}`,terceroId:null,contactId:null,moneda:'USD',total:12,estado:'confirmado',paymentState:index===0?'parcial':index===1?'exceso':index===2?'pendiente':'cubierto',deliveryState:index===0?'pendiente':index===1?'asignado':'enviado',receivedAmount:index===2?0:12,missingAmount:index===0||index===2?4:0,excessAmount:index===1?2:0,expiraAt:'2026-10-03',items:[{id:`item-${index}`,tipo:'nueva',servicioId:'s1',ventaId:null,planNombre:`Plan ${index}`,total:12,estado:'pendiente',ventaIdResultante:null}]}));Element.prototype.hasPointerCapture=()=>false;Element.prototype.setPointerCapture=()=>undefined;Element.prototype.releasePointerCapture=()=>undefined;Element.prototype.scrollIntoView=()=>undefined;});

describe('PedidosView',()=>{
  it('muestra dinero y estados independientes; conserva búsqueda y selección al volver',async()=>{
    const {unmount}=render(<PedidosView />);
    expect(screen.getByRole('heading',{name:'Pedidos de clientes'})).toBeTruthy();
    expect(screen.getByText('Exceso')).toBeTruthy();
    expect(screen.getByText('Asignado')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox'),{target:{value:'Plan 0'}});
    await userEvent.setup().click(screen.getByRole('button',{name:'Acciones del pedido'}));
    await userEvent.setup().click(screen.getByRole('menuitem',{name:'Revisar pedido'}));
    expect(screen.getByText('Detalle del pedido seleccionado')).toBeTruthy();
    unmount();
    render(<PedidosView />);
    expect(screen.getByRole('searchbox', { hidden: true })).toHaveProperty('value','Plan 0');
    expect(screen.getByText('Detalle del pedido seleccionado')).toBeTruthy();
    await userEvent.setup().keyboard('{Escape}');
    expect(screen.queryByText('Detalle del pedido seleccionado')).toBeNull();
  });
  it('filtra cobro, entrega y completados como vistas de la misma lista',async()=>{
    render(<PedidosView />);
    const user=userEvent.setup();
    for(const [filter,count] of [['Cobro pendiente',2],['Entrega pendiente',2],['Completados',2],['Todos',4]] as const){
      await user.click(screen.getByRole('button',{name:'Estado del pedido'}));
      await user.click(screen.getByRole('menuitem',{name:filter}));
      expect(screen.getAllByRole('button',{name:'Acciones del pedido'})).toHaveLength(count);
    }
  });
  it('permite reintentar, vacío y carga',()=>{
    state.failed=true;
    const {rerender}=render(<PedidosView />);
    fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));
    expect(state.retry).toHaveBeenCalled();
    state.failed=false;state.rows=[];
    rerender(<PedidosView />);
    expect(screen.getByText('No hay pedidos en esta vista.')).toBeTruthy();
    state.loading=true;
    rerender(<PedidosView />);
    expect(screen.getByText('Cargando datos…')).toBeTruthy();
  });
  it('muestra cliente y etapa, busca por cliente o teléfono y filtra por revisar y cancelados',async()=>{
    state.rows=[
      {...state.rows[0],id:'a0000000-0000-4000-8000-000000000001',terceroId:'t1',contactId:'50761112222',estado:'esperando_pago',items:[{...state.rows[0].items[0],planNombre:'Netflix'}]},
      {...state.rows[1],id:'b0000000-0000-4000-8000-000000000002',contactId:'50763334444',estado:'cancelado',receivedAmount:0,excessAmount:0,items:[{...state.rows[1].items[0],planNombre:'Disney'}]},
      {...state.rows[2],id:'c0000000-0000-4000-8000-000000000003',estado:'pagado',excessAmount:3,items:[{...state.rows[2].items[0],planNombre:'Max'}]},
    ];
    render(<PedidosView />);
    const user=userEvent.setup();
    expect(screen.getByText('Ana Pérez')).toBeTruthy();
    expect(screen.getByText('+50761112222')).toBeTruthy();
    expect(screen.getByText('+50763334444')).toBeTruthy();
    expect(screen.getByText('Reservado')).toBeTruthy();
    expect(screen.getByText('Cancelado')).toBeTruthy();
    expect(screen.getByText('Sin cobro')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox'),{target:{value:'ana'}});
    expect(screen.getAllByRole('button',{name:'Acciones del pedido'})).toHaveLength(1);
    fireEvent.change(screen.getByRole('searchbox'),{target:{value:'63334444'}});
    expect(screen.getAllByRole('button',{name:'Acciones del pedido'})).toHaveLength(1);
    fireEvent.change(screen.getByRole('searchbox'),{target:{value:''}});
    for(const [filter,count] of [['Por revisar',1],['Cancelados y vencidos',1],['Cobro pendiente',2],['Todos',3]] as const){
      await user.click(screen.getByRole('button',{name:'Estado del pedido'}));
      await user.click(screen.getByRole('menuitem',{name:filter}));
      expect(screen.getAllByRole('button',{name:'Acciones del pedido'})).toHaveLength(count);
    }
  });
});
