import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // ...providers gerados pelo CLI (error listeners / zone), mantenha-os aqui
    provideRouter(routes),
    provideHttpClient(withFetch()),
  ],
};