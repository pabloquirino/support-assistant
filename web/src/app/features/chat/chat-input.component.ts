import { Component, ElementRef, afterRenderEffect, input, output, signal, viewChild } from '@angular/core';

@Component({
  selector: 'app-chat-input',
  template: `
    <div class="flex items-center gap-2">
      <input
        #field
        type="text"
        maxlength="200"
        autocomplete="off"
        placeholder="Descreva o problema (ex.: pix não compensou)"
        aria-label="Mensagem"
        class="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
        [value]="text()"
        [disabled]="disabled()"
        (input)="onInput($event)"
        (keydown.enter)="submit()"
      />
      <button
        type="button"
        class="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
        [disabled]="disabled() || !text().trim()"
        (click)="submit()"
      >
        Enviar
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