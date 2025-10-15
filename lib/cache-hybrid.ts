import { unstable_cache } from 'next/cache';

// Global cache buster that gets updated when cache is cleared
let globalCacheBuster: string | null = null;

// Update the global cache buster
export function updateGlobalCacheBuster(): string {
  globalCacheBuster = Date.now().toString();
  console.log('🔄 Global cache buster updated:', globalCacheBuster);
  return globalCacheBuster;
}

// Get the current cache buster (empty string if none set)
export function getGlobalCacheBuster(): string {
  return globalCacheBuster || '';
}

// CLIENT-SIDE: Get cache buster via API call
export async function getClientCacheBuster(): Promise<string> {
  try {
    const response = await fetch('/api/cache-buster');
    if (response.ok) {
      const data = await response.json();
      return data.cacheBuster || '';
    }
  } catch (error) {
    console.warn('Failed to get cache buster:', error);
  }
  return '';
}

// Simplified caching: use unstable_cache everywhere
export async function getCachedApiData<T>(
  apiCall: () => Promise<T>,
  cacheKey: string,
  tags: string[] = []
): Promise<T> {
  console.log(`📦 Using unstable_cache: ${cacheKey}`);
  console.log(`🏷️ Cache tags: ${tags.join(', ')}`);

  const cachedCall = unstable_cache(
    async () => {
      console.log(`🔥 Cache MISS - executing API call: ${cacheKey}`);
      return await apiCall();
    },
    [cacheKey],
    {
      revalidate: 6 * 60 * 60, // 6 hours
      tags: ['acquia-api', ...tags]
    }
  );

  return cachedCall();
}

// Generate cache key (same as before)
export function generateApiCacheKey(endpoint: string, params: Record<string, unknown>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((obj: Record<string, unknown>, key) => {
      obj[key] = params[key] ?? 'null';
      return obj;
    }, {});

  const keyComponents = [
    endpoint,
    sortedParams.subscriptionUuid || 'no-sub',
    sortedParams.from || 'no-from',
    sortedParams.to || 'no-to',
    sortedParams.resolution || 'no-res',
    sortedParams._cb || 'no-cb' // Include cache buster in key generation
  ];

  const keyString = keyComponents.join('|');
  console.log(`🗝️ Cache key components: ${keyString}`);

  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(keyString).digest('hex').substring(0, 16);
  const readableKey = `${endpoint}_${hash}`;

  console.log(`🔑 Final cache key: ${readableKey}`);
  return readableKey;
}

// Cache invalidation by updating global cache buster
export async function invalidateCache() {
  console.log('🗑️ Invalidating cache using global cache buster');

  const newCacheBuster = updateGlobalCacheBuster();

  return {
    success: true,
    environment: process.env.NODE_ENV || 'unknown',
    method: 'query-parameter-cache-bust',
    cacheBuster: newCacheBuster
  };
}