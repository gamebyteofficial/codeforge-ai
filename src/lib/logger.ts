const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) console.log('[Waziros]', ...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn('[Waziros]', ...args);
  },
  error: (...args: unknown[]) => {
    // Always log errors, but in production could send to monitoring
    console.error('[Waziros]', ...args);
  },
  debug: (...args: unknown[]) => {
    if (isDev) console.log('[Waziros:debug]', ...args);
  },
};
