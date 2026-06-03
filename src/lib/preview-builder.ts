// ---------------------------------------------------------------------------
// preview-builder.ts — Shared srcdoc builder for inline & full preview iframes
// ---------------------------------------------------------------------------
// This module is the single source of truth for:
//   • CONSOLE_CAPTURE_SCRIPT  — the script injected into preview iframes to
//     capture console output and forward it to the parent window via postMessage
//   • buildSrcdoc(html, css, js) — builds a self-contained HTML document
//     suitable for use as an iframe srcdoc attribute
//
// Previously this logic was duplicated across ChatPanel.tsx and LivePreview.tsx.
// ---------------------------------------------------------------------------

/**
 * Console capture script injected into the preview iframe.
 *
 * Intercepts console.log / warn / error / info calls and forwards them to the
 * parent window via `postMessage` so the host UI can display them.
 * Also catches `window.onerror` and `unhandledrejection` events.
 */
export const CONSOLE_CAPTURE_SCRIPT = `
<script>
(function() {
  var _id = 0;
  function send(level, args) {
    try {
      var strs = [];
      for (var i = 0; i < args.length; i++) {
        try {
          var a = args[i];
          if (a === null) strs.push('null');
          else if (a === undefined) strs.push('undefined');
          else if (typeof a === 'object') {
            try { strs.push(JSON.stringify(a, null, 2)); }
            catch(e) { strs.push(String(a)); }
          }
          else strs.push(String(a));
        } catch(e) { strs.push('[unknown]'); }
      }
      window.parent.postMessage({
        type: '__preview_console',
        level: level,
        args: strs,
        id: ++_id,
        ts: Date.now()
      }, '*');
    } catch(e) {}
  }
  var origLog = console.log;
  var origWarn = console.warn;
  var origError = console.error;
  var origInfo = console.info;
  console.log = function() { send('log', arguments); origLog.apply(console, arguments); };
  console.warn = function() { send('warn', arguments); origWarn.apply(console, arguments); };
  console.error = function() { send('error', arguments); origError.apply(console, arguments); };
  console.info = function() { send('info', arguments); origInfo.apply(console, arguments); };
  window.onerror = function(msg, src, line, col, err) {
    send('error', [msg + ' (line ' + line + ':' + col + ')']);
    return false;
  };
  window.addEventListener('unhandledrejection', function(e) {
    send('error', ['Unhandled Promise: ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason))]);
  });
})();
<\/script>
`;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Strip local (relative) CSS file references from HTML.
 * CDN URLs (http://, https://, //) are preserved.
 */
function stripLocalCssRefs(html: string): string {
  return html.replace(
    /<link\s+[^>]*href\s*=\s*["']([^"']+\.css)["'][^>]*\/?>/gi,
    (match, href: string) => {
      if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
        return match;
      }
      return '';
    },
  );
}

/**
 * Strip local (relative) JS file references from HTML.
 * CDN URLs (http://, https://, //) are preserved.
 * Handles both `<script src="…"></script>` and self-closing `<script src="…"/>`.
 */
function stripLocalJsRefs(html: string): string {
  let result = html.replace(
    /<script\s+[^>]*src\s*=\s*["']([^"']+\.js)["'][^>]*><\/script>/gi,
    (match, src: string) => {
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) {
        return match;
      }
      return '';
    },
  );
  result = result.replace(
    /<script\s+[^>]*src\s*=\s*["']([^"']+\.js)["'][^>]*\/>/gi,
    (match, src: string) => {
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) {
        return match;
      }
      return '';
    },
  );
  return result;
}

/**
 * Inject `<meta charset>` and `<meta viewport>` tags into the document.
 * If a `<head>` exists they go right after the opening tag; otherwise a
 * `<head>` element is created after `<html>`.
 */
