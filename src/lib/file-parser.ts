/**
 * File Parser — Extracts file blocks from AI responses
 *
 * Detects patterns like:
 *   📄 **filename.ext**
 *   ```language
 *   code here
 *   ```
 *
 * Also detects simpler patterns like:
 *   **filename.ext** followed by a code block
 */

export interface ParsedFile {
  filePath: string;
  fileName: string;
  content: string;
  language: string;
}

/**
 * Parse an AI response string and extract file blocks.
 * Returns an array of ParsedFile objects.
 */
export function parseFilesFromResponse(content: string): ParsedFile[] {
  const files: ParsedFile[] = [];

  // Pattern 1: 📄 **filepath** followed by a code block
  // Matches: 📄 **index.html**\n```html\n...\n```
  const emojiPattern = /📄\s*\*\*(.+?)\*\*\s*\n```(\w*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = emojiPattern.exec(content)) !== null) {
    const filePath = match[1].trim();
    const language = match[2] || '';
    const code = match[3];
    const fileName = filePath.split('/').pop() || filePath;

    files.push({
      filePath,
      fileName,
      content: code,
      language: language || detectLangFromFileName(fileName),
    });
  }

  // If emoji pattern found files, return early
  if (files.length > 0) return files;

  // Pattern 2: **filepath** (bold) followed by a code block
  // Matches: **index.html**\n```html\n...\n```
  const boldPattern = /\*\*(.+?\.\w+)\*\*\s*\n```(\w*)\n([\s\S]*?)```/g;

  while ((match = boldPattern.exec(content)) !== null) {
    const filePath = match[1].trim();
    const language = match[2] || '';
    const code = match[3];
    const fileName = filePath.split('/').pop() || filePath;

    // Avoid false positives - skip if the "filename" looks like regular text
    if (!looksLikeFilePath(filePath)) continue;

    files.push({
      filePath,
      fileName,
      content: code,
      language: language || detectLangFromFileName(fileName),
    });
  }

  // If bold pattern found files, return early
  if (files.length > 0) return files;

  // Pattern 3: Fallback - just look for code blocks with file-like language tags
  // that might indicate a project (e.g., HTML + CSS + JS together)
  // Only activate if there are 2+ code blocks
  const codeBlockPattern = /```(\w*)\n([\s\S]*?)```/g;
  const codeBlocks: { language: string; content: string }[] = [];

  while ((match = codeBlockPattern.exec(content)) !== null) {
    codeBlocks.push({
      language: match[1] || 'text',
      content: match[2],
    });
  }

  if (codeBlocks.length >= 2) {
    // Try to match language blocks to default filenames
    const langToFile: Record<string, string> = {
      html: 'index.html',
      css: 'styles.css',
      javascript: 'script.js',
      js: 'script.js',
      typescript: 'index.ts',
      ts: 'index.ts',
      tsx: 'App.tsx',
      jsx: 'App.jsx',
      python: 'main.py',
      py: 'main.py',
      json: 'data.json',
      yaml: 'config.yaml',
      bash: 'script.sh',
      sh: 'script.sh',
      sql: 'query.sql',
      rust: 'main.rs',
      go: 'main.go',
      java: 'Main.java',
    };

    for (const block of codeBlocks) {
      const fileName = langToFile[block.language.toLowerCase()];
      if (fileName) {
        files.push({
          filePath: fileName,
          fileName,
          content: block.content,
          language: block.language,
        });
      }
    }
  }

  return files;
}

/**
 * Check if a string looks like a file path (has extension or path separators)
 */
function looksLikeFilePath(str: string): boolean {
  // Must contain a dot (for extension) or path separator
  if (str.includes('/') || str.includes('\\')) return true;

  // Check if it ends with a file extension (e.g., .html, .css, .js, .py)
  const extPattern = /\.\w{1,10}$/;
  if (extPattern.test(str)) return true;

  // Check for common file names
  const commonNames = ['README', 'Makefile', 'Dockerfile', 'Gemfile', '.gitignore', '.env'];
  if (commonNames.some((name) => str.toLowerCase() === name.toLowerCase())) return true;

  return false;
}

/**
 * Detect programming language from file name
 */
function detectLangFromFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    sql: 'sql',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    md: 'markdown',
    sh: 'bash',
    bash: 'bash',
    xml: 'xml',
    svg: 'xml',
  };
  return langMap[ext] || ext || 'text';
}

/**
 * Check if a message contains file blocks that can be auto-created
 */
export function hasFileBlocks(content: string): boolean {
  return parseFilesFromResponse(content).length > 0;
}
