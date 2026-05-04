"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { Categoria } from "@/types";

interface ServiciosFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  categoriaFilter: string;
  setCategoriaFilter: (value: string) => void;
  tipoFilter: string;
  setTipoFilter: (value: string) => void;
  estadoFilter: string;
  setEstadoFilter: (value: string) => void;
  categorias: Categoria[];
}

export function ServiciosFilters({
  searchTerm,
  setSearchTerm,
  categoriaFilter,
  setCategoriaFilter,
  tipoFilter,
  setTipoFilter,
  estadoFilter,
  setEstadoFilter,
  categorias,
}: ServiciosFiltersProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar servicios..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
        <SelectTrigger>
          <SelectValue placeholder="Todas las categorías" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las categorías</SelectItem>
          {categorias.map((cat) => (
            <SelectItem key={cat.id} value={cat.id}>
              {cat.iconUrl && <span className="mr-2">{cat.iconUrl}</span>}
              {cat.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={tipoFilter} onValueChange={setTipoFilter}>
        <SelectTrigger>
          <SelectValue placeholder="Todos los tipos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los tipos</SelectItem>
          <SelectItem value="individual">Individual</SelectItem>
          <SelectItem value="familiar">Familiar</SelectItem>
        </SelectContent>
      </Select>

      <Select value={estadoFilter} onValueChange={setEstadoFilter}>
        <SelectTrigger>
          <SelectValue placeholder="Todos los estados" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          <SelectItem value="activo">Activo</SelectItem>
          <SelectItem value="inactivo">Inactivo</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
