import { marked } from 'marked';

// Escape raw HTML in markdown for security
marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    html: ({ text }: { text: string }) =>
      text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
});

export function parseMarkdown(content: string): string {
  if (!content) return '';
  const result = marked.parse(content);
  return typeof result === 'string' ? result : '';
}
