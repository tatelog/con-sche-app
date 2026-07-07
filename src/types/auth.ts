export type Role = 'admin' | 'member' | 'viewer' | 'owner';

export interface User {
  id: string;
  email: string;
  name: string;
  role?: Role;
}

export interface Membership {
  organizationId: string;
  role: Role;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}
