import { Component, DestroyRef, computed, inject, input, linkedSignal, signal } from '@angular/core';

import { ApiService } from '../../core/api.service';
import { ClipboardService } from '../../core/clipboard.service';
import { MarkdownPipe } from '../../core/markdown.pipe';
import { MarkdownService } from '../../core/markdown.service';
import { BlockType, SolutionBlock } from '../../core/models';

const CONTAINER: Record<BlockType, string> = {
  Steps: 'border-slate-200 bg-surface',
  CustomerMessage: 'border-indigo-200 bg-surface',
  Ticket: 'border-slate-300 bg-surface',
  Attachments: 'border-slate-200 bg-surface',
  Note: 'border-sky-200 border-l-4 border-l-sky-500 bg-sky-50',
  Warning: 'border-amber-300 border-l-4 border-l-amber-500 bg-amber-50',
};

const TEXT: Record<BlockType, string> = {
  Steps: 'text-slate-800',
  CustomerMessage: 'text-slate-800',
  Ticket: 'text-slate-800',
  Attachments: 'text-slate-800',
  Note: 'text-sky-950',
  Warning: 'text-amber-950',
};

@Component({
  selector: 'app-solution-block',
  imports: [MarkdownPipe],
  templateUrl: './solution-block.component.html',
})
export class SolutionBlockComponent {
  readonly block = input.required<SolutionBlock>();

  private readonly markdown = inject(MarkdownService);
  private readonly clipboard = inject(ClipboardService);
  private readonly api = inject(ApiService);

  /** Blocos "recolhidos por padrão" começam fechados; os demais ficam sempre abertos. */
  protected readonly open = linkedSignal(() => !this.block().collapsedByDefault);

  protected readonly copyState = signal<'idle' | 'copied' | 'failed'>('idle');
  protected readonly checked = signal<ReadonlySet<number>>(new Set());

  private copyTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly containerClass = computed(
    () => `rounded-xl border ${CONTAINER[this.block().type]} ${TEXT[this.block().type]}`,
  );

  protected readonly copyable = computed(() => {
    const type = this.block().type;
    return type === 'CustomerMessage' || type === 'Ticket';
  });

  protected readonly parts = computed(() =>
    this.block().type === 'Steps' ? this.markdown.steps(this.block().contentMarkdown) : [],
  );

  protected readonly totalSteps = computed(() => this.parts().filter((p) => p.kind === 'step').length);
  protected readonly doneSteps = computed(() => this.checked().size);

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.copyTimer));
  }

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  protected toggleStep(index: number): void {
    this.checked.update((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  protected async copy(): Promise<void> {
    const ok = await this.clipboard.copy(this.markdown.plainText(this.block().contentMarkdown));
    this.copyState.set(ok ? 'copied' : 'failed');

    clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => this.copyState.set('idle'), 2000);
  }

  protected downloadUrl(id: string): string {
    return this.api.attachmentUrl(id);
  }

  protected formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  }
}