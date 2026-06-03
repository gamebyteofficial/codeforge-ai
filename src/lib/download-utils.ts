/**
 * Shared download utility for preview content.
 * Handles both ZIP (multi-file) and single HTML downloads.
 *
 * Used by InlinePreview (ChatPanel) and LivePreview.
 */

import { buildSrcdoc } from '@/lib/preview-builder';

/**
 * Download a preview project as either a ZIP (when multiple files exist)
 * or a single HTML file (when only HTML exists).
 */
export async function downloadPreviewProject(
  html: string,
  css: string,
  js: string,
  previewTitle?: string,
): Promise<void> {
  if (!html && !css && !js) return;

  try {
    let cleanHtml = html || '';
    const cleanCss = css || '';
    const cleanJs = js || '';

    const hasMultipleFiles = (cleanCss && cleanHtml) || (cleanJs && cleanHtml);

    if (hasMultipleFiles) {
      // Download as ZIP with separate files
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      let modifiedHtml = cleanHtml;
      if (cleanCss) {
        // Remove existing local <link> tags for CSS
        modifiedHtml = modifiedHtml.replace(
          /<link\s+[^>]*href\s*=\s*["']([^"']+\.css)["'][^>]*\/?>/gi,
          (match: string, href: string) => {
            if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) return match;
            return '';
          }
        );
        // Add link to external CSS
        if (/<head[\s>]/i.test(modifiedHtml)) {
          modifiedHtml = modifiedHtml.replace(/(<head[^>]*>)/i, '$1\n  <link rel="stylesheet" href="styles.css">');
        }
        zip.file('styles.css', cleanCss);
      }
      if (cleanJs) {
        // Remove existing local <script> tags for JS
        modifiedHtml = modifiedHtml.replace(
          /<script\s+[^>]*src\s*=\s*["']([^"']+\.js)["'][^>]*><\/script>/gi,
          (match: string, src: string) => {
            if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) return match;
            return '';
          }
        );
        // Add script reference
        if (/<\/body>/i.test(modifiedHtml)) {
          modifiedHtml = modifiedHtml.replace(/<\/body>/i, '  <script src="script.js"></script>\n</body>');
        }
        zip.file('script.js', cleanJs);
      }

      // Remove console capture script from downloaded version
      modifiedHtml = modifiedHtml.replace(/<script>\s*\(function\(\)\s*\{[\s\S]*?__preview_console[\s\S]*?<\/script>/gi, '');

      // If HTML is a fragment, wrap it in a full document
      if (!/<html[\s>]/i.test(modifiedHtml) && !/<!DOCTYPE/i.test(modifiedHtml)) {
        modifiedHtml = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  ${cleanCss ? '  <link rel="stylesheet" href="styles.css">' : ''}\n</head>\n<body>\n${modifiedHtml}\n  ${cleanJs ? '<script src="script.js"></script>' : ''}\n</body>\n</html>`;
      }

      zip.file('index.html', modifiedHtml);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'waziros-project.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { zipName: 'waziros-project.zip' } as any; // Caller handles toast
    } else {
      // Download as single HTML file
      const srcdocContent = buildSrcdoc(cleanHtml, cleanCss, cleanJs);
      // Remove console capture script for download
      const cleanSrcdoc = srcdocContent.replace(/<script>\s*\(function\(\)\s*\{[\s\S]*?__preview_console[\s\S]*?<\/script>/gi, '');

      const blob = new Blob([cleanSrcdoc], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const title = previewTitle || 'waziros-preview';
      const safeName = title.replace(/\s+/g, '-').toLowerCase();
      a.download = `${safeName}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { htmlName: `${safeName}.html` } as any; // Caller handles toast
    }
  } catch (error) {
    console.error('Download failed:', error);
    throw error; // Let caller handle the error toast
  }
}
