import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { MarkdownPipe } from '../../core/markdown.pipe';
import { AttachmentInfo, BlockType } from '../../core/models';
import { AdminApiService, adminErrorMessage } from './admin-api.service';
import { AdminNode, BLOCK_TYPES, QuestionBody, SolutionBody, formatSize, nodeLabel } from './admin.models';

interface DraftOption {
  id?: number;
  key: number;
  text: string;
  nextNodeId: number | null;
}

interface DraftBlock {
  id?: number;
  key: number;
  type: BlockType;
  title: string;
  contentMarkdown: string;
  collapsedByDefault: boolean;
  attachments: AttachmentInfo[];
  preview: boolean;
}

interface Draft {
  questionText: string;
  options: DraftOption[];
  title: string;
  summary: string;
  blocks: DraftBlock[];
}

@Component({
  selector: 'app-node-editor',
  imports: [FormsModule, MarkdownPipe],
  templateUrl: './node-editor.component.html',
})
export class NodeEditorComponent implements OnInit {
  readonly node = input.required<AdminNode>();
  /** Todos os nós do assunto (destinos possíveis das opções). */
  readonly nodes = input.required<AdminNode[]>();
  readonly saved = output<AdminNode>();

  private readonly api = inject(AdminApiService);

  protected readonly blockTypes = BLOCK_TYPES;
  protected readonly size = formatSize;
  protected readonly draft = signal<Draft | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly info = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly uploading = signal<number | null>(null);

  protected readonly targets = computed(() =>
    this.nodes()
      .filter((n) => n.id !== this.node().id)
      .map((n) => ({ id: n.id, label: nodeLabel(n) })),
  );

  private key = 0;
  private snapshot = '';

  ngOnInit(): void {
    this.load(this.node());
  }

  /** Há edições não salvas? (usado pela página ao trocar de nó.) */
  isDirty(): boolean {
    const d = this.draft();
    return d !== null && this.snapshotOf(d) !== this.snapshot;
  }

  // ------------------------------------------------------------
  // Pergunta
  // ------------------------------------------------------------
  protected addOption(): void {
    this.draft.update((d) =>
      d ? { ...d, options: [...d.options, { key: ++this.key, text: '', nextNodeId: null }] } : d,
    );
  }

  protected removeOption(index: number): void {
    this.draft.update((d) => (d ? { ...d, options: d.options.filter((_, i) => i !== index) } : d));
  }

  // ------------------------------------------------------------
  // Solução: blocos
  // ------------------------------------------------------------
  protected addBlock(): void {
    this.draft.update((d) =>
      d
        ? {
            ...d,
            blocks: [
              ...d.blocks,
              {
                key: ++this.key,
                type: 'Steps',
                title: '',
                contentMarkdown: '',
                collapsedByDefault: false,
                attachments: [],
                preview: false,
              },
            ],
          }
        : d,
    );
  }

  protected removeBlock(index: number): void {
    const d = this.draft();
    const block = d?.blocks[index];
    if (!d || !block) return;

    if (block.attachments.length > 0 && !confirm('Os PDFs deste bloco serão excluídos ao salvar. Continuar?')) return;

    this.draft.set({ ...d, blocks: d.blocks.filter((_, i) => i !== index) });
  }

  protected moveBlock(index: number, delta: -1 | 1): void {
    const d = this.draft();
    const target = index + delta;
    if (!d || target < 0 || target >= d.blocks.length) return;

    const blocks = [...d.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    this.draft.set({ ...d, blocks });
  }

  // ------------------------------------------------------------
  // Anexos (cada upload/remoção é imediato, sem depender do "Salvar")
  // ------------------------------------------------------------
  protected async upload(block: DraftBlock, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || block.id === undefined) return;

    this.error.set(null);
    this.info.set(null);
    this.uploading.set(block.key);
    try {
      const attachment = await firstValueFrom(this.api.uploadAttachment(block.id, file));
      block.attachments = [...block.attachments, attachment];
      this.info.set(`PDF "${attachment.fileName}" enviado.`);
    } catch (err) {
      console.error('[Admin] upload', err);
      this.error.set(adminErrorMessage(err));
    } finally {
      this.uploading.set(null);
    }
  }

  protected async removeAttachment(block: DraftBlock, attachment: AttachmentInfo): Promise<void> {
    if (!confirm(`Remover "${attachment.fileName}"? O arquivo será apagado.`)) return;

    this.error.set(null);
    this.info.set(null);
    try {
      await firstValueFrom(this.api.deleteAttachment(attachment.id));
      block.attachments = block.attachments.filter((a) => a.id !== attachment.id);
      this.info.set('PDF removido.');
    } catch (err) {
      console.error('[Admin] remover anexo', err);
      this.error.set(adminErrorMessage(err));
    }
  }

  // ------------------------------------------------------------
  // Salvar
  // ------------------------------------------------------------
  protected async save(): Promise<void> {
    const d = this.draft();
    if (!d) return;

    this.error.set(null);
    this.info.set(null);

    const isQuestion = this.node().type === 'Question';
    if (isQuestion && d.options.some((o) => o.nextNodeId === null)) {
      this.error.set('Escolha o destino de todas as opções.');
      return;
    }

    this.busy.set(true);
    try {
      const id = this.node().id;
      const result = isQuestion
        ? await firstValueFrom(this.api.saveQuestion(id, this.questionBody(d)))
        : await firstValueFrom(this.api.saveSolution(id, this.solutionBody(d)));

      this.load(result); // ids novos (opções/blocos) vindos do servidor
      this.saved.emit(result);
      this.info.set('Salvo.');
    } catch (err) {
      console.error('[Admin] salvar nó', err);
      this.error.set(adminErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }

  // ------------------------------------------------------------
  // Internos
  // ------------------------------------------------------------
  private load(n: AdminNode): void {
    const draft: Draft = {
      questionText: n.questionText ?? '',
      options: n.options.map((o) => ({ id: o.id, key: ++this.key, text: o.text, nextNodeId: o.nextNodeId })),
      title: n.solution?.title ?? '',
      summary: n.solution?.summary ?? '',
      blocks: (n.solution?.blocks ?? []).map((b) => ({
        id: b.id,
        key: ++this.key,
        type: b.type,
        title: b.title,
        contentMarkdown: b.contentMarkdown,
        collapsedByDefault: b.collapsedByDefault,
        attachments: b.attachments,
        preview: false,
      })),
    };

    this.draft.set(draft);
    this.snapshot = this.snapshotOf(draft);
  }

  private questionBody(d: Draft): QuestionBody {
    return {
      questionText: d.questionText,
      options: d.options.map((o) => ({ id: o.id, text: o.text, nextNodeId: o.nextNodeId })),
    };
  }

  private solutionBody(d: Draft): SolutionBody {
    return {
      title: d.title,
      summary: d.summary,
      blocks: d.blocks.map((b) => ({
        id: b.id,
        type: b.type,
        title: b.title,
        contentMarkdown: b.contentMarkdown,
        collapsedByDefault: b.collapsedByDefault,
      })),
    };
  }

  private snapshotOf(d: Draft): string {
    return JSON.stringify(this.node().type === 'Question' ? this.questionBody(d) : this.solutionBody(d));
  }
}