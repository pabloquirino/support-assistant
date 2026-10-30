import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="min-h-dvh bg-slate-100">
      <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <a routerLink="/admin" class="text-base font-semibold text-slate-900">
            Assistant Support · Administração
          </a>
          <a routerLink="/" class="btn">Ir para o chat</a>
        </div>
      </header>
      <p class="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900">
        Esta área ainda não exige login (etapa 7). Não exponha este endereço fora da rede interna.
      </p>
      <main class="mx-auto max-w-6xl px-4 py-6">
        <router-outlet />
      </main>
    </div>
  `,
})
export class AdminShellComponent {}