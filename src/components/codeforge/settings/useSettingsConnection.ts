'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { ProviderKey, PROVIDER_DISPLAY_INFO } from '@/lib/providers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionStatus = 'idle' | 'success' | 'error';

export interface ProviderConnectionState {
  isTesting: boolean;
  connectionStatus: ConnectionStatus;
}

// ---------------------------------------------------------------------------
// useSettingsConnection — custom hook for test connection logic
// ---------------------------------------------------------------------------

export function useSettingsConnection(
  providerIndex: number,
  localSettings: Record<string, string>,
) {
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');

  const testConnection = useCallback(async () => {
    const providerKey = providerIndex === 1
      ? (localSettings.provider || 'openrouter') as ProviderKey
      : providerIndex === 2
        ? (localSettings.provider2 || 'opencode') as ProviderKey
        : providerIndex === 3
          ? (localSettings.provider3 || 'deepseek') as ProviderKey
          : (localSettings.provider4 || 'gemini') as ProviderKey;

    setIsTesting(true);
    setConnectionStatus('idle');

    try {
      const perProviderKey = `${providerKey}_apiKey`;
      const key = providerIndex === 1
        ? (localSettings[perProviderKey] || localSettings.apiKey)
        : localSettings[perProviderKey];

      const settingsToPost = providerIndex === 1
        ? { ...localSettings, provider: providerKey, [perProviderKey]: key, apiKey: key }
        : { provider: providerKey, [perProviderKey]: key, apiKey: key };

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: settingsToPost,
          testConnection: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setConnectionStatus('success');
        toast.success('Connection successful', { description: `Connected to ${PROVIDER_DISPLAY_INFO[providerKey].name}` });
      } else {
        setConnectionStatus('error');
        toast.error('Connection failed', { description: data.error || 'Could not connect.' });
      }
    } catch {
      setConnectionStatus('error');
      toast.error('Connection failed', { description: 'Network error.' });
    } finally {
      setIsTesting(false);
    }
  }, [providerIndex, localSettings]);

  const resetStatus = useCallback(() => {
    setConnectionStatus('idle');
  }, []);

  return {
    isTesting,
    connectionStatus,
    testConnection,
    resetStatus,
    setConnectionStatus,
  };
}
