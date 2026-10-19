import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../core/api.service';
import {
  Category,
  ChatMessage,
  FlowNode,
  FlowOption,
  NewChatMessage,
  QuestionMessage,
  SolutionMessage,
  TopicChoice,
} from '../../core/models';

const MIN_QUERY_LENGTH = 2;

type IsStale = () => boolean;

/** Nó recebido da API com dados inconsistentes (ex.: pergunta sem opções). */
class FlowDataError extends Error {}

@Injectable({ providedIn: 'root' })
export class ChatStore {
  private readonly api = inject(ApiService);

  private seq = 0;
  private flowSeq = 0;
  /** Incrementa em "Nova conversa": respostas pendentes da conversa anterior são descartadas. */
  private epoch = 0;
  private categoriesCache: Category[] | null = null;

  readonly messages = signal<ChatMessage[]>([]);
  readonly busy = signal(false);

  /**
   * Id do nó (pergunta ou solução) com o qual o usuário ainda pode interagir:
   * o último nó da conversa, desde que não haja mensagem do usuário depois dele.
   */
  readonly activeNodeId = computed<number | null>(() => {
    const list = this.messages();
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (m.kind === 'user') return null;
      if (m.kind === 'question' || m.kind === 'solution') return m.id;
    }
    return null;
  });

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
  // Busca e navegação por categoria
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
        await this.openTopic(only, stale);
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

  async pickTopic(messageId: number, topic: TopicChoice): Promise<void> {
    if (this.busy()) return;

    this.markChosen(messageId, topic.id);
    this.push({ kind: 'user', text: topic.title });

    await this.run(async (stale) => {
      try {
        await this.openTopic(topic, stale);
      } catch (err) {
        // Libera o card para o usuário tentar de novo.
        if (!stale()) this.markChosen(messageId, undefined);
        throw err;
      }
    });
  }

  // ------------------------------------------------------------
  // Motor do fluxo
  // ------------------------------------------------------------

  /** Responde a pergunta ativa e avança para o nó apontado pela opção. */
  async answer(messageId: number, option: FlowOption): Promise<void> {
    if (this.busy() || this.activeNodeId() !== messageId) return;

    const question = this.messages().find((m) => m.id === messageId);
    if (!question || question.kind !== 'question' || question.chosenOptionId !== undefined) return;

    const { flowId, step } = question;

    this.messages.update((list) =>
      list.map((m) => (m.id === messageId && m.kind === 'question' ? { ...m, chosenOptionId: option.id } : m)),
    );
    this.push({ kind: 'user', text: option.text });

    await this.run(async (stale) => {
      try {
        const node = await firstValueFrom(this.api.node(option.nextNodeId));
        if (stale()) return;
        this.pushNode(node, flowId, step + 1);
      } catch (err) {
        // Desfaz a escolha: remove a resposta do usuário e reabre a pergunta.
        if (!stale()) this.truncateTo(this.indexOf(messageId));
        throw err;
      }
    });
  }

  /** Volta uma pergunta: reabre o nó anterior e descarta a resposta e o nó atual. */
  goBack(): void {
    if (this.busy()) return;

    const current = this.activeNode();
    if (!current || current.step === 0) return;

    this.truncateToStep(current.flowId, current.step - 1);
  }

  /** Volta ao nó raiz do assunto atual, sem nova requisição. */
  restartFlow(): void {
    if (this.busy()) return;

    const current = this.activeNode();
    if (!current || current.step === 0) return;

    this.truncateToStep(current.flowId, 0);
  }

  private async openTopic(topic: TopicChoice, stale: IsStale): Promise<void> {
    const node = await firstValueFrom(this.api.topicStart(topic.id));
    if (stale()) return;

    this.pushNode(node, ++this.flowSeq, 0);
  }

  private pushNode(node: FlowNode, flowId: number, step: number): void {
    if (node.type === 'Question') {
      if (!node.questionText || node.options.length === 0) {
        throw new FlowDataError(`Pergunta ${node.id} sem texto ou sem opções.`);
      }

      this.push({ kind: 'question', flowId, step, text: node.questionText, options: node.options });
      return;
    }

    if (!node.solution) {
      throw new FlowDataError(`Solução ${node.id} sem conteúdo.`);
    }

    this.push({ kind: 'solution', flowId, step, topicTitle: node.topicTitle, solution: node.solution });
  }

  private activeNode(): QuestionMessage | SolutionMessage | null {
    const id = this.activeNodeId();
    if (id === null) return null;

    const m = this.messages().find((x) => x.id === id);
    return m && (m.kind === 'question' || m.kind === 'solution') ? m : null;
  }

  private truncateToStep(flowId: number, step: number): void {
    const idx = this.messages().findIndex(
      (m) => m.kind === 'question' && m.flowId === flowId && m.step === step,
    );
    if (idx >= 0) this.truncateTo(idx);
  }

  private indexOf(messageId: number): number {
    return this.messages().findIndex((m) => m.id === messageId);
  }

  /** Mantém o histórico até a mensagem do índice (inclusive) e reabre essa pergunta, se for uma. */
  private truncateTo(index: number): void {
    if (index < 0) return;

    this.messages.update((list) => {
      const kept = list.slice(0, index + 1);
      const last = kept[index];
      if (last.kind === 'question') {
        kept[index] = { ...last, chosenOptionId: undefined };
      }
      return kept;
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

  private markChosen(messageId: number, chosenId: number | undefined): void {
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
    if (err instanceof FlowDataError) {
      return 'Este passo do procedimento está incompleto. Avise o administrador do conteúdo.';
    }
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) return 'Não consegui falar com o servidor. Verifique a conexão e tente novamente.';
      if (err.status === 404) return 'Este passo não está mais disponível. Use "Recomeçar" ou faça uma nova busca.';
      if (err.status >= 500) return 'O servidor encontrou um erro. Tente novamente em instantes.';
    }
    return 'Não foi possível concluir a consulta. Tente novamente.';
  }
}