import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { THEMES, Theme, ThemeService } from '../core/theme.service';
import { IconComponent, IconName } from './icon.component';

const ICONS: Record<Theme, IconName> = { light: 'sun', dark: 'moon', sepia: 'book' };

/** Controle segmentado Claro / Escuro / Sépia. */
@Component({
  selector: 'app-theme-switcher',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid grid-cols-3 gap-1 rounded-xl bg-slate-200/70 p-1" role="radiogroup" aria-label="Tema">
      @for (t of themes; track t.value) {
        <button
          type="button"
          role="radio"
          class="flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          [class]="
            theme.theme() === t.value
              ? 'bg-surface text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          "
          [attr.aria-checked]="theme.theme() === t.value"
          [title]="'Tema ' + t.label.toLowerCase()"
          (click)="theme.set(t.value)"
        >
          <app-icon class="size-4" [name]="icons[t.value]" />
          {{ t.label }}
        </button>
      }
    </div>
  `,
})
export class ThemeSwitcherComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly themes = THEMES;
  protected readonly icons = ICONS;
}
