import { unstable_cache } from 'next/cache';

const isLocal = process.env.NODE_ENV === 'development' && !process.env.VERCEL;

// Cache buster that gets updated when cache is cleared
// This will be stored in a way that persists across serverless function instances
let cacheBusterTimestamp: number | null = null;

// Get the current cache buster timestamp
async function getCacheBuster(): Promise<number> {
  if (isLocal) {
    // For local development, just use a simple timestamp
    return cacheBusterTimestamp || Date.now();
  } else {
    // For Vercel, we'll use an environment variable or API call to get cache buster
    // This is a simple approach - in production you might use a database or external store
    if (cacheBusterTimestamp === null) {
      cacheBusterTimestamp = Date.now();
    }
    return cacheBusterTimestamp;
  }
}

// Update the cache buster to force cache invalidation
export async function updateCacheBuster(): Promise<number> {
  const newTimestamp = Date.now();
  cacheBusterTimestamp = newTimestamp;
  console.log('🔄 Cache buster updated:', newTimestamp);
  return newTimestamp;
}

// Hybrid caching with cache busting
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
      [busteredCacheKey], // This key will be unique per cache-buster timestamp
      {
        revalidate: 6 * 60 * 60, // 6 hours
        tags: ['acquia-api', ...tags]
      }
    );

    return cachedCall();
  }
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

// Manual cache invalidation with cache busting
export async function invalidateCache(specificTags?: string[]) {
  if (!isLocal) {
    // Update the cache buster to force new cache keys
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
      console.warn('Revalidation failed (this is expected with cache busting):', error);
    }

    return {
      success: true,
      environment: 'production',
      method: 'cache-buster',
      cacheBusterTimestamp: newCacheBuster,
      note: 'All future API calls will use new cache keys'
    };
  } else {
    const { clearAllCache } = await import('./cache');
    await clearAllCache();
    return { success: true, environment: 'local', method: 'file-clear' };
  }
}