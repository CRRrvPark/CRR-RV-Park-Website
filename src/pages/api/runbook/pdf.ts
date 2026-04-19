/**
 * GET /api/runbook/pdf — returns a print-friendly HTML rendering of the runbook
 *
 * Browsers natively print-to-PDF better than any server-side PDF lib renders
 * arbitrary Markdown. So we:
 *   1. Load the current runbook content (from DB, or bundled file)
 *   2. Render it with a print-optimized stylesheet
 *   3. Return as HTML with appropriate headers
 *
 * The admin's "Print runbook" button opens this URL in a new tab, and the
 * user uses their browser's "Save as PDF" action. This avoids pulling in
 * a heavy PDF library (puppeteer, pdfkit) — which are difficult to run
 * inside Netlify Functions anyway.
 */

import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serverClient } from '@lib/supabase';
import { requireAuth, handleError } from '@lib/api';

export const prerender = false;

const __dirname = dirname(fileURLToPath(import.meta.url));

export const GET: APIRoute = async ({ request }) => {
  try {
    await requireAuth(request);

    // Load content: DB-first, bundled fallback
    let markdown = '';
    const sb = serverClient();
    const { data } = await sb
      .from('runbook_content')
      .select('content')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.content) {
      markdown = data.content;
    } else {
      try {
        const path = resolve(__dirname, '..', '..', '..', 'RUNBOOK.md');
        markdown = readFileSync(path, 'utf8');
      } catch {
        markdown = '# Runbook\n\n(Not yet created.)';
      }
    }

    const html = renderHtml(markdownToHtml(markdown));
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'inline; filename="crr-runbook.html"',
      },
    });
  } catch (err) {
    return handleError(err);
  }
};

/**
 * Minimal Markdown → HTML converter. Handles: headings, paragraphs, lists,
 * inline code, bold, italic, links, tables, blockquotes. No external lib.
 * Not perfect, but good enough for runbook rendering.
 */
function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inList = false;
  let inTable = false;
  let inCodeBlock = false;
  let tableHeader: string[] | null = null;

  const inline = (s: string): string => s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  for (const raw of lines) {
    const line = raw;

    if (line.startsWith('```')) {
      if (inCodeBlock) { out.push('</code></pre>'); inCodeBlock = false; }
      else { out.push('<pre><code>'); inCodeBlock = true; }
      continue;
    }
    if (inCodeBlock) { out.push(line); continue; }

    if (line.match(/^---+\s*$/)) { out.push('<hr>'); continue; }

    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      closeList();
      closeTable();
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      continue;
    }

    // Table detection: pipe-separated with a delimiter row
    if (line.includes('|') && line.trim().startsWith('|')) {
      if (!inTable) {
        const nextLineIdx = lines.indexOf(line) + 1;
        const isHeader = nextLineIdx < lines.length && /^\s*\|[\s-:|]+\|\s*$/.test(lines[nextLineIdx]);
        if (isHeader) {
          closeList();
          tableHeader = line.split('|').slice(1, -1).map(s => s.trim());
          out.push('<table><thead><tr>' + tableHeader.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>');
          inTable = true;
          continue;
        }
      } else {
        if (/^\s*\|[\s-:|]+\|\s*$/.test(line)) continue;
        const cells = line.split('|').slice(1, -1).map(s => s.trim());
        out.push('<tr>' + cells.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>');
        continue;
      }
    } else if (inTable) {
      closeTable();
    }

    if (line.match(/^\s*[-*]\s+/)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
      continue;
    }
    if (line.match(/^\s*\d+\.\s+/)) {
      if (!inList) { out.push('<ol>'); inList = true; }
      out.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`);
      continue;
    }
    if (inList && line.trim() === '') { closeList(); continue; }

    if (line.startsWith('> ')) {
      out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
      continue;
    }

    if (line.trim() === '') { out.push(''); continue; }

    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  closeTable();
  if (inCodeBlock) out.push('</code></pre>');

  return out.join('\n');

  function closeList() {
    if (inList) { out.push('</ul>'); inList = false; }
  }
  function closeTable() {
    if (inTable) { out.push('</tbody></table>'); inTable = false; tableHeader = null; }
  }
}

function renderHtml(bodyHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>CRR RV Park Runbook — Print Version</title>
<style>
  @page { size: letter; margin: 0.75in; }
  body { font-family: Georgia, serif; font-size: 11pt; line-height: 1.5; color: #222; max-width: 7in; margin: 0 auto; }
  h1 { font-size: 22pt; border-bottom: 2px solid #C4622D; padding-bottom: 0.3em; margin-top: 2em; page-break-before: auto; }
  h2 { font-size: 16pt; color: #9A4A20; margin-top: 2em; page-break-after: avoid; }
  h3 { font-size: 13pt; color: #3a2820; margin-top: 1.5em; page-break-after: avoid; }
  h4 { font-size: 11pt; font-weight: bold; }
  p, li { margin: 0.5em 0; }
  code { background: #f4f0e8; padding: 1px 4px; border-radius: 2px; font-size: 10pt; }
  pre { background: #f4f0e8; padding: 12px; border-radius: 3px; overflow-x: auto; page-break-inside: avoid; }
  pre code { background: transparent; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; page-break-inside: avoid; font-size: 10pt; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #ddd; vertical-align: top; }
  th { background: #f4f0e8; font-weight: bold; }
  blockquote { border-left: 3px solid #C4622D; padding: 0.5em 1em; background: #fef9f2; margin: 1em 0; }
  a { color: #9A4A20; text-decoration: none; }
  a:after { content: " (" attr(href) ")"; font-size: 8pt; color: #888; }
  hr { border: 0; border-top: 1px solid #ccc; margin: 2em 0; }
  @media print {
    body { font-size: 10.5pt; }
    a { color: #222; }
  }
  .print-note {
    background: #FEF5E7;
    border: 1px solid #F0D89B;
    padding: 12px;
    margin-bottom: 2em;
    font-size: 10pt;
  }
  @media print { .print-note { display: none; } }
</style>
</head><body>
<div class="print-note">
  <strong>To save as PDF:</strong> use your browser's <strong>Print</strong> function (Ctrl+P or Cmd+P)
  and choose <strong>Save as PDF</strong> as the destination. This print-version styling is optimized for letter-size paper.
</div>
${bodyHtml}
</body></html>`;
}
