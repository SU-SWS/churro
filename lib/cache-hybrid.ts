import { unstable_cache } from 'next/cache';

// Fixed environment detection based on actual Vercel env vars
const isLocal = process.env.NODE_ENV === 'development' && !process.env.VERCEL_ENV;
const isVercel = !!process.env.VERCEL_ENV; // This is the reliable indicator

console.log('🔍 Cache-hybrid environment detection:', {
  isLocal,
  isVercel,
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV
});

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

// Hybrid caching: file cache for local development, unstable_cache for Vercel
export async function getCachedApiData<T>(
  apiCall: () => Promise<T>,
  cacheKey: string,
  tags: string[] = []
): Promise<T> {
  if (isLocal) {
    console.log(`🏠 Using file cache for local development: ${cacheKey}`);
    // Use your existing file cache for local development
    const { getCachedData, setCachedData } = await import('./cache');
    const cached = await getCachedData<T>(cacheKey);
    if (cached) return cached;

    console.log(`🔥 File cache MISS - executing API call: ${cacheKey}`);
    const result = await apiCall();
    await setCachedData(cacheKey, result);
    return result;
  } else {
    // Include cache buster in the cache key for Vercel
    const cacheBuster = await getCacheBuster();
    const busteredCacheKey = `${cacheKey}_${cacheBuster}`;
    console.log(`☁️ Using unstable_cache for Vercel: ${busteredCacheKey}`);
    console.log(`🏷️ Cache tags: ${tags.join(', ')}`);
    console.log(`🔄 Cache buster: ${cacheBuster}`);

    const cachedCall = unstable_cache(
      async () => {
        console.log(`🔥 unstable_cache MISS - executing API call: ${busteredCacheKey}`);
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
}

// Generate cache key (same as working version)
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

// Manual cache invalidation
export async function invalidateCache(specificTags?: string[]) {
  if (isLocal) {
    // Local - clear file cache
    const { clearAllCache } = await import('./cache');
    await clearAllCache();
    return { success: true, environment: 'local', method: 'file-clear' };
  } else {
    // Vercel - update cache buster to force new cache keys
    const newCacheBuster = await updateCacheBuster();

    // Still try the revalidation APIs as a backup
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
      console.warn('Revalidation APIs failed (expected with cache busting):', error);
    }

    return {
      success: true,
      environment: 'vercel',
      method: 'cache-buster',
      cacheBusterTimestamp: newCacheBuster
    };
  }
}