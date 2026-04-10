import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../../services/analytics/index.js';
import { isEnvTruthy } from '../envUtils.js';

export type APIProvider = 'firstParty' | 'bedrock' | 'vertex' | 'foundry' | 'custom';

export function getAPIProvider(): APIProvider {
  return isEnvTruthy(process.env.CLAUDE_CODE_USE_CUSTOM)
    ? 'custom'
    : isEnvTruthy(process.env.CLAUDE_CODE_USE_BEDROCK)
      ? 'bedrock'
      : isEnvTruthy(process.env.CLAUDE_CODE_USE_VERTEX)
        ? 'vertex'
        : isEnvTruthy(process.env.CLAUDE_CODE_USE_FOUNDRY)
          ? 'foundry'
          : 'firstParty';
}

export function getAPIProviderForStatsig(): AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS {
  return getAPIProvider() as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS;
}

/**
 * Check if ANTHROPIC_BASE_URL is a first-party Anthropic API URL.
 * Returns true if not set (default API) or points to api.anthropic.com
 * (or api-staging.anthropic.com for ant users).
 *
 * In custom mode, this always returns false since we're not using Anthropic's API.
 */
export function isFirstPartyAnthropicBaseUrl(): boolean {
  // Custom/OpenCode mode is never first-party
  if (isEnvTruthy(process.env.CLAUDE_CODE_USE_CUSTOM)) {
    return false;
  }

  const baseUrl = process.env.ANTHROPIC_BASE_URL;
  if (!baseUrl) {
    return true;
  }
  try {
    const host = new URL(baseUrl).host;
    const allowedHosts = ['api.anthropic.com'];
    if (process.env.USER_TYPE === 'ant') {
      allowedHosts.push('api-staging.anthropic.com');
    }
    return allowedHosts.includes(host);
  } catch {
    return false;
  }
}

/**
 * Check if we're in custom/OpenCode mode
 */
export function isCustomProvider(): boolean {
  return getAPIProvider() === 'custom';
}
