export type UserRole = "professor" | "admin";

export interface Institution {
  nome: string;
  logoUrl: string | null;
}

export interface UserProfile {
  googleId: string;
  email: string;
  nome: string;
  avatarUrl: string | null;
  role: UserRole;
  disciplinas: string[];
  instituicoes: Institution[];
}
