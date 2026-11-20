import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { AuthService } from '../core/auth.service';
import { ChatStore } from '../features/chat/chat.store';
import { IconComponent, IconName } from '../shared/icon.component';
import { ThemeSwitcherComponent } from '../shared/theme-switcher.component';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  exact: boolean;
}

const COLLAPSED_KEY = 'as-sidebar-collapsed';

/**
 * Layout das telas autenticadas, no estilo dos chats de LLM:
 * menu lateral à esquerda (nova conversa, administração, tema, usuário/sair)
 * e o conteúdo à direita. No celular o menu vira uma gaveta sobreposta.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent, ThemeSwitcherComponent],
  host: { '(document:keydown.escape)': 'mobileOpen.set(false)' },
  template: `
    <div class="flex h-dvh overflow-hidden bg-slate-100">
      <!-- Fundo escurecido da gaveta (celular) -->
      @if (mobileOpen()) {
        <div class="fixed inset-0 z-30 bg-black/40 md:hidden" aria-hidden="true" (click)="mobileOpen.set(false)"></div>
      }

      <aside
        id="app-sidebar"
        class="fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-sidebar transition-[transform,margin] duration-200 ease-out md:relative md:z-auto md:w-64 md:translate-x-0"
        [class]="sidebarClass()"
        aria-label="Menu principal"
      >
        <!-- Marca + recolher -->
        <div class="flex h-14 items-center justify-between gap-2 px-3">
          <a routerLink="/" class="flex min-w-0 items-center gap-2.5 rounded-lg px-1 py-1">
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-xs font-semibold text-white"
            >
              AS
            </span>
            <span class="truncate text-sm font-semibold text-slate-900">Assistant Support</span>
          </a>
          <button
            type="button"
            class="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            [attr.aria-label]="'Fechar menu'"
            title="Fechar menu"
            (click)="closeSidebar()"
          >
            <app-icon class="hidden size-5 md:inline-block" name="sidebar" />
            <app-icon class="size-5 md:hidden" name="close" />
          </button>
        </div>

        <!-- Ações e navegação -->
        <nav class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3">
          <button
            type="button"
            class="mb-2 flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-surface px-3 py-2.5 text-sm font-medium text-slate-800 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            (click)="newConversation()"
          >
            <app-icon class="size-5 text-indigo-600" name="newChat" />
            Nova conversa
          </button>

          <a
            routerLink="/"
            routerLinkActive="bg-slate-200/70 text-slate-900"
            [routerLinkActiveOptions]="{ exact: true }"
            class="nav-link"
          >
            <app-icon class="size-5" name="chat" />
            Conversa atual
          </a>

          @if (auth.isAdmin()) {
            <p class="mt-4 px-3 pb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Administração</p>
            @for (item of adminNav; track item.path) {
              <a
                [routerLink]="item.path"
                routerLinkActive="bg-slate-200/70 text-slate-900"
                [routerLinkActiveOptions]="{ exact: item.exact }"
                class="nav-link"
              >
                <app-icon class="size-5" [name]="item.icon" />
                {{ item.label }}
              </a>
            }
          }
        </nav>

        <!-- Tema + usuário -->
        <div class="flex flex-col gap-3 border-t border-slate-200 p-3">
          <app-theme-switcher />

          <div class="flex items-center gap-2.5 rounded-xl px-1">
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700"
              aria-hidden="true"
            >
              {{ initials() }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium text-slate-900">{{ auth.user()?.name }}</span>
              <span class="block truncate text-xs text-slate-500">{{ roleLabel() }}</span>
            </span>
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              title="Sair"
              (click)="auth.logout()"
            >
              <app-icon class="size-5" name="logout" />
              Sair
            </button>
          </div>
        </div>
      </aside>

      <!-- Conteúdo -->
      <div class="flex min-w-0 flex-1 flex-col">
        <header [class]="topbarClass()">
          <button
            type="button"
            class="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            aria-label="Abrir menu"
            aria-controls="app-sidebar"
            [attr.aria-expanded]="mobileOpen() || !collapsed()"
            title="Abrir menu"
            (click)="openSidebar()"
          >
            <app-icon class="size-5 md:hidden" name="menu" />
            <app-icon class="hidden size-5 md:inline-block" name="sidebar" />
          </button>
          <span class="truncate text-sm font-semibold text-slate-900">Assistant Support</span>
          <button
            type="button"
            class="ml-auto rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            aria-label="Nova conversa"
            title="Nova conversa"
            (click)="newConversation()"
          >
            <app-icon class="size-5" name="newChat" />
          </button>
        </header>

        <main class="flex min-h-0 flex-1 flex-col">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class AppShellComponent {
  protected readonly auth = inject(AuthService);
  private readonly store = inject(ChatStore);
  private readonly router = inject(Router);

  protected readonly adminNav: NavItem[] = [
    { path: '/admin', label: 'Conteúdo', icon: 'folder', exact: true },
    { path: '/admin/users', label: 'Usuários', icon: 'users', exact: false },
    { path: '/admin/metrics', label: 'Métricas', icon: 'chart', exact: false },
  ];

  /** Celular: gaveta aberta. */
  protected readonly mobileOpen = signal(false);
  /** Desktop: menu recolhido (lembrado neste navegador). */
  protected readonly collapsed = signal(readCollapsed());

  protected readonly sidebarClass = computed(() => {
    const mobile = this.mobileOpen() ? 'translate-x-0 shadow-xl' : '-translate-x-full';
    const desktop = this.collapsed() ? 'md:-ml-64' : 'md:ml-0';
    return `${mobile} ${desktop}`;
  });

  /** Barra superior: sempre no celular; no desktop só com o menu recolhido. */
  protected readonly topbarClass = computed(
    () =>
      'flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-surface px-3 ' +
      (this.collapsed() ? '' : 'md:hidden'),
  );

  protected readonly initials = computed(() => {
    const parts = (this.auth.user()?.name ?? '').trim().split(/\s+/).filter(Boolean);
    const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2);
    return letters.toUpperCase();
  });

  protected readonly roleLabel = computed(() => (this.auth.isAdmin() ? 'Administrador' : 'Analista'));

  constructor() {
    // Fecha a gaveta do celular ao navegar.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.mobileOpen.set(false));
  }

  protected newConversation(): void {
    void this.store.reset();
    this.mobileOpen.set(false);
    if (this.router.url !== '/') void this.router.navigateByUrl('/');
  }

  protected openSidebar(): void {
    if (window.matchMedia('(min-width: 768px)').matches) this.setCollapsed(false);
    else this.mobileOpen.set(true);
  }

  protected closeSidebar(): void {
    if (window.matchMedia('(min-width: 768px)').matches) this.setCollapsed(true);
    else this.mobileOpen.set(false);
  }

  private setCollapsed(value: boolean): void {
    this.collapsed.set(value);
    try {
      localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0');
    } catch {
      // ignora: preferência vale só nesta sessão
    }
  }
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}
