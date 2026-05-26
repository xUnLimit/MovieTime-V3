export interface FilterOption {
  field: string;
  operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'is' | 'ilike' | 'orIlike';
  value: unknown;
}
