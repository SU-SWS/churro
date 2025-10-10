import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const CACHE_DIR = path.join(process.cwd(), '.cache');
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

// Ensure cache directory exists
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore error
  }
}

// Generate a cache key from request parameters
function generateCacheKey(params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((obj: Record<string, any>, key) => {
      obj[key] = params[key];
      return obj;
    }, {});

  const paramString = JSON.stringify(sortedParams);
  return crypto.createHash('md5').update(paramString).digest('hex');
}

// Get cache file path
function getCacheFilePath(key: string): string {
  return path.join(CACHE_DIR, `${key}.json`);
}

// Check if cache is valid (not expired)
async function isCacheValid(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    const now = Date.now();
    const cacheTime = stats.mtime.getTime();
    return (now - cacheTime) < CACHE_TTL;
  } catch (error) {
    return false;
  }
}

// Get cached data if valid
export async function getCachedData<T>(cacheKey: string): Promise<T | null> {
  try {
    await ensureCacheDir();
    const filePath = getCacheFilePath(cacheKey);

    if (await isCacheValid(filePath)) {
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      console.log(`📦 Cache HIT for key: ${cacheKey}`);
      return parsed.data as T;
    } else {
      console.log(`❌ Cache MISS/EXPIRED for key: ${cacheKey}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Cache ERROR for key: ${cacheKey}`, error);
    return null;
  }
}

// Set cached data
export async function setCachedData<T>(cacheKey: string, data: T): Promise<void> {
  try {
    await ensureCacheDir();
    const filePath = getCacheFilePath(cacheKey);

    const cacheData = {
      data,
      timestamp: new Date().toISOString(),
      ttl: CACHE_TTL
    };

    await fs.writeFile(filePath, JSON.stringify(cacheData, null, 2));
    console.log(`💾 Cache SET for key: ${cacheKey}`);
  } catch (error) {
    console.error(`❌ Cache SET ERROR for key: ${cacheKey}`, error);
  }
}

// Generate cache key for API requests
export function generateApiCacheKey(endpoint: string, params: Record<string, any>): string {
  return generateCacheKey({ endpoint, ...params });
}

// Clear all cache files (useful for debugging)
export async function clearAllCache(): Promise<void> {
  try {
    const files = await fs.readdir(CACHE_DIR);
    await Promise.all(
      files.map(file => fs.unlink(path.join(CACHE_DIR, file)))
    );
    console.log('🗑️ All cache cleared');
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
  }
}