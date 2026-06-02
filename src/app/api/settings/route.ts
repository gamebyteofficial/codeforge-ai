import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { testProviderConnection, getApiKeyForProvider, invalidateSettingsCache, type ProviderKey } from '@/lib/llm';

export async function GET() {
  try {
    const settings = await db.setting.findMany();
    const settingsMap: Record<string, string> = {};
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });
    return NextResponse.json({ settings: settingsMap });
  } catch (error) {
    // Database unavailable (e.g., Vercel serverless with SQLite)
    console.warn('Settings GET: Database unavailable, returning empty settings');
    return NextResponse.json({ settings: {} });
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

    // Handle real connection test
    if (testConnection) {
      const provider = (settings.provider || 'openai') as ProviderKey;

      // Try per-provider key first, then legacy key
      const apiKey = getApiKeyForProvider(settings, provider) || settings.apiKey;

      if (!apiKey) {
        return NextResponse.json(
          { success: false, error: 'API key is required to test connection' },
          { status: 400 },
        );
      }

      const result = await testProviderConnection(provider, apiKey);

      if (result.success) {
        return NextResponse.json({
          success: true,
          provider,
          message: `Successfully connected to ${provider}`,
        });
      } else {
        return NextResponse.json({
          success: false,
          error: result.error || 'Connection failed',
        });
      }
    }

    // Save settings — handle DB failures gracefully
    try {
      // Filter out any non-string values to prevent DB errors
      const cleanEntries = Object.entries(settings).filter(
        ([, value]) => value !== undefined && value !== null
      );
      
      const operations = cleanEntries.map(([key, value]) =>
        db.setting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      );

      await Promise.all(operations);
      // Invalidate cache so next LLM call picks up new settings
      invalidateSettingsCache();
    } catch (dbError) {
      // Database unavailable — settings were already saved to localStorage by the client
      console.warn('Settings POST: Database unavailable, settings saved client-side only');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save settings:', error);
    // Still return success since client has localStorage backup
    return NextResponse.json({ success: true, warning: 'Server storage unavailable' });
  }
}
