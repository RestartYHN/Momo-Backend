import { marked } from 'marked';

const ENTITY_MAP: Record<string, string> = { amp: '&', colon: ':', tab: '\t', newline: '\n' };

function safeCodePoint(code: number, fallback: string): string {
  return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : fallback;
}

// Decode the HTML entities / control characters attackers use to disguise a
// URL scheme (e.g. `javascript&#58;`, `&#106;avascript:`, `java\tscript:`).
function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (m, h) => safeCodePoint(parseInt(h, 16), m))
    .replace(/&#(\d+);?/g, (m, d) => safeCodePoint(parseInt(d, 10), m))
    .replace(/&(amp|colon|tab|newline);/gi, (m, n) => ENTITY_MAP[n.toLowerCase()] ?? m);
}

const ALLOWED_SCHEMES = new Set(['http', 'https', 'mailto']);

export function isSafeUrl(url: unknown): boolean {
  const decoded = decodeEntities(String(url ?? ''))
    .replace(/[\u0000-\u0020\u007f\u00a0]+/g, '')
    .toLowerCase();
  const match = /^([a-z][a-z0-9+.-]*):/.exec(decoded);
  if (!match) return true; // relative URL / no scheme
  return ALLOWED_SCHEMES.has(match[1]);
}

// Escape raw HTML in markdown for security, and force link/image URLs to an
// allowlist of schemes before they are rendered into href/src attributes.
marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    html: ({ text }: { text: string }) =>
      text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  },
  walkTokens: (token) => {
    const t = token as { type?: string; href?: unknown };
    if ((t.type === 'link' || t.type === 'image') && !isSafeUrl(t.href)) {
      t.href = '#';
    }
  },
});

// Post-markdown sanitization: belt-and-suspenders removal of javascript: URLs.
export function sanitizeHtml(html: string): string {
  return html
    .replace(/\s+(?:href|src|action|formaction)\s*=\s*"(?:javascript|vbscript):[^"]*"/gi, ' href="#"')
    .replace(/\s+(?:href|src|action|formaction)\s*=\s*'(?:javascript|vbscript):[^']*'/gi, " href='#'")
    .replace(/\s+(?:href|src|action|formaction)\s*=\s*(?:javascript|vbscript):[^\s>"]+/gi, ' href="#"');
}

export function parseMarkdown(content: string): string {
  if (!content) return '';
  const result = marked.parse(content);
  const html = typeof result === 'string' ? result : '';
  return sanitizeHtml(html);
}
