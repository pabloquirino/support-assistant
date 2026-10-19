import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Assistant Support',
    loadComponent: () => import('./features/chat/chat.page').then((m) => m.ChatPage),
  },
  { path: '**', redirectTo: '' },
];