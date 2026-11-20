import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ThemeService } from './core/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App {
  constructor() {
    // Instancia cedo: mantém o atributo data-theme do <html> sincronizado com a escolha.
    inject(ThemeService);
  }
}
