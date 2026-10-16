import { apiClient } from "@/lib/api/client";
import { API_ROUTES } from "@/lib/api/routes";
import type {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
} from "@/features/auth/types/auth";

export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>(API_ROUTES.auth.register, payload);
}

export async function loginUser(payload: LoginPayload): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>(API_ROUTES.auth.login, payload);
}
