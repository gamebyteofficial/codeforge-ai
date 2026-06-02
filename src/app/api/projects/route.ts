import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { files: true, tasks: true, conversations: true } },
      },
    });
    return NextResponse.json({ projects });
  } catch (error) {
    // Database unavailable (e.g., Vercel serverless with SQLite)
    console.warn('Projects GET: Database unavailable, returning empty projects');
    return NextResponse.json({ projects: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, language, framework } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    try {
      const project = await db.project.create({
        data: {
          name,
          description,
          language: language || 'typescript',
          framework,
        },
      });
      return NextResponse.json({ project }, { status: 201 });
    } catch (dbError) {
      // Database unavailable — return a fake project for client-side use
      console.warn('Projects POST: Database unavailable, returning client-side project');
      const fakeProject = {
        id: crypto.randomUUID(),
        name,
        description: description || null,
        path: '/',
        language: language || 'typescript',
        framework: framework || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return NextResponse.json({ project: fakeProject }, { status: 201 });
    }
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
