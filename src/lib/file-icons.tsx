import type { LucideIcon } from 'lucide-react';
import {
  File,
  FileCode,
  FileJson,
  FileText,
  Braces,
  Code2,
  Palette,
  Layout,
  Database,
  Terminal,
  Settings,
  FileType,
  Hash,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Master file-extension mapping
// ---------------------------------------------------------------------------

/** Every known extension mapped to its icon, editor language, and tailwind dot color */
export const FILE_EXTENSIONS: Record<
  string,
  { icon: LucideIcon; language: string; color: string }
> = {
  // TypeScript / JavaScript
  ts:  { icon: Braces,    language: 'typescript',  color: 'text-blue-400'   },
  tsx: { icon: Braces,    language: 'tsx',         color: 'text-blue-400'   },
  js:  { icon: Braces,    language: 'javascript',  color: 'text-yellow-400' },
  jsx: { icon: Braces,    language: 'jsx',         color: 'text-yellow-400' },

  // Python
  py: { icon: Code2, language: 'python', color: 'text-green-400' },

  // Ruby
  rb: { icon: Code2, language: 'ruby', color: 'text-red-400' },

  // Go
  go: { icon: Code2, language: 'go', color: 'text-cyan-400' },

  // Rust
  rs: { icon: Code2, language: 'rust', color: 'text-orange-400' },

  // Java / JVM
  java:   { icon: Code2,   language: 'java',    color: 'text-red-400'   },
  kt:     { icon: Code2,   language: 'kotlin',  color: 'text-purple-400' },
  scala:  { icon: Code2,   language: 'scala',   color: 'text-red-400'   },

  // C-family
  c:   { icon: Code2, language: 'c',      color: 'text-blue-400' },
  cpp: { icon: Code2, language: 'cpp',    color: 'text-blue-400' },
  cs:  { icon: Code2, language: 'csharp', color: 'text-purple-400' },

  // PHP
  php: { icon: Code2, language: 'php', color: 'text-indigo-400' },

  // Swift
  swift: { icon: Code2, language: 'swift', color: 'text-orange-400' },

  // Dart
  dart: { icon: Code2, language: 'dart', color: 'text-cyan-400' },

  // Lua
  lua: { icon: Code2, language: 'lua', color: 'text-blue-400' },

  // R
  r: { icon: Code2, language: 'r', color: 'text-blue-400' },

  // Web markup
  html: { icon: Layout,  language: 'markup', color: 'text-orange-400' },
  htm:  { icon: Layout,  language: 'markup', color: 'text-orange-400' },
  svg:  { icon: Layout,  language: 'markup', color: 'text-orange-400' },
  xml:  { icon: Layout,  language: 'markup', color: 'text-orange-400' },
  vue:  { icon: Layout,  language: 'markup', color: 'text-emerald-400' },
  svelte: { icon: Layout, language: 'markup', color: 'text-orange-400' },

  // Styles
  css:  { icon: Palette, language: 'css',  color: 'text-pink-400' },
  scss: { icon: Palette, language: 'scss', color: 'text-pink-400' },
  less: { icon: Palette, language: 'less', color: 'text-pink-400' },

  // Data / config
  json:    { icon: FileJson, language: 'json',    color: 'text-amber-400' },
  yaml:    { icon: Settings, language: 'yaml',    color: 'text-zinc-400'  },
  yml:     { icon: Settings, language: 'yaml',    color: 'text-zinc-400'  },
  toml:    { icon: Settings, language: 'toml',    color: 'text-zinc-400'  },
  env:     { icon: Settings, language: 'text',    color: 'text-zinc-400'  },

  // Database
  sql:    { icon: Database, language: 'sql',    color: 'text-cyan-400'    },
  prisma: { icon: Database, language: 'prisma', color: 'text-cyan-400'    },

  // GraphQL
  graphql: { icon: Hash, language: 'graphql', color: 'text-pink-400' },
  gql:     { icon: Hash, language: 'graphql', color: 'text-pink-400' },

  // Shell / DevOps
  sh:         { icon: Terminal, language: 'bash',   color: 'text-emerald-400' },
  bash:       { icon: Terminal, language: 'bash',   color: 'text-emerald-400' },
  zsh:        { icon: Terminal, language: 'bash',   color: 'text-emerald-400' },
  dockerfile: { icon: Terminal, language: 'docker', color: 'text-emerald-400' },

  // Docs
  md: { icon: FileText, language: 'markdown', color: 'text-zinc-400' },
};

// ---------------------------------------------------------------------------
// Helper: resolve extension
// ---------------------------------------------------------------------------

function getExt(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Return the appropriate Lucide icon element for a given file name */
export function getFileIcon(fileName: string): React.ReactNode {
  const entry = FILE_EXTENSIONS[getExt(fileName)];
  if (entry) {
    const Icon = entry.icon;
    return <Icon className={`size-3.5 shrink-0 ${entry.color}`} />;
  }
  return <File className="size-3.5 shrink-0 text-zinc-500" />;
}

/** Return the editor / syntax-highlighter language identifier for a file name */
export function getLanguageFromFileName(fileName: string): string {
  const ext = getExt(fileName);
  const entry = FILE_EXTENSIONS[ext];
  if (entry) return entry.language;
  return ext || 'text';
}

/** Return a Tailwind background-color class for a file-type indicator dot */
export function getFileTypeColor(fileName: string): string {
  const ext = getExt(fileName);
  // Map text-color classes to their bg equivalents for dot indicators
  const textToBg: Record<string, string> = {
    'text-blue-400':    'bg-blue-400',
    'text-yellow-400':  'bg-yellow-400',
    'text-green-400':   'bg-green-400',
    'text-red-400':     'bg-red-400',
    'text-cyan-400':    'bg-cyan-400',
    'text-orange-400':  'bg-orange-400',
    'text-purple-400':  'bg-purple-400',
    'text-indigo-400':  'bg-indigo-400',
    'text-pink-400':    'bg-pink-400',
    'text-amber-400':   'bg-amber-400',
    'text-emerald-400': 'bg-emerald-400',
    'text-zinc-400':    'bg-zinc-400',
    'text-zinc-500':    'bg-zinc-500',
  };
  const entry = FILE_EXTENSIONS[ext];
  if (entry) {
    return textToBg[entry.color] ?? 'bg-zinc-500';
  }
  return 'bg-zinc-500';
}
