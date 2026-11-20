import { Component, computed, input, output } from '@angular/core';

import { Category, ChatMessage, FlowOption, MatchSource, TopicChoice } from '../../core/models';
import { BotAvatarComponent } from './bot-avatar.component';
import { SolutionPanelComponent } from './solution-panel.component';

@Component({
  selector: 'app-message',
  imports: [BotAvatarComponent, SolutionPanelComponent],
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
  readonly feedbackGiven = output<boolean>();

  protected readonly matchLabel: Record<MatchSource, string> = {
    Title: 'Título',
    Keyword: 'Palavra-chave',
    Synonym: 'Sinônimo',
    Content: 'Conteúdo',
  };

  protected readonly bubbleClass = computed(() => {
    const base = 'min-w-0 break-words text-sm';
    const m = this.message();

    if (m.kind === 'user') {
      return `${base} max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2.5 text-white shadow-sm`;
    }
    if (m.kind === 'solution') {
      return `${base} flex-1`;
    }
    if (m.kind === 'text' && m.tone === 'error') {
      return `${base} max-w-[85%] rounded-2xl rounded-tl-sm bg-red-50 px-4 py-2.5 text-red-800 shadow-sm ring-1 ring-red-200`;
    }
    return `${base} max-w-[85%] rounded-2xl rounded-tl-sm bg-surface px-4 py-2.5 text-slate-800 shadow-sm ring-1 ring-slate-200`;
  });

  /** Voltar/Recomeçar nas perguntas: só no nó ativo e a partir do segundo passo. (A solução tem a barra própria.) */
  protected readonly canNavigate = computed(() => {
    const m = this.message();
    return this.active() && m.kind === 'question' && m.step > 0;
  });

  protected readonly optionsLocked = computed(() => {
    const m = this.message();
    return this.disabled() || !this.active() || (m.kind === 'question' && m.chosenOptionId !== undefined);
  });

  protected chipClass(active: boolean): string {
    return active
      ? 'border-indigo-600 bg-indigo-600 text-white disabled:opacity-100'
      : 'border-slate-300 bg-surface text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50';
  }

  protected cardClass(active: boolean): string {
    return active
      ? 'border-indigo-500 bg-indigo-50 disabled:opacity-100'
      : 'border-slate-200 bg-surface hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50';
  }
}