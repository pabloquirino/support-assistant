import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type UserRole = 'Analyst' | 'Admin';

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

interface SessionResponse {
  user: SessionUser | null;
}

/**
 * Sessão por cookie HttpOnly: o front nunca vê o token, só o usuário retornado pela API.
 * Chamar /auth/session também emite o cookie XSRF-TOKEN, que o HttpClient do Angular
 * reenvia como header X-XSRF-TOKEN em POST/PUT/DELETE.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/auth';

  readonly user = signal<SessionUser | null>(null);
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'Admin');

  /** Carrega a sessão atual. Falha de rede = tratado como não autenticado. */
  async load(): Promise<SessionUser | null> {
    try {
      const res = await firstValueFrom(this.http.get<SessionResponse>(`${this.base}/session`));
      this.user.set(res.user);
    } catch {
      this.user.set(null);
    }
    return this.user();
  }

  async login(email: string, password: string): Promise<SessionUser> {
    const res = await firstValueFrom(this.http.post<SessionResponse>(`${this.base}/login`, { email, password }));
    this.user.set(res.user);
    return res.user!;
  }

  /** Recarrega a página depois de sair: limpa todo o estado em memória (conversa, caches). */
  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post<void>(`${this.base}/logout`, {}));
    } finally {
      this.user.set(null);
      window.location.assign('/login');
    }
  }

  /** Sessão expirou ou foi revogada (401 da API). */
  clear(): void {
    this.user.set(null);
  }
}
