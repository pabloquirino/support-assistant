import { Component, computed, input, output } from '@angular/core';

import { Category, ChatMessage, FlowOption, MatchSource, TopicChoice } from '../../core/models';
import { BotAvatarComponent } from './bot-avatar.component';

@Component({
  selector: 'app-message',
  imports: [BotAvatarComponent],
  templateUrl: './message.component.html',
})
export class MessageComponent {
  readonly message = input.required<ChatMessage>();
  /** Bloqueia os botões enquanto uma requisição está em andamento. */
  readonly disabled = input(false);
  /** Verdadeiro quando este é o nó do fluxo com o qual o usuário ainda pode interagir. */
  readonly active = input(false);

  readonly categoryPicked = output<Category>();
  readonly topicPicked = output<TopicChoice>();
  readonly optionPicked = output<FlowOption>();
  readonly backClicked = output<void>();
  readonly restartClicked = output<void>();

  protected readonly matchLabel: Record<MatchSource, string> = {
    Title: 'Título',
    Keyword: 'Palavra-chave',
    Synonym: 'Sinônimo',
    Content: 'Conteúdo',
  };

  protected readonly bubbleClass = computed(() => {
    const m = this.message();
    if (m.kind === 'user') return 'bg-indigo-600 text-white rounded-br-sm';
    if (m.kind === 'text' && m.tone === 'error') {
      return 'bg-red-50 text-red-800 ring-1 ring-red-200 rounded-tl-sm';
    }
    if (m.kind === 'solution') return 'bg-white text-slate-800 ring-1 ring-emerald-300 rounded-tl-sm';
    return 'bg-white text-slate-800 ring-1 ring-slate-200 rounded-tl-sm';
  });

  /** Voltar/Recomeçar só fazem sentido no nó ativo e a partir do segundo passo do fluxo. */
  protected readonly canNavigate = computed(() => {
    const m = this.message();
    return this.active() && (m.kind === 'question' || m.kind === 'solution') && m.step > 0;
  });

  protected readonly optionsLocked = computed(() => {
    const m = this.message();
    return (
      this.disabled() || !this.active() || (m.kind === 'question' && m.chosenOptionId !== undefined)
    );
  });

  protected chipClass(active: boolean): string {
    return active
      ? 'border-indigo-600 bg-indigo-600 text-white disabled:opacity-100'
      : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50';
  }

  protected cardClass(active: boolean): string {
    return active
      ? 'border-indigo-500 bg-indigo-50 disabled:opacity-100'
      : 'border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50';
  }
}