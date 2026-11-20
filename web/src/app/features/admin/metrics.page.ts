import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AdminApiService, adminErrorMessage } from './admin-api.service';
import { Metrics } from './admin.models';

const TOP_UNRESOLVED = 10;

@Component({
  selector: 'app-metrics-page',
  imports: [DatePipe, DecimalPipe, PercentPipe],
  template: `
    <div class="flex flex-col gap-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-semibold text-slate-900">Métricas</h2>
        <div class="flex gap-1" role="group" aria-label="Período">
          @for (d of periods; track d) {
            <button
              type="button"
              class="btn"
              [class.btn-primary]="days() === d"
              [attr.aria-pressed]="days() === d"
              [disabled]="busy()"
              (click)="setDays(d)"
            >
              {{ d }} dias
            </button>
          }
        </div>
      </div>

      @if (error(); as e) {
        <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200" role="alert">{{ e }}</p>
      }

      @if (data(); as m) {
        <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div class="card">
            <p class="text-xs text-slate-500">Buscas</p>
            <p class="mt-1 text-2xl font-semibold text-slate-900">{{ m.totalSearches | number }}</p>
          </div>
          <div class="card">
            <p class="text-xs text-slate-500">Sem resultado</p>
            <p class="mt-1 text-2xl font-semibold text-slate-900">{{ m.searchesWithoutResult | number }}</p>
            @if (m.totalSearches > 0) {
              <p class="text-xs text-slate-500">{{ m.searchesWithoutResult / m.totalSearches | percent: '1.0-1' }} das buscas</p>
            }
          </div>
          <div class="card">
            <p class="text-xs text-slate-500">Feedbacks</p>
            <p class="mt-1 text-2xl font-semibold text-slate-900">{{ m.totalFeedback | number }}</p>
          </div>
          <div class="card">
            <p class="text-xs text-slate-500">Taxa de "resolveu"</p>
            <p class="mt-1 text-2xl font-semibold text-slate-900">
              {{ m.totalFeedback > 0 ? (m.resolvedFeedback / m.totalFeedback | percent: '1.0-1') : '—' }}
            </p>
          </div>
        </div>

        <section class="card">
          <h3 class="text-base font-semibold text-slate-900">Buscas sem resultado</h3>
          <p class="mt-1 text-xs text-slate-500">
            Termos que não encontraram nenhum assunto. Bons candidatos a palavra-chave, sinônimo ou assunto novo.
          </p>
          @if (m.unansweredSearches.length) {
            <div class="mt-3 overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead class="text-xs text-slate-500">
                  <tr class="border-b border-slate-200">
                    <th class="py-2 pr-3 font-medium">Termo (normalizado)</th>
                    <th class="py-2 pr-3 text-right font-medium">Ocorrências</th>
                    <th class="py-2 font-medium">Última</th>
                  </tr>
                </thead>
                <tbody>
                  @for (s of m.unansweredSearches; track s.normalizedTerm) {
                    <tr class="border-b border-slate-100 last:border-0">
                      <td class="py-2 pr-3 text-slate-900">{{ s.normalizedTerm }}</td>
                      <td class="py-2 pr-3 text-right tabular-nums">{{ s.count | number }}</td>
                      <td class="py-2 whitespace-nowrap text-slate-500">{{ s.lastAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="mt-3 text-sm text-slate-500">Nenhuma busca sem resultado no período.</p>
          }
        </section>

        <section class="card">
          <h3 class="text-base font-semibold text-slate-900">Soluções com mais "não resolveu"</h3>
          @if (mostUnresolved().length) {
            <ol class="mt-3 flex flex-col gap-2">
              @for (s of mostUnresolved(); track s.solutionId ?? -1) {
                <li class="flex items-baseline justify-between gap-3 text-sm">
                  <span class="min-w-0">
                    <span class="font-medium text-slate-900">{{ s.solutionTitle }}</span>
                    @if (s.topicTitle) {
                      <span class="text-slate-500"> · {{ s.topicTitle }}</span>
                    }
                  </span>
                  <span class="shrink-0 tabular-nums text-red-700">{{ s.notResolved }} de {{ s.total }}</span>
                </li>
              }
            </ol>
          } @else {
            <p class="mt-3 text-sm text-slate-500">Nenhum "não resolveu" no período.</p>
          }
        </section>

        <section class="card">
          <h3 class="text-base font-semibold text-slate-900">Taxa de "resolveu" por solução</h3>
          @if (m.solutions.length) {
            <div class="mt-3 overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead class="text-xs text-slate-500">
                  <tr class="border-b border-slate-200">
                    <th class="py-2 pr-3 font-medium">Solução</th>
                    <th class="py-2 pr-3 text-right font-medium">Sim</th>
                    <th class="py-2 pr-3 text-right font-medium">Não</th>
                    <th class="py-2 pr-3 font-medium">Taxa</th>
                    <th class="py-2 font-medium">Último</th>
                  </tr>
                </thead>
                <tbody>
                  @for (s of m.solutions; track s.solutionId ?? -1) {
                    <tr class="border-b border-slate-100 last:border-0">
                      <td class="py-2 pr-3">
                        <span class="text-slate-900">{{ s.solutionTitle }}</span>
                        @if (s.topicTitle) {
                          <span class="block text-xs text-slate-500">{{ s.topicTitle }}</span>
                        }
                      </td>
                      <td class="py-2 pr-3 text-right tabular-nums">{{ s.resolved }}</td>
                      <td class="py-2 pr-3 text-right tabular-nums">{{ s.notResolved }}</td>
                      <td class="py-2 pr-3">
                        <div class="flex items-center gap-2">
                          <div class="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                            <div class="h-full rounded-full bg-emerald-500" [style.width.%]="s.resolvedRate * 100"></div>
                          </div>
                          <span class="tabular-nums">{{ s.resolvedRate | percent: '1.0-0' }}</span>
                        </div>
                      </td>
                      <td class="py-2 whitespace-nowrap text-slate-500">{{ s.lastAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="mt-3 text-sm text-slate-500">Nenhum feedback no período.</p>
          }
        </section>
      } @else if (busy()) {
        <p class="text-sm text-slate-500">Carregando…</p>
      }
    </div>
  `,
})
export class MetricsPage implements OnInit {
  private readonly api = inject(AdminApiService);

  protected readonly periods = [7, 30, 90];
  protected readonly days = signal(30);
  protected readonly data = signal<Metrics | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly mostUnresolved = computed(() =>
    (this.data()?.solutions ?? [])
      .filter((s) => s.notResolved > 0)
      .sort((a, b) => b.notResolved - a.notResolved || a.resolvedRate - b.resolvedRate)
      .slice(0, TOP_UNRESOLVED),
  );

  ngOnInit(): void {
    void this.load();
  }

  protected setDays(d: number): void {
    this.days.set(d);
    void this.load();
  }

  private async load(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      this.data.set(await firstValueFrom(this.api.metrics(this.days())));
    } catch (err) {
      this.error.set(adminErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
