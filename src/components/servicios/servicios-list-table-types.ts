import type { Categoria, Servicio } from "@/types";

export interface ServiciosListTableProps {
  servicios: Servicio[];
  isLoading: boolean;
  title?: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  categorias?: Categoria[];
  selectedCategoriaId?: string;
  onCategoriaChange?: (id: string) => void;
  orderBy?: "createdAt" | "updatedAt";
  onOrderByChange?: (value: "createdAt" | "updatedAt") => void;
  hasMore: boolean;
  hasPrevious: boolean;
  page: number;
  totalPages: number;
  onNext: () => void;
  onPrevious: () => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
}

export interface ServicioRow extends Record<string, unknown> {
  id: string;
  nombre: string;
  correo: string;
  categoriaNombre: string;
  cicloPago: string;
  fechaInicio?: Date;
  fechaVencimiento?: Date;
  costo: number;
  moneda: string;
  activo: boolean;
  renovaciones: number;
  original: Servicio;
}
