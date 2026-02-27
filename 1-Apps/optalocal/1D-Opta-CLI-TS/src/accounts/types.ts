export interface SupabaseUser {
  id: string;
  email?: string;
  phone?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at?: number;
  user?: SupabaseUser;
  [key: string]: unknown;
}

export interface AccountState {
  project: string;
  session: SupabaseSession | null;
  user: SupabaseUser | null;
  updatedAt: string;
}

export type AccountIdentifier =
  | { email: string; phone?: undefined }
  | { phone: string; email?: undefined };
