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

export interface CreateUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  roleId: number;
  password: string;
}

export interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
}

export interface UpdateUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  roleId: number;
}
