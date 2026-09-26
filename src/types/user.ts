export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  roleId: number;
}

export interface Role {
  id: number;
  name: string;
}
