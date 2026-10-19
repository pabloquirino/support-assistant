// ---- Contratos da API (camelCase, enums como string) ----

export interface Category {
  id: number;
  name: string;
  topicCount: number;
}

export interface TopicSummary {
  id: number;
  title: string;
}

export type MatchSource = 'Title' | 'Keyword' | 'Synonym' | 'Content';

export interface SearchResult {
  topicId: number;
  title: string;
  categoryId: number;
  categoryName: string;
  matchedBy: MatchSource;
}

export interface SearchResponse {
  query: string;
  total: number;
  results: SearchResult[];
}

// ---- Modelo do chat ----

/** Opção de assunto exibida em um card de escolha. */
export interface TopicChoice {
  id: number;
  title: string;
  categoryName?: string;
  matchedBy?: MatchSource;
}

interface BaseMessage {
  id: number;
}

export interface UserMessage extends BaseMessage {
  kind: 'user';
  text: string;
}

export interface TextMessage extends BaseMessage {
  kind: 'text';
  text: string;
  tone?: 'default' | 'error';
}

export interface CategoriesMessage extends BaseMessage {
  kind: 'categories';
  text: string;
  categories: Category[];
  chosenId?: number;
}

export interface TopicsMessage extends BaseMessage {
  kind: 'topics';
  text: string;
  topics: TopicChoice[];
  chosenId?: number;
}

export type ChatMessage = UserMessage | TextMessage | CategoriesMessage | TopicsMessage;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Mensagem ainda sem id (o store atribui). */
export type NewChatMessage = DistributiveOmit<ChatMessage, 'id'>;