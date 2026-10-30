import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Assistant Support',
    loadComponent: () => import('./features/chat/chat.page').then((m) => m.ChatPage),
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin-shell.component').then((m) => m.AdminShellComponent),
    children: [
      {
        path: '',
        title: 'Admin · Assistant Support',
        loadComponent: () => import('./features/admin/admin-home.page').then((m) => m.AdminHomePage),
      },
      {
        path: 'topics/:id',
        title: 'Editar assunto · Assistant Support',
        loadComponent: () => import('./features/admin/topic-editor.page').then((m) => m.TopicEditorPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];