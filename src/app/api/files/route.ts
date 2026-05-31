import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId');

    const files = await db.file.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: { path: 'asc' },
    });

    return NextResponse.json({ files });
  } catch (error) {
    console.error('Failed to fetch files:', error);
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, path, content, language, isFolder, projectId } = body;

    if (!name || !path) {
      return NextResponse.json({ error: 'Name and path are required' }, { status: 400 });
    }

    const existing = await db.file.findFirst({
      where: { path, projectId: projectId || null },
    });

    if (existing) {
      return NextResponse.json({ error: 'File already exists at this path' }, { status: 409 });
    }

    const file = await db.file.create({
      data: {
        name,
        path,
        content: content || '',
        language: language || detectLanguage(name),
        isFolder: isFolder || false,
        projectId: projectId || null,
      },
    });

    return NextResponse.json({ file }, { status: 201 });
  } catch (error) {
    console.error('Failed to create file:', error);
    return NextResponse.json({ error: 'Failed to create file' }, { status: 500 });
  }
}

function detectLanguage(filename: string): string {
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
