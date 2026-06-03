import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId');
    const type = req.nextUrl.searchParams.get('type');
    const category = req.nextUrl.searchParams.get('category');

    const memories = await db.memory.findMany({
      where: {
        ...(projectId ? { projectId } : undefined),
        ...(type ? { type } : undefined),
        ...(category ? { category } : undefined),
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ memories });
  } catch (error) {
    logger.error('Failed to fetch memories:', error);
    return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, category, key, value, projectId } = body;

    if (!key || !value) {
      return NextResponse.json({ error: 'Key and value are required' }, { status: 400 });
    }

    const memory = await db.memory.create({
      data: {
        type: type || 'short_term',
        category,
        key,
        value,
        projectId: projectId || null,
      },
    });

    return NextResponse.json({ memory }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create memory:', error);
    return NextResponse.json({ error: 'Failed to create memory' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Memory ID is required' }, { status: 400 });
    }
    await db.memory.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete memory:', error);
    return NextResponse.json({ error: 'Failed to delete memory' }, { status: 500 });
  }
}
