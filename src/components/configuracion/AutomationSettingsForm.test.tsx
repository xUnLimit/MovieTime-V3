import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationControl, AutomationIntent } from '@/types/automation-control';
import { AutomationSettingsForm } from './AutomationSettingsForm';

const state = vi.hoisted(() => ({ save: vi.fn(), simulate: vi.fn(), reset: vi.fn(), saveError: false, saved: false, simError: false, simSuccess: false, intent: null as AutomationIntent | null }));
vi.mock('@/hooks/use-automation-control', () => ({ useAutomationControlActions: () => ({ save: {mutate:state.save,isPending:false,isError:state.saveError,error:new Error('private'),isSuccess:state.saved}, simulate: {mutate:state.simulate,reset:state.reset,isPending:false,isError:state.simError,error:new Error('private'),isSuccess:state.simSuccess,data:state.intent} }) }));
const control: AutomationControl = { settings: {aiMode:'off',model:'',dailyCalls:100,dailyTokens:10000,reservationMinutes:15,maxReservations:1,integrationsEnabled:false},health:{aiConfigured:false,integrationConfigured:false},providers:[{id:'netflix',name:'Netflix',loginCode:true,travelCode:true,verified:true},{id:'other',name:'No verificado',loginCode:false,travelCode:false,verified:false}],interests:[],access:[] };
beforeEach(() => {vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });vi.clearAllMocks(); state.saveError=false;state.saved=false;state.simError=false;state.simSuccess=false;state.intent=null;});

describe('AutomationSettingsForm', () => {
  it('mantiene nuevas compras apagadas hasta habilitación explícita y permite pausarlas conservando pedidos pagados', () => {
    render(<AutomationSettingsForm control={control} />);
    const purchases = screen.getByRole('switch', { name: 'Permitir nuevas compras por WhatsApp' });
    expect(purchases.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText(/Pausar las compras conserva la atención y la entrega de pedidos ya pagados/)).toBeTruthy();
    fireEvent.click(purchases); fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    expect(state.save).toHaveBeenLastCalledWith(expect.objectContaining({ purchasesEnabled: true }));
    fireEvent.click(purchases); fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    expect(state.save).toHaveBeenLastCalledWith(expect.objectContaining({ purchasesEnabled: false }));
  });
  it('prepara límites estando desconectado y solo publica proveedores verificados', () => {
    render(<AutomationSettingsForm control={control} />);
    expect(screen.getByText(/Falta configurar la clave de IA/)).toBeTruthy();
    expect(screen.queryByText('No verificado')).toBeNull();
    expect(screen.getByRole('switch', {name:'Permitir integraciones'})).toHaveProperty('disabled',true);
    fireEvent.change(screen.getByLabelText('Minutos para reservar'),{target:{value:'20'}});
    fireEvent.change(screen.getByLabelText('Reservas máximas por contacto'),{target:{value:'2'}});
    fireEvent.change(screen.getByLabelText('Llamadas máximas por día'),{target:{value:'80'}});
    fireEvent.change(screen.getByLabelText('Tokens máximos por día'),{target:{value:'8000'}});
    fireEvent.click(screen.getByRole('button',{name:'Guardar configuración'}));
    expect(state.save).toHaveBeenCalledWith({...control.settings,reservationMinutes:20,maxReservations:2,dailyCalls:80,dailyTokens:8000});
  });
  it('requiere modelo y enteros positivos al activar IA; prueba y expone intención segura', () => {
    const configured={...control,health:{aiConfigured:true,integrationConfigured:true}};
    const {rerender}=render(<AutomationSettingsForm control={configured} />);
    fireEvent.change(screen.getByLabelText('Modo de atención'),{target:{value:'queries'}});
    expect(screen.getByRole('button',{name:'Guardar configuración'})).toHaveProperty('disabled',true);
    fireEvent.change(screen.getByLabelText('Modelo configurado'),{target:{value:'model-example'}});
    fireEvent.click(screen.getByRole('switch',{name:'Permitir integraciones'}));
    fireEvent.click(screen.getByRole('button',{name:'Guardar configuración'}));
    expect(state.save).toHaveBeenCalledWith(expect.objectContaining({aiMode:'queries',model:'model-example',integrationsEnabled:true}));
    fireEvent.change(screen.getByLabelText('Mensaje de ejemplo'),{target:{value:'Quiero consultar mis servicios'}});
    fireEvent.click(screen.getByRole('button',{name:'Probar interpretación'}));
    expect(state.simulate).toHaveBeenCalledWith('Quiero consultar mis servicios');
    expect(state.reset).toHaveBeenCalled();
    state.simSuccess=true;state.intent={intent:'services',confidence:0.95,selection:[],reference:null};
    rerender(<AutomationSettingsForm control={configured} />);
    expect(screen.getByRole('status').textContent).toContain('Consultar sus servicios');
    fireEvent.change(screen.getByLabelText('Llamadas máximas por día'),{target:{value:'0.5'}});
    expect(screen.getByRole('button',{name:'Guardar configuración'})).toHaveProperty('disabled',true);
  });
  it('ofrece recuperación y fallback sin filtrar errores internos', () => {
    state.saveError=true;state.simError=true;
    const {rerender}=render(<AutomationSettingsForm control={control} />);
    screen.getAllByRole('alert').forEach(element=>expect(element.textContent).not.toContain('private'));
    state.saveError=false;state.saved=true;state.simError=false;state.simSuccess=true;
    rerender(<AutomationSettingsForm control={{...control,providers:[{id:'netflix',name:'Netflix',loginCode:false,travelCode:false,verified:true}]}} />);
    expect(screen.getByText('Sin códigos disponibles')).toBeTruthy();
    expect(screen.getByText(/Sin interpretación disponible/)).toBeTruthy();
    expect(screen.getByText('Configuración guardada.')).toBeTruthy();
  });
});