function injectMetaAndConsole(doc: string): string {
  if (/<head[\s>]/i.test(doc)) {
    return doc.replace(
      /(<head[^>]*>)/i,
      `$1\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  ${CONSOLE_CAPTURE_SCRIPT}`,
    );
  }
  return doc.replace(
    /(<html[^>]*>)/i,
    `$1\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  ${CONSOLE_CAPTURE_SCRIPT}\n</head>`,
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a self-contained HTML document suitable for use as an iframe `srcdoc`.
 *
 * Handles three scenarios:
 *
 * 1. **Self-contained HTML** — the HTML is a full document (`<!DOCTYPE>` or
 *    `<html>`) with no separate CSS/JS. Meta tags and the console capture
 *    script are injected.
 *
 * 2. **Full document with separate CSS/JS** — the HTML is a full document but
 *    CSS and/or JS are provided separately. They are injected at the correct
 *    positions (CSS before `</head>`, JS before `</body>`).
 *
 * 3. **HTML fragment** — the HTML is not a full document. It is wrapped in a
 *    complete document structure with the CSS/JS included.
 *
 * In all cases:
 * - Local CSS/JS file references are stripped (CDN URLs are preserved).
 * - The console capture script is injected.
 * - JS is placed at global scope (NOT wrapped in try/catch) so that
 *   `onclick="myFunction()"` handlers work correctly.
 * - A `window.addEventListener('error', …)` handler is added for visual
 *   error display when JS is present.
 */
export function buildSrcdoc(html: string, css: string, js: string): string {
  // ── Always strip external CSS/JS file references from HTML ──
  let cleanedHtml = stripLocalCssRefs(html);
  cleanedHtml = stripLocalJsRefs(cleanedHtml);

  // Clean up empty lines left by removed tags
  cleanedHtml = cleanedHtml.replace(/\n\s*\n\s*\n/g, '\n\n');

  // ── Scenario 1: Self-contained document with no separate CSS/JS ──
  if (
    cleanedHtml &&
    !css &&
    !js &&
    (/<html[\s>]/i.test(cleanedHtml) || /<!DOCTYPE/i.test(cleanedHtml))
  ) {
    return injectMetaAndConsole(cleanedHtml);
  }

  const isFullDocument =
    /<!DOCTYPE\s+html/i.test(cleanedHtml) || /<html[\s>]/i.test(cleanedHtml);

  // ── Scenario 2: Full HTML document with separate CSS/JS ──
  if (isFullDocument) {
    let doc = injectMetaAndConsole(cleanedHtml);

    // Inject inline CSS right before </head>
    if (css) {
      const styleBlock = `\n<style>\n${css}\n</style>`;
      if (/<\/head>/i.test(doc)) {
        doc = doc.replace(/<\/head>/i, `${styleBlock}\n</head>`);
      } else if (/<head[^>]*>/i.test(doc)) {
        doc = doc.replace(/(<head[^>]*>)/i, `$1${styleBlock}`);
      }
    }

    // Inject inline JS at global scope — must NOT wrap in try/catch because
    // that creates a block scope, preventing function declarations from being
    // global (which breaks onclick="myFunction()" handlers in the HTML).
    if (js) {
      // Visual error display handler (doesn't wrap user code)
      const errorHandler = `\n<script>\nwindow.addEventListener('error',function(e){\n  var d=document.createElement('div');\n  d.style.cssText='color:red;padding:10px;font-family:monospace;background:rgba(255,0,0,0.1);border-top:1px solid red;margin-top:10px;';\n  d.textContent='Error: '+(e.message||'Unknown error');\n  document.body.appendChild(d);\n});\n</script>`;
      const scriptBlock = `\n<script>\n${js}\n</script>`;
      if (/<\/body>/i.test(doc)) {
        doc = doc.replace(/<\/body>/i, `${errorHandler}${scriptBlock}\n</body>`);
      } else {
        doc = doc.replace(/<\/html>/i, `${errorHandler}${scriptBlock}\n</html>`);
      }
    }

    return doc;
  }

  // ── Scenario 3: HTML fragment — wrap in a complete document ──
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${css ? `<style>\n${css}\n</style>` : ''}
  ${CONSOLE_CAPTURE_SCRIPT}
</head>
<body>
  ${cleanedHtml}
  ${js ? `<script>\nwindow.addEventListener('error',function(e){var d=document.createElement('div');d.style.cssText='color:red;padding:10px;font-family:monospace;background:rgba(255,0,0,0.1);border-top:1px solid red;margin-top:10px;';d.textContent='Error: '+(e.message||'Unknown error');document.body.appendChild(d);});\n</script>\n<script>\n${js}\n</script>` : ''}
</body>
</html>`;
}
