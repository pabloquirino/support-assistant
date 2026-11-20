import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.guards';
import { AuthService } from './core/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...providers gerados pelo CLI (error listeners / zone), mantenha-os aqui
    provideRouter(routes),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor]),
      // Cookie emitido pela API em /api/auth/session e reenviado como header (proteção CSRF).
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
    ),
    // Descobre se já existe sessão antes da primeira navegação (os guards dependem disso).
    provideAppInitializer(() => inject(AuthService).load()),
  ],
};
