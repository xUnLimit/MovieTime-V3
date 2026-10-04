import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationControl } from '@/types/automation-control';
import { AutomationSettingsForm } from './AutomationSettingsForm';

const state = vi.hoisted(() => ({ save: vi.fn(), saveError: false, saved: false }));
vi.mock('@/hooks/use-automation-control', () => ({ useAutomationControlActions: () => ({ save: {mutate:state.save,isPending:false,isError:state.saveError,error:new Error('private'),isSuccess:state.saved} }) }));
const control: AutomationControl = { settings: {reservationMinutes:15,maxReservations:1,integrationsEnabled:false},health:{integrationConfigured:false},providers:[{id:'netflix',name:'Netflix',loginCode:true,travelCode:true,verified:true},{id:'other',name:'No verificado',loginCode:false,travelCode:false,verified:false}],interests:[],access:[] };
beforeEach(() => {vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });vi.clearAllMocks(); state.saveError=false;state.saved=false;});

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
  it('solo muestra reservas, compras nuevas, accesos e integraciones, sin controles de IA', () => {
    render(<AutomationSettingsForm control={control} />);
    for (const name of [/Modo de atención/, /Modelo configurado/, /Llamadas máximas/, /Tokens máximos/, /Probar interpretación/, /Inteligencia artificial/, /clave de IA/])
      expect(screen.queryByText(name)).toBeNull();
    expect(screen.queryByText('No verificado')).toBeNull();
    expect(screen.getByRole('switch', {name:'Permitir integraciones'})).toHaveProperty('disabled',true);
  });
  it('guarda solo los ajustes vigentes y exige enteros positivos', () => {
    const configured={...control,health:{integrationConfigured:true}};
    render(<AutomationSettingsForm control={configured} />);
    fireEvent.change(screen.getByLabelText('Minutos para reservar'),{target:{value:'20'}});
    fireEvent.change(screen.getByLabelText('Reservas máximas por contacto'),{target:{value:'2'}});
    fireEvent.click(screen.getByRole('switch',{name:'Permitir integraciones'}));
    fireEvent.click(screen.getByRole('button',{name:'Guardar configuración'}));
    expect(state.save).toHaveBeenCalledWith({...control.settings,reservationMinutes:20,maxReservations:2,integrationsEnabled:true});
    expect(Object.keys(state.save.mock.lastCall?.[0]).sort()).toEqual(['integrationsEnabled','maxReservations','reservationMinutes']);
    fireEvent.change(screen.getByLabelText('Minutos para reservar'),{target:{value:'0.5'}});
    expect(screen.getByRole('button',{name:'Guardar configuración'})).toHaveProperty('disabled',true);
  });
  it('ofrece recuperación sin filtrar errores internos', () => {
    state.saveError=true;
    const {rerender}=render(<AutomationSettingsForm control={control} />);
    screen.getAllByRole('alert').forEach(element=>expect(element.textContent).not.toContain('private'));
    state.saveError=false;state.saved=true;
    rerender(<AutomationSettingsForm control={{...control,providers:[{id:'netflix',name:'Netflix',loginCode:false,travelCode:false,verified:true}]}} />);
    expect(screen.getByText('Sin códigos disponibles')).toBeTruthy();
    expect(screen.getByText('Configuración guardada.')).toBeTruthy();
  });
});
