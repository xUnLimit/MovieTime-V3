// ===========================
// DASHBOARD METRICS TYPES
// ===========================

export interface DashboardStats {
  // Financial totals (in USD)
  gastosTotal: number;
  ingresosTotal: number;

  // Chart: User growth (last 12 months)
  usuariosPorMes: UsuariosMes[];

  // Chart: User growth (current month, by day)
  usuariosPorDia: UsuariosDia[];

  // Chart: Income vs Expenses (last 12 months)
  ingresosPorMes: IngresosMes[];

  // Chart: Income vs Expenses (current month, by day)
  ingresosPorDia: IngresosDia[];

  // Chart: Revenue by category (cumulative)
  ingresosPorCategoria: IngresoCategoria[];

  // Chart: Revenue by category with month breakdown (for year filter)
  ingresosCategoriasPorMes?: IngresoCategoriaMes[];

  // Financial forecast (next 4 months, pre-computed — no extra reads on load)
  pronostico?: PronosticoMensual[];

  // Denormalized source data for forecast calculation (client-side, no reads)
  ventasPronostico?: VentaPronostico[];
  serviciosPronostico?: ServicioPronostico[];

  updatedAt?: Date;
}

/** Minimal venta fields needed to compute the forecast and monto sin consumir */
export interface VentaPronostico {
  id: string;
  categoriaId: string;    // needed for per-category monto sin consumir
  fechaInicio: string;    // ISO string — needed for monto sin consumir ratio
  fechaFin: string;       // ISO string — avoids Firestore Timestamp complexity
  cicloPago: string;
  precioFinal: number;
  moneda: string;
}

/** Minimal servicio fields needed to compute the forecast */
export interface ServicioPronostico {
  id: string;
  fechaVencimiento: string; // ISO string
  cicloPago: string;
  costoServicio: number;
  moneda: string;
}

export interface IngresosDia {
  dia: string;  // "YYYY-MM-DD"
  ingresos: number; // USD
  gastos: number;   // USD
}

export interface UsuariosDia {
  dia: string;  // "YYYY-MM-DD"
  clientes: number;
  revendedores: number;
}

export interface UsuariosMes {
  mes: string; // "YYYY-MM"
  clientes: number;
  revendedores: number;
}

export interface IngresosMes {
  mes: string; // "YYYY-MM"
  ingresos: number; // USD
  gastos: number; // USD
}

export interface IngresoCategoria {
  categoriaId: string;
  nombre: string;
  total: number; // USD — ingresos (pagosVenta)
  gastos?: number; // USD — gastos (pagosServicio)
}

export interface IngresoCategoriaMes {
  mes: string;       // "YYYY-MM"
  categoriaId: string;
  nombre: string;
  total: number;     // USD — ingresos
  gastos: number;    // USD — gastos
}

export interface DashboardCounts {
  ventasActivas: number;
  totalClientes: number;
  totalRevendedores: number;
}

// Legacy interfaces (kept for type compatibility)
export interface DashboardMetrics {
  gastosTotal: number;
  ingresosTotal: number;
  gananciasTotal: number;
  gastoMensualEsperado: number;
  ingresoMensualEsperado: number;
  clientesActivos: number;
  revendedoresActivos: number;
  serviciosActivos: number;
}

export interface MetricaPorCategoria {
  categoriaId: string;
  categoriaNombre: string;
  ingresos: number;
  gastos: number;
  ganancias: number;
  rentabilidad: number;
}

export interface PronosticoMensual {
  mes: string;
  ingresos: number;
  gastos: number;
  ganancias: number;
}
