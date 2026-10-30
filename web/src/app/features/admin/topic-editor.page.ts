import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { NodeType } from '../../core/models';
import { AdminApiService, adminErrorMessage } from './admin-api.service';
import { AdminCategory, AdminNode, AdminTerm, AdminTopic, nodeLabel } from './admin.models';
import { NodeEditorComponent } from './node-editor.component';

const lines = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

@Component({
  selector: 'app-topic-editor',
  imports: [FormsModule, RouterLink, NodeEditorComponent],
  templateUrl: './topic-editor.page.html',
})
export class TopicEditorPage implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly topicId = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  private readonly editor = viewChild(NodeEditorComponent);

  protected readonly label = nodeLabel;
  protected readonly topic = signal<AdminTopic | null>(null);
  protected readonly categories = signal<AdminCategory[]>([]);
  protected readonly selected = signal<AdminNode | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly info = signal<string | null>(null);
  protected readonly busy = signal(false);

  /** Lista de 0 ou 1 item: o `track n.id` recria o editor só quando muda o nó selecionado. */
  protected readonly selectedList = computed(() => {
    const n = this.selected();
    return n ? [n] : [];
  });

  protected meta = {
    title: '',
    categoryId: 0,
    isActive: true,
    rootNodeId: null as number | null,
    keywords: '',
    synonyms: '',
  };

  protected newNode: { type: NodeType; text: string } = { type: 'Solution', text: '' };

  ngOnInit(): void {
    void this.run(async () => {
      const [topic, categories] = await Promise.all([
        firstValueFrom(this.api.topic(this.topicId)),
        firstValueFrom(this.api.categories()),
      ]);
      this.fillMeta(topic);
      this.categories.set(categories);
      this.topic.set(topic);
    });
  }

  protected saveMeta(): void {
    void this.run(async () => {
      const terms: AdminTerm[] = [
        ...lines(this.meta.keywords).map((term) => ({ term, kind: 'Keyword' as const })),
        ...lines(this.meta.synonyms).map((term) => ({ term, kind: 'Synonym' as const })),
      ];

      const updated = await firstValueFrom(
        this.api.updateTopic(this.topicId, {
          categoryId: this.meta.categoryId,
          title: this.meta.title,
          isActive: this.meta.isActive,
          rootNodeId: this.meta.rootNodeId,
          terms,
        }),
      );

      this.fillMeta(updated);
      // Mantém os nós atuais (e o rascunho aberto no editor).
      this.topic.update((t) => ({ ...updated, nodes: t?.nodes ?? updated.nodes }));
      this.info.set('Dados do assunto salvos.');
    });
  }

  protected addNode(): void {
    if (!this.newNode.text.trim()) {
      this.error.set('Informe o texto da pergunta ou o título da solução.');
      return;
    }

    void this.run(async () => {
      const node = await firstValueFrom(this.api.createNode(this.topicId, this.newNode));
      this.newNode.text = '';
      await this.refresh();
      this.selected.set(node);
    });
  }

  protected selectNode(n: AdminNode): void {
    if (this.selected()?.id === n.id) return;
    if (this.editor()?.isDirty() && !confirm('Há alterações não salvas neste nó. Descartar?')) return;

    void this.run(async () => this.selected.set(await firstValueFrom(this.api.node(n.id))));
  }

  protected deleteNode(n: AdminNode): void {
    if (!confirm(`Excluir "${nodeLabel(n)}"? Os PDFs de uma solução excluída também são removidos.`)) return;

    void this.run(async () => {
      await firstValueFrom(this.api.deleteNode(n.id));
      if (this.selected()?.id === n.id) this.selected.set(null);
      await this.refresh();
    });
  }

  protected onNodeSaved(node: AdminNode): void {
    this.topic.update((t) => (t ? { ...t, nodes: t.nodes.map((x) => (x.id === node.id ? node : x)) } : t));
  }

  /** Recarrega a estrutura reaproveitando os nós já conhecidos (preserva o que está em edição). */
  private async refresh(): Promise<void> {
    const fresh = await firstValueFrom(this.api.topic(this.topicId));
    const known = this.topic()?.nodes ?? [];

    this.meta.rootNodeId = fresh.rootNodeId;
    this.topic.set({ ...fresh, nodes: fresh.nodes.map((n) => known.find((k) => k.id === n.id) ?? n) });
  }

  private fillMeta(t: AdminTopic): void {
    this.meta = {
      title: t.title,
      categoryId: t.categoryId,
      isActive: t.isActive,
      rootNodeId: t.rootNodeId,
      keywords: t.terms.filter((x) => x.kind === 'Keyword').map((x) => x.term).join('\n'),
      synonyms: t.terms.filter((x) => x.kind === 'Synonym').map((x) => x.term).join('\n'),
    };
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.error.set(null);
    this.info.set(null);
    this.busy.set(true);
    try {
      await fn();
    } catch (err) {
      console.error('[Admin]', err);
      this.error.set(adminErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}