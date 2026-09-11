import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../src/utils/markdown';

const render = (p: string) => parseMarkdown(p);

describe('markdown sanitizer', () => {
  it('blocks entity-encoded javascript: schemes', async () => {
    expect(await render('[x](javascript&#58;alert(1))')).toContain('href="#"');
    expect(await render('[x](&#106;avascript:alert(1))')).toContain('href="#"');
    expect(await render('[x](&#x6a;avascript:alert(1))')).toContain('href="#"');
  });

  it('escapes raw HTML so it cannot become live elements', async () => {
    const iframe = await render('<iframe src="javascript:alert(1)"></iframe>');
    expect(iframe).not.toMatch(/<iframe/i); // not a real element
    expect(iframe).toContain('&lt;iframe'); // escaped to text instead

    const img = await render('<img src=x onerror=alert(1)>');
    expect(img).not.toMatch(/<img/i); // not a real element
    expect(img).toContain('&lt;img');
  });

  it('keeps allowed tags and safe links', async () => {
    const out = await render('# Title\n\n[x](https://example.com)\n\n- a\n- b\n\n![alt](https://img.restartyhn.top/a.png)');
    expect(out).toContain('<h1>');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('<ul>');
    expect(out).toContain('src="https://img.restartyhn.top/a.png"');
  });

  it('blocks data: urls', async () => {
    expect(await render('[x](data:text/html,alert(1))')).toContain('href="#"');
  });
});
