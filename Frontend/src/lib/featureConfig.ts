/**
 * Feature flags and coming-soon state.
 * Controlled by public/config/features.json.
 * Set "comingSoon.enabled" to true to lock Customize & AI Assistant with overlay.
 */

export interface FeatureConfig {
  comingSoon: {
    enabled: boolean;
  };
}

const DEFAULT_CONFIG: FeatureConfig = {
  comingSoon: { enabled: true },
};

let cachedConfig: FeatureConfig | null = null;

/**
 * Fetches feature config from public/config/features.json.
 * Cached in memory for the session.
 */
export async function getFeatureConfig(): Promise<FeatureConfig> {
  if (cachedConfig !== null) return cachedConfig;
  try {
    const res = await fetch('/config/features.json', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      cachedConfig = {
        comingSoon: {
          enabled: data?.comingSoon?.enabled ?? DEFAULT_CONFIG.comingSoon.enabled,
        },
      };
      return cachedConfig;
    }
  } catch {
    // ignore; use default
  }
  cachedConfig = DEFAULT_CONFIG;
  return cachedConfig;
}

/**
 * Sync get for initial render when config was already loaded (e.g. by provider).
 * Returns null until config is loaded.
 */
export function getCachedFeatureConfig(): FeatureConfig | null {
  return cachedConfig;
}

export function isComingSoonEnabled(): boolean {
  return cachedConfig?.comingSoon?.enabled ?? DEFAULT_CONFIG.comingSoon.enabled;
}

// Re-export React hook and provider so "@/lib/featureConfig" resolves to this file
export { FeatureConfigProvider, useFeatureConfig } from './featureConfig.tsx';
