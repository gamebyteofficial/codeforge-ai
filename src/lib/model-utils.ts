/**
 * Shared model grouping utility.
 * Used by ChatPanel (ModelSelector), SettingsModal, and OnboardingWizard.
 */

import type { DynamicModel } from './types';

/**
 * Group models by category for display purposes.
 *
 * For OpenRouter / OpenCode Zen providers, models are grouped into
 * Auto-Routing, Free, and Paid categories.
 * For other providers, all models go under the provider name.
 */
export function groupModels(
  models: DynamicModel[],
  provider: string,
): Record<string, DynamicModel[]> {
  if (provider === 'openrouter' || provider === 'opencode') {
    const auto = models.filter((m) => m.id === 'openrouter/auto');
    const free = models.filter((m) => m.isFree && m.id !== 'openrouter/auto');
    const paid = models.filter((m) => !m.isFree);
    const groups: Record<string, DynamicModel[]> = {};
    if (auto.length) groups['⚡ Auto-Routing'] = auto;
    if (free.length) groups['🆓 Free Models'] = free;
    if (paid.length) groups['💎 Paid Models'] = paid;
    return groups;
  }
  return { [provider.toUpperCase()]: models };
}

/**
 * Group models into labelled sections — a variant that returns an array
 * of { label, models } pairs, used by SettingsModal and OnboardingWizard
 * which render groups via .map() with a label.
 */
export function groupModelsAsSections(
  models: DynamicModel[],
  provider: string,
  providerDisplayName?: string,
): { label: string; models: DynamicModel[] }[] {
  if (provider === 'openrouter' || provider === 'opencode') {
    const auto = models.filter((m) => m.id === 'openrouter/auto');
    const free = models.filter((m) => m.isFree && m.id !== 'openrouter/auto');
    const paid = models.filter((m) => !m.isFree);
    const groups: { label: string; models: DynamicModel[] }[] = [];
    if (auto.length) groups.push({ label: '⚡ Auto-Routing (Recommended)', models: auto });
    if (free.length) groups.push({ label: `🆓 Free Models (${free.length})`, models: free });
    if (paid.length) groups.push({ label: `💎 Paid Models (${paid.length})`, models: paid });
    return groups;
  }
  return [{ label: providerDisplayName || provider.toUpperCase(), models }];
}
