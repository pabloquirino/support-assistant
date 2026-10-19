import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import { Category, ChatMessage, NewChatMessage, TopicChoice } from '../../core/models';

const MIN_QUERY_LENGTH = 2;

type IsStale = () => boolean;

@Injectable({ providedIn: 'root' })
export class ChatStore {
  private readonly api = inject(ApiService);

  private seq = 0;
  /** Incrementa em "Nova conversa": respostas pendentes da conversa anterior são descartadas. */
  private epoch = 0;
  private categoriesCache: Category[] | null = null;

  readonly messages = signal<ChatMessage[]>([]);
  readonly busy = signal(false);

  // ------------------------------------------------------------
  // Ciclo da conversa
  // ------------------------------------------------------------
  async start(): Promise<void> {
    if (this.messages().length > 0) return;

    await this.run((stale) =>
      this.showCategories(
        'Olá! Descreva o problema do cliente (ex.: "pagamento não processado") ou escolha uma categoria.',
        stale,
      ),
    );
  }

  async reset(): Promise<void> {
    this.epoch++;
    this.busy.set(false);
    this.categoriesCache = null;
    this.messages.set([]);
    await this.start();
  }

  // ------------------------------------------------------------
  // Ações do usuário
  // ------------------------------------------------------------
  async send(raw: string): Promise<void> {
    const text = raw.trim();
    if (!text || this.busy()) return;

    this.push({ kind: 'user', text });

    if (text.length < MIN_QUERY_LENGTH) {
      this.push({ kind: 'text', text: `Digite ao menos ${MIN_QUERY_LENGTH} caracteres para buscar.` });
      return;
    }

    await this.run(async (stale) => {
      const res = await firstValueFrom(this.api.search(text));
      if (stale()) return;

      if (res.total === 0) {
        await this.showCategories(
          `Não encontrei nenhum procedimento para “${text}”. A busca foi registrada para que o conteúdo possa ser cadastrado. Tente outras palavras ou navegue por categoria:`,
          stale,
        );
        return;
      }

      const choices: TopicChoice[] = res.results.map((r) => ({
        id: r.topicId,
        title: r.title,
        categoryName: r.categoryName,
        matchedBy: r.matchedBy,
      }));

      if (choices.length === 1) {
        const [only] = choices;
        this.push({ kind: 'text', text: `Encontrei um procedimento: ${only.title} (${only.categoryName}).` });
        this.openTopic(only);
        return;
      }

      const extra =
        res.total > choices.length
          ? ` Mostrando os ${choices.length} mais relevantes; refine a busca para ver os demais.`
          : '';

      this.push({
        kind: 'topics',
        text: `Encontrei ${res.total} procedimentos. Qual deles se aplica?${extra}`,
        topics: choices,
      });
    });
  }

  async pickCategory(messageId: number, category: Category): Promise<void> {
    if (this.busy()) return;

    this.markChosen(messageId, category.id);
    this.push({ kind: 'user', text: category.name });

    await this.run(async (stale) => {
      const topics = await firstValueFrom(this.api.topicsByCategory(category.id));
      if (stale()) return;

      if (topics.length === 0) {
        this.push({ kind: 'text', text: `Ainda não há procedimentos cadastrados em ${category.name}.` });
        return;
      }

      this.push({
        kind: 'topics',
        text: `Assuntos em ${category.name}:`,
        topics: topics.map((t) => ({ id: t.id, title: t.title })),
      });
    });
  }

  pickTopic(messageId: number, topic: TopicChoice): void {
    if (this.busy()) return;

    this.markChosen(messageId, topic.id);
    this.push({ kind: 'user', text: topic.title });
    this.openTopic(topic);
  }

  /**
   * Gancho da etapa 4: aqui entra a chamada a /api/topics/{id}/start e o motor de perguntas.
   * Por enquanto apenas confirma a seleção.
   */
  private openTopic(topic: TopicChoice): void {
    this.push({
      kind: 'text',
      text: `Assunto selecionado: ${topic.title}. O fluxo guiado de perguntas e a solução em blocos entram nas próximas etapas.`,
    });
  }

  // ------------------------------------------------------------
  // Internos
  // ------------------------------------------------------------
  private async showCategories(text: string, stale: IsStale): Promise<void> {
    if (!this.categoriesCache) {
      this.categoriesCache = await firstValueFrom(this.api.categories());
    }
    if (stale()) return;

    const categories = this.categoriesCache.filter((c) => c.topicCount > 0);
    this.push({ kind: 'categories', text, categories });
  }

  /** Controla o indicador de "digitando", trata erros e ignora respostas de conversas descartadas. */
  private async run(task: (isStale: IsStale) => Promise<void>): Promise<void> {
    const epoch = this.epoch;
    const stale: IsStale = () => epoch !== this.epoch;

    this.busy.set(true);
    try {
      await task(stale);
    } catch (err) {
      if (!stale()) {
        this.push({ kind: 'text', tone: 'error', text: this.errorText(err) });
      }
    } finally {
      if (!stale()) this.busy.set(false);
    }
  }

  private markChosen(messageId: number, chosenId: number): void {
    this.messages.update((list) =>
      list.map((m) =>
        m.id === messageId && (m.kind === 'categories' || m.kind === 'topics') ? { ...m, chosenId } : m,
      ),
    );
  }

  private push(message: NewChatMessage): void {
    this.messages.update((list) => [...list, { ...message, id: ++this.seq } as ChatMessage]);
  }

  private errorText(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) return 'Não consegui falar com o servidor. Verifique a conexão e tente novamente.';
      if (err.status >= 500) return 'O servidor encontrou um erro. Tente novamente em instantes.';
    }
    return 'Não foi possível concluir a consulta. Tente novamente.';
  }
}