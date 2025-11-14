import { unstable_cache } from 'next/cache';

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL_MS = 5 * 60 * 1000;

// Cache buster that gets updated when cache is cleared
// This is stored in memory but we also use deployment ID to bust cache on deploy
let cacheBusterTimestamp: number | null = null;

// Get cache version based on deployment ID (changes with each deploy)
// This ensures cache is automatically invalidated on new deployments
function getCacheVersion(): string {
  // Use Vercel deployment ID if available, otherwise use a timestamp
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID ||
                       process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 8) ||
                       'local';
  return deploymentId;
}

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

// Check if cached data is still valid based on timestamp
function isCacheDataValid(cachedTimestamp: string): boolean {
  const now = Date.now();
  const cacheTime = new Date(cachedTimestamp).getTime();
  const age = now - cacheTime;
  const isValid = age < CACHE_TTL_MS;

  if (!isValid) {
    console.log(`⏰ Cache expired: age=${Math.round(age/1000)}s, ttl=${CACHE_TTL_MS/1000}s`);
  }

  return isValid;
}

// Hybrid caching: file cache for local development, unstable_cache for Vercel
export async function getCachedApiData<T>(
  apiCall: () => Promise<T>,
  cacheKey: string,
  tags: string[] = []
): Promise<T> {
  // Check environment at runtime, not module load time
  const isLocal = process.env.NODE_ENV === 'development' && !process.env.VERCEL_ENV;
  console.log(`🔍 getCachedApiData environment check: isLocal=${isLocal}, NODE_ENV=${process.env.NODE_ENV}, VERCEL_ENV=${process.env.VERCEL_ENV}`);

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
    // Include cache version (deployment ID) and cache buster in the cache key
    const cacheVersion = getCacheVersion();
    const cacheBuster = await getCacheBuster();
    const versionedCacheKey = `${cacheKey}_v${cacheVersion}_${cacheBuster}`;

    console.log(`☁️ Using unstable_cache for Vercel: ${versionedCacheKey}`);
    console.log(`🏷️ Cache tags: ${tags.join(', ')}`);
    console.log(`� Cache version (deployment): ${cacheVersion}`);
    console.log(`�🔄 Cache buster: ${cacheBuster}`);

    const cachedCall = unstable_cache(
      async () => {
        console.log(`🔥 unstable_cache MISS - executing API call: ${versionedCacheKey}`);
        const result = await apiCall();

        // Wrap the result with timestamp for validation
        return {
          data: result,
          cachedAt: new Date().toISOString(),
          cacheKey: versionedCacheKey
        };
      },
      [versionedCacheKey],
      {
        // Don't use revalidate as it doesn't work reliably on Vercel
        // Instead, we'll validate timestamps in application code
        tags: ['acquia-api', ...tags]
      }
    );

    const cachedResult = await cachedCall();

    // Validate cache age at application level
    if (!isCacheDataValid(cachedResult.cachedAt)) {
      console.log(`🔄 Cache data expired, fetching fresh data`);
      // Bust the cache by updating the timestamp and recursively calling
      await updateCacheBuster();
      // This will use a new cache key, forcing a fresh call
      return getCachedApiData(apiCall, cacheKey, tags);
    }

    console.log(`✅ Cache data valid, age: ${Math.round((Date.now() - new Date(cachedResult.cachedAt).getTime())/1000)}s`);
    return cachedResult.data;
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

// Manual cache invalidation - CHECK ENVIRONMENT AT RUNTIME
export async function invalidateCache(specificTags?: string[]) {
  // Check environment at runtime, not module load time
  const isLocal = process.env.NODE_ENV === 'development' && !process.env.VERCEL_ENV;
  const isVercel = !!process.env.VERCEL_ENV;

  console.log(`🔍 invalidateCache environment check (RUNTIME): isLocal=${isLocal}, isVercel=${isVercel}`);
  console.log(`🔍 Environment vars: NODE_ENV=${process.env.NODE_ENV}, VERCEL_ENV=${process.env.VERCEL_ENV}`);

  if (isLocal) {
    // Local - clear file cache
    console.log('🏠 Running LOCAL cache invalidation (file clear)');
    const { clearAllCache } = await import('./cache');
    await clearAllCache();
    return { success: true, environment: 'local', method: 'file-clear' };
  } else {
    // Vercel - update cache buster to force new cache keys
    console.log('☁️ Running VERCEL cache invalidation (cache buster)');
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