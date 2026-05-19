import { useEffect, useMemo, useState } from 'react';

import { PROFILE_PAGE_SIZE } from '@/lib/utils/perfiles';

import type { PerfilDetalle, PerfilVenta, ServicioDetalle } from './types';

type VentaPerfil = PerfilVenta & { perfilNumero?: number | null };

export function useServicioProfiles(
  servicio: ServicioDetalle | null,
  ventasServicio: VentaPerfil[]
) {
  const [expandedProfileNumber, setExpandedProfileNumber] = useState<number | null>(null);
  const [profilePage, setProfilePage] = useState(0);
  const [profileSearch, setProfileSearch] = useState('');

  const ventasPorPerfil = useMemo(() => {
    const map = new Map<number, PerfilVenta>();
    ventasServicio.forEach((venta) => {
      if (!venta.perfilNumero) return;
      const existing = map.get(venta.perfilNumero);
      const entry: PerfilVenta = {
        ventaId: venta.ventaId,
        clienteId: venta.clienteId,
        clienteNombre: venta.clienteNombre,
        clienteTelefono: venta.clienteTelefono,
        createdAt: venta.createdAt,
        precioFinal: venta.precioFinal,
        descuento: venta.descuento,
        fechaInicio: venta.fechaInicio,
        fechaFin: venta.fechaFin,
        notas: venta.notas,
        servicioNombre: venta.servicioNombre,
        servicioCorreo: venta.servicioCorreo,
        moneda: venta.moneda,
        perfilNombre: venta.perfilNombre,
        codigo: venta.codigo,
        cicloPago: venta.cicloPago,
      };
      if (!existing) {
        map.set(venta.perfilNumero, entry);
        return;
      }
      const existingDate = existing.createdAt?.getTime() ?? 0;
      const nextDate = venta.createdAt?.getTime() ?? 0;
      if (nextDate >= existingDate) {
        map.set(venta.perfilNumero, entry);
      }
    });
    return map;
  }, [ventasServicio]);

  const perfilesArray = useMemo<PerfilDetalle[]>(
    () =>
      Array.from({ length: servicio?.perfilesDisponibles ?? 0 }, (_, i) => {
        const numero = i + 1;
        const venta = ventasPorPerfil.get(numero);
        const estado = !servicio?.activo ? 'inactivo' : venta ? 'ocupado' : 'disponible';
        return {
          numero,
          nombre: `Perfil ${numero}`,
          estado,
          clienteNombre: venta?.clienteNombre,
          venta,
        };
      }),
    [servicio?.activo, servicio?.perfilesDisponibles, ventasPorPerfil]
  );

  const perfilesEnUso = perfilesArray.filter((p) => p.estado === 'ocupado').length;
  const perfilesDisponibles = (servicio?.perfilesDisponibles ?? 0) - perfilesEnUso;
  const showProfileControls = (servicio?.perfilesDisponibles ?? 0) > PROFILE_PAGE_SIZE;
  const normalizedProfileSearch = showProfileControls ? profileSearch.trim().toLowerCase() : '';

  const filteredPerfiles = useMemo(
    () =>
      perfilesArray.filter((perfil) => {
        if (!normalizedProfileSearch) return true;
        const persona = (perfil.clienteNombre || '').toLowerCase();
        const perfilLabel = perfil.nombre.toLowerCase();
        return persona.includes(normalizedProfileSearch) || perfilLabel.includes(normalizedProfileSearch);
      }),
    [normalizedProfileSearch, perfilesArray]
  );

  const profilePageCount = Math.max(Math.ceil(filteredPerfiles.length / PROFILE_PAGE_SIZE), 1);

  const visiblePerfiles = useMemo(() => {
    if (!showProfileControls) return filteredPerfiles;
    const start = profilePage * PROFILE_PAGE_SIZE;
    return filteredPerfiles.slice(start, start + PROFILE_PAGE_SIZE);
  }, [filteredPerfiles, profilePage, showProfileControls]);

  const visibleProfileNumbers = useMemo(
    () => visiblePerfiles.map((perfil) => perfil.numero),
    [visiblePerfiles]
  );

  useEffect(() => {
    if (!showProfileControls) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preserves existing page clamp behavior during refactor.
    setProfilePage((prev) => Math.min(prev, Math.max(profilePageCount - 1, 0)));
  }, [profilePageCount, showProfileControls]);

  useEffect(() => {
    if (!showProfileControls) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preserves existing reset behavior when controls disappear.
      setProfilePage(0);
      setProfileSearch('');
    }
  }, [showProfileControls]);

  useEffect(() => {
    if (expandedProfileNumber === null) return;
    if (!visibleProfileNumbers.includes(expandedProfileNumber)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- preserves existing collapse behavior when the profile leaves the page.
      setExpandedProfileNumber(null);
    }
  }, [expandedProfileNumber, visibleProfileNumbers]);

  const toggleProfile = (profileNumber: number) => {
    setExpandedProfileNumber((prev) => (prev === profileNumber ? null : profileNumber));
  };

  const handleProfileSearchChange = (value: string) => {
    setProfileSearch(value);
    setProfilePage(0);
  };

  const goToPreviousProfilePage = () => {
    setProfilePage((prev) => Math.max(prev - 1, 0));
  };

  const goToNextProfilePage = () => {
    setProfilePage((prev) => Math.min(prev + 1, profilePageCount - 1));
  };

  return {
    expandedProfileNumber,
    perfilesDisponibles,
    profilePage,
    profilePageCount,
    profileSearch,
    showProfileControls,
    visiblePerfiles,
    goToNextProfilePage,
    goToPreviousProfilePage,
    handleProfileSearchChange,
    toggleProfile,
  };
}
