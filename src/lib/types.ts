/**
 * Shared type definitions for the Waziros AI project.
 * Centralised here to avoid duplication across components.
 */

export interface DynamicModel {
  id: string;
  name: string;
  provider: string;
  pricing?: { prompt: string; completion: string };
  contextLength?: number;
  isFree: boolean;
}
