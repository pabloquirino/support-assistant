import { Pipe, PipeTransform, inject } from '@angular/core';
import { SafeHtml } from '@angular/platform-browser';

import { MarkdownService } from './markdown.service';

@Pipe({ name: 'markdown' })
export class MarkdownPipe implements PipeTransform {
  private readonly markdown = inject(MarkdownService);

  transform(value: string | null | undefined): SafeHtml {
    return this.markdown.render(value ?? '');
  }
}