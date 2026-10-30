import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AttachmentInfo, NodeType } from '../../core/models';
import {
  AdminCategory,
  AdminNode,
  AdminTerm,
  AdminTopic,
  AdminTopicItem,
  QuestionBody,
  SolutionBody,
} from './admin.models';

export interface CategoryBody {
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface TopicBody {
  categoryId: number;
  title: string;
  isActive: boolean;
  rootNodeId: number | null;
  terms: AdminTerm[];
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/admin';

  // Categorias
  categories(): Observable<AdminCategory[]> {
    return this.http.get<AdminCategory[]>(`${this.base}/categories`);
  }

  saveCategory(id: number | null, body: CategoryBody): Observable<AdminCategory> {
    return id === null
      ? this.http.post<AdminCategory>(`${this.base}/categories`, body)
      : this.http.put<AdminCategory>(`${this.base}/categories/${id}`, body);
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/categories/${id}`);
  }

  // Assuntos
  topics(categoryId: number | null): Observable<AdminTopicItem[]> {
    const params = categoryId === null
      ? new HttpParams()
      : new HttpParams().set('categoryId', categoryId);
    return this.http.get<AdminTopicItem[]>(`${this.base}/topics`, { params });
  }

  topic(id: number): Observable<AdminTopic> {
    return this.http.get<AdminTopic>(`${this.base}/topics/${id}`);
  }

  createTopic(body: { categoryId: number; title: string }): Observable<AdminTopic> {
    return this.http.post<AdminTopic>(`${this.base}/topics`, body);
  }

  updateTopic(id: number, body: TopicBody): Observable<AdminTopic> {
    return this.http.put<AdminTopic>(`${this.base}/topics/${id}`, body);
  }

  deleteTopic(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/topics/${id}`);
  }

  // Nós
  node(id: number): Observable<AdminNode> {
    return this.http.get<AdminNode>(`${this.base}/nodes/${id}`);
  }

  createNode(topicId: number, body: { type: NodeType; text: string }): Observable<AdminNode> {
    return this.http.post<AdminNode>(`${this.base}/topics/${topicId}/nodes`, body);
  }

  saveQuestion(nodeId: number, body: QuestionBody): Observable<AdminNode> {
    return this.http.put<AdminNode>(`${this.base}/nodes/${nodeId}/question`, body);
  }

  saveSolution(nodeId: number, body: SolutionBody): Observable<AdminNode> {
    return this.http.put<AdminNode>(`${this.base}/nodes/${nodeId}/solution`, body);
  }

  deleteNode(nodeId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/nodes/${nodeId}`);
  }

  // Anexos
  uploadAttachment(blockId: number, file: File): Observable<AttachmentInfo> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<AttachmentInfo>(`${this.base}/blocks/${blockId}/attachments`, form);
  }

  deleteAttachment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/attachments/${id}`);
  }
}

/** Prefere a mensagem de negócio devolvida pela API ({ error }). */
export function adminErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const message = (err.error as { error?: unknown } | null)?.error;
    if (typeof message === 'string') return message;
    if (err.status === 0) return 'Não consegui falar com o servidor.';
    if (err.status === 413) return 'O arquivo é grande demais.';
    if (err.status === 404) return 'Registro não encontrado.';
    if (err.status >= 500) return 'Erro no servidor. Tente novamente.';
  }
  return 'Não foi possível concluir a operação.';
}