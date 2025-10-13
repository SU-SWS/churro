import { unstable_cache } from 'next/cache';

// Cache buster that gets updated when cache is cleared
let cacheBusterTimestamp: number | null = null;

// Get the current cache buster timestamp
async function getCacheBuster(): Promise<number> {
  if (cacheBusterTimestamp === null) {
    cacheBusterTimestamp = Date.now();
  }
  return cacheBusterTimestamp;
}

// Update the cache buster to force cache invalidation
export async function updateCacheBuster(): Promise<number> {
  const newTimestamp = Date.now();
  cacheBusterTimestamp = newTimestamp;
  console.log('🔄 Cache buster updated:', newTimestamp);
  return newTimestamp;
}

// Simplified caching: use unstable_cache everywhere
export async function getCachedApiData<T>(
  apiCall: () => Promise<T>,
  cacheKey: string,
  tags: string[] = []
): Promise<T> {
  // Include cache buster in the cache key for invalidation support
  const cacheBuster = await getCacheBuster();
  const busteredCacheKey = `${cacheKey}_${cacheBuster}`;

  console.log(`📦 Using unstable_cache: ${busteredCacheKey}`);
  console.log(`🏷️ Cache tags: ${tags.join(', ')}`);
  console.log(`🔄 Cache buster: ${cacheBuster}`);

  const cachedCall = unstable_cache(
    async () => {
      console.log(`🔥 Cache MISS - executing API call: ${busteredCacheKey}`);
      return await apiCall();
    },
    [busteredCacheKey],
    {
      revalidate: 6 * 60 * 60, // 6 hours
      tags: ['acquia-api', ...tags]
    }
  );

  return cachedCall();
}

// Generate cache key (same as before)
export function generateApiCacheKey(endpoint: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((obj: Record<string, any>, key) => {
      obj[key] = params[key] ?? 'null';
      return obj;
    }, {});

  const keyComponents = [
    endpoint,
    sortedParams.subscriptionUuid || 'no-sub',
    sortedParams.from || 'no-from',
    sortedParams.to || 'no-to',
    sortedParams.resolution || 'no-res'
  ];

  const keyString = keyComponents.join('|');
  console.log(`🗝️ Cache key components: ${keyString}`);

  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(keyString).digest('hex').substring(0, 16);
  const readableKey = `${endpoint}_${hash}`;

  console.log(`🔑 Final cache key: ${readableKey}`);
  return readableKey;
}

// Simplified cache invalidation - cache buster only
export async function invalidateCache(specificTags?: string[]) {
  console.log('🗑️ Invalidating cache using cache-buster approach');

  // Update cache buster to force new cache keys
  const newCacheBuster = await updateCacheBuster();

  // Try revalidation APIs as backup (may help with some edge cases)
  try {
    const { revalidateTag, revalidatePath } = await import('next/cache');
    const tagsToInvalidate = specificTags || ['acquia-api', 'views', 'visits'];

    tagsToInvalidate.forEach(tag => {
      revalidateTag(tag);
      console.log(`🗑️ Revalidated tag: ${tag}`);
    });

    const pathsToRevalidate = ['/api/acquia/views', '/api/acquia/visits', '/api/acquia/applications'];
    pathsToRevalidate.forEach(path => {
      revalidatePath(path);
      console.log(`🗑️ Revalidated path: ${path}`);
    });
  } catch (error) {
    console.warn('Revalidation APIs failed (expected):', error);
  }

  return {
    success: true,
    environment: process.env.NODE_ENV || 'unknown',
    method: 'cache-buster',
    cacheBusterTimestamp: newCacheBuster
  };
}