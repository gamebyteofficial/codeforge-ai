import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { detectLanguage } from '@/lib/language-utils';
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
    logger.error('Failed to fetch files:', error);
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
    logger.error('Failed to create file:', error);
    return NextResponse.json({ error: 'Failed to create file' }, { status: 500 });
  }
}
