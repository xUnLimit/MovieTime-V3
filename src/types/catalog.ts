/** Customer interest in a sold-out plan, as the admin screen shows it. Structurally matches the validated row. */
export type CatalogInterest = {
  id: string;
  contact_id: string;
  categoria_id: string;
  plan_id: string | null;
  origen: 'catalogo_agotado' | 'manual';
  estado: 'esperando' | 'avisado' | 'convertido' | 'descartado';
  created_at: string;
  avisado_at: string | null;
};
