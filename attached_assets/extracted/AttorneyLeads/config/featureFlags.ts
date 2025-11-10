/**
 * Feature Flags Configuration
 * 
 * Centralized feature toggle system for enabling/disabling features
 * without code changes. Useful for A/B testing, gradual rollouts, and
 * emergency kill switches.
 */

export interface FeatureFlagConfig {
  enabled: boolean;
  description: string;
  rolloutPercentage?: number; // 0-100, for gradual rollouts
  allowlist?: string[]; // User IDs or emails for early access
}

export const featureFlags = {
  /**
   * Core Features
   */
  scraping: {
    enabled: true,
    description: "Arrest record scraping via Python scraper",
  } as FeatureFlagConfig,

  aiEnrichment: {
    enabled: true,
    description: "OpenAI GPT-4o-mini charge classification and risk scoring",
  } as FeatureFlagConfig,

  leadScoring: {
    enabled: true,
    description: "Automated lead scoring (0-100 scale)",
  } as FeatureFlagConfig,

  deduplication: {
    enabled: true,
    description: "Fuzzy matching duplicate detection",
  } as FeatureFlagConfig,

  analytics: {
    enabled: true,
    description: "Analytics dashboard with Recharts visualizations",
  } as FeatureFlagConfig,

  /**
   * CRM Features
   */
  crmProspects: {
    enabled: true,
    description: "CRM prospect management",
  } as FeatureFlagConfig,

  phantombusterIntegration: {
    enabled: true,
    description: "PhantomBuster LinkedIn/Facebook prospect discovery",
  } as FeatureFlagConfig,

  calendlyIntegration: {
    enabled: true,
    description: "Calendly meeting scheduling",
  } as FeatureFlagConfig,

  googleSheetsIntegration: {
    enabled: true,
    description: "Google Sheets bi-directional sync",
  } as FeatureFlagConfig,

  /**
   * Export Features
   */
  csvExport: {
    enabled: true,
    description: "CSV export for arrest records",
  } as FeatureFlagConfig,

  jsonExport: {
    enabled: true,
    description: "JSON export for arrest records",
  } as FeatureFlagConfig,

  /**
   * Experimental Features (Beta)
   */
  scheduledScraping: {
    enabled: false,
    description: "[BETA] Automated scheduled scraping via cron",
    rolloutPercentage: 0,
  } as FeatureFlagConfig,

  automatedOutreach: {
    enabled: false,
    description: "[BETA] Automated email outreach sequences",
    rolloutPercentage: 0,
  } as FeatureFlagConfig,

  webhookSupport: {
    enabled: false,
    description: "[BETA] Webhook callbacks for job completion",
    rolloutPercentage: 0,
  } as FeatureFlagConfig,

  multiTenant: {
    enabled: false,
    description: "[BETA] Multi-tenant support for agencies",
    rolloutPercentage: 0,
  } as FeatureFlagConfig,
};

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(
  featureName: keyof typeof featureFlags,
  userId?: string
): boolean {
  const flag = featureFlags[featureName];
  
  if (!flag || !flag.enabled) {
    return false;
  }

  // If allowlist exists, check if user is in it
  if (flag.allowlist && userId) {
    return flag.allowlist.includes(userId);
  }

  // If rollout percentage is set, use it for gradual rollout
  if (flag.rolloutPercentage !== undefined) {
    if (flag.rolloutPercentage === 0) return false;
    if (flag.rolloutPercentage === 100) return true;
    
    // Use userId to determine if user is in rollout
    if (userId) {
      const hash = hashUserId(userId);
      return hash % 100 < flag.rolloutPercentage;
    }
    
    // No userId provided, default to disabled
    return false;
  }

  return true;
}

/**
 * Simple hash function for userId-based rollout
 */
function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures(): string[] {
  return Object.entries(featureFlags)
    .filter(([_, config]) => config.enabled)
    .map(([name, _]) => name);
}

/**
 * Get feature flag configuration
 */
export function getFeatureFlag(featureName: keyof typeof featureFlags): FeatureFlagConfig | undefined {
  return featureFlags[featureName];
}

/**
 * Example usage:
 * 
 * ```typescript
 * import { isFeatureEnabled } from '@/config/featureFlags';
 * 
 * if (isFeatureEnabled('aiEnrichment')) {
 *   await enhanceRecordsWithAI(records);
 * }
 * 
 * // With user-specific rollout
 * if (isFeatureEnabled('scheduledScraping', userId)) {
 *   showSchedulingUI();
 * }
 * ```
 */
