export type Role = 'SuperAdmin' | 'BusinessAdmin' | 'Customer';

export interface AuthUser {
  id: number;
  role: Role;
  name: string;
  businessId: number | null;
  businessToken: string | null;
  kind: 'user' | 'customer';
}
