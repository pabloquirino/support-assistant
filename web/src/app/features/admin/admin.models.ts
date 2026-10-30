import { AttachmentInfo, BlockType, NodeType } from '../../core/models';

export type TermKind = 'Keyword' | 'Synonym';

export interface AdminCategory {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
  topicCount: number;
}

export interface AdminTopicItem {
  id: number;
  title: string;
  categoryId: number;
  categoryName: string;
  isActive: boolean;
  hasRoot: boolean;
}

export interface AdminTerm {
  term: string;
  kind: TermKind;
}

export interface AdminOption {
  id: number;
  text: string;
  nextNodeId: number;
}

export interface AdminBlock {
  id: number;
  type: BlockType;
  title: string;
  contentMarkdown: string;
  collapsedByDefault: boolean;
  attachments: AttachmentInfo[];
}

export interface AdminSolution {
  id: number;
  title: string;
  summary: string;
  blocks: AdminBlock[];
}

export interface AdminNode {
  id: number;
  type: NodeType;
  questionText: string | null;
  options: AdminOption[];
  solution: AdminSolution | null;
}

export interface AdminTopic {
  id: number;
  categoryId: number;
  title: string;
  isActive: boolean;
  rootNodeId: number | null;
  terms: AdminTerm[];
  nodes: AdminNode[];
}

export interface QuestionBody {
  questionText: string;
  options: { id?: number; text: string; nextNodeId: number | null }[];
}

export interface SolutionBody {
  title: string;
  summary: string;
  blocks: {
    id?: number;
    type: BlockType;
    title: string;
    contentMarkdown: string;
    collapsedByDefault: boolean;
  }[];
}

export const BLOCK_TYPES: { value: BlockType; label: string }[] = [
  { value: 'Steps', label: 'Passo a passo' },
  { value: 'CustomerMessage', label: 'Mensagem ao cliente' },
  { value: 'Ticket', label: 'Modelo de ticket' },
  { value: 'Attachments', label: 'Anexos (PDF)' },
  { value: 'Note', label: 'Observação' },
  { value: 'Warning', label: 'Alerta' },
];

export function nodeLabel(n: AdminNode): string {
  const text = n.type === 'Question' ? (n.questionText ?? '') : (n.solution?.title ?? '');
  const short = text.length > 50 ? `${text.slice(0, 50)}…` : text;
  return `#${n.id} · ${n.type === 'Question' ? 'Pergunta' : 'Solução'}: ${short}`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}