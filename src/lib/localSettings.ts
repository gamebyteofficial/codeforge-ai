/**
 * localStorage-based Settings Utility
 *
 * Provides persistent settings storage that works in any environment
 * (local dev, Vercel serverless, etc.) without requiring a database.
 *
 * On Vercel, the SQLite database doesn't work because serverless functions
 * have ephemeral filesystems. This module provides client-side persistence
 * as the primary mechanism, with the API as a best-effort backup.
 */

const SETTINGS_KEY = 'waziros-settings';
const ONBOARDED_KEY = 'waziros-onboarded';

/**
 * Save settings to localStorage.
 */
export function saveSettingsToLocal(settings: Record<string, string>): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings to localStorage:', err);
  }
}

/**
 * Load settings from localStorage.
 */
export function loadSettingsFromLocal(): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, string>;
  } catch (err) {
    console.error('Failed to load settings from localStorage:', err);
    return null;
  }
}

/**
 * Mark onboarding as complete in localStorage.
 */
export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, 'true');
  } catch (err) {
    console.error('Failed to save onboarding state:', err);
  }
}

/**
 * Check if onboarding has been completed.
 */
export function isOnboardedLocal(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Clear all local settings (for reset).
 */
export function clearLocalSettings(): void {
  try {
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(ONBOARDED_KEY);
  } catch (err) {
    console.error('Failed to clear local settings:', err);
  }
}

/**
 * Save settings to both localStorage and API (best-effort for API).
 */
export async function saveSettings(
  settings: Record<string, string>,
  skipApi = false
): Promise<{ localSaved: boolean; apiSaved: boolean }> {
  // Always save to localStorage first
  saveSettingsToLocal(settings);

  if (skipApi) {
    return { localSaved: true, apiSaved: false };
  }

  // Try to save to API (best-effort)
  let apiSaved = false;
  try {
    const cleanSettings: Record<string, string> = {};
    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined && value !== null) {
        cleanSettings[key] = String(value);
      }
    }

    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: cleanSettings }),
    });
    apiSaved = res.ok;
  } catch {
    // API save failed - that's fine, localStorage is the primary
  }

  return { localSaved: true, apiSaved };
}

/**
 * Load settings from localStorage first, then fall back to API.
 */
export async function loadSettings(): Promise<Record<string, string>> {
  // Check localStorage first
  const localSettings = loadSettingsFromLocal();
  if (localSettings && Object.keys(localSettings).length > 0) {
    return localSettings;
  }

  // Fall back to API
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      const data = await res.json();
      if (data.settings && Object.keys(data.settings).length > 0) {
        // Cache to localStorage for future use
        saveSettingsToLocal(data.settings);
        return data.settings;
      }
    }
  } catch {
    // API failed - return empty
  }

  return {};
}
