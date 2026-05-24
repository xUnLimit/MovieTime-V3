export function getTipoLabel(tipo: string) {
  switch (tipo) {
    case 'cliente':
      return 'Cliente';
    case 'revendedor':
      return 'Revendedor';
    default:
      return tipo;
  }
}

export function getTipoCategoriaLabel(tipo: string) {
  switch (tipo) {
    case 'plataforma_streaming':
      return 'Plataforma De Streaming';
    case 'otros':
      return 'Otros';
    default:
      return tipo;
  }
}

export function getCicloPagoLabel(ciclo: string) {
  switch (ciclo) {
    case 'mensual':
      return { label: 'Mensual', short: 'mes' };
    case 'trimestral':
      return { label: 'Trimestral', short: 'trimestre' };
    case 'semestral':
      return { label: 'Semestral', short: 'semestre' };
    case 'anual':
      return { label: 'Anual', short: 'año' };
    default:
      return { label: ciclo, short: ciclo };
  }
}
