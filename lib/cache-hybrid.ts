import { unstable_cache } from 'next/cache';

const isLocal = process.env.NODE_ENV === 'development' && !process.env.VERCEL;

// Add a cache buster timestamp that gets updated when cache is cleared
let cacheBusterTimestamp = Date.now();

export function updateCacheBuster() {
  cacheBusterTimestamp = Date.now();
  console.log('🔄 Cache buster updated:', cacheBusterTimestamp);
}

// Hybrid caching: file cache for local development, unstable_cache for Vercel
export async function getCachedApiData<T>(
  apiCall: () => Promise<T>,
  cacheKey: string,
  tags: string[] = []
): Promise<T> {
  if (isLocal) {
    console.log(`🏠 Using file cache for local development: ${cacheKey}`);
    const { getCachedData, setCachedData } = await import('./cache');
    const cached = await getCachedData<T>(cacheKey);
    if (cached) return cached;

    console.log(`🔥 File cache MISS - executing API call: ${cacheKey}`);
    const result = await apiCall();
    await setCachedData(cacheKey, result);
    return result;
  } else {
    // Include cache buster in the cache key for Vercel
    const busteredCacheKey = `${cacheKey}_${cacheBusterTimestamp}`;
    console.log(`☁️ Using unstable_cache for Vercel: ${busteredCacheKey}`);
    console.log(`🏷️ Cache tags: ${tags.join(', ')}`);

    const cachedCall = unstable_cache(
      async () => {
        console.log(`🔥 unstable_cache MISS - executing API call: ${busteredCacheKey}`);
        return await apiCall();
      },
      [busteredCacheKey],
      {
        revalidate: 6 * 60 * 60,
        tags: ['acquia-api', ...tags]
      }
    );

    return cachedCall();
  }
}

// Generate cache key - FIXED to be more precise
export function generateApiCacheKey(endpoint: string, params: Record<string, any>): string {
  // Sort and normalize all parameters
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((obj: Record<string, any>, key) => {
      // Ensure all values are strings and handle null/undefined
      obj[key] = params[key] ?? 'null';
      return obj;
    }, {});

  // Create a more detailed cache key
  const keyComponents = [
    endpoint,
    sortedParams.subscriptionUuid || 'no-sub',
    sortedParams.from || 'no-from',
    sortedParams.to || 'no-to',
    sortedParams.resolution || 'no-res'
  ];

  // Join with a delimiter and create hash for consistent length
  const keyString = keyComponents.join('|');
  console.log(`🗝️ Cache key components: ${keyString}`);

  // Use a shorter, more readable cache key
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(keyString).digest('hex').substring(0, 16);
  const readableKey = `${endpoint}_${hash}`;

  console.log(`🔑 Final cache key: ${readableKey}`);
  return readableKey;
}

// Manual cache invalidation
export async function invalidateCache(specificTags?: string[]) {
  if (!isLocal) {
    // Update the cache buster to force new cache keys
    updateCacheBuster();

    // Still try the revalidation APIs in case they help
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
      console.warn('Revalidation failed:', error);
    }

    return {
      success: true,
      environment: 'production',
      method: 'cache-buster',
      cacheBusterTimestamp
    };
  } else {
    const { clearAllCache } = await import('./cache');
    await clearAllCache();
    return { success: true, environment: 'local', method: 'file-clear' };
  }
}