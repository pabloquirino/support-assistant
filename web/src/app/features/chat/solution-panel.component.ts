import { Component, computed, input, output } from '@angular/core';

import { SolutionMessage } from '../../core/models';
import { SolutionBlockComponent } from './solution-block.component';

@Component({
  selector: 'app-solution-panel',
  imports: [SolutionBlockComponent],
  templateUrl: './solution-panel.component.html',
})
export class SolutionPanelComponent {
  readonly message = input.required<SolutionMessage>()
  /** Verdadeiro quando este é o nó com o qual o usuário ainda pode navegar. */
  readonly active = input(false);
  readonly disabled = input(false);

  readonly backClicked = output<void>();
  readonly restartClicked = output<void>();
  readonly feedbackGiven = output<boolean>();

  /** Voltar/Recomeçar só fazem sentido no nó ativo e a partir do segundo passo do fluxo. */
  protected readonly canNavigate = computed(() => this.active() && this.message().step > 0);

  protected readonly feedbackStatus = computed(() => this.message().feedback?.status ?? 'idle');
  protected readonly feedbackResolved = computed(() => this.message().feedback?.resolved ?? false);
}