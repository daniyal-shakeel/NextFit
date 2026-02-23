/**
 * Feature config React context and hook.
 * Loads public/config/features.json once; controls Coming Soon overlay for Customize & AI Assistant.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { getFeatureConfig, type FeatureConfig } from './featureConfig';

interface FeatureConfigContextValue {
  config: FeatureConfig | null;
  loading: boolean;
  comingSoonEnabled: boolean;
}

const FeatureConfigContext = createContext<FeatureConfigContextValue>({
  config: null,
  loading: true,
  comingSoonEnabled: true,
});

export function FeatureConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<FeatureConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFeatureConfig().then((c) => {
      setConfig(c);
      setLoading(false);
    });
  }, []);

  const comingSoonEnabled = config?.comingSoon?.enabled ?? true;

  return (
    <FeatureConfigContext.Provider value={{ config, loading, comingSoonEnabled }}>
      {children}
    </FeatureConfigContext.Provider>
  );
}

export function useFeatureConfig() {
  return useContext(FeatureConfigContext);
}
