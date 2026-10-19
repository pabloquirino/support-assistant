import { Injectable, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';
import { Token, Tokens, marked } from 'marked';

export type StepPart =
  | { kind: 'html'; html: SafeHtml }
  | { kind: 'step'; index: number; html: SafeHtml };

// Links do conteúdo sempre abrem em nova aba, sem acesso ao window.opener.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/**
 * Markdown -> HTML sanitizado (DOMPurify), nunca confiando no que vem do banco.
 * O bypassSecurityTrustHtml só é aplicado depois da sanitização.
 */
@Injectable({ providedIn: 'root' })
export class MarkdownService {
  private readonly sanitizer = inject(DomSanitizer);

  render(markdown: string): SafeHtml {
    return this.trust(marked.parse(markdown, { async: false }) as string);
  }

  /**
   * Divide um bloco Steps em trechos: itens de lista viram passos (checklist) e o restante
   * (introduções, observações) continua como HTML.
   */
  steps(markdown: string): StepPart[] {
    const parts: StepPart[] = [];
    let pending: Token[] = [];
    let index = 0;

    const flush = () => {
      if (pending.length === 0) return;
      parts.push({ kind: 'html', html: this.trust(marked.parser(pending)) });
      pending = [];
    };

    for (const token of marked.lexer(markdown)) {
      if (token.type !== 'list') {
        pending.push(token);
        continue;
      }

      flush();
      for (const item of (token as Tokens.List).items) {
        parts.push({ kind: 'step', index: index++, html: this.trust(this.unwrapParagraph(marked.parser(item.tokens))) });
      }
    }

    flush();
    return parts;
  }

  /**
   * Texto para a área de transferência: sem marcação, e com as quebras de linha "de edição"
   * dentro de um parágrafo desfeitas (listas mantêm uma linha por item).
   */
  plainText(markdown: string): string {
    return markdown
      .replace(/\r\n/g, '\n')
      .split(/\n{2,}/)
      .map((paragraph) => {
        const lines = paragraph
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        const isList = lines.some((l) => /^([-*+]|\d+[.)])\s+/.test(l));
        return lines.join(isList ? '\n' : ' ');
      })
      .join('\n\n')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
      .replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$|[.,;:!?])/g, '$1$2')
      .trim();
  }

  /** Itens de lista "tight" saem do parser envoltos em <p>; remove quando é só um parágrafo. */
  private unwrapParagraph(html: string): string {
    const match = /^<p>([\s\S]*?)<\/p>\s*$/.exec(html);
    return match && !match[1].includes('<p>') ? match[1] : html;
  }

  private trust(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(DOMPurify.sanitize(html));
  }
}