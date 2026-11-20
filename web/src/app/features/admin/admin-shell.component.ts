import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-dvh bg-slate-100">
      <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div class="flex flex-wrap items-center gap-4">
            <a routerLink="/admin" class="text-base font-semibold text-slate-900">
              Assistant Support · Administração
            </a>
            <nav class="flex gap-1 text-sm" aria-label="Seções do admin">
              @for (item of nav; track item.path) {
                <a
                  [routerLink]="item.path"
                  routerLinkActive="bg-indigo-50 text-indigo-700"
                  [routerLinkActiveOptions]="{ exact: item.exact }"
                  class="rounded-lg px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
                >
                  {{ item.label }}
                </a>
              }
            </nav>
          </div>
          <div class="flex items-center gap-2">
            <span class="hidden text-sm text-slate-500 sm:inline">{{ auth.user()?.name }}</span>
            <a routerLink="/" class="btn">Ir para o chat</a>
            <button type="button" class="btn" (click)="auth.logout()">Sair</button>
          </div>
        </div>
      </header>
      <main class="mx-auto max-w-6xl px-4 py-6">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AdminShellComponent {
  protected readonly auth = inject(AuthService);

  protected readonly nav = [
    { path: '/admin', label: 'Conteúdo', exact: true },
    { path: '/admin/users', label: 'Usuários', exact: false },
    { path: '/admin/metrics', label: 'Métricas', exact: false },
  ];
}
