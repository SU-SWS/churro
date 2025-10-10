import { unstable_cache } from 'next/cache';

const isLocal = process.env.NODE_ENV === 'development' && !process.env.VERCEL;

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
    console.log(`☁️ Using unstable_cache for Vercel: ${cacheKey}`);
    // Use unstable_cache for Vercel
    const cachedCall = unstable_cache(
      async () => {
        console.log(`🔥 unstable_cache MISS - executing API call: ${cacheKey}`);
        return await apiCall();
      },
      [cacheKey], // Cache key array
      {
        revalidate: 6 * 60 * 60, // 6 hours in seconds
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

// Manual cache invalidation for Vercel (optional)
export async function invalidateCache(tags: string[] = ['acquia-api']) {
  if (!isLocal) {
    const { revalidateTag } = await import('next/cache');
    tags.forEach(tag => {
      console.log(`🗑️ Invalidating cache tag: ${tag}`);
      revalidateTag(tag);
    });
  } else {
    // Clear file cache in local development
    const { clearAllCache } = await import('./cache');
    await clearAllCache();
  }
}