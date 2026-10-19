import { Component } from '@angular/core';

@Component({
  selector: 'app-bot-avatar',
  template: `
    <div
      class="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white"
      aria-hidden="true"
    >
      AS
    </div>
  `,
})
export class BotAvatarComponent {}