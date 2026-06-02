import { NextResponse } from 'next/server';

/**
 * Lightweight health-check endpoint — NO database access.
 * Used by the frontend for latency measurement instead of
 * hitting /api/settings (which queries Prisma every time).
 */
export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: Date.now() });
}
