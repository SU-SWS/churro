import { unstable_cache } from 'next/cache';

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
    [cacheKey], // Remove cache buster from here
    {
      revalidate: 6 * 60 * 60, // 6 hours
      tags: ['acquia-api', ...tags] // These tags are what we'll use for invalidation
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

// Proper cache invalidation using revalidateTag
export async function invalidateCache(specificTags?: string[]) {
  console.log('🗑️ Invalidating cache using revalidateTag');

  try {
    const { revalidateTag, revalidatePath } = await import('next/cache');
    const tagsToInvalidate = specificTags || ['acquia-api', 'views', 'visits'];

    // Revalidate tags - this should work with unstable_cache
    tagsToInvalidate.forEach(tag => {
      revalidateTag(tag);
      console.log(`🗑️ Revalidated tag: ${tag}`);
    });

    // Also revalidate the API paths as backup
    const pathsToRevalidate = ['/api/acquia/views', '/api/acquia/visits', '/api/acquia/applications'];
    pathsToRevalidate.forEach(path => {
      revalidatePath(path);
      console.log(`🗑️ Revalidated path: ${path}`);
    });

    return {
      success: true,
      environment: process.env.NODE_ENV || 'unknown',
      method: 'revalidateTag',
      revalidatedTags: tagsToInvalidate,
      revalidatedPaths: pathsToRevalidate
    };
  } catch (error) {
    console.error('❌ Cache invalidation failed:', error);
    throw error;
  }
}