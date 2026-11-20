import { Component, ElementRef, afterRenderEffect, input, output, signal, viewChild } from '@angular/core';

import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-chat-input',
  imports: [IconComponent],
  template: `
    <div
      class="flex items-center gap-2 rounded-2xl border border-slate-300 bg-surface p-2 pl-4 shadow-sm transition focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-200"
      [class.opacity-70]="disabled()"
    >
      <input
        #field
        type="text"
        maxlength="200"
        autocomplete="off"
        placeholder="Descreva o problema do cliente (ex.: pix não compensou)"
        aria-label="Mensagem"
        class="min-w-0 flex-1 bg-transparent py-2 text-[0.95rem] text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed"
        [value]="text()"
        [disabled]="disabled()"
        (input)="onInput($event)"
        (keydown.enter)="submit()"
      />
      <button
        type="button"
        class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        aria-label="Enviar"
        title="Enviar"
        [disabled]="disabled() || !text().trim()"
        (click)="submit()"
      >
        <app-icon class="size-5" name="send" />
      </button>
    </div>
  `,
})
export class ChatInputComponent {
  readonly disabled = input(false);
  readonly submitted = output<string>();

  protected readonly text = signal('');
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  constructor() {
    // Após renderizar (o atributo disabled já foi atualizado), devolve o foco ao campo.
    afterRenderEffect(() => {
      if (!this.disabled()) this.field()?.nativeElement.focus();
    });
  }

  protected onInput(event: Event): void {
    this.text.set((event.target as HTMLInputElement).value);
  }

  protected submit(): void {
    const value = this.text().trim();
    if (!value || this.disabled()) return;

    this.submitted.emit(value);
    this.text.set('');
  }
}