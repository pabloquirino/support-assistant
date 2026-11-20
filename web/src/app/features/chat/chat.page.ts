import { Component, ElementRef, OnInit, afterRenderEffect, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';

import { BotAvatarComponent } from './bot-avatar.component';
import { ChatInputComponent } from './chat-input.component';
import { ChatStore } from './chat.store';
import { MessageComponent } from './message.component';

@Component({
  selector: 'app-chat-page',
  imports: [MessageComponent, ChatInputComponent, BotAvatarComponent, RouterLink],
  templateUrl: './chat.page.html',
})
export class ChatPage implements OnInit {
  protected readonly store = inject(ChatStore);
  protected readonly auth = inject(AuthService);
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');

  constructor() {
    // Rola até o fim depois que novas mensagens (ou o indicador de "digitando") forem renderizados.
    afterRenderEffect(() => {
      this.store.messages();
      this.store.busy();

      const el = this.scroller().nativeElement;
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }

  ngOnInit(): void {
    void this.store.start();
  }
}