/**
 * Shared language detection utility.
 * Used by /api/files and /api/files/batch routes.
 */

export function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', html: 'html', css: 'css', json: 'json', yaml: 'yaml',
    yml: 'yaml', md: 'markdown', rs: 'rust', go: 'go', java: 'java',
    cpp: 'cpp', c: 'c', cs: 'csharp', php: 'php', rb: 'ruby',
    swift: 'swift', kt: 'kotlin', dart: 'dart', sql: 'sql',
    sh: 'bash', bash: 'bash', xml: 'xml', svg: 'xml',
  };
  return langMap[ext] || 'text';
}
