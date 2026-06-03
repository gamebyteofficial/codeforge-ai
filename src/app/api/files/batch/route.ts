import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { detectLanguage } from '@/lib/language-utils';
import { NextRequest, NextResponse } from 'next/server';

interface BatchFileInput {
  name: string;
  path: string;
  content: string;
  language?: string;
  isFolder?: boolean;
  projectId?: string;
}

interface BatchResult {
  files: Array<{
    id: string;
    name: string;
    path: string;
    content: string;
    language: string;
    isFolder: boolean;
    projectId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  created: number;
  updated: number;
  errors: Array<{ path: string; error: string }>;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { files } = body as { files: BatchFileInput[] };

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'A non-empty "files" array is required' },
        { status: 400 }
      );
    }

    // Limit batch size to prevent abuse
    if (files.length > 100) {
      return NextResponse.json(
        { error: 'Batch size limited to 100 files per request' },
        { status: 400 }
      );
    }

    const result: BatchResult = {
      files: [],
      created: 0,
      updated: 0,
      errors: [],
    };

    for (const fileInput of files) {
      const { name, path, content, language, isFolder, projectId } = fileInput;

      if (!name || !path) {
        result.errors.push({
          path: path || '<missing path>',
          error: 'Name and path are required for each file',
        });
        continue;
      }

      try {
        const projectFilter = projectId ? { projectId } : { projectId: null };
        const existing = await db.file.findFirst({
          where: { path, ...projectFilter },
        });

        if (existing) {
          // Update existing file
          const updated = await db.file.update({
            where: { id: existing.id },
            data: {
              content: content ?? existing.content,
              name,
              language: language || detectLanguage(name),
              isFolder: isFolder ?? existing.isFolder,
            },
          });
          result.files.push(updated);
          result.updated++;
        } else {
          // Create new file
          const created = await db.file.create({
            data: {
              name,
              path,
              content: content || '',
              language: language || detectLanguage(name),
              isFolder: isFolder || false,
              projectId: projectId || null,
            },
          });
          result.files.push(created);
          result.created++;
        }
      } catch (fileError) {
        const message =
          fileError instanceof Error
            ? fileError.message
            : 'Unknown error processing file';
        result.errors.push({ path, error: message });
        logger.error(`Failed to process file at "${path}":`, fileError);
      }
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error('Failed to batch create/update files:', error);
    return NextResponse.json(
      { error: 'Failed to batch create/update files' },
      { status: 500 }
    );
  }
}
