import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AdminApiService, adminErrorMessage } from './admin-api.service';
import { AdminCategory, AdminTopicItem } from './admin.models';

@Component({
  selector: 'app-admin-home',
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-home.page.html',
})
export class AdminHomePage implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly router = inject(Router);

  protected readonly categories = signal<AdminCategory[]>([]);
  protected readonly topics = signal<AdminTopicItem[]>([]);
  protected readonly filter = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected newCategory = { name: '', sortOrder: 0, isActive: true };
  protected newTopic: { categoryId: number | null; title: string } = { categoryId: null, title: '' };

  ngOnInit(): void {
    void this.run(async () => {
      await this.loadCategories();
      await this.loadTopics();
    });
  }

  protected setFilter(value: number | null): void {
    this.filter.set(value);
    void this.run(() => this.loadTopics());
  }

  protected addCategory(): void {
    void this.run(async () => {
      await firstValueFrom(this.api.saveCategory(null, this.newCategory));
      this.newCategory = { name: '', sortOrder: 0, isActive: true };
      await this.reloadAll();
    });
  }

  protected saveCategory(c: AdminCategory): void {
    void this.run(async () => {
      await firstValueFrom(
        this.api.saveCategory(c.id, { name: c.name, sortOrder: c.sortOrder, isActive: c.isActive }),
      );
      await this.reloadAll();
    });
  }

  protected deleteCategory(c: AdminCategory): void {
    if (!confirm(`Excluir a categoria "${c.name}"?`)) return;

    void this.run(async () => {
      await firstValueFrom(this.api.deleteCategory(c.id));
      await this.reloadAll();
    });
  }

  protected createTopic(): void {
    const { categoryId, title } = this.newTopic;
    if (categoryId === null || !title.trim()) {
      this.error.set('Escolha a categoria e informe o título do assunto.');
      return;
    }

    void this.run(async () => {
      const topic = await firstValueFrom(this.api.createTopic({ categoryId, title }));
      await this.router.navigate(['/admin/topics', topic.id]);
    });
  }

  protected deleteTopic(t: AdminTopicItem): void {
    if (!confirm(`Excluir "${t.title}"? O fluxo, as soluções e os PDFs deste assunto serão removidos.`)) return;

    void this.run(async () => {
      await firstValueFrom(this.api.deleteTopic(t.id));
      await this.reloadAll();
    });
  }

  private async reloadAll(): Promise<void> {
    await this.loadCategories();
    await this.loadTopics();
  }

  private async loadCategories(): Promise<void> {
    const list = await firstValueFrom(this.api.categories());
    this.categories.set(list);

    const selected = this.newTopic.categoryId;
    if (selected === null || !list.some((c) => c.id === selected)) {
      this.newTopic.categoryId = list[0]?.id ?? null;
    }
  }

  private async loadTopics(): Promise<void> {
    this.topics.set(await firstValueFrom(this.api.topics(this.filter())));
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    try {
      await fn();
    } catch (err) {
      console.error('[Admin]', err);
      this.error.set(adminErrorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}