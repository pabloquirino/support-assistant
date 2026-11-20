import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { ThemeSwitcherComponent } from '../../shared/theme-switcher.component';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, ThemeSwitcherComponent],
  template: `
    <div class="flex min-h-dvh flex-col items-center justify-center gap-6 bg-slate-100 px-4">
      <form class="card w-full max-w-sm p-6" (ngSubmit)="submit()" #f="ngForm">
        <div class="mb-6 flex items-center gap-3">
          <div class="flex size-10 items-center justify-center rounded-xl bg-indigo-600 text-sm font-semibold text-white">
            AS
          </div>
          <div>
            <h1 class="text-base font-semibold leading-tight text-slate-900">Assistant Support</h1>
            <p class="text-xs text-slate-500">Entre com sua conta para continuar</p>
          </div>
        </div>

        @if (error(); as e) {
          <p class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200" role="alert">{{ e }}</p>
        }

        <label class="lbl" for="email">E-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          class="field mb-4"
          autocomplete="username"
          required
          maxlength="200"
          [(ngModel)]="email"
        />

        <label class="lbl" for="password">Senha</label>
        <input
          id="password"
          name="password"
          type="password"
          class="field mb-6"
          autocomplete="current-password"
          required
          maxlength="128"
          [(ngModel)]="password"
        />

        <button type="submit" class="btn btn-primary w-full py-2" [disabled]="busy() || f.invalid">
          {{ busy() ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
      <div class="w-full max-w-xs">
        <app-theme-switcher />
      </div>
    </div>
  `,
})
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected email = '';
  protected password = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    // Renova o token CSRF (pode estar vinculado a uma sessão que já expirou).
    void this.auth.load();
  }

  protected async submit(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);

    try {
      await this.loginWithRetry();
      await this.router.navigateByUrl(this.safeReturnUrl());
    } catch (err) {
      this.password = '';
      this.error.set(this.message(err));
    } finally {
      this.busy.set(false);
    }
  }

  /** Token CSRF vencido: renova uma vez e tenta de novo. */
  private async loginWithRetry(): Promise<void> {
    try {
      await this.auth.login(this.email.trim(), this.password);
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 400 && err.error?.code === 'csrf') {
        await this.auth.load();
        await this.auth.login(this.email.trim(), this.password);
        return;
      }
      throw err;
    }
  }

  /** Só caminhos internos: evita redirecionamento aberto via ?returnUrl=. */
  private safeReturnUrl(): string {
    const url = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
    const safe = url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/login') ? url : '/';
    return safe.startsWith('/admin') && !this.auth.isAdmin() ? '/' : safe;
  }

  private message(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (typeof err.error?.error === 'string') return err.error.error;
      if (err.status === 429) return 'Muitas tentativas. Aguarde um minuto e tente de novo.';
      if (err.status === 0) return 'Não consegui falar com o servidor.';
    }
    return 'Não foi possível entrar. Tente novamente.';
  }
}
