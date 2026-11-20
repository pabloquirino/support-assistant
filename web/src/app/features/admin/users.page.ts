import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../core/auth.service';
import { AdminApiService, adminErrorMessage } from './admin-api.service';
import { AdminUser, CreateUserBody, UserRole } from './admin.models';

const MIN_PASSWORD = 8;

@Component({
  selector: 'app-users-page',
  imports: [FormsModule, DatePipe],
  template: `
    <div class="flex flex-col gap-6">
      @if (error(); as e) {
        <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200" role="alert">{{ e }}</p>
      }
      @if (notice(); as n) {
        <p class="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200" role="status">{{ n }}</p>
      }

      <section class="card">
        <h2 class="text-base font-semibold text-slate-900">Usuários</h2>
        <p class="mt-1 text-xs text-slate-500">
          Analista acessa o chat. Admin acessa também a administração. Usuários inativos não conseguem entrar.
        </p>

        <div class="mt-4 flex flex-col divide-y divide-slate-100">
          @for (u of users(); track u.id) {
            <div class="flex flex-col gap-2 py-3">
              <div class="flex flex-wrap items-center gap-2">
                <input class="field min-w-40 flex-1" aria-label="Nome" maxlength="150" [(ngModel)]="u.name" />
                <input class="field min-w-48 flex-1" aria-label="E-mail" type="email" maxlength="200" [(ngModel)]="u.email" />
                <select class="field w-32" aria-label="Perfil" [(ngModel)]="u.role" [disabled]="u.id === meId()">
                  @for (r of roles; track r.value) {
                    <option [value]="r.value">{{ r.label }}</option>
                  }
                </select>
                <label class="flex items-center gap-1.5 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    class="size-4 accent-indigo-600"
                    [(ngModel)]="u.isActive"
                    [disabled]="u.id === meId()"
                  />
                  Ativo
                </label>
                <button type="button" class="btn" [disabled]="busy()" (click)="save(u)">Salvar</button>
                <button type="button" class="btn" [disabled]="busy()" (click)="togglePassword(u.id)">
                  Redefinir senha
                </button>
              </div>

              <p class="text-xs text-slate-500">
                @if (u.id === meId()) {
                  <span class="badge ml-0 mr-1">você</span>
                }
                @if (!u.isActive) {
                  <span class="mr-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">inativo</span>
                }
                Criado em {{ u.createdAt | date: 'dd/MM/yyyy HH:mm' }}
              </p>

              @if (passwordFor() === u.id) {
                <div class="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
                  <input
                    class="field min-w-48 flex-1"
                    type="password"
                    autocomplete="new-password"
                    aria-label="Nova senha"
                    placeholder="Nova senha (mín. 8 caracteres)"
                    maxlength="128"
                    [(ngModel)]="newPassword"
                  />
                  <button
                    type="button"
                    class="btn btn-primary"
                    [disabled]="busy() || newPassword.length < minPassword"
                    (click)="resetPassword(u)"
                  >
                    Definir senha
                  </button>
                  <button type="button" class="btn" (click)="togglePassword(u.id)">Cancelar</button>
                </div>
              }
            </div>
          } @empty {
            <p class="py-3 text-sm text-slate-500">Nenhum usuário cadastrado.</p>
          }
        </div>
      </section>

      <section class="card">
        <h2 class="text-base font-semibold text-slate-900">Novo usuário</h2>
        <form class="mt-3 flex flex-wrap items-end gap-2" (ngSubmit)="create()">
          <div class="min-w-40 flex-1">
            <label class="lbl" for="nu-name">Nome</label>
            <input id="nu-name" name="name" class="field" maxlength="150" [(ngModel)]="draft.name" />
          </div>
          <div class="min-w-48 flex-1">
            <label class="lbl" for="nu-email">E-mail</label>
            <input id="nu-email" name="email" type="email" class="field" maxlength="200" [(ngModel)]="draft.email" />
          </div>
          <div class="min-w-40 flex-1">
            <label class="lbl" for="nu-pass">Senha inicial</label>
            <input
              id="nu-pass"
              name="password"
              type="password"
              autocomplete="new-password"
              class="field"
              maxlength="128"
              placeholder="mín. 8 caracteres"
              [(ngModel)]="draft.password"
            />
          </div>
          <div class="w-32">
            <label class="lbl" for="nu-role">Perfil</label>
            <select id="nu-role" name="role" class="field" [(ngModel)]="draft.role">
              @for (r of roles; track r.value) {
                <option [value]="r.value">{{ r.label }}</option>
              }
            </select>
          </div>
          <button
            type="submit"
            class="btn btn-primary"
            [disabled]="busy() || !draft.name.trim() || !draft.email.trim() || draft.password.length < minPassword"
          >
            Criar
          </button>
        </form>
      </section>
    </div>
  `,
})
export class UsersPage implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly auth = inject(AuthService);

  protected readonly minPassword = MIN_PASSWORD;
  protected readonly roles: { value: UserRole; label: string }[] = [
    { value: 'Analyst', label: 'Analista' },
    { value: 'Admin', label: 'Admin' },
  ];

  protected readonly users = signal<AdminUser[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly passwordFor = signal<number | null>(null);
  protected readonly meId = () => this.auth.user()?.id ?? null;

  protected newPassword = '';
  protected draft: CreateUserBody = this.emptyDraft();

  ngOnInit(): void {
    void this.run(() => this.load());
  }

  protected save(u: AdminUser): void {
    void this.run(async () => {
      await firstValueFrom(
        this.api.updateUser(u.id, { name: u.name, email: u.email, role: u.role, isActive: u.isActive }),
      );
      await this.load();
      // O próprio nome/e-mail pode ter mudado: atualiza o cabeçalho.
      if (u.id === this.meId()) await this.auth.load();
      this.notice.set('Usuário salvo.');
    });
  }

  protected togglePassword(id: number): void {
    this.newPassword = '';
    this.passwordFor.update((current) => (current === id ? null : id));
  }

  protected resetPassword(u: AdminUser): void {
    void this.run(async () => {
      await firstValueFrom(this.api.resetPassword(u.id, this.newPassword));
      this.newPassword = '';
      this.passwordFor.set(null);
      this.notice.set(`Senha de ${u.name} redefinida.`);
    });
  }

  protected create(): void {
    void this.run(async () => {
      const created = await firstValueFrom(this.api.createUser({ ...this.draft, email: this.draft.email.trim() }));
      this.draft = this.emptyDraft();
      await this.load();
      this.notice.set(`Usuário ${created.name} criado.`);
    });
  }

  private async load(): Promise<void> {
    this.users.set(await firstValueFrom(this.api.users()));
  }

  private emptyDraft(): CreateUserBody {
    return { name: '', email: '', password: '', role: 'Analyst' };
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await fn();
    } catch (err) {
      this.error.set(adminErrorMessage(err));
      // Desfaz edições locais não salvas que a API recusou.
      await this.load().catch(() => undefined);
    } finally {
      this.busy.set(false);
    }
  }
}
