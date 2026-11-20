import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Área de conteúdo do admin. A navegação (Conteúdo, Usuários, Métricas) fica no menu lateral. */
@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet],
  template: `
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <router-outlet />
      </div>
    </div>
  `,
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class AdminShellComponent {}
