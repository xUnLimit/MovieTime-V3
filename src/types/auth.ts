// ===========================
// USER & AUTH TYPES
// ===========================

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'operador';
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
