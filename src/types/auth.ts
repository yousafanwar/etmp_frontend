export interface LoginResponse {
  accessToken: string;
  accessTokenExpiresAt: string; // ISO date string
}

export interface ResetPasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface AdminResetPasswordRequest {
  newPassword: string;
}