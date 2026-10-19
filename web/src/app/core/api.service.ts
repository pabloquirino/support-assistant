import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Category, FlowNode, SearchResponse, TopicSummary } from './models';

/** Caminhos relativos: em dev o proxy.conf.json encaminha, em produção o nginx. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';

  categories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.base}/categories`);
  }

  topicsByCategory(categoryId: number): Observable<TopicSummary[]> {
    return this.http.get<TopicSummary[]>(`${this.base}/categories/${categoryId}/topics`);
  }

  search(q: string): Observable<SearchResponse> {
    return this.http.get<SearchResponse>(`${this.base}/search`, { params: { q } });
  }

  /** Nó raiz do assunto (pergunta ou solução direta). */
  topicStart(topicId: number): Observable<FlowNode> {
    return this.http.get<FlowNode>(`${this.base}/topics/${topicId}/start`);
  }

  /** Qualquer nó da árvore (o cliente segue Option.nextNodeId). */
  node(nodeId: number): Observable<FlowNode> {
    return this.http.get<FlowNode>(`${this.base}/nodes/${nodeId}`);
  }
}