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

// ---- Fluxo (árvore de decisão) ----

export type NodeType = 'Question' | 'Solution';

export type BlockType = 'Steps' | 'CustomerMessage' | 'Ticket' | 'Attachments' | 'Note' | 'Warning';

export interface FlowOption {
  id: number;
  text: string;
  nextNodeId: number;
}

export interface AttachmentInfo {
  id: string;
  fileName: string;
  sizeBytes: number;
}

export interface SolutionBlock {
  id: number;
  type: BlockType;
  title: string;
  contentMarkdown: string;
  sortOrder: number;
  collapsedByDefault: boolean;
  attachments: AttachmentInfo[];
}

export interface SolutionData {
  id: number;
  title: string;
  summary: string;
  blocks: SolutionBlock[];
}

/** Resposta de /api/topics/{id}/start e /api/nodes/{id}. */
export interface FlowNode {
  id: number;
  topicId: number;
  topicTitle: string;
  type: NodeType;
  questionText: string | null;
  options: FlowOption[];
  solution: SolutionData | null;
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

/** Campos comuns às mensagens que representam um nó da árvore. */
interface FlowMessage extends BaseMessage {
  /** Identifica uma execução do fluxo de um assunto (muda a cada vez que o assunto é aberto). */
  flowId: number;
  /** Profundidade no fluxo: 0 = nó raiz. */
  step: number;
}

export interface QuestionMessage extends FlowMessage {
  kind: 'question';
  text: string;
  options: FlowOption[];
  chosenOptionId?: number;
}

export interface SolutionMessage extends FlowMessage {
  kind: 'solution';
  topicTitle: string;
  solution: SolutionData;
}

export type ChatMessage =
  | UserMessage
  | TextMessage
  | CategoriesMessage
  | TopicsMessage
  | QuestionMessage
  | SolutionMessage;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Mensagem ainda sem id (o store atribui). */
export type NewChatMessage = DistributiveOmit<ChatMessage, 'id'>;