import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark' | 'sepia';

export const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
  { value: 'sepia', label: 'Sépia' },
];

/** Mesma chave lida pelo script inline do index.html (aplica o tema antes do Angular subir). */
const STORAGE_KEY = 'as-theme';

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'sepia';
}

/** Preferência por navegador (localStorage). Sem escolha salva, segue o tema do sistema. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;

  readonly theme = signal<Theme>(this.initial());

  constructor() {
    effect(() => {
      this.root.dataset['theme'] = this.theme();
    });
  }

  set(theme: Theme): void {
    this.theme.set(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Armazenamento bloqueado (aba anônima etc.): vale só para esta sessão.
    }
  }

  private initial(): Theme {
    const fromDom = this.root.dataset['theme'];
    if (isTheme(fromDom)) return fromDom;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (isTheme(saved)) return saved;
    } catch {
      // ignora
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
