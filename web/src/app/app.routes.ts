import { Routes } from '@angular/router';

import { adminGuard, authGuard, guestGuard } from './core/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Entrar · Assistant Support',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    // Telas autenticadas: menu lateral + conteúdo.
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Assistant Support',
        loadComponent: () => import('./features/chat/chat.page').then((m) => m.ChatPage),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        canActivateChild: [adminGuard],
        loadComponent: () => import('./features/admin/admin-shell.component').then((m) => m.AdminShellComponent),
        children: [
          {
            path: '',
            title: 'Conteúdo · Assistant Support',
            loadComponent: () => import('./features/admin/admin-home.page').then((m) => m.AdminHomePage),
          },
          {
            path: 'topics/:id',
            title: 'Editar assunto · Assistant Support',
            loadComponent: () => import('./features/admin/topic-editor.page').then((m) => m.TopicEditorPage),
          },
          {
            path: 'users',
            title: 'Usuários · Assistant Support',
            loadComponent: () => import('./features/admin/users.page').then((m) => m.UsersPage),
          },
          {
            path: 'metrics',
            title: 'Métricas · Assistant Support',
            loadComponent: () => import('./features/admin/metrics.page').then((m) => m.MetricsPage),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
