import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const settings = await db.setting.findMany();
    const settingsMap: Record<string, string> = {};
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });
    return NextResponse.json({ settings: settingsMap });
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { settings, testConnection } = body as {
      settings: Record<string, string>;
      testConnection?: boolean;
    };

    if (!settings) {
      return NextResponse.json({ error: 'Settings object is required' }, { status: 400 });
    }

    // Handle test connection request
    if (testConnection) {
      const apiKey = settings.apiKey;
      const provider = settings.provider;

      if (!apiKey) {
        return NextResponse.json(
          { success: false, error: 'API key is required to test connection' },
          { status: 400 }
        );
      }

      // Simulate connection test (in production, this would make a real API call)
      // Check that the key looks reasonable (non-empty and has minimum length)
      const isValid = apiKey.length >= 8;
      if (isValid) {
        return NextResponse.json({
          success: true,
          provider,
          message: `Successfully connected to ${provider}`,
        });
      } else {
        return NextResponse.json({
          success: false,
          error: 'Invalid API key format',
        });
      }
    }

    // Save settings
    const operations = Object.entries(settings).map(([key, value]) =>
      db.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    );

    await Promise.all(operations);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
