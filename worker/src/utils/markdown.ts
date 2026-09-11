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

// Escape raw HTML in markdown, and force link/image URLs to an allowlist of
// schemes before they are rendered into href/src attributes (first line of
// defence; the HTMLRewriter allowlist below is the second).
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

// Tag -> allowed attributes. A tag absent from this map is disallowed.
const ALLOWED_ATTRS: Record<string, string[]> = {
  p: [], br: [], b: [], i: [], em: [], strong: [], del: [],
  ul: [], ol: ['start'], li: [],
  h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
  blockquote: [], pre: [], code: [], hr: [],
  table: [], thead: [], tbody: [], tr: [],
  th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'],
  span: [], div: [],
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'title'],
  input: ['type', 'checked', 'disabled'],
};
const ALLOWED = new Map(Object.entries(ALLOWED_ATTRS).map(([tag, attrs]) => [tag, new Set(attrs)]));
const URL_ATTRS = new Set(['href', 'src']);
// Tags whose contents must be dropped entirely (script/style/embedding).
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template', 'noscript', 'title', 'textarea', 'xmp']);

class AllowlistHandler {
  element(el: Element): void {
    const tag = el.tagName.toLowerCase();
    const allowedAttrs = ALLOWED.get(tag);
    if (!allowedAttrs) {
      if (DROP_WITH_CONTENT.has(tag)) el.remove();
      else el.removeAndKeepContent();
      return;
    }
    for (const [name] of Array.from(el.attributes)) {
      const lower = name.toLowerCase();
      if (!allowedAttrs.has(lower)) {
        el.removeAttribute(name);
        continue;
      }
      if (URL_ATTRS.has(lower) && !isSafeUrl(el.getAttribute(name))) {
        el.setAttribute(name, '#');
      }
    }
  }
}

export async function sanitizeHtml(html: string): Promise<string> {
  const rewriter = new HTMLRewriter().on('*', new AllowlistHandler());
  const transformed = rewriter.transform(
    new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  );
  return await transformed.text();
}

export async function parseMarkdown(content: string): Promise<string> {
  if (!content) return '';
  const result = marked.parse(content);
  const html = typeof result === 'string' ? result : '';
  return sanitizeHtml(html);
}
